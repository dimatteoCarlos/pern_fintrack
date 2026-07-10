// src/fintrack_api/services/budget_services/core/budgetAllocation.js

//Objective: Represents an immutable budget allocation for a budget policy (BudgetPolicy). 
// Each allocation contains the amount (budgetedAmount), the frequency (frequency), and the validity date range (validFrom / validUntil). 
// The allocation with validUntil === null is the active one (used for current calculations). 
// It is a pure Value Object with no external dependencies, and it self-validates to protect 
// the calculation engine from corrupted internal data.
//------------------------------
// Immutable domain object representing a budget allocation (SCD Type 2 record).
// Each allocation contains the amount, frequency type, and validity range.
// The allocation with validUntil === null is the currently active one.

export function makeBudgetAllocation({
  budgetAllocationId,
  budgetPolicyId,
  budgetAmount,
  budgetFrequencyTypeId,
  validFrom,
  validUntil,
  createdAt,
}) {
  // Validate required fields
  if (budgetAllocationId === undefined || budgetAllocationId === null) {
    throw new Error('BudgetAllocation: budgetAllocationId is required');
  }
  if (budgetPolicyId === undefined || budgetPolicyId === null) {
    throw new Error('BudgetAllocation: budgetPolicyId is required');
  }
  if (budgetAmount === undefined || budgetAmount === null) {
    throw new Error('BudgetAllocation: budgetAmount is required');
  }
  if (typeof budgetAmount !== 'number' || budgetAmount <= 0) {
    throw new Error('BudgetAllocation: budgetAmount must be a number greater than 0');
  }
  if (budgetFrequencyTypeId === undefined || budgetFrequencyTypeId === null) {
    throw new Error('BudgetAllocation: budgetFrequencyTypeId is required');
  }
  if (typeof budgetFrequencyTypeId !== 'number' || budgetFrequencyTypeId <= 0) {
    throw new Error('BudgetAllocation: budgetFrequencyTypeId must be a positive number');
  }
  if (!(validFrom instanceof Date) || isNaN(validFrom.getTime())) {
    throw new Error('BudgetAllocation: validFrom must be a valid Date');
  }
  // validUntil can be null (active) or a valid Date (closed)
  if (validUntil !== null && (!(validUntil instanceof Date) || isNaN(validUntil.getTime()))) {
    throw new Error('BudgetAllocation: validUntil must be a valid Date or null');
  }
  if (!(createdAt instanceof Date) || isNaN(createdAt.getTime())) {
    throw new Error('BudgetAllocation: createdAt must be a valid Date');
  }

  const budgetAllocation = Object.freeze({
    budgetAllocationId,
    budgetPolicyId,
    budgetAmount,
    budgetFrequencyTypeId,
    validFrom,
    validUntil,
    createdAt,
  });

  return budgetAllocation;
}