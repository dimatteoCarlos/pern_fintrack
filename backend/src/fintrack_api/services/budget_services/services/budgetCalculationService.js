// src/fintrack_api/services/budget_services/services/budgetCalculationService.js

// Budget Calculation Service – Read operations for budget summaries.
// Orchestrates data fetching, period resolution, and metric calculation.
// Currency is obtained from in-memory catalog (no DB queries).
//
// The word "frequency" named two different things and conflating them was a
// defect. There is only one left: the code stored on each ALLOCATION. It is the
// multiplier — how often that budget recurs — and it also sizes the period the
// report covers. The request no longer carries one, because a query locates a
// period and never defines one.

import { resolvePeriod } from '../../../../utils/fintrackUtils/date-utils/periodResolver.js';
import {
 getBudgetDataForAccounts,
 getPolicyFrequenciesForAccounts,
} from '../db/budgetTransactionRepository.js';
import { calculateBudgetVsActual } from '../calculators/budgetVsActualCalculator.js';
import { makeBudgetAccountStatus } from '../core/makeBudgetAccountStatus.js';
import { money, toAmount } from '../core/money.js';
import { DEFAULT_FREQUENCY, MONTHS_PER_PERIOD } from '../core/budgetConfig.js';
import { getCurrencyCodeSync } from '../../../../utils/currencyLookup.js';

/**
 * The status of an account with no budget figure to report for this window.
 *
 * Two different situations land here and the response keeps them apart through
 * isBudgeted:
 *
 * - No policy at all. The account is unbudgeted (PLAN_D §1.2): two states, not
 *   three, so there is no such thing as a null or zero budget.
 * - A policy whose allocations all fall outside the window. The account IS
 *   budgeted; a policy created in March simply says nothing about January.
 *   Reporting March's amount for a January window — what selecting only the
 *   active allocation used to do — invents a budget that never existed.
 *
 * actualSpent is reported in both cases. Money can be spent on a category with
 * no budget behind it, and hiding that would replace one lie with another. The
 * percentage stays 0 because there is no denominator.
 */
const makeAccountStatusWithoutAllocation = ({
 accountId,
 isBudgeted,
 budgetPolicy,
 currency,
 actualSpent,
 startDate,
 endDate,
 resolution,
}) =>
 makeBudgetAccountStatus({
  accountId,
  isBudgeted,
  currency,
  period: { start: startDate, end: endDate },
  resolution,
  budgetPolicy: budgetPolicy ?? null,
  budgetAllocation: null,
  budgetAccumulatedAmount: 0,
  actualSpent,
  remainingBudget: money(actualSpent).negated(),
  actualVsBudgetDifference: money(actualSpent).negated(),
  executionPercentage: 0,
 });

/**
 * Turn one repository entry into a BudgetAccountStatus.
 */
const buildAccountStatus = (entry, startDate, endDate, resolution) => {
 const currency = getCurrencyCodeSync(entry.currencyId);
 const isBudgeted = entry.budgetPolicyId !== null;

 if (!isBudgeted) {
  return makeAccountStatusWithoutAllocation({
   accountId: entry.accountId,
   isBudgeted: false,
   budgetPolicy: null,
   currency,
   actualSpent: entry.actualSpent,
   startDate,
   endDate,
   resolution,
  });
 }

 const budgetPolicy = {
  budgetPolicyId: entry.budgetPolicyId,
  accountId: entry.accountId,
  budgetFrequencyTypeId:
   entry.allocations.length > 0
    ? entry.allocations[entry.allocations.length - 1].budgetFrequencyTypeId
    : null,
  createdAt: null,
  updatedAt: null,
 };

 if (entry.allocations.length === 0) {
  return makeAccountStatusWithoutAllocation({
   accountId: entry.accountId,
   isBudgeted: true,
   budgetPolicy,
   currency,
   actualSpent: entry.actualSpent,
   startDate,
   endDate,
   resolution,
  });
 }

 return calculateBudgetVsActual({
  accountId: entry.accountId,
  budgetPolicy,
  budgetAllocations: entry.allocations,
  actualSpentOverride: entry.actualSpent,
  startDate,
  endDate,
  currency,
  resolution,
 });
};

