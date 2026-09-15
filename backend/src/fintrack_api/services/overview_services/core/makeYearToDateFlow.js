// src/fintrack_api/services/overview_services/core/makeYearToDateFlow.js

// The calendar year's net flow and savings rate: PLAN_EXPORT.md commit 5a,
// feeding the Period Statement's Year to date column.
//
// Reuses savingsRateOf (makeHeroSection.js) on the year's income and the
// year's net flow instead of writing the zero/negative-denominator guard a
// second time. The year rate is a quotient of sums (year net flow over year
// income), never an average of the monthly rates: three fat months and nine
// lean ones read as one figure, the way the year actually went, instead of
// letting twelve unequal rates cancel each other out.
//
// Takes the two totals already accumulated, not a month series of its own:
// makeMonthlySnapshot.js:122 already sums the calendar year out of the
// thirteen-month window it reads for MS1-MS4, once per domain
// (`domain: 'income'` and `domain: 'expense'`), so this function is called
// with each result's own `yearToDate` field rather than querying again.

import { money, toAmount } from '../../budget_services/core/money.js';
import { savingsRateOf } from './makeHeroSection.js';

// Said when the calendar year recorded no income at all up to the reference
// month, mirroring NO_INCOME_NOTICE (makeHeroSection.js) but scoped to the
// year: a reader has to know which window is empty, month or year.
export const NO_YEAR_INCOME_NOTICE =
 'No income was recorded this year, so the year to date savings rate is not reported.';

// Said when the year's accumulated income is negative, mirroring
// NEGATIVE_INCOME_NOTICE at the year's scope.
export const NEGATIVE_YEAR_INCOME_NOTICE =
 'The recorded income for this year is negative, so the year to date savings rate is not reported.';

/**
 * Build the frozen YearToDateFlow.
 *
 * @param {object} input
 * @param {number} input.incomeYearToDate - the calendar year's accumulated income
 * @param {number} input.expenseYearToDate - the calendar year's accumulated expense
 * @param {string[]} [input.notices]
 * @returns {object} frozen { netYearToDateFlow, yearToDateSavingsRate, meta }
 */
export const makeYearToDateFlow = ({
 incomeYearToDate,
 expenseYearToDate,
 notices = [],
}) => {
 const income = money(incomeYearToDate);
 // Computed once and used twice, so the published amount and the rate's
 // numerator cannot drift apart the way two separate expressions eventually
 // do (the same reason makeHeroSection.js computes netFlow once for H3 and
 // the savings rate).
 const netFlow = income.minus(expenseYearToDate);
 const yearToDateSavingsRate = savingsRateOf(income, netFlow);

 const flowNotices = [...notices];
 if (yearToDateSavingsRate === null) {
  flowNotices.push(
   income.isZero() ? NO_YEAR_INCOME_NOTICE : NEGATIVE_YEAR_INCOME_NOTICE,
  );
 }

 return Object.freeze({
  netYearToDateFlow: toAmount(netFlow),
  yearToDateSavingsRate,
  meta: Object.freeze({
   notices: Object.freeze(flowNotices),
   provenance: null,
  }),
 });
};
