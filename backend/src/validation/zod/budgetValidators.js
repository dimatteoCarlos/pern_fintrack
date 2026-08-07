// src/validation/zod/budgetValidators.js

// Budget validators – Zod schemas for API request validation.
// Validates query parameters, body, and URL parameters before reaching the controller.
// Frequencies are imported from budgetConfig.js (single source of truth).

import { z } from 'zod';
import {
 ALLOWED_WINDOW_FREQUENCIES,
 ALLOWED_ALLOCATION_FREQUENCIES,
} from '../../fintrack_api/services/budget_services/core/budgetConfig.js';

// Helper schemas
// Base fields reused across schemas
// The query window, not the stored allocation: reporting on a quarter is
// allowed even though only monthly budgets may be created.
const frequencyField = z.enum(ALLOWED_WINDOW_FREQUENCIES).default('monthly');
const dateField = z.coerce.date().optional();

// The three reporting schemas below are strict.
//
// They used to accept startDate/endDate, and zod's default is to strip an
// unknown key silently. Under that default a caller still sending the retired
// pair would get a 200 computed over a period it never asked for, with nothing
// in the response saying so. Strict turns that into a 400 naming the key.
//
// .strict() must precede .refine(): the refine returns a ZodEffects, which no
// longer exposes the method.

// Summary (single account)
/**
 * GET /budget/summary
 * Query: accountId (required), frequency, date
 */
export const summaryQuerySchema = z.object({
 accountId: z.coerce.number().positive({
  message: 'accountId must be a positive number',
 }),
 frequency: frequencyField,
 date: dateField,
}).strict();

// Multi‑summary (multiple accounts)
/**
 * POST /budget/multi-summary
 * Body: accountIds (array, required), frequency, date
 */
export const multiSummaryBodySchema = z.object({
 accountIds: z.array(
  z.coerce.number().positive({
   message: 'each accountId must be a positive number',
  })
 ).min(1, {
  message: 'accountIds must contain at least one account',
 }),
 frequency: frequencyField,
 date: dateField,
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
 * Body: budgetAmount (required), budgetFrequencyCode (required)
 * Params: budgetPolicyId (positive integer)
 */
export const updatePolicyParamsSchema = z.object({
 budgetPolicyId: z.coerce.number().positive({
  message: 'budgetPolicyId must be a positive number',
 }),
});

// The code, not the surrogate id: it is self-describing, it is the key into
// MONTHS_PER_PERIOD, and z.enum rejects an unknown one here instead of letting
// a foreign-key violation surface as a 500.
export const updatePolicyBodySchema = z.object({
 budgetAmount: z.number().positive({
  message: 'budgetAmount must be a positive number',
 }),
 budgetFrequencyCode: z.enum(ALLOWED_ALLOCATION_FREQUENCIES),
});

// History (versions)
/**
 * GET /budget/history/:budgetPolicyId
 * Params: budgetPolicyId (positive integer)
 */
export const historyParamsSchema = z.object({
 budgetPolicyId: z.coerce.number().positive({
  message: 'budgetPolicyId must be a positive number',
 }),
});

// Export CSV
/**
 * GET /budget/export
 * Query: accountId (optional), frequency, date
 * Same as summaryQuerySchema but accountId is optional.
 */
export const exportQuerySchema = z.object({
 accountId: z.coerce.number().positive({
  message: 'accountId must be a positive number',
 }).optional(),
 frequency: frequencyField,
 date: dateField,
}).strict();