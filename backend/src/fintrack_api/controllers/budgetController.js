// src/fintrack_api/controllers/budgetController.js

// Budget Controller – HTTP request handlers for the Budget module.
// Validates requests using Zod schemas from budgetValidators.js.
// Calls services and returns JSON or CSV responses.
// All dates are handled in UTC to avoid timezone drift.

import {
 summaryQuerySchema,
 multiSummaryBodySchema,
 updatePolicyParamsSchema,
 updatePolicyBodySchema,
 historyParamsSchema,
 exportQuerySchema,
} from '../../validation/zod/budgetValidators.js';

import { budgetCalculationService } from '../services/budget_services/services/budgetCalculationService.js';
import { budgetPolicyService } from '../services/budget_services/services/budgetPolicyService.js';
import { pool } from '../../db/config/configDB.js';
import { getAccountsByType } from '../../utils/fintrackUtils/accountDataRetrieval/accountUtils.js';
import { convertBudgetResultsToCSV } from '../../utils/fintrackUtils/exportUtils.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';

/**
 * Return the caller's category_budget accounts, keyed by id.
 *
 * Every handler that receives an accountId from the client must check it
 * against this set. verifyToken proves who the caller is; it proves nothing
 * about which accounts they may read. Without this, passing another user's
 * accountId returns that user's budget — the same hole A2 closed elsewhere.
 */
const getOwnedBudgetAccounts = async (userId) => {
 const accounts = await getAccountsByType(userId, 'category_budget');
 return new Map(accounts.map((a) => [a.accountId, a]));
};

// ============================================================
// GET /budget/summary
// ============================================================
export async function getSummary(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const validated = summaryQuerySchema.parse(req.query);
  const { accountId, frequency, date, startDate, endDate } = validated;

  const owned = await getOwnedBudgetAccounts(userId);
  if (accountId && !owned.has(accountId)) {
   return res.status(403).json({
    status: 403,
    message: 'Account not found or not owned by the authenticated user.',
   });
  }

  const result = await budgetCalculationService.getSummary(
   pool,
   accountId,
   frequency,
   date || new Date(),
   { startDate, endDate }
  );

  res.status(200).json(result);
 } catch (error) {
  if (error.name === 'ZodError') {
   return res.status(400).json({ errors: error.errors });
  }
  next(error);
 }
}

// ============================================================
// POST /budget/multi-summary
// ============================================================
export async function getMultiSummary(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const validated = multiSummaryBodySchema.parse(req.body);
  const { accountIds, frequency, date, startDate, endDate } = validated;

  // Check EVERY element. Validating only the first would let a caller hide
  // foreign ids behind one of their own.
  const owned = await getOwnedBudgetAccounts(userId);
  const foreign = accountIds.filter((id) => !owned.has(id));
  if (foreign.length > 0) {
   return res.status(403).json({
    status: 403,
    message: `${foreign.length} account(s) not found or not owned by the authenticated user.`,
   });
  }

  const result = await budgetCalculationService.getMultiSummary(
   pool,
   accountIds,
   frequency,
   date || new Date(),
   { startDate, endDate }
  );

  res.status(200).json(result);
 } catch (error) {
  if (error.name === 'ZodError') {
   return res.status(400).json({ errors: error.errors });
  }
  next(error);
 }
}

// ============================================================
// PUT /budget/policy/:budgetPolicyId
// ============================================================
export async function updatePolicy(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const params = updatePolicyParamsSchema.parse(req.params);
  const body = updatePolicyBodySchema.parse(req.body);
  const { budgetPolicyId } = params;
  const { budgetAmount, budgetFrequencyTypeId } = body;

  // Ownership is enforced inside the service, in the same transaction as the
  // write. Checking it here instead would leave a window between the check
  // and the update.
  const result = await budgetPolicyService.updateBudgetAllocation(
   pool,
   userId,
   budgetPolicyId,
   budgetAmount,
   budgetFrequencyTypeId
  );

  res.status(200).json(result);
 } catch (error) {
  if (error.name === 'ZodError') {
   return res.status(400).json({ errors: error.errors });
  }
  next(error);
 }
}

// ============================================================
// GET /budget/history/:budgetPolicyId
// ============================================================
export async function getHistory(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const params = historyParamsSchema.parse(req.params);
  const { budgetPolicyId } = params;

  const history = await budgetPolicyService.getBudgetAllocationHistory(
   pool,
   userId,
   budgetPolicyId
  );

  res.status(200).json(history);
 } catch (error) {
  if (error.name === 'ZodError') {
   return res.status(400).json({ errors: error.errors });
  }
  next(error);
 }
}

// ============================================================
// GET /budget/export
// ============================================================
export async function exportCSV(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const validated = exportQuerySchema.parse(req.query);
  const { accountId, frequency, date, startDate, endDate } = validated;

  let results;
  const accountNamesMap = new Map();
  const owned = await getOwnedBudgetAccounts(userId);

  if (accountId) {
   // Single account
   if (!owned.has(accountId)) {
    return res.status(403).json({
     status: 403,
     message: 'Account not found or not owned by the authenticated user.',
    });
   }

   const { result } = await budgetCalculationService.getSummary(
    pool,
    accountId,
    frequency,
    date || new Date(),
    { startDate, endDate }
   );
   results = [result];
   accountNamesMap.set(accountId, owned.get(accountId).accountName);
  } else {
   // All accounts owned by the caller
   if (owned.size === 0) {
    return res.status(200).send('No budget accounts found');
   }
   const accountIds = [...owned.keys()];
   owned.forEach((a, id) => {
    accountNamesMap.set(id, a.accountName);
   });

   const { results: multiResults } = await budgetCalculationService.getMultiSummary(
    pool,
    accountIds,
    frequency,
    date || new Date(),
    { startDate, endDate }
   );
   results = multiResults;
  }

  const dateStr = new Date().toISOString().split('T')[0];

  // CSV is the only export format. The XLSX branch that lived here was
  // unreachable — exportQuerySchema declares no `format` field and zod strips
  // unknown keys, so `format` was always undefined. It also imported xlsx at
  // module scope, which would have failed the whole router's load once the
  // package was uninstalled (prototype pollution / ReDoS advisories, no fix
  // published on npm).
  const csv = convertBudgetResultsToCSV(results, accountNamesMap);
  const filename = `budget_export_${dateStr}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
 } catch (error) {
  if (error.name === 'ZodError') {
   return res.status(400).json({ errors: error.errors });
  }
  next(error);
 }
}