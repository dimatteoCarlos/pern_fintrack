// src/validation/zod/budgetValidators.js

// Budget validators – Zod schemas for API request validation.
// Validates query parameters, body, and URL parameters before reaching the controller.
// Frequencies are imported from budgetConfig.js (single source of truth).

import { z } from 'zod';
import { ALLOWED_FREQUENCIES } from '../../fintrack_api/services/budget_services/core/budgetConfig.js';

// Helper schemas
// Base fields reused across schemas
const frequencyField = z.enum(ALLOWED_FREQUENCIES).default('monthly');
const dateField = z.coerce.date().optional();
const startDateField = z.coerce.date().optional();
const endDateField = z.coerce.date().optional();

// Summary (single account)
/**
 * GET /budget/summary
 * Query: accountId (required), frequency, date, startDate, endDate
 */
export const summaryQuerySchema = z.object({
 accountId: z.coerce.number().positive({
  message: 'accountId must be a positive number',
 }),
 frequency: frequencyField,
 date: dateField,
 startDate: startDateField,
 endDate: endDateField,
})
.refine(
 (data) => {
  if (data.startDate && data.endDate) {
   return data.startDate <= data.endDate;
  }
  return true;
 },
 {
  message: 'startDate must be before or equal to endDate',
  path: ['startDate'],
 }
);

// Multi‑summary (multiple accounts)
/**
 * POST /budget/multi-summary
 * Body: accountIds (array, required), frequency, date, startDate, endDate
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
 startDate: startDateField,
 endDate: endDateField,
})
.refine(
 (data) => {
  if (data.startDate && data.endDate) {
   return data.startDate <= data.endDate;
  }
  return true;
 },
 {
  message: 'startDate must be before or equal to endDate',
  path: ['startDate'],
 }
)
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
 * Body: budgetAmount (required), budgetFrequencyTypeId (required)
 * Params: budgetPolicyId (positive integer)
 */
export const updatePolicyParamsSchema = z.object({
 budgetPolicyId: z.coerce.number().positive({
  message: 'budgetPolicyId must be a positive number',
 }),
});

export const updatePolicyBodySchema = z.object({
 budgetAmount: z.number().positive({
  message: 'budgetAmount must be a positive number',
 }),
 budgetFrequencyTypeId: z.coerce.number().positive({
  message: 'budgetFrequencyTypeId must be a positive number',
 }),
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
 * Query: accountId (optional), frequency, date, startDate, endDate
 * Same as summaryQuerySchema but accountId is optional.
 */
export const exportQuerySchema = z.object({
 accountId: z.coerce.number().positive({
  message: 'accountId must be a positive number',
 }).optional(),
 frequency: frequencyField,
 date: dateField,
 startDate: startDateField,
 endDate: endDateField,
})
.refine(
 (data) => {
  if (data.startDate && data.endDate) {
   return data.startDate <= data.endDate;
  }
  return true;
 },
 {
  message: 'startDate must be before or equal to endDate',
  path: ['startDate'],
 }
);