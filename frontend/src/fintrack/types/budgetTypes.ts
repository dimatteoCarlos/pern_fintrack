// frontend/src/fintrack/types/budgetTypes.ts
// Response contract of the /budget module. Written against the backend
// (README_BUDGET_MODULE_BE.md §3), not against the frontend's expectations:
// when the two disagree, this file must follow the server.

import { CurrencyType } from './types.ts';

//-----FREQUENCIES-------------
// The five seeded codes (010_create_budget_tables.sql). Declared for what the
// frontend sends and for autocomplete, not as a closed set: the catalog is a
// VARCHAR table with an is_active flag, not a Postgres enum.
export type BudgetFrequencyCode =
 | 'monthly'
 | 'quarterly'
 | 'four-month'
 | 'semiannual'
 | 'yearly';

// Widened on the way in. A closed union here would make a code the server adds
// unrepresentable and turn every default branch into dead code.
// Record<never, never> is the empty object type spelled in a way ban-types
// accepts; plain `| string` would collapse the union and lose autocompletion.
export type BudgetFrequencyCodeFromApi =
 | BudgetFrequencyCode
 | (string & Record<never, never>);

// GET /budget/frequencies. Populate every frequency selector from this, never
// from a literal array: the codes live in a catalog table.
export type BudgetFrequencyType = {
 budgetFrequencyTypeId: number;
 budgetFrequencyCode: BudgetFrequencyCodeFromApi;
 budgetFrequencyName: string;
 sortOrder: number;
};

export type BudgetFrequenciesResponse = {
 frequencies: BudgetFrequencyType[];
};

//-----POLICY AND ALLOCATION---
// One policy per account. createdAt/updatedAt are declared null because the
// service sends them null today; they are not read.
export type BudgetPolicyType = {
 budgetPolicyId: number;
 accountId: number;
 budgetFrequencyTypeId: number | null;
 createdAt: null;
 updatedAt: null;
};

// A versioned amount. validUntil is null on the one in force.
export type BudgetAllocationType = {
 budgetAllocationId: number;
 budgetPolicyId: number;
 budgetAmount: number;
 budgetFrequencyTypeId: number;
 budgetFrequencyCode: BudgetFrequencyCodeFromApi;
 validFrom: string;
 validUntil: string | null;
};

// GET /budget/history/:id adds the flag; PUT /budget/policy/:id does not.
export type BudgetAllocationHistoryType = BudgetAllocationType & {
 isActive: boolean;
};

//-----RESULT------------------
// The resolved window, end exclusive, ISO UTC. Named period, not
// startDate/endDate: those are request fields, this is the server's answer.
export type BudgetPeriodType = {
 start: string;
 end: string;
};

export type BudgetResultType = {
 accountId: number;
 // A policy row exists. Not "the amount is 0": an account queried over a window
 // that precedes its policy also accumulates 0, and reads differently.
 isBudgeted: boolean;
 currency: CurrencyType;
 period: BudgetPeriodType;
 budgetPolicy: BudgetPolicyType | null;
 // The allocation in force at the end of the window.
 budgetAllocation: BudgetAllocationType | null;
 budgetAccumulatedAmount: number;
 // Signed: positive for expenses, negative for reversals.
 actualSpent: number;
 // Deprecated duplicate of actualVsBudgetDifference. Kept because the server
 // still sends it; commit 5 stops reading it.
 remainingBudget: number;
 // Canonical remaining figure. Negative means overspent.
 actualVsBudgetDifference: number;
 executionPercentage: number;
};

//-----TOTALS------------------
// Aggregated by the server so no component adds amounts up. currency is null
// when the set mixes currencies — amounts are added but never converted.
export type BudgetTotalsType = {
 currency: CurrencyType | null;
 accountCount: number;
 budgetedCount: number;
 budgetAccumulatedAmount: number;
 actualSpent: number;
 remainingBudget: number;
 actualVsBudgetDifference: number;
 executionPercentage: number;
};

//-----META--------------------
// Always an object, and notices is always an array. No null check needed.
export type BudgetMetaType = {
 notices: string[];
};

//-----RESPONSES---------------
export type BudgetSummaryResponse = {
 result: BudgetResultType;
 meta: BudgetMetaType;
};

export type BudgetMultiSummaryResponse = {
 results: BudgetResultType[];
 totals: BudgetTotalsType;
 meta: BudgetMetaType;
};

export type BudgetHistoryResponse = BudgetAllocationHistoryType[];

//-----ERRORS------------------
// Two shapes, both on 400: Zod returns errors[], a domain guard returns
// status/message. There is no 404 on /budget — a missing resource and one that
// is not yours both answer 403, so ids cannot be enumerated.
export type BudgetValidationErrorResponse = {
 errors: unknown[];
};

export type BudgetDomainErrorResponse = {
 status: string | number;
 message: string;
};

export type BudgetErrorResponse =
 | BudgetValidationErrorResponse
 | BudgetDomainErrorResponse;
