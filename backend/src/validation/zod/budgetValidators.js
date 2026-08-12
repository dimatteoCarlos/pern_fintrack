// src/validation/zod/budgetValidators.js

// Budget validators – Zod schemas for API request validation.
// Validates query parameters, body and URL parameters before reaching the
// controller.

import { z } from 'zod';

// Every schema in this file is strict.
//
// Zod's default is to strip an unknown key silently. Under that default a caller
// still sending a retired field — date, aggregationLevel, budgetFrequencyCode,
// intent — would get a 200 computed over something it never asked for, with
// nothing in the response saying so. Strict turns that into a 400 naming the key,
// which is what a frontend mid-migration needs to hear.
//
// No schema accepts a date or a period. The month is resolved server-side on the
// account owner's calendar, and only the current one is writable: a month in the
// request would be clock skew, the device zone, or a month the rules forbid.

/**
 * POST /budget/accounts/status
 * Body: accountIds (array, required)
 */
export const budgetAccountsStatusBodySchema = z.object({
 accountIds: z.array(
  z.coerce.number().positive({
   message: 'each accountId must be a positive number',
  })
 ).min(1, {
  message: 'accountIds must contain at least one account',
 }),
})
.strict()
.refine(
 (data) => {
  const uniqueIds = new Set(data.accountIds);
  return data.accountIds.length === uniqueIds.size;
 },
 {
  message: 'accountIds must contain unique values',
  path: ['accountIds'],
 }
);

/**
 * PUT /budget/accounts/:accountId/current
 * Params: accountId (positive integer)
 */
export const currentBudgetParamsSchema = z.object({
 accountId: z.coerce.number().positive({
  message: 'accountId must be a positive number',
 }),
}).strict();

/**
 * PUT /budget/accounts/:accountId/current
 * Body: amount (required, >= 0), onlyThisMonth
 */
export const currentBudgetBodySchema = z.object({
 // Zero is accepted here, unlike the old positive-only rule: it is how "stop
 // budgeting" is expressed, and an absent row terminates nothing under
 // carry-forward. The service still rejects a sub-cent amount, which would
 // store as 0 and mean a decision the user did not take.
 amount: z.number().nonnegative({
  message: 'amount must be zero or a positive number',
 }),
 // Optional because the recurring case is the normal one and has no name in the
 // payload. Defaulting to false is the conservative branch: it writes no
 // terminator, so nothing the user did not ask for expires.
 onlyThisMonth: z.boolean().default(false),
}).strict();

/**
 * GET /budget/export
 * Query: accountId (optional — omitted exports every budget account owned)
 */
export const exportQuerySchema = z.object({
 accountId: z.coerce.number().positive({
  message: 'accountId must be a positive number',
 }).optional(),
}).strict();
