// src/fintrack_api/services/budget_services/services/budgetCalculationService.js

// Budget Calculation Service – Read operations for budget summaries.
// Orchestrates data fetching, period resolution, and metric calculation.
// Currency is obtained from in-memory catalog (no DB queries).
//
// The word "frequency" names two different things and conflating them was a
// defect. The frequency in the REQUEST resolves the query window: which date
// range to look at. The frequency stored on each ALLOCATION is the multiplier:
// how often that budget recurs. Only the second one may reach the arithmetic,
// which is why it never leaves the calculator's parameters here.

import { resolvePeriod } from '../../../../utils/fintrackUtils/date-utils/periodResolver.js';
import { getBudgetDataForAccounts } from '../db/budgetTransactionRepository.js';
import { calculateBudgetVsActual } from '../calculators/budgetVsActualCalculator.js';
import { makeBudgetResult } from '../core/makeBudgetResult.js';
import { money, toAmount, toRate } from '../core/money.js';
import { getCurrencyCodeSync } from '../../../../utils/currencyLookup.js';

/**
 * Resolve the window to report on.
 *
 * The window is the calendar period the reference date falls in, sized by the
 * requested frequency. There is no other way to obtain one.
 *
 * A budget is a property of a canonical period, not of a query window (PLAN_F
 * §0). The branch that took an arbitrary startDate/endDate pair answered "what
 * was budgeted between these two dates" — a question with no answer, because no
 * budget was ever defined over those dates. The figure it returned was a
 * prorated invention.
 *
 * Notices are a list, and `meta` is always an object. A singular `notice` field
 * can only carry the first thing worth saying, so anything after it is dropped
 * silently. The caller reads meta.notices and iterates: no null check, and no
 * shape change the day a second notice appears.
 */
const resolveWindow = (windowFrequencyCode, referenceDate) => {
 const period = resolvePeriod(windowFrequencyCode, referenceDate);
 return { startDate: period.start, endDate: period.end, notices: [] };
};

/**
 * Result for an account with no budget figure to report for this window.
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
const makeNoBudgetResult = ({
 accountId,
 isBudgeted,
 budgetPolicy,
 currency,
 actualSpent,
 startDate,
 endDate,
}) =>
 makeBudgetResult({
  accountId,
  isBudgeted,
  currency,
  period: { start: startDate, end: endDate },
  budgetPolicy: budgetPolicy ?? null,
  budgetAllocation: null,
  budgetAccumulatedAmount: 0,
  actualSpent,
  remainingBudget: money(actualSpent).negated(),
  actualVsBudgetDifference: money(actualSpent).negated(),
  executionPercentage: 0,
 });

/**
 * Turn one repository entry into a BudgetResult.
 */
const buildResult = (entry, startDate, endDate) => {
 const currency = getCurrencyCodeSync(entry.currencyId);
 const isBudgeted = entry.budgetPolicyId !== null;

 if (!isBudgeted) {
  return makeNoBudgetResult({
   accountId: entry.accountId,
   isBudgeted: false,
   budgetPolicy: null,
   currency,
   actualSpent: entry.actualSpent,
   startDate,
   endDate,
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
  return makeNoBudgetResult({
   accountId: entry.accountId,
   isBudgeted: true,
   budgetPolicy,
   currency,
   actualSpent: entry.actualSpent,
   startDate,
   endDate,
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
 });
};

/**
 * Aggregate a set of results into the figures the Overview header shows.
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
// The line values are already rounded by makeBudgetResult, and the totals are
// summed FROM them: the figure on screen must reconcile with the figures above
// it. Summing the unrounded values instead would let three displayed numbers
// contradict each other by a cent.
const makeTotals = (results) => {
 const totals = results.reduce(
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
 const currencies = new Set(results.map((r) => r.currency));

 return {
  currency: currencies.size === 1 ? [...currencies][0] : null,
  accountCount: results.length,
  budgetedCount: results.filter((r) => r.isBudgeted).length,
  budgetAccumulatedAmount: toAmount(totals.budgetAccumulatedAmount),
  actualSpent: toAmount(totals.actualSpent),
  remainingBudget: toAmount(difference),
  actualVsBudgetDifference: toAmount(difference),
  executionPercentage: totals.budgetAccumulatedAmount.isZero()
   ? 0
   : toRate(totals.actualSpent.dividedBy(totals.budgetAccumulatedAmount).times(100)),
 };
};

const MIXED_CURRENCY_NOTICE =
 'Totals add amounts in more than one currency and are not converted.';

/**
 * Budget calculation service – read operations.
 * All functions receive a PostgreSQL connection pool as first argument.
 */
export const budgetCalculationService = {
 /**
  * Get budget summary for a single account.
  */
  async getSummary(pool, accountId, windowFrequencyCode, referenceDate) {
    const { startDate, endDate, notices } = resolveWindow(
      windowFrequencyCode,
      referenceDate,
    );

    const entries = await getBudgetDataForAccounts(pool, [accountId], startDate, endDate);

    // An owned category_budget account always produces an entry now, budgeted
    // or not, so this no longer fires for an account the user simply has not
    // budgeted. What is left is a genuine inconsistency: an id that passed the
    // caller's ownership check but has no category_budget_accounts row.
    if (entries.length === 0) {
      throw new Error(`budgetCalculationService: no budget account found for id ${accountId}`);
    }

    return {
      result: buildResult(entries[0], startDate, endDate),
      meta: { notices },
    };
  },

  /**
   * Get budget summaries for multiple accounts.
   */
  async getMultiSummary(pool, accountIds, windowFrequencyCode, referenceDate) {
    if (!accountIds || accountIds.length === 0) {
      return { results: [], totals: makeTotals([]), meta: { notices: [] } };
    }

    const { startDate, endDate, notices } = resolveWindow(
      windowFrequencyCode,
      referenceDate,
    );

    const entries = await getBudgetDataForAccounts(pool, accountIds, startDate, endDate);
    const results = entries.map((entry) => buildResult(entry, startDate, endDate));
    const totals = makeTotals(results);

    if (totals.currency === null && results.length > 0) {
      notices.push(MIXED_CURRENCY_NOTICE);
    }

    return { results, totals, meta: { notices } };
  },
};