/**
 * Which window one account is read over, and how that window was arrived at.
 *
 * The unified rule of PLAN_F §4.1. A query never redefines a policy's budget
 * period, so an aggregation level is honoured only when it is a whole multiple
 * of that period; otherwise the canonical period containing the reference date
 * is reported instead. Neither branch is an error: asking a monthly question
 * about a quarterly budget is a reasonable thing to do, and answering "that
 * budget is quarterly, here is its quarter" is more useful than a 400.
 *
 * Divisibility in months is the whole test because every canonical period
 * anchors to January. A quarter is always Jan–Mar, Apr–Jun and so on, so a
 * yearly window contains exactly four of them with no boundary left straddling.
 */
const resolveWindowFor = (policyCode, aggregationLevel) => {
 if (!aggregationLevel) {
  return { frequencyCode: policyCode, resolution: 'native' };
 }

 return MONTHS_PER_PERIOD[aggregationLevel] % MONTHS_PER_PERIOD[policyCode] === 0
  ? { frequencyCode: aggregationLevel, resolution: 'aggregated' }
  : { frequencyCode: policyCode, resolution: 'resolved' };
};

/**
 * Read a set of accounts, each over the window its own policy allows.
 *
 * The frequency comes from the allocation in force at the reference date, never
 * from the request. A budget belongs to a canonical period, so a query that
 * sized the window itself was redefining that period: a quarterly budget of 600
 * read through the default monthly window counted floor(1/3) = 0 whole periods
 * and reported the entire spend as overspend. The window is now either one
 * period of the policy or a whole number of them, so the count is exact by
 * construction.
 *
 * An account with no allocation covering the date falls back to
 * DEFAULT_FREQUENCY. There is no budget in force to take a period from, and
 * monthly is the finest canonical grain, so the window neither invents a budget
 * nor hides spending. isBudgeted already tells the two situations apart.
 *
 * Accounts are grouped by window frequency rather than read one at a time:
 * there are five codes, so this is at most five reads and in practice one,
 * against the N of a per-account loop. The resolution is carried per account,
 * not per group — a monthly policy aggregated to quarterly and a quarterly
 * policy that rejected a monthly level share one window and reached it for
 * opposite reasons.
 *
 * timeZone is what the window is read on. The stored instants never move; the
 * boundaries do, so an expense late on the last day of the month belongs to the
 * month the user was living, not the one UTC was.
 */
const readAccountsOverTheirOwnPeriods = async (
 pool,
 accountIds,
 referenceDate,
 aggregationLevel = null,
 timeZone = 'UTC',
) => {
 const frequencyByAccount = await getPolicyFrequenciesForAccounts(
  pool,
  accountIds,
  referenceDate,
 );

 const windowByAccount = new Map();
 const accountsByFrequency = new Map();
 for (const accountId of accountIds) {
  const policyCode = frequencyByAccount.get(accountId) ?? DEFAULT_FREQUENCY;
  const window = resolveWindowFor(policyCode, aggregationLevel);
  windowByAccount.set(accountId, window);

  const group = accountsByFrequency.get(window.frequencyCode) ?? [];
  group.push(accountId);
  accountsByFrequency.set(window.frequencyCode, group);
 }

 const groups = await Promise.all(
  [...accountsByFrequency].map(async ([frequencyCode, ids]) => {
   const period = resolvePeriod(frequencyCode, referenceDate, timeZone);
   const entries = await getBudgetDataForAccounts(pool, ids, period.start, period.end);
   return entries.map((entry) =>
    buildAccountStatus(
     entry,
     period.start,
     period.end,
     windowByAccount.get(entry.accountId).resolution,
    ),
   );
  }),
 );

 // Back into the order the caller asked in. Grouping reorders the rows, and a
 // response whose order depends on which frequencies happened to be present is
 // not something a caller can pair against its own list.
 const statusByAccount = new Map(groups.flat().map((status) => [status.accountId, status]));
 return accountIds.map((id) => statusByAccount.get(id)).filter(Boolean);
};

