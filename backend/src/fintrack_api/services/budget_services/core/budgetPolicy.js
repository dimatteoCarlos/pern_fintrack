// src/fintrack_api/services/budget_services/core/budgetPolicy.js

// Immutable domain object representing a budget policy for an expense account.
// Contains the policy identity, the associated account, and the frequency type ID.
// Frequency is now managed via catalog table budget_frequency_types.

export function makeBudgetPolicy({
  budgetPolicyId,
  accountId,
  budgetFrequencyTypeId,
  createdAt,
  updatedAt,
}) {
  // Validate required fields
  if (budgetPolicyId === undefined || budgetPolicyId === null) {
    throw new Error('BudgetPolicy: budgetPolicyId is required');
  }
  if (accountId === undefined || accountId === null) {
    throw new Error('BudgetPolicy: accountId is required');
  }
  if (budgetFrequencyTypeId === undefined || budgetFrequencyTypeId === null) {
    throw new Error('BudgetPolicy: budgetFrequencyTypeId is required');
  }
  if (typeof budgetFrequencyTypeId !== 'number' || budgetFrequencyTypeId <= 0) {
    throw new Error('BudgetPolicy: budgetFrequencyTypeId must be a positive number');
  }
  if (!(createdAt instanceof Date) || isNaN(createdAt.getTime())) {
    throw new Error('BudgetPolicy: createdAt must be a valid Date');
  }
  if (!(updatedAt instanceof Date) || isNaN(updatedAt.getTime())) {
    throw new Error('BudgetPolicy: updatedAt must be a valid Date');
  }

  const budgetPolicy = Object.freeze({
    budgetPolicyId,
    accountId,
    budgetFrequencyTypeId,
    createdAt,
    updatedAt,
  });

  return budgetPolicy;
}