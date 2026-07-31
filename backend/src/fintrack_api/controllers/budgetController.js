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
import { getAccountsByType } from '../services/fintrackUtils/accountUtils.js';
import { convertBudgetResultsToCSV } from '../services/fintrackUtils/exportUtils.js';

// ============================================================
// GET /budget/summary
// ============================================================
export async function getSummary(req, res, next) {
 try {
  const validated = summaryQuerySchema.parse(req.query);
  const { accountId, frequency, date, startDate, endDate } = validated;

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
  const validated = multiSummaryBodySchema.parse(req.body);
  const { accountIds, frequency, date, startDate, endDate } = validated;

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
  const params = updatePolicyParamsSchema.parse(req.params);
  const body = updatePolicyBodySchema.parse(req.body);
  const { budgetPolicyId } = params;
  const { budgetAmount, budgetFrequencyTypeId } = body;

  const result = await budgetPolicyService.updateBudgetAllocation(
   pool,
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
  const params = historyParamsSchema.parse(req.params);
  const { budgetPolicyId } = params;

  const history = await budgetPolicyService.getBudgetAllocationHistory(
   pool,
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
  const validated = exportQuerySchema.parse(req.query);
  const { accountId, frequency, date, startDate, endDate } = validated;

  let results;
  const accountNamesMap = new Map();

  if (accountId) {
   // Single account
   const { result } = await budgetCalculationService.getSummary(
    pool,
    accountId,
    frequency,
    date || new Date(),
    { startDate, endDate }
   );
   results = [result];
   const accounts = await getAccountsByType(req.user.userId, 'category_budget');
   const account = accounts.find(a => a.accountId === accountId);
   if (account) {
    accountNamesMap.set(accountId, account.accountName);
   }
  } else {
   // All user accounts
   const accounts = await getAccountsByType(req.user.userId, 'category_budget');
   if (accounts.length === 0) {
    return res.status(200).send('No budget accounts found');
   }
   const accountIds = accounts.map(a => a.accountId);
   accounts.forEach(a => {
    accountNamesMap.set(a.accountId, a.accountName);
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