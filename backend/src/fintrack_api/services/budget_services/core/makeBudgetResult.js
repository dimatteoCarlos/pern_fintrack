// src/fintrack_api/services/budget_services/core/makeBudgetResult.js
// 📝 CHANGE: Renamed budgetedAmount → budgetAccumulatedAmount

// The single rounding point of the module. Every result passes through here,
// including the no-budget ones, so rounding in the calculator instead would
// leave those unrounded.

import { isFiniteMoney, toAmount, toRate } from './money.js';

// How the reported period was arrived at.
//
// 'native'     – no aggregation level was asked for; the window is the policy's
//                own period.
// 'aggregated' – the level asked for is a whole multiple of that period, so the
//                window spans several of them exactly.
// 'resolved'   – the level asked for does not fit, so the window fell back to
//                the policy's period. The request was honoured as far as it
//                could be, which is why this is not a 400: a query locates a
//                period, it never redefines one.
export const RESOLUTIONS = ['native', 'aggregated', 'resolved'];

export function makeBudgetResult({
  accountId = null,
  isBudgeted = true,
  currency,
  period,
  resolution = 'native',
  budgetPolicy = null,
  budgetAllocation = null,
  budgetAccumulatedAmount,
  actualSpent,
  remainingBudget,
  actualVsBudgetDifference,
  executionPercentage,
}) {
  // Validate currency
  if (!currency || typeof currency !== 'string') {
    throw new Error('BudgetResult: currency is required and must be a string');
  }

  // Validate period
  if (!period || typeof period !== 'object') {
    throw new Error('BudgetResult: period is required and must be an object with start and end');
  }
  if (!(period.start instanceof Date) || isNaN(period.start.getTime())) {
    throw new Error('BudgetResult: period.start must be a valid Date');
  }
  if (!(period.end instanceof Date) || isNaN(period.end.getTime())) {
    throw new Error('BudgetResult: period.end must be a valid Date');
  }
  if (!RESOLUTIONS.includes(resolution)) {
    throw new Error(`BudgetResult: resolution must be one of ${RESOLUTIONS.join(', ')}`);
  }

  // Validate optional objects
  if (budgetPolicy !== null && typeof budgetPolicy !== 'object') {
    throw new Error('BudgetResult: budgetPolicy must be an object or null');
  }
  if (budgetAllocation !== null && typeof budgetAllocation !== 'object') {
    throw new Error('BudgetResult: budgetAllocation must be an object or null');
  }

  // Validate numeric metrics. isFiniteMoney, not typeof 'number': the
  // calculator hands over Decimals so no lossy conversion happens on the way in.
  if (!isFiniteMoney(budgetAccumulatedAmount)) {
    throw new Error('BudgetResult: budgetAccumulatedAmount must be a finite amount');
  }
  if (!isFiniteMoney(actualSpent)) {
    throw new Error('BudgetResult: actualSpent must be a finite amount');
  }
  if (!isFiniteMoney(remainingBudget)) {
    throw new Error('BudgetResult: remainingBudget must be a finite amount');
  }
  if (!isFiniteMoney(actualVsBudgetDifference)) {
    throw new Error('BudgetResult: actualVsBudgetDifference must be a finite amount');
  }
  if (!isFiniteMoney(executionPercentage)) {
    throw new Error('BudgetResult: executionPercentage must be a finite amount');
  }

  const budgetResult = Object.freeze({
    // The caller asked about a set of accounts and gets a set of results back.
    // Without this field the only way to tell them apart was budgetPolicy
    // .accountId, which is null precisely for the accounts that need
    // identifying: the ones with no policy.
    accountId,
    // Whether a budget_policies row exists for the account. It is not "the
    // accumulated amount is 0": a budgeted account queried over a window that
    // precedes its policy also accumulates 0, and the screen must not label it
    // the same way.
    isBudgeted,
    currency,
    period: {
      start: period.start,
      end: period.end,
    },
    // Per row, not only in meta: a mixed response has to say which rows were
    // aggregated and which fell back, and a single top-level value cannot.
    resolution,
    budgetPolicy,
    budgetAllocation,
    budgetAccumulatedAmount: toAmount(budgetAccumulatedAmount),  // ← Renombrado
    actualSpent: toAmount(actualSpent),
    remainingBudget: toAmount(remainingBudget),
    actualVsBudgetDifference: toAmount(actualVsBudgetDifference),
    // A ratio, not money: rounded so the response and the CSV agree, never
    // summed anywhere.
    executionPercentage: toRate(executionPercentage),
  });

  return budgetResult;
}