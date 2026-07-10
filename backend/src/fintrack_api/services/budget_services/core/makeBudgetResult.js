// src/fintrack_api/services/budget_services/core/makeBudgetResult.js
// 📝 CHANGE: Renamed budgetedAmount → budgetAccumulatedAmount

export function makeBudgetResult({
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