// Contract tests for the expense Pareto's execution rate over categorized spend.

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeCategoryBreakdown } from '../../src/fintrack_api/services/overview_services/core/makeCategoryBreakdown.js';
import { makeCategoryBudgetExecution } from '../../src/fintrack_api/services/overview_services/core/makeCategoryBudgetExecution.js';

const row = (categoryName, actualSpent, budgetAmount) => ({
 categoryName,
 actualSpent,
 budgetAmount,
});

test('the rate divides categorized spend by the same categories budget', () => {
 const execution = makeCategoryBudgetExecution(
  makeCategoryBreakdown([row('food', 30.1, 100), row('rent', 50, 50), row('fun', 0, 50)]),
 );

 assert.deepEqual(execution, {
  spentAmount: 80.1,
  budgetAmount: 200,
  executionPercentage: 40.05,
  remainingBudget: 119.9,
  isOverBudget: false,
 });
});

test('an overrun leaves a negative remainder and raises the flag', () => {
 const execution = makeCategoryBudgetExecution(
  makeCategoryBreakdown([row('food', 150, 100)]),
 );

 assert.equal(execution.executionPercentage, 150);
 assert.equal(execution.remainingBudget, -50);
 assert.equal(execution.isOverBudget, true);
});

test('no budget gives no rate rather than a division by zero', () => {
 const execution = makeCategoryBudgetExecution(
  makeCategoryBreakdown([row('food', 20, 0)]),
 );

 assert.equal(execution.executionPercentage, null);
 assert.equal(execution.isOverBudget, false);
});

test('no category gives no execution', () => {
 assert.equal(makeCategoryBudgetExecution([]), null);
});
