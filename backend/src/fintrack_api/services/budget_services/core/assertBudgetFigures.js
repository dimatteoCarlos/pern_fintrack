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

import { isFiniteMoney } from './money.js';

/**
 * Reject a set of budget figures that cannot be true together.
 *
 * @param {string} label - factory name, so the message says which shape failed
 * @param {object} flags - { isOverBudget, executionPercentage }
 * @param {object} amounts - every monetary field, keyed by name
 */
export function assertBudgetFigures(label, flags, amounts) {
 const { isOverBudget, executionPercentage } = flags;

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
}
