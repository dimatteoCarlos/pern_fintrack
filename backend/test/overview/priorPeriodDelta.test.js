// Contract tests for the change against the prior month.
//
// The case worth freezing is the middle one. Until 2026-09-09 there were two
// answers for three situations: a prior month the owner held an account for all
// of, one they held an account for part of, and no prior month at all. The
// second and the third shared an answer, so a September card said "no prior
// month to compare" while August sat beside it holding a figure.
//
// What makes the middle case reachable is that the guard reads the ACCOUNT'S
// AGE and not the presence of rows: a month with real transactions in it still
// fails a test written against the first of the month if the account was opened
// on the fourteenth.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
 makePeriodDelta,
 priorPeriodNotices,
 NO_PRIOR_PERIOD_NOTICE,
 PARTIAL_PRIOR_PERIOD_NOTICE,
} from '../../src/fintrack_api/services/overview_services/core/makeDomainCard.js';

const months = [
 { month: '2026-08-01', totalAmount: 100, transactionCount: 3 },
 { month: '2026-09-01', totalAmount: 180, transactionCount: 5 },
];

const deltaFor = (oldestAccountDate) => makePeriodDelta({
 months,
 referenceMonth: '2026-09-01',
 priorMonth: '2026-08-01',
 oldestAccountDate,
});

test('an account older than the prior month gives a complete comparison', () => {
 const { delta, priorPeriodCoverage } = deltaFor('2026-07-15');

 assert.equal(priorPeriodCoverage, 'complete');
 assert.equal(delta, 80);
 assert.deepEqual(priorPeriodNotices(priorPeriodCoverage), []);
});

test('an account opened during the prior month still reports the change', () => {
 const { delta, priorPeriodCoverage } = deltaFor('2026-08-14');

 assert.equal(priorPeriodCoverage, 'partial');
 // The figure is the same subtraction as the complete case. What differs is the
 // caveat, not the arithmetic: suppressing the delta here is the behaviour this
 // test exists to prevent from coming back.
 assert.equal(delta, 80);
 assert.deepEqual(priorPeriodNotices(priorPeriodCoverage), [PARTIAL_PRIOR_PERIOD_NOTICE]);
});

test('the boundaries of the prior month land on the right side', () => {
 // Opened on the first of the prior month: held for every day of it, so
 // complete. The predicate was < and not <= until 2026-09-09, which put this
 // day on the partial side and attached a caveat to a full comparison.
 assert.equal(deltaFor('2026-08-01').priorPeriodCoverage, 'complete');
 assert.equal(deltaFor('2026-07-31').priorPeriodCoverage, 'complete');
 // The last day of the prior month is still part of it.
 assert.equal(deltaFor('2026-08-31').priorPeriodCoverage, 'partial');
 // The first day of the reference month holds no part of the prior one.
 assert.equal(deltaFor('2026-09-01').priorPeriodCoverage, 'none');
});

test('an account opened during the reference month has nothing to compare against', () => {
 const { delta, priorPeriodCoverage } = deltaFor('2026-09-02');

 assert.equal(priorPeriodCoverage, 'none');
 // The prior row exists — generate_series fabricates it — and it is a zero for
 // a month the owner did not exist in. Comparing against it would read as a
 // rise from nothing, which is the rule that did not change.
 assert.equal(delta, null);
 assert.deepEqual(priorPeriodNotices(priorPeriodCoverage), [NO_PRIOR_PERIOD_NOTICE]);
});

test('an owner with no accounts has no prior period, not a prior period of zero', () => {
 const { delta, priorPeriodCoverage } = deltaFor(null);

 assert.equal(priorPeriodCoverage, 'none');
 assert.equal(delta, null);
});

test('the reference point is read off the series, so the card and the chart cannot disagree', () => {
 const { currentPoint } = deltaFor('2026-07-15');

 assert.equal(currentPoint.totalAmount, 180);
 assert.equal(currentPoint.transactionCount, 5);
});
