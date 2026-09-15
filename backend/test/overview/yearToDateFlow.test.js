// Contract tests for the calendar year's net flow and savings rate.

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeYearToDateFlow } from '../../src/fintrack_api/services/overview_services/core/makeYearToDateFlow.js';

test('net year to date flow is income minus expense', () => {
 const flow = makeYearToDateFlow({ incomeYearToDate: 9000, expenseYearToDate: 6000 });

 assert.equal(flow.netYearToDateFlow, 3000);
 assert.equal(flow.yearToDateSavingsRate, 0.33);
});

test('the year rate is a quotient of sums, not an average of monthly rates', () => {
 const flow = makeYearToDateFlow({ incomeYearToDate: 18000, expenseYearToDate: 10000 });

 assert.equal(flow.netYearToDateFlow, 8000);
 assert.equal(flow.yearToDateSavingsRate, 0.44);
});

test('no income this year withholds the rate and still publishes the flow', () => {
 const flow = makeYearToDateFlow({ incomeYearToDate: 0, expenseYearToDate: 500 });

 // null and not 0: a year that took in nothing has no rate to report, not a
 // rate of zero.
 assert.equal(flow.yearToDateSavingsRate, null);
 assert.equal(flow.netYearToDateFlow, -500);
 assert.equal(
  flow.meta.notices[0],
  'No income was recorded this year, so the year to date savings rate is not reported.',
 );
});

test('negative year income withholds the rate with its own notice', () => {
 const flow = makeYearToDateFlow({ incomeYearToDate: -100, expenseYearToDate: 50 });

 assert.equal(flow.yearToDateSavingsRate, null);
 assert.equal(
  flow.meta.notices[0],
  'The recorded income for this year is negative, so the year to date savings rate is not reported.',
 );
});
