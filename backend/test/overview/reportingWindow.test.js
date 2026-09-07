// Contract tests for the reporting window.
//
// The window is where the module answers "which period is this", and the
// contract makes that an obligation: the server reports the window it used and
// the client never infers it from its own clock. These tests hold the two
// statements that obligation rests on — a running month stops at the reference
// date, and a closed one stops at its own last day.
//
// No database. The builder is pure and the clock arrives as an argument, which
// is what makes the running-month case testable at all: a builder reading the
// clock itself could only be tested on the day the test was written.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
 TREND_MONTHS,
 makeReportingWindow,
 monthEndDate,
 servedWindow,
 shiftMonths,
} from '../../src/fintrack_api/services/overview_services/core/monthArithmetic.js';

test('a closed month ends on its own last day', () => {
 const window = makeReportingWindow('2026-08-01', '2026-09-01', '2026-09-07');

 assert.equal(window.periodStart, '2026-08-01');
 assert.equal(window.periodEnd, '2026-08-31');
 assert.equal(window.isCurrentMonth, false);
});

test('the running month ends on the reference date, not on the month end', () => {
 const window = makeReportingWindow('2026-09-01', '2026-09-01', '2026-09-07');

 assert.equal(window.periodEnd, '2026-09-07');
 assert.equal(window.isCurrentMonth, true);
 assert.notEqual(window.periodEnd, monthEndDate('2026-09-01'));
});

test('a day past the served month is clamped to that month', () => {
 // The two clocks disagreeing is the case this covers: the database still calls
 // September current while the process has already rolled into October. A
 // reference date outside the month served would be a period no figure was cut
 // at.
 const window = makeReportingWindow('2026-09-01', '2026-09-01', '2026-10-01');

 assert.equal(window.periodEnd, '2026-09-30');
});

test('the last day of a running month is the month end and not a clamp', () => {
 const window = makeReportingWindow('2026-09-01', '2026-09-01', '2026-09-30');

 assert.equal(window.periodEnd, '2026-09-30');
 assert.equal(window.isCurrentMonth, true);
});

test('the trend reaches back exactly TREND_MONTHS points, the reference month included', () => {
 const window = makeReportingWindow('2026-09-01', '2026-09-01', '2026-09-07');

 assert.equal(window.trendStart, shiftMonths('2026-09-01', -(TREND_MONTHS - 1)));
 assert.equal(window.trendStart, '2026-04-01');
 assert.equal(window.priorMonth, '2026-08-01');
});

test('the prior month crosses a year boundary', () => {
 const window = makeReportingWindow('2026-01-01', '2026-01-01', '2026-01-15');

 assert.equal(window.priorMonth, '2025-12-01');
 assert.equal(window.trendStart, '2025-08-01');
});

test('the window is frozen, so nothing downstream can retune the period', () => {
 const window = makeReportingWindow('2026-09-01', '2026-09-01', '2026-09-07');

 assert.equal(Object.isFrozen(window), true);
});

test('a window built without the clock throws instead of defaulting', () => {
 // A silent default here would report isCurrentMonth false for every request
 // and end every running month at its last day — the exact defect these tests
 // exist to hold, arriving through an omitted argument.
 assert.throws(() => makeReportingWindow('2026-09-01'), /current month and day/);
 assert.throws(() => makeReportingWindow('2026-09-01', '2026-09-01'), /current month and day/);
});

test('the published window carries the period and not the trend bounds', () => {
 const window = makeReportingWindow('2026-09-01', '2026-09-01', '2026-09-07');
 const served = servedWindow(window);

 assert.deepEqual(Object.keys(served).sort(), [
  'isCurrentMonth',
  'periodEnd',
  'periodStart',
  'referenceMonth',
 ]);
 assert.equal(served.referenceMonth, '2026-09-01');
 assert.equal(served.periodEnd, '2026-09-07');
 assert.equal(Object.isFrozen(served), true);
});
