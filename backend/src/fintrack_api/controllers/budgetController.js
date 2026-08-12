// src/fintrack_api/controllers/budgetController.js

// Budget Controller – HTTP request handlers for the Budget module.
// Validates requests using Zod schemas from budgetValidators.js, calls services,
// and returns JSON or CSV.
//
// No handler accepts a date. The month is resolved inside the query, on the
// account owner's calendar, so a request cannot name a month at all.

import {
 budgetAccountsStatusBodySchema,
 currentBudgetParamsSchema,
 currentBudgetBodySchema,
 exportQuerySchema,
} from '../../validation/zod/budgetValidators.js';

import { budgetCalculationService } from '../services/budget_services/services/budgetCalculationService.js';
import { budgetAllocationService } from '../services/budget_services/services/budgetAllocationService.js';
import { pool } from '../../db/config/configDB.js';
import { getAccountsByType } from '../../utils/fintrackUtils/accountDataRetrieval/accountUtils.js';
import { convertAccountsStatusToCSV } from '../../utils/fintrackUtils/exportUtils.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';

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

/**
 * Answer a failed validation with the issues that caused it.
 *
 * Zod 4 renamed the issue list: ZodError.errors no longer exists, and reading it
 * yielded undefined, which JSON.stringify drops from the payload. Every 400 this
 * module returned carried an empty body, telling the caller the request failed
 * but never which field. The shape matches the one validateRequest.js already
 * defines for the auth module.
 */
const respondWithZodIssues = (res, error) =>
 res.status(400).json({
  status: 400,
  message: 'Validation Error',
  errors: error.issues.map((issue) => ({
   field: issue.path.join('.'),
   message: issue.message,
   code: issue.code,
  })),
 });

/** POST /api/fintrack/budget/accounts/status */
export async function getBudgetAccountsStatus(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { accountIds } = budgetAccountsStatusBodySchema.parse(req.body);

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

  // Resolved here, not inside the service: the zone is fetched once per request
  // and the service receives it, rather than going to the users table itself.
  const timeZone = await getUserTimeZone(pool, userId);

  const response = await budgetCalculationService.getBudgetAccountsStatus(
   pool,
   accountIds,
   timeZone
  );

  res.status(200).json(response);
 } catch (error) {
  if (error.name === 'ZodError') {
   return respondWithZodIssues(res, error);
  }
  next(error);
 }
}

/** PUT /api/fintrack/budget/accounts/:accountId/current */
export async function setCurrentBudget(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { accountId } = currentBudgetParamsSchema.parse(req.params);
  const { amount, onlyThisMonth } = currentBudgetBodySchema.parse(req.body);

  // Ownership is enforced inside the service, in the same transaction as the
  // write. Checking it here instead would leave a window between the check and
  // the update.
  const timeZone = await getUserTimeZone(pool, userId);

  const result = await budgetAllocationService.setCurrentMonthBudget(
   pool,
   userId,
   accountId,
   amount,
   onlyThisMonth,
   timeZone
  );

  res.status(200).json(result);
 } catch (error) {
  if (error.name === 'ZodError') {
   return respondWithZodIssues(res, error);
  }
  // The service raises 400 and 403 with a status already attached; anything
  // without one is unexpected and belongs to the error handler.
  if (error.status) {
   return res.status(error.status).json({ status: error.status, message: error.message });
  }
  next(error);
 }
}

/** GET /api/fintrack/budget/export */
export async function exportCSV(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { accountId } = exportQuerySchema.parse(req.query);

  const owned = await getOwnedBudgetAccounts(userId);

  if (accountId && !owned.has(accountId)) {
   return res.status(403).json({
    status: 403,
    message: 'Account not found or not owned by the authenticated user.',
   });
  }

  if (owned.size === 0) {
   return res.status(200).send('No budget accounts found');
  }

  const accountIds = accountId ? [accountId] : [...owned.keys()];
  const timeZone = await getUserTimeZone(pool, userId);

  const { referenceMonth, accounts } = await budgetCalculationService.getBudgetAccountsStatus(
   pool,
   accountIds,
   timeZone
  );

  // The read returns unbudgeted accounts too, so the screen can show them as
  // such. A CSV has no room for that distinction: the row would be a line of
  // zeros indistinguishable from a budget that was never spent. Exporting only
  // budgeted accounts keeps the file meaning what it did.
  const csv = convertAccountsStatusToCSV(accounts.filter((r) => r.isBudgeted), referenceMonth);

  // The month the data is about, not the day it was downloaded. Two exports of
  // August taken on different days are the same file and should be named alike.
  const filename = `budget_export_${referenceMonth}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
 } catch (error) {
  if (error.name === 'ZodError') {
   return respondWithZodIssues(res, error);
  }
  next(error);
 }
}