/**
 * The one word that describes a whole response, or 'mixed' when there is none.
 *
 * A single value would be a lie on a set where some rows aggregated and others
 * fell back, and dropping the field on those responses would make the caller
 * branch on its absence. 'mixed' says the answer is per row.
 */
const collapseResolution = (accountsStatus) => {
 if (accountsStatus.length === 0) return 'native';

 const distinct = new Set(accountsStatus.map((r) => r.resolution));
 return distinct.size === 1 ? [...distinct][0] : 'mixed';
};

// Whole months between two canonical boundaries. Both are period starts, so
// this is exact and needs no day arithmetic.
const monthsInWindow = (period) =>
 (period.end.getUTCFullYear() - period.start.getUTCFullYear()) * 12
 + (period.end.getUTCMonth() - period.start.getUTCMonth());

/**
 * The one cross-category figure that survives rows on different frequencies.
 *
 * 600 over a quarter and 250 over a month cannot be added, so the sum in
 * `totals` is only meaningful when every row shares a window. This divides each
 * row by the length of the window it reports and adds the quotients, which gives
 * a figure the rows above it reconcile with: a row showing 60 over a year
 * contributes 5, not the 10 its allocation is worth, because 60 is what the
 * screen says.
 *
 * Budget only, per PLAN_F §6.3. Normalising the spend would turn a fact into an
 * average, and there is deliberately no equivalent Remaining: once normalised
 * that figure is a construction rather than money anyone can spend, and it must
 * never be mistaken for a balance.
 */
const makeMonthlyEquivalentBudget = (accountsStatus) =>
 accountsStatus.reduce((acc, r) => {
  const months = monthsInWindow(r.period);
  return months > 0 ? acc.plus(money(r.budgetAccumulatedAmount).dividedBy(months)) : acc;
 }, money(0));

/**
 * Aggregate a set of account statuses into the figures the Overview header shows.
 *
 * This exists so the frontend does not add them up itself. Summing on the
 * client is exactly the arithmetic this module was built to remove, and it
 * would reappear in a component instead of a service — the same bug in a file
 * nobody thinks to check.
 *
 * The percentage is recomputed from the totals, not averaged across accounts.
 * An average of percentages weights a category budgeted at 10 the same as one
 * budgeted at 10,000, which is not what "how much of my budget have I spent"
 * means.
 *
 * Unbudgeted accounts contribute their spending but no budget, so they pull
 * the totals in the honest direction: money spent with nothing allocated
 * behind it. budgetedCount lets the caller qualify the figure without
 * recounting.
 */
// The line values are already rounded by makeBudgetAccountStatus, and the totals
// are summed FROM them: the figure on screen must reconcile with the figures
// above it. Summing the unrounded values instead would let three displayed
// numbers contradict each other by a cent.
const makeTotals = (accountsStatus) => {
 const totals = accountsStatus.reduce(
  (acc, r) => ({
   budgetAccumulatedAmount: acc.budgetAccumulatedAmount.plus(r.budgetAccumulatedAmount),
   actualSpent: acc.actualSpent.plus(r.actualSpent),
  }),
  { budgetAccumulatedAmount: money(0), actualSpent: money(0) },
 );

 const difference = totals.budgetAccumulatedAmount.minus(totals.actualSpent);

 // Currencies are NOT converted here. Budget-level FX is a schema change, not
 // an aggregate, and inventing a rate at report time would produce a number no
 // stored row supports. A mixed set reports a null currency and says so.
 const currencies = new Set(accountsStatus.map((r) => r.currency));

 return {
  currency: currencies.size === 1 ? [...currencies][0] : null,
  accountCount: accountsStatus.length,
  budgetedCount: accountsStatus.filter((r) => r.isBudgeted).length,
  budgetAccumulatedAmount: toAmount(totals.budgetAccumulatedAmount),
  // Derived, never stored, and named so the screen cannot label it "budget".
  // The UI must render it as "Monthly Equivalent Budget": unlabelled, a
  // normalised figure reads as money available to spend, which it is not.
  monthlyEquivalentBudget: toAmount(makeMonthlyEquivalentBudget(accountsStatus)),
  actualSpent: toAmount(totals.actualSpent),
  remainingBudget: toAmount(difference),
  actualVsBudgetDifference: toAmount(difference),
  // No aggregate executionPercentage. Its denominator adds amounts that recur
  // on different periods, so the ratio compares a month of spending against a
  // sum of months, quarters and years. Per row it is exact and it stays there.
 };
};

