// src/fintrack_api/services/budget_services/core/assertBudgetFigures.js

// The invariants every budget figure obeys, whatever it is a figure ABOUT.
//
// Two factories build budget objects — one per account for a month
// (makeBudgetAccountStatus), one per month for an account (makeBudgetMonthStatus)
// — and they differ only in identity fields. The rules below are the same in
// both, and duplicating them is how the two drift: the day a rule changes in one
// factory and not the other, the same account reports one thing on the card and
// another on the chart, and nothing fails.
//
// Identity stays with each factory. Only the arithmetic invariants live here.

import { isFiniteMoney, toAmount } from './money.js';

/**
 * Reject a set of budget figures that cannot be true together.
 *
 * @param {string} label - factory name, so the message says which shape failed
 * @param {object} flags - { isBudgeted, isOverBudget, executionPercentage }
 * @param {object} amounts - every monetary field, keyed by name. budgetAmount is
 *  required: the coherence rule below is stated in terms of it
 */
export function assertBudgetFigures(label, flags, amounts) {
 const { isBudgeted, isOverBudget, executionPercentage } = flags;

 if (typeof isBudgeted !== 'boolean') {
  throw new Error(`${label}: isBudgeted is required and must be a boolean`);
 }

 if (typeof isOverBudget !== 'boolean') {
  throw new Error(`${label}: isOverBudget is required and must be a boolean`);
 }

 // isFiniteMoney, not typeof 'number': the service hands over Decimals so no
 // lossy conversion happens on the way in.
 for (const [field, value] of Object.entries(amounts)) {
  if (!isFiniteMoney(value)) {
   throw new Error(`${label}: ${field} must be a finite amount`);
  }
 }

 // Checked after the loop, not before: a non-finite budgetAmount has to fail as
 // "not a finite amount", not as an incoherence it is not the cause of.
 if (executionPercentage !== null && !isFiniteMoney(executionPercentage)) {
  throw new Error(`${label}: executionPercentage must be a finite amount or null`);
 }

 // Being budgeted is the existence of an allocation, never its magnitude: an
 // account deliberately set to 0 IS budgeted. Only one direction is checkable —
 // an account with no allocation cannot carry an amount, while a budgeted one is
 // free to carry 0.
 if (!isBudgeted && toAmount(amounts.budgetAmount) !== 0) {
  throw new Error(`${label}: an unbudgeted entry cannot carry an amount`);
 }
}
