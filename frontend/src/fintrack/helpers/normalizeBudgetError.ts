// frontend/src/fintrack/helpers/normalizeBudgetError.ts
// Keeps the §7.5 envelope whole instead of flattening it to a sentence.
//
// normalizeError returns { message, status }, which for a 400 is the constant
// 'Validation Error' — the module's controller puts the useful half in errors[],
// one entry per issue with the field it names. A form that shows the offending
// field needs that array, so this is the reader the budget screens use and
// normalizeError stays for everything that only has a sentence to show.

import { BudgetErrorIssue, BudgetErrorResponse } from '../types/budgetTypes.ts';

const isIssue = (value: unknown): value is BudgetErrorIssue =>
 typeof value === 'object' &&
 value !== null &&
 typeof (value as BudgetErrorIssue).field === 'string' &&
 typeof (value as BudgetErrorIssue).message === 'string';

export const normalizeBudgetError = (error: unknown): BudgetErrorResponse => {
 const body =
  typeof error === 'object' && error !== null && 'response' in error
   ? (error as { response?: { data?: Partial<BudgetErrorResponse> } }).response
      ?.data
   : undefined;

 // A rejected request that never reached the server has no envelope: no status
 // to report and no field to blame, so it keeps its own sentence.
 if (!body) {
  return {
   status: 0,
   message:
    error instanceof Error ? error.message : 'The budget could not be saved.',
  };
 }

 return {
  status: typeof body.status === 'number' ? body.status : 500,
  message: body.message ?? 'The budget could not be saved.',
  errors: Array.isArray(body.errors) ? body.errors.filter(isIssue) : undefined,
 };
};
