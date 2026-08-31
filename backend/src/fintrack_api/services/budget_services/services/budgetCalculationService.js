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
import { makeBudgetCategoryStatus } from '../core/makeBudgetCategoryStatus.js';
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
 * Four derived figures, all of them arithmetic on two numbers. An account with
 * no decision in force needs no branch: its budget is 0, so remaining comes out
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
  categoryName: entry.categoryName,
  subcategory: entry.subcategory,
  nature: entry.nature,
  accountStartDate: entry.accountStartDate,
  currency: getCurrencyCodeSync(entry.currencyId),
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
 * branch when no decision is in force: the month's budget is 0, so remaining
 * comes out negative and isOverBudget comes out true, which is what spending
 * against no budget means.
 */
const buildMonthStatus = (entry) => {
 const budgetAmount = money(entry.budgetAmount);
 const actualSpent = money(entry.actualSpent);
 const hasDenominator = !budgetAmount.isZero();

 return makeBudgetMonthStatus({
  month: entry.month,
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
 * The month a status request is about, and the one after it.
 *
 * Returns undefined when the caller named no month, which is what asks the
 * repository to resolve the current one and its successor from a single
 * CURRENT_TIMESTAMP — a guarantee that cannot be made from out here.
 *
 * A named month costs the one query the check needs and no more: nextMonth is
 * derived from the text, so the pair still comes from one source.
 *
 * currentMonth travels back out because the check already had to ask for it. The
 * response states it (§7.4) and the alternative is a second query for a value
 * this function is holding.
 *
 * @param {object} pool - Database pool
 * @param {string|undefined} requestedMonth - 'YYYY-MM-01', already coerced by the validator
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<object|undefined>} { month, nextMonth, currentMonth }, or undefined
 */
const resolveStatusMonths = async (pool, requestedMonth, timeZone) => {
 if (!requestedMonth) return undefined;

 const currentMonth = await getCurrentMonth(pool, timeZone);

 // The same rule a series is held to: V1 has no future to show. A later month
 // has a budget and no spending to compare it against, so it would report the
 // whole amount as remaining and read as an underspend.
 if (requestedMonth > currentMonth) {
  throw rangeError(
   `month (${requestedMonth}) must not be later than the current month (${currentMonth}).`,
  );
 }

 return {
  month: requestedMonth,
  nextMonth: shiftMonths(requestedMonth, 1),
  currentMonth,
 };
};

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
  monthsOverBudget: months.filter((m) => m.isOverBudget).length,
  // Divided by EVERY month in the range. Spending happens whether or not a
  // decision was in force, and a smaller denominator would report an average
  // higher than any month actually spent (§8.2).
  averageMonthlySpend:
   months.length === 0 ? 0 : toAmount(sums.actualSpent.dividedBy(months.length)),
 };
};

const MIXED_CURRENCY_NOTICE =
 'Totals add amounts in more than one currency and are not converted.';

// A category whose accounts disagree about currency is not a total that cannot
// be shown: it is a state V1 does not allow, and the response says so by name.
// Under one accounting currency per installation it cannot happen, so seeing it
// means the data is wrong, not that the report is limited.
const mixedCurrencyCategoryNotice = (categoryName) =>
 `Category "${categoryName}" holds accounts in more than one currency, which V1 does not support. Its totals are not reported; the account rows keep their own amounts.`;

/**
 * Fold the account statuses into one entry per category.
 *
 * The grouping happens here, over rows already in memory, and not in a second
 * query: the three levels of the budget drill-down — categories, the accounts of
 * a category, one account — are three readings of the same set, so they are one
 * request, not three.
 *
 * Amounts are summed FROM the rounded account rows for the reason makeTotals
 * does the same: a group header that does not reconcile with the rows under it
 * is a bug the user finds before we do.
 *
 * Ordered by categoryName so no component sorts. The names are lowercased by
 * migration 013, so the comparison is on the same form the rows were written in.
 */
