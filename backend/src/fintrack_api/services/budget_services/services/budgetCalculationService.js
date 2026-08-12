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

import {
 getCurrentMonth,
 getMonthlySeriesForAccounts,
 getMonthlyStatusForAccounts,
} from '../db/budgetTransactionRepository.js';
import { makeBudgetAccountStatus } from '../core/makeBudgetAccountStatus.js';
import { makeBudgetMonthStatus } from '../core/makeBudgetMonthStatus.js';
import { money, toAmount, toRate } from '../core/money.js';
import { getCurrencyCodeSync } from '../../../../utils/currencyLookup.js';

const HUNDRED = 100;

// The twelve-month window the history screen opens on, and the ceiling on how
// many months one request may ask for. The cap bounds the generate_series and
// the correlated lookup under it — accounts x months — at a size a chart can
// still render.
const DEFAULT_SERIES_MONTHS = 12;
const MAX_SERIES_MONTHS = 60;

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

/**
 * Turn one repository month into a BudgetMonthStatus.
 *
 * Same four derived figures as an account status, and the same absence of a
 * branch for the unbudgeted case: the month's budget is 0, so remaining comes
 * out negative and isOverBudget comes out true, which is what spending against
 * no budget means.
 */
const buildMonthStatus = (entry) => {
 const budgetAmount = money(entry.budgetAmount);
 const actualSpent = money(entry.actualSpent);
 const hasDenominator = !budgetAmount.isZero();

 return makeBudgetMonthStatus({
  month: entry.month,
  isBudgeted: entry.isBudgeted,
  budgetAmount,
  actualSpent,
  remainingBudget: budgetAmount.minus(actualSpent),
  executionPercentage: hasDenominator
   ? actualSpent.dividedBy(budgetAmount).times(HUNDRED)
   : null,
  isOverBudget: actualSpent.greaterThan(budgetAmount),
 });
};

// Month arithmetic on 'YYYY-MM-01' text, never through Date.
//
// A Date would reintroduce the zone the module spent §4.5 removing: constructing
// one from 'YYYY-MM-01' parses as UTC midnight, and reading it back through any
// local getter can land on the previous month. Counting months as integers has
// no zone to lose and no daylight saving to survive.
const monthIndex = (month) => {
 const [year, index] = month.split('-').map(Number);
 return year * 12 + (index - 1);
};

const shiftMonths = (month, delta) => {
 const total = monthIndex(month) + delta;
 const year = Math.floor(total / 12);
 const index = total % 12;
 return `${String(year).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}-01`;
};

const rangeError = (message) =>
 Object.assign(new Error(message), { status: 422 });

/**
 * Fill in the range the caller left open and reject the ones that cannot be
 * answered.
 *
 * 422, not 400: the request is well-formed and every field parsed. What fails is
 * the relationship between the values, or the relationship between a value and
 * today — neither of which a schema can see. A 400 would tell the client its
 * payload was malformed when it was not.
 *
 * Both bounds are first-of-month text, so `<` and `>` compare them
 * chronologically. That is a property of the format, not a coincidence, and it
 * is why nothing here parses a date.
 *
 * @param {object} pool - Database pool
 * @param {object} requested - { from, to }, either or both undefined
 * @param {string} timeZone - IANA zone of the account owner
 * @param {number} defaultMonths - span to use when `from` is omitted
 * @returns {Promise<object>} { from, to }, both resolved
 */
const resolveSeriesRange = async (pool, requested, timeZone, defaultMonths) => {
 const currentMonth = await getCurrentMonth(pool, timeZone);
 const to = requested.to ?? currentMonth;
 const from = requested.from ?? shiftMonths(to, -(defaultMonths - 1));

 if (from > to) {
  throw rangeError(`from (${from}) must not be later than to (${to}).`);
 }

 // V1 has no future to show: a budget can be written for a later month, but
 // there is no spending to compare it against, so every month past the current
 // one would report the full budget as remaining and read as an underspend.
 if (to > currentMonth) {
  throw rangeError(`to (${to}) must not be later than the current month (${currentMonth}).`);
 }

 const span = monthIndex(to) - monthIndex(from) + 1;
 if (span > MAX_SERIES_MONTHS) {
  throw rangeError(
   `The range spans ${span} months; at most ${MAX_SERIES_MONTHS} may be requested.`,
  );
 }

 return { from, to };
};

