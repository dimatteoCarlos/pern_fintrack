// frontend/src/fintrack/helpers/budgetStatus.ts
// 🚦 BUDGET STATUS: how one budget reads, decided in one place
//
// The rule this exists to honour: the threshold must be written ONCE, beside
// whatever computes the status. A pill announcing "near limit" at one number
// while a square lights at another is a list contradicting itself, and the
// square is rendered from four different screens.
//
// Two decisions live here now, not one. The second is whether a budget was
// measured at all, and it arrived the same way the first did: the word
// over/left was derived by hand in all four of those screens, so a rule about
// zero budgets fixed in one of them left the other three disagreeing on the
// same row.
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

/**
 * Whether there is a budget to report on at all.
 *
 * Nothing budgeted and nothing spent is not a budget met, it is no budget. The
 * server withholds executionPercentage in exactly that case and for the same
 * reason — budgetCalculationService has no denominator to divide by — so a
 * word, a square or a share printed over it states a reading nobody took.
 *
 * Spending against a zero budget is a different case and this returns false for
 * it: that amount is real and keeps its word and its square. Only its share is
 * unmeasurable, and the server already withholds that one.
 */
export const isUnbudgeted = (
 budgetAmount: number | null | undefined,
 actualSpent: number | null | undefined,
): boolean => budgetAmount === 0 && actualSpent === 0;

/**
 * Which side of the budget the remainder falls on, as the word the four screens
 * print beside it. Empty when there is no side: the figures are still on the
 * wire, or nothing was budgeted and nothing spent.
 *
 * The word is what carries the sign, which is why every caller prints Math.abs
 * of the amount next to it — a minus in front would state the same thing twice.
 */
export const budgetRemainWord = (
 budgetAmount: number | null | undefined,
 actualSpent: number | null | undefined,
 remainingBudget: number | null | undefined,
): 'over' | 'left' | '' =>
 remainingBudget === null ||
 remainingBudget === undefined ||
 isUnbudgeted(budgetAmount, actualSpent)
  ? ''
  : remainingBudget < 0
   ? 'over'
   : 'left';