const MIXED_CURRENCY_NOTICE =
 'Totals add amounts in more than one currency and are not converted.';

// Rows no longer share a window: each covers the period its own policy defines,
// so a quarterly row and a monthly row land in the same response over different
// date ranges. Adding them produces a figure nobody can read, and this reports
// it for the same reason the currency notice does rather than papering over it.
// The monthly equivalent that replaces the raw sum is a separate change.
const MIXED_PERIOD_NOTICE =
 'Totals add amounts from different budget periods and are not comparable.';

const periodKey = (accountStatus) =>
 `${accountStatus.period.start.getTime()}-${accountStatus.period.end.getTime()}`;

/**
 * Budget calculation service – read operations.
 * All functions receive a PostgreSQL connection pool as first argument.
 */
export const budgetCalculationService = {
 /**
  * Get the budget status of a single account.
  */
 async getSummary(pool, accountId, referenceDate, aggregationLevel = null, timeZone = 'UTC') {
  const accountsStatus = await readAccountsOverTheirOwnPeriods(
   pool,
   [accountId],
   referenceDate,
   aggregationLevel,
   timeZone,
  );

  // An owned category_budget account always produces an entry now, budgeted
  // or not, so this no longer fires for an account the user simply has not
  // budgeted. What is left is a genuine inconsistency: an id that passed the
  // caller's ownership check but has no category_budget_accounts row.
  if (accountsStatus.length === 0) {
   throw new Error(`budgetCalculationService: no budget account found for id ${accountId}`);
  }

  // Notices are a list, and `meta` is always an object. A singular `notice`
  // field can only carry the first thing worth saying, so anything after it is
  // dropped silently. The caller reads meta.notices and iterates: no null
  // check, and no shape change the day a second notice appears.
  return {
   budgetAccountStatus: accountsStatus[0],
   meta: { notices: [], resolution: collapseResolution(accountsStatus) },
  };
 },

 /**
  * Get the budget status of several accounts, plus the totals over them.
  */
 async getBudgetAccountsStatus(
  pool,
  accountIds,
  referenceDate,
  aggregationLevel = null,
  timeZone = 'UTC',
 ) {
  if (!accountIds || accountIds.length === 0) {
   return {
    budgetAccountsStatus: [],
    totals: makeTotals([]),
    meta: { notices: [], resolution: 'native' },
   };
  }

  const accountsStatus = await readAccountsOverTheirOwnPeriods(
   pool,
   accountIds,
   referenceDate,
   aggregationLevel,
   timeZone,
  );
  const totals = makeTotals(accountsStatus);
  const notices = [];

  if (totals.currency === null && accountsStatus.length > 0) {
   notices.push(MIXED_CURRENCY_NOTICE);
  }

  if (new Set(accountsStatus.map(periodKey)).size > 1) {
   notices.push(MIXED_PERIOD_NOTICE);
  }

  return {
   budgetAccountsStatus: accountsStatus,
   totals,
   meta: { notices, resolution: collapseResolution(accountsStatus) },
  };
 },
};