const makeCategoryGroups = (accountsStatus) => {
 const groups = new Map();

 for (const row of accountsStatus) {
  if (!groups.has(row.categoryName)) {
   groups.set(row.categoryName, []);
  }
  groups.get(row.categoryName).push(row);
 }

 return [...groups.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([categoryName, rows]) => {
   const currencies = new Set(rows.map((r) => r.currency));
   const currency = currencies.size === 1 ? [...currencies][0] : null;

   if (currency === null) {
    return makeBudgetCategoryStatus({
     categoryName,
     currency: null,
     accountCount: rows.length,
    });
   }

   const sums = rows.reduce(
    (acc, r) => ({
     budgetAmount: acc.budgetAmount.plus(r.budgetAmount),
     actualSpent: acc.actualSpent.plus(r.actualSpent),
    }),
    { budgetAmount: money(0), actualSpent: money(0) },
   );

   return makeBudgetCategoryStatus({
    categoryName,
    currency,
    accountCount: rows.length,
    budgetAmount: sums.budgetAmount,
    actualSpent: sums.actualSpent,
    remainingBudget: sums.budgetAmount.minus(sums.actualSpent),
    executionPercentage: sums.budgetAmount.isZero()
     ? null
     : sums.actualSpent.dividedBy(sums.budgetAmount).times(HUNDRED),
    isOverBudget: sums.actualSpent.greaterThan(sums.budgetAmount),
   });
  });
};

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

 if (accountsStatus.length > 0 && currency === null) {
  return {
   currency: null,
   budgetAmount: null,
   actualSpent: null,
   remainingBudget: null,
   executionPercentage: null,
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
 };
};

/**
 * Budget calculation service – read operations.
 * All functions receive a PostgreSQL connection pool as first argument.
 */
export const budgetCalculationService = {
 /**
  * The budget of several accounts for one month, plus the totals.
  *
  * One entry per requested account, budgeted or not: an account the caller asked
  * about and did not get back is indistinguishable from one the backend dropped,
  * and the screen has to be able to say "this category has no budget".
  *
  * The same rows are also returned folded by category, so the list of
  * categories, the accounts of one category and one account's card are three
  * readings of ONE response instead of three requests.
  *
  * requestedMonth is optional and past-only. Omitted, the month is the current
  * one on the owner's calendar — the only month that is ever WRITABLE, whatever
  * a read asks for.
  *
  * timeZone decides which month "now" is and which month each transaction falls
  * in. Both sides of the comparison have to live on the same calendar.
  */
 async getBudgetAccountsStatus(pool, accountIds, timeZone = 'UTC', requestedMonth) {
  const months = await resolveStatusMonths(pool, requestedMonth, timeZone);

  const { month, accounts } = await getMonthlyStatusForAccounts(
   pool,
   accountIds,
   timeZone,
   months,
  );

  const accountsStatus = accounts.map(buildAccountStatus);
  const categories = makeCategoryGroups(accountsStatus);
  const totals = makeTotals(accountsStatus);

  // Notices are a list and meta is always an object. A singular field could
  // only carry the first thing worth saying, so anything after it would be
  // dropped silently. The caller iterates: no null check, and no shape change
  // the day a second notice appears.
  const notices = [];
  if (accountsStatus.length > 0 && totals.currency === null) {
   notices.push(MIXED_CURRENCY_NOTICE);
  }
  for (const category of categories) {
   if (category.currency === null) {
    notices.push(mixedCurrencyCategoryNotice(category.categoryName));
   }
  }

  // The month reported and the current month are two different facts, and only
  // the first one is the subject of this response. They coincide on a request
  // that named no month and diverge on every request that named a past one, so
  // a client that read the ceiling off referenceMonth would offer the month it
  // is already looking at as the latest it may ask for. The client cannot
  // compute it either: its clock is not the account owner's calendar.
  //
  // Free in both branches: a named month already paid for this query in the 422
  // check, and an omitted one resolves to the current month by definition.
  const currentMonth = months?.currentMonth ?? month;

  return {
   referenceMonth: month,
   accounts: accountsStatus,
   // Between accounts and totals because that is the order the screen reads
   // them in: the rows, the groups they fall into, the header over both.
   categories,
   totals,
   meta: { notices, currentMonth },
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
