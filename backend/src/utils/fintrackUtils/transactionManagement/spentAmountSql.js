// backend/src/utils/fintrackUtils/transactionManagement/spentAmountSql.js
/**
 * What "spent" means in SQL, written once.
 *
 * Two modules ask the same question of the same rows. The budget module answers
 * it as `actualSpent` for one month and one set of accounts
 * (budgetTransactionRepository.js, SPENT_QUERY); the overview module answers it
 * as the expense card's `totalAmount` for a series of months
 * (overviewMonthlyRepository.js, MONTHLY_EXPENSE_QUERY). Both carried the same
 * CASE and the same movement type list independently, and the overview comment
 * said it was the budget module's netting "verbatim" — which it was, with
 * nothing keeping it that way.
 *
 * Why the netting exists at all. `movement_type_id` 6 is the transfer that sends
 * money back from a category account to a bank account, and `amount` is already
 * signed per leg, so the category account's leg of a reversal is negative.
 * Counting movement type 1 alone would report a refunded expense as still spent,
 * while `actualSpent` — which nets — reported it as returned, and two figures
 * where one is a subset of the other would disagree over a refund.
 *
 * This module holds the rule, not the window. The month bounds, the account set
 * and the time zone stay written out in each statement, because those are what
 * the two questions genuinely differ on.
 */

// The category account's leg of a spend, positive: movementInputHandler.js
// declares the expense movement as bank -> category_budget, so the leg that
// lands on the category account is a deposit.
export const EXPENSE_MOVEMENT_TYPE_ID = 1;

// The transfer that returns money from a category account to a bank account.
export const EXPENSE_REVERSAL_MOVEMENT_TYPE_ID = 6;

// The rows a spend figure is made of. Used both to filter and, through the
// builder below, to sum, so a statement cannot filter on one set and sum over
// another.
export const SPENT_MOVEMENT_TYPE_IDS = [
 EXPENSE_MOVEMENT_TYPE_ID,
 EXPENSE_REVERSAL_MOVEMENT_TYPE_ID,
];

/**
 * The amount each row contributes to a spend figure.
 *
 * The ELSE branch is 0 rather than absent so the expression is total over any
 * row the caller's join admits. A statement whose filter already restricts to
 * these two types gets the same answer either way; one that widens its filter
 * later does not silently start summing rows this rule never covered.
 *
 * @param {string} [alias] - The alias of `transactions` in the caller's query
 * @returns {string} - A CASE expression, to sit inside a SUM
 */
export function spentAmountSql(alias = 't') {
 // Interpolated into SQL, so it is restricted to a bare identifier.
 if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) {
  throw new Error(`spentAmountSql expects a table alias, received: ${alias}`);
 }

 return `CASE
        WHEN ${alias}.movement_type_id = ${EXPENSE_MOVEMENT_TYPE_ID} THEN ${alias}.amount
        WHEN ${alias}.movement_type_id = ${EXPENSE_REVERSAL_MOVEMENT_TYPE_ID} THEN ${alias}.amount
        ELSE 0
      END`;
}

/**
 * The movement type list as a SQL literal, for the filter beside the sum.
 *
 * @returns {string} - e.g. `1, 6`, to sit inside an IN (...)
 */
export function spentMovementTypeList() {
 return SPENT_MOVEMENT_TYPE_IDS.join(', ');
}
