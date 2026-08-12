// src/validation/zod/budgetValidators.js

// Budget validators – Zod schemas for API request validation.
// Validates query parameters, body, and URL parameters before reaching the controller.
// Frequencies are imported from budgetConfig.js (single source of truth).

import { z } from 'zod';
import {
 ALLOCATION_INTENTS,
 ALLOWED_ALLOCATION_FREQUENCIES,
 ALLOWED_WINDOW_FREQUENCIES,
 DEFAULT_ALLOCATION_INTENT,
} from '../../fintrack_api/services/budget_services/core/budgetConfig.js';

// Helper schemas
// Base fields reused across schemas
const dateField = z.coerce.date().optional();

// How wide a window the caller would like to read over. Optional, and never
// binding: a level that is not a whole multiple of a policy's period is
// answered over that policy's period instead, and meta.resolution says so. The
// enum still rejects a code the arithmetic does not know, which is a different
// mistake from asking for a width that does not fit.
const aggregationLevelField = z.enum(ALLOWED_WINDOW_FREQUENCIES).optional();

// Every schema in this file is strict.
//
// The reporting ones used to accept startDate/endDate and frequency, and zod's
// default is to strip an unknown key silently. Under that default a caller still
// sending a retired field would get a 200 computed over a period it never asked
// for, with nothing in the response saying so. Strict turns that into a 400
// naming the key.
//
// The write and params schemas follow for one reason each: a body carrying a
// misspelt intent must not fall through to the default, and a params object that
// Express did not build from the route is not a request this API understands.
//
// frequency is gone because the period is resolved from the frequency stored on
// the allocation in force, never from the request. A query locates a period; it
// does not get to size one.
//
// .strict() must precede .refine(): the refine returns a ZodEffects, which no
// longer exposes the method.

// Summary (single account)
/**
 * GET /budget/summary
 * Query: accountId (required), date, aggregationLevel
 */
export const summaryQuerySchema = z.object({
 accountId: z.coerce.number().positive({
  message: 'accountId must be a positive number',
 }),
 date: dateField,
 aggregationLevel: aggregationLevelField,
}).strict();

// Budget status of several accounts
/**
 * POST /budget/accounts/status
 * Body: accountIds (array, required), date, aggregationLevel
 */
export const budgetAccountsStatusBodySchema = z.object({
 accountIds: z.array(
  z.coerce.number().positive({
   message: 'each accountId must be a positive number',
  })
 ).min(1, {
  message: 'accountIds must contain at least one account',
 }),
 date: dateField,
 aggregationLevel: aggregationLevelField,
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

// Update policy (budget amount / frequency)
/**
 * PUT /budget/policy/:budgetPolicyId
 * Body: budgetAmount (required), budgetFrequencyCode (required), intent
 * Params: budgetPolicyId (positive integer)
 */
export const updatePolicyParamsSchema = z.object({
 budgetPolicyId: z.coerce.number().positive({
  message: 'budgetPolicyId must be a positive number',
 }),
}).strict();

// The code, not the surrogate id: it is self-describing, it is the key into
// MONTHS_PER_PERIOD, and z.enum rejects an unknown one here instead of letting
// a foreign-key violation surface as a 500.
export const updatePolicyBodySchema = z.object({
 budgetAmount: z.number().positive({
  message: 'budgetAmount must be a positive number',
 }),
 budgetFrequencyCode: z.enum(ALLOWED_ALLOCATION_FREQUENCIES),
 // Optional so a caller written before the field existed keeps working. The
 // default is the conservative one: it only ever opens the next period.
 intent: z.enum(ALLOCATION_INTENTS).default(DEFAULT_ALLOCATION_INTENT),
})
// Strict because of intent above. A misspelt key is stripped, the default
// applies, and a caller asking to correct a version silently supersedes it
// instead: two rows in history where one was meant, and no error anywhere.
.strict();

// History (versions)
/**
 * GET /budget/history/:budgetPolicyId
 * Params: budgetPolicyId (positive integer)
 */
export const historyParamsSchema = z.object({
 budgetPolicyId: z.coerce.number().positive({
  message: 'budgetPolicyId must be a positive number',
 }),
}).strict();

// Export CSV
/**
 * GET /budget/export
 * Query: accountId (optional), date, aggregationLevel
 * Same as summaryQuerySchema but accountId is optional.
 */
export const exportQuerySchema = z.object({
 accountId: z.coerce.number().positive({
  message: 'accountId must be a positive number',
 }).optional(),
 date: dateField,
 aggregationLevel: aggregationLevelField,
}).strict();