/**
 * Aggregate a month series into the range figures Overview and Insights show.
 *
 * The backend folds, not the client. A range's percentage is recomputed as
 * SUM(actual) / SUM(budget) and never averaged from the per-month percentages —
 * if the client folded, every client would have to reimplement that rule, and
 * the first one to write avg(executionPercentage) produces a number that looks
 * right and is wrong.
 *
 * No mixed-currency rule applies here: a series covers one account, so its
 * months cannot span currencies.
 *
 * The month values are already rounded by makeBudgetMonthStatus and the totals
 * are summed FROM them, so the header reconciles with the rows under it.
 */
const makeSeriesTotals = (months) => {
 const sums = months.reduce(
  (acc, m) => ({
   budgetAmount: acc.budgetAmount.plus(m.budgetAmount),
   actualSpent: acc.actualSpent.plus(m.actualSpent),
  }),
  { budgetAmount: money(0), actualSpent: money(0) },
 );

 return {
  budgetAmount: toAmount(sums.budgetAmount),
  actualSpent: toAmount(sums.actualSpent),
  remainingBudget: toAmount(sums.budgetAmount.minus(sums.actualSpent)),
  executionPercentage: sums.budgetAmount.isZero()
   ? null
   : toRate(sums.actualSpent.dividedBy(sums.budgetAmount).times(HUNDRED)),
  // A month set to zero counts: budgeted is the existence of the decision, not
  // its size (§8.2).
  budgetedMonthCount: months.filter((m) => m.isBudgeted).length,
  monthsOverBudget: months.filter((m) => m.isOverBudget).length,
  // Divided by EVERY month in the range, not by the budgeted ones. Spending
  // happens whether or not the account was budgeted, and dividing by the
  // budgeted months alone reports an average higher than any month actually
  // spent (§8.2).
  averageMonthlySpend:
   months.length === 0 ? 0 : toAmount(sums.actualSpent.dividedBy(months.length)),
 };
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

 /**
  * The month-by-month budget of ONE account over a range, plus the range totals.
  *
  * Every month between from and to is present, including the months before the
  * account's first allocation: the carry-forward is applied in SQL so the client
  * never re-derives it, and a gap in the array is exactly the thing that would
  * force it to.
  *
  * The range is resolved here rather than in the controller because the default
  * upper bound is the current month on the owner's calendar, which is a query,
  * not a constant.
  */
 async getBudgetAccountSeries(pool, accountId, requestedRange, timeZone = 'UTC') {
  const { from, to } = await resolveSeriesRange(
   pool,
   requestedRange,
   timeZone,
   DEFAULT_SERIES_MONTHS,
  );

  const [account] = await getMonthlySeriesForAccounts(pool, [accountId], from, to, timeZone);

  // The caller checked ownership before getting here, so an account that is
  // missing now has no row in category_budget_accounts — a data inconsistency,
  // not an empty result. Reporting it as an empty series would hide it.
  if (!account) {
   throw new Error(`Account ${accountId} has no category_budget row.`);
  }

  const months = account.months.map(buildMonthStatus);

  return {
   accountId: account.accountId,
   accountName: account.accountName,
   // Stated once for the whole series. Repeating it on every month would be the
   // same fact in sixty places, and the months cannot disagree about it.
   currency: getCurrencyCodeSync(account.currencyId),
   from,
   to,
   months,
   totals: makeSeriesTotals(months),
  };
 },

 /**
  * The same series for SEVERAL accounts, flattened for the export.
  *
  * Kept separate from getBudgetAccountSeries rather than folded into it because
  * the two answer different questions: this one has no single currency and no
  * range totals to report, since a set of accounts can span currencies and there
  * is no FX in V1. The CSV needs neither — each line carries its own currency.
  *
  * defaultMonths is a parameter because /export and /series disagree about it on
  * purpose: an omitted range means the current month for a file the user
  * downloads, and twelve months for a chart.
  */
 async getBudgetAccountsSeries(pool, accountIds, requestedRange, timeZone = 'UTC', defaultMonths = 1) {
  const { from, to } = await resolveSeriesRange(pool, requestedRange, timeZone, defaultMonths);

  const accounts = await getMonthlySeriesForAccounts(pool, accountIds, from, to, timeZone);

  return {
   from,
   to,
   accounts: accounts.map((account) => ({
    accountId: account.accountId,
    accountName: account.accountName,
    subcategory: account.subcategory,
    currency: getCurrencyCodeSync(account.currencyId),
    months: account.months.map(buildMonthStatus),
   })),
  };
 },
};
