// src/fintrack_api/services/budget_services/services/budgetCalculationService.js

// Budget Calculation Service – read operations.
//
// The window is no longer decided here. A budget belongs to a calendar month, so
// there is nothing to resolve, nothing to normalise across periods, and no
// aggregation level to honour or reject: the repository returns the month it
// resolved on the owner's calendar and one row per requested account, and this
// turns those rows into the response the frontend contract defines.
//
// Currency comes from the in-memory catalog, so no query is issued for it.

import { getMonthlyStatusForAccounts } from '../db/budgetTransactionRepository.js';
import { makeBudgetAccountStatus } from '../core/makeBudgetAccountStatus.js';
import { money, toAmount, toRate } from '../core/money.js';
import { getCurrencyCodeSync } from '../../../../utils/currencyLookup.js';

const HUNDRED = 100;

/**
 * Turn one repository row into a BudgetAccountStatus.
 *
 * Four derived figures, all of them arithmetic on two numbers. There is no
 * branch for the unbudgeted account: its budget is 0, so remaining comes out
 * negative and isOverBudget comes out true, which is exactly its situation.
 * The one thing 0 cannot produce is a percentage.
 */
const buildAccountStatus = (entry) => {
 const budgetAmount = money(entry.budgetAmount);
 const actualSpent = money(entry.actualSpent);
 const hasDenominator = !budgetAmount.isZero();

 return makeBudgetAccountStatus({
  accountId: entry.accountId,
  accountName: entry.accountName,
  subcategory: entry.subcategory,
  currency: getCurrencyCodeSync(entry.currencyId),
  isBudgeted: entry.isBudgeted,
  budgetAmount,
  nextMonthBudget: money(entry.nextMonthBudget),
  actualSpent,
  remainingBudget: budgetAmount.minus(actualSpent),
  executionPercentage: hasDenominator
   ? actualSpent.dividedBy(budgetAmount).times(HUNDRED)
   : null,
  isOverBudget: actualSpent.greaterThan(budgetAmount),
 });
};

const MIXED_CURRENCY_NOTICE =
 'Totals add amounts in more than one currency and are not converted.';

/**
 * Aggregate a set of account statuses into the figures the Overview header shows.
 *
 * This exists so the frontend does not add them up itself. Summing on the client
 * is exactly the arithmetic this module was built to remove, and it would
 * reappear in a component instead of a service — the same bug in a file nobody
 * thinks to check.
 *
 * The percentage is recomputed from the totals, never averaged across accounts.
 * An average weights a category budgeted at 10 the same as one budgeted at
 * 10,000, which is not what "how much of my budget have I spent" means. Every
 * row now covers the same month, so the denominator is a real sum.
 *
 * Currencies are NOT converted. Budget-level FX is a schema change, not an
 * aggregate, and adding USD to COP is a conversion at an implicit rate of 1:1 —
 * the invented number the rule exists to forbid. A mixed set reports every
 * monetary total as null and says why in notices; the per-account rows keep
 * their own amounts, so nothing is lost except the bad addition.
 *
 * The line values are already rounded by makeBudgetAccountStatus and the totals
 * are summed FROM them: the header must reconcile with the figures under it.
 * Summing the unrounded values would let two displayed numbers differ by a cent.
 */
const makeTotals = (accountsStatus) => {
 const currencies = new Set(accountsStatus.map((r) => r.currency));
 const currency = currencies.size === 1 ? [...currencies][0] : null;
 const budgetedAccountCount = accountsStatus.filter((r) => r.isBudgeted).length;

 if (accountsStatus.length > 0 && currency === null) {
  return {
   currency: null,
   budgetAmount: null,
   actualSpent: null,
   remainingBudget: null,
   executionPercentage: null,
   budgetedAccountCount,
  };
 }

 const sums = accountsStatus.reduce(
  (acc, r) => ({
   budgetAmount: acc.budgetAmount.plus(r.budgetAmount),
   actualSpent: acc.actualSpent.plus(r.actualSpent),
  }),
  { budgetAmount: money(0), actualSpent: money(0) },
 );

 return {
  currency,
  budgetAmount: toAmount(sums.budgetAmount),
  actualSpent: toAmount(sums.actualSpent),
  remainingBudget: toAmount(sums.budgetAmount.minus(sums.actualSpent)),
  executionPercentage: sums.budgetAmount.isZero()
   ? null
   : toRate(sums.actualSpent.dividedBy(sums.budgetAmount).times(HUNDRED)),
  budgetedAccountCount,
 };
};

/**
 * Budget calculation service – read operations.
 * All functions receive a PostgreSQL connection pool as first argument.
 */
export const budgetCalculationService = {
 /**
  * The budget of several accounts for the current month, plus the totals.
  *
  * One entry per requested account, budgeted or not: an account the caller asked
  * about and did not get back is indistinguishable from one the backend dropped,
  * and the screen has to be able to say "this category has no budget".
  *
  * timeZone decides which month "now" is and which month each transaction falls
  * in. Both sides of the comparison have to live on the same calendar.
  */
 async getBudgetAccountsStatus(pool, accountIds, timeZone = 'UTC') {
  const { month, accounts } = await getMonthlyStatusForAccounts(pool, accountIds, timeZone);

  const accountsStatus = accounts.map(buildAccountStatus);
  const totals = makeTotals(accountsStatus);

  // Notices are a list and meta is always an object. A singular field could
  // only carry the first thing worth saying, so anything after it would be
  // dropped silently. The caller iterates: no null check, and no shape change
  // the day a second notice appears.
  const notices = [];
  if (accountsStatus.length > 0 && totals.currency === null) {
   notices.push(MIXED_CURRENCY_NOTICE);
  }

  return {
   referenceMonth: month,
   accounts: accountsStatus,
   totals,
   meta: { notices },
  };
 },
};
