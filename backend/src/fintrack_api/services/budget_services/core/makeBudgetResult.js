// src/fintrack_api/services/budget_services/core/makeBudgetResult.js
// 📝 CHANGE: Renamed budgetedAmount → budgetAccumulatedAmount

export function makeBudgetResult({
  accountId = null,
  isBudgeted = true,
  currency,
  period,
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

  // Validate optional objects
  if (budgetPolicy !== null && typeof budgetPolicy !== 'object') {
    throw new Error('BudgetResult: budgetPolicy must be an object or null');
  }
  if (budgetAllocation !== null && typeof budgetAllocation !== 'object') {
    throw new Error('BudgetResult: budgetAllocation must be an object or null');
  }

  // Validate numeric metrics
  if (budgetAccumulatedAmount === undefined || budgetAccumulatedAmount === null || typeof budgetAccumulatedAmount !== 'number') {
    throw new Error('BudgetResult: budgetAccumulatedAmount must be a number');
  }
  if (actualSpent === undefined || actualSpent === null || typeof actualSpent !== 'number') {
    throw new Error('BudgetResult: actualSpent must be a number');
  }
  if (remainingBudget === undefined || remainingBudget === null || typeof remainingBudget !== 'number') {
    throw new Error('BudgetResult: remainingBudget must be a number');
  }
  if (actualVsBudgetDifference === undefined || actualVsBudgetDifference === null || typeof actualVsBudgetDifference !== 'number') {
    throw new Error('BudgetResult: actualVsBudgetDifference must be a number');
  }
  if (executionPercentage === undefined || executionPercentage === null || typeof executionPercentage !== 'number') {
    throw new Error('BudgetResult: executionPercentage must be a number');
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
    budgetPolicy,
    budgetAllocation,
    budgetAccumulatedAmount,  // ← Renombrado
    actualSpent,
    remainingBudget,
    actualVsBudgetDifference,
    executionPercentage,
  });

  return budgetResult;
}