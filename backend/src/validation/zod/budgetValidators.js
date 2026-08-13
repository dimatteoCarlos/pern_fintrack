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
 * Body: accountIds (array, optional — omitted means every budget account owned)
 */
export const budgetAccountsStatusBodySchema = z.object({
 // Optional, and the omission carries meaning: no key at all asks for every
 // budget account the caller owns, resolved server-side from the ownership set
 // the controller already builds. min(1) survives for the case where the key IS
 // present, so an explicit [] stays a 400 — "all of them" and "none of them"
 // must not collapse into the same request.
 accountIds: z.array(
  z.coerce.number().positive({
   message: 'each accountId must be a positive number',
  })
 ).min(1, {
  message: 'accountIds must contain at least one account',
 }).optional(),
})
.strict()
.refine(
 (data) => {
  if (!data.accountIds) return true;
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

// A historical bound, coerced to the first of its month.
//
// This is the one place a date DOES travel, and the rule above still holds: the
// current month is never sent, but the server cannot guess which twelve months
// the user is looking at.
//
// Coerced by truncating the text, never by constructing a Date. A Date parsed
// from 'YYYY-MM-DD' is UTC midnight, and reading it back through a local getter
// can land on the previous month — the zone bug §4.5 removed from the queries,
// re-entering through the validator. Truncation has no zone to lose.
//
// The day is accepted and discarded, so 2026-08-17 and 2026-08-01 are the same
// request. It is not range-checked: 2026-02-31 would be rejected as a date and
// is meaningless as a month, since the day is thrown away either way.
//
// What this schema deliberately does NOT check is the relationship between the
// bounds, or between a bound and today. from <= to, to <= current month and the
// 60-month span are 422s raised by the service: the current month is a query on
// the owner's calendar, and a schema cannot see it.
const monthBound = z
 .string()
 .regex(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/, {
  message: 'must be a month as YYYY-MM or a date as YYYY-MM-DD',
 })
 .transform((value) => `${value.slice(0, 7)}-01`);

/**
 * GET /budget/accounts/:accountId/series
 * Params: accountId (positive integer)
 */
export const seriesParamsSchema = z.object({
 accountId: z.coerce.number().positive({
  message: 'accountId must be a positive number',
 }),
}).strict();

/**
 * GET /budget/accounts/:accountId/series
 * Query: from, to (both optional — defaults resolve to the last 12 months)
 */
export const seriesQuerySchema = z.object({
 from: monthBound.optional(),
 to: monthBound.optional(),
}).strict();

/**
 * GET /budget/export
 * Query: accountId, from, to — all optional.
 *
 * accountId omitted exports every budget account owned; from/to omitted collapse
 * the range to the current month, which is what the endpoint did before it
 * accepted a range. A default of twelve months here would change the meaning of
 * a request that already works.
 */
export const exportQuerySchema = z.object({
 accountId: z.coerce.number().positive({
  message: 'accountId must be a positive number',
 }).optional(),
 from: monthBound.optional(),
 to: monthBound.optional(),
}).strict();
