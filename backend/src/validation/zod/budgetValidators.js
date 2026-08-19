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
// No schema accepts a period. Months do travel, on reads and on writes alike:
// the server cannot guess which month the user is looking at, and a write that
// could only ever land on today would have no way to correct a past one. What no
// schema checks is whether a month is ALLOWED — later than today, earlier than
// the account, or an end before its start are 422s the service raises, because
// each of them is a relationship with a row or a calendar.

// The shape a month arrives in, shared by the two bounds below so they cannot
// drift apart. No global flag, so .test() carries no state between calls.
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/;

// A historical bound, coerced to the first of its month.
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
 .regex(MONTH_PATTERN, {
  message: 'must be a month as YYYY-MM or a date as YYYY-MM-DD',
 })
 .transform((value) => `${value.slice(0, 7)}-01`);

// The value appliesUntil takes when the amount is meant to keep recurring with
// no end. Exported because the service has to recognise it: it is the one value
// of that field which is not a month, and a second copy of the literal is a
// second thing to keep in step with this one.
export const OPEN_ENDED = 'openEnded';

// The upper bound of a write: a month, or the sentinel for "no end".
//
// A refine over the same pattern rather than a union of the two, so a wrong
// value gets one message naming both forms instead of the nested list a failed
// union reports.
const appliesUntilBound = z
 .string()
 .refine((value) => value === OPEN_ENDED || MONTH_PATTERN.test(value), {
  message: `must be '${OPEN_ENDED}' or a month as YYYY-MM`,
 })
 .transform((value) =>
  value === OPEN_ENDED ? OPEN_ENDED : `${value.slice(0, 7)}-01`,
 );

/**
 * POST /budget/accounts/status
 * Body: accountIds (array, optional — omitted means every budget account owned)
 *       month (optional — omitted means the current month on the owner's calendar)
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
 // Optional, and the omission means the current month. Present, it must not be
 // later than that — a 422 the service raises, since the schema cannot see the
 // owner's calendar.
 month: monthBound.optional(),
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
 * Body: amount (required, >= 0), month, appliesUntil
 */
export const currentBudgetBodySchema = z.object({
 // Zero is accepted here, unlike the old positive-only rule: it is how "stop
 // budgeting" is expressed, and an absent row terminates nothing under
 // carry-forward. The service still rejects a sub-cent amount, which would
 // store as 0 and mean a decision the user did not take.
 amount: z.number().nonnegative({
  message: 'amount must be zero or a positive number',
 }),
 // The month the amount comes into force. Required, with no default: the screen
 // always knows which month it is showing, and a default would quietly write
 // somewhere else on the day the field went missing.
 month: monthBound,
 // The last month it stays in force. Equal to month writes one month; a later
 // one writes a closed range; OPEN_ENDED leaves it recurring. Required for the
 // same reason as month, and more sharply: every default here destroys something
 // in one direction or the other — OPEN_ENDED erases the decisions that follow,
 // and month alone expires an amount the user meant to keep.
 appliesUntil: appliesUntilBound,
}).strict();

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
