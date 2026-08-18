// frontend/src/fintrack/helpers/budgetStatus.ts
// 🚦 BUDGET STATUS: the three readings of one budget, decided in one place
//
// The rule this exists to honour: the threshold must be written ONCE, beside
// whatever computes the status. A pill announcing "near limit" at one number
// while a square lights at another is a list contradicting itself, and the
// square is rendered from four different screens.
//
// It lives in helpers/ and not in pages/budget/ because the level-3 hero sits in
// accountDetailSharedComponents, outside the budget tree.
//
// Nothing here recomputes a figure. `over` is served as isOverBudget and
// `execution` is served as executionPercentage; what this applies is a
// presentation threshold over a served number.

// Fixed by the developer on 2026-08-17. It is a business rule, not a derivation:
// there is nothing in the model to read it from.
export const BUDGET_NEAR_LIMIT_PERCENT = 75;

export type BudgetStatusLevel = 'ok' | 'near' | 'over';

// The class the shared StatusSquare appends. 'ok' is the bare square, which is
// why it maps to an empty string rather than to a class of its own.
const SQUARE_CLASS: Record<BudgetStatusLevel, string> = {
 ok: '',
 near: 'warning',
 over: 'alert',
};

/**
 * Which of the three readings a budget is at.
 *
 * A withheld percentage reads as `ok`, the same as today: the server nulls the
 * figures of a set holding more than one currency, and a month whose share
 * cannot be computed has not been measured against the threshold at all.
 * Painting it amber would state a proximity nobody calculated.
 */
export const budgetStatusLevel = (
 executionPercentage: number | null | undefined,
 isOverBudget: boolean | null | undefined,
): BudgetStatusLevel => {
 if (isOverBudget === true) return 'over';

 return typeof executionPercentage === 'number' &&
  executionPercentage >= BUDGET_NEAR_LIMIT_PERCENT
  ? 'near'
  : 'ok';
};

/** The same decision, as the string StatusSquare takes. */
export const budgetSquareState = (
 executionPercentage: number | null | undefined,
 isOverBudget: boolean | null | undefined,
): string => SQUARE_CLASS[budgetStatusLevel(executionPercentage, isOverBudget)];
