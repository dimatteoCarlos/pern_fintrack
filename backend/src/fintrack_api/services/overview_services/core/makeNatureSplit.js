// src/fintrack_api/services/overview_services/core/makeNatureSplit.js

// How the month's spending splits across the four nature tags.
//
// IT IS A COMPOSITION AND NOT A RANKING. Four fixed values ordered by size
// discover nothing: a Pareto exists to separate the vital few from the many, and
// there is no many here. The question the nature answers is what share went to
// each, and the four are read against the same four of last month — which rows
// that move cannot be (owner decision 2026-09-17).
//
// The tag travels per account and not per category because it varies WITHIN one,
// which is the only reason it is worth showing beside a subcategory
// (makeBudgetAccountStatus.js:56-59).

import { money, toAmount } from '../../budget_services/core/money.js';

// The catalog's own order, as seeded at populateDB.js:313-318 — must, need,
// other, want. Stated here as the four ids the catalog gives them, so the block
// keeps one order across months whatever was spent. 'other' sitting third reads
// oddly beside a scale, and it is kept anyway: re-sequencing it would be a
// second definition of an order the database already has.
const NATURE_ORDER = Object.freeze(['must', 'need', 'other', 'want']);

// The same four decimals rankBySpend keeps its shares at, and for the same
// reason: a 0-1 ratio at two decimals is 1% resolution.
const SHARE_SCALE = 4;

/**
 * The nature composition of a set of budget accounts.
 *
 * ALL FOUR ROWS ARE ALWAYS PUBLISHED, including the ones nobody used. A row that
 * disappears when its figure is zero makes the block a different shape every
 * month, and the reader comparing two months would be comparing two blocks. A
 * nature with no accounts carries zeros and a count of zero, and the screen says
 * so in words.
 *
 * AN ACCOUNT WITH NO TAG IS COUNTED OUTSIDE THE FOUR AND NOT INSIDE 'other'. The
 * column is nullable (createTables.js:90), 'other' is a value somebody chose,
 * and folding a gap into a choice would report a decision that was never made.
 *
 * @param {object[]} accounts - BudgetAccountStatus rows in scope
 * @param {string|null} categoryName - the category the scope is narrowed to, or
 *   null for the whole expense domain
 * @returns {object} the four rows, their totals, and what carries no tag
 */
export const makeNatureSplit = (accounts, categoryName = null) => {
 const spentOf = (account) => account.actualSpent ?? 0;
 const budgetOf = (account) => account.budgetAmount ?? 0;

 const spentTotal = accounts.reduce((sum, account) => sum.plus(spentOf(account)), money(0));
 const budgetTotal = accounts.reduce((sum, account) => sum.plus(budgetOf(account)), money(0));

 const rows = NATURE_ORDER.map((nature) => {
  const held = accounts.filter((account) => account.nature === nature);
  const spent = held.reduce((sum, account) => sum.plus(spentOf(account)), money(0));
  const budget = held.reduce((sum, account) => sum.plus(budgetOf(account)), money(0));

  return {
   nature,
   accountCount: held.length,
   spent: toAmount(spent),
   budget: toAmount(budget),
   // Of the spending IN SCOPE, which is the whole domain or the one category —
   // never of the month when a category is open. The screen restates the
   // denominator in money for the same reason.
   //
   // 0 when nothing was spent in scope: there is no share of zero to distribute,
   // and a division by zero is the invented number the money rules forbid.
   share: spentTotal.isZero()
    ? 0
    : spent.dividedBy(spentTotal).toDecimalPlaces(SHARE_SCALE).toNumber(),
  };
 });

 const untagged = accounts.filter((account) => account.nature === null);

 return Object.freeze({
  // Null for the whole domain. The client restates the scope three times and
  // reads it from here rather than from its own selection, so a stale selection
  // cannot label a figure it did not produce.
  categoryName: categoryName ?? null,
  spentTotal: toAmount(spentTotal),
  budgetTotal: toAmount(budgetTotal),
  rows,
  untaggedCount: untagged.length,
  untaggedSpent: toAmount(untagged.reduce((sum, account) => sum.plus(spentOf(account)), money(0))),
  untaggedBudget: toAmount(
   untagged.reduce((sum, account) => sum.plus(budgetOf(account)), money(0)),
  ),
 });
};
