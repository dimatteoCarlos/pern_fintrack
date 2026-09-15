// Contract tests for composeExecutiveSummaryRows, the pure half of
// statementService.js — exercised with plain objects shaped like
// overviewPageService.getOverviewPage's result and getPriorYearClose's
// result, no pool.

import test from 'node:test';
import assert from 'node:assert/strict';

import { composeExecutiveSummaryRows } from '../../src/export_api/services/statementService.js';
import { NO_DEBT_LEGS_NOTICE } from '../../src/fintrack_api/services/overview_services/core/makeHeroSection.js';

const baseOverview = {
 hero: {
  netMonthlyFlow: 1550,
  savingsRate: 0.24,
  netWorth: 43250,
  liquidNetWorth: 42250,
  cashPosition: 18000,
  freeCash: 15000,
  meta: { notices: [] },
 },
 domainCards: {
  income: { totalAmount: 6500 },
  expense: { totalAmount: 4950 },
  debt: { totalAmount: 300, receivable: 500, payable: 200 },
  pocket: { totalAmount: 3000 },
 },
 monthlySnapshot: [
  { domain: 'income', yearToDate: 58000 },
  { domain: 'expense', yearToDate: 44000 },
  { domain: 'pocket', yearToDate: 0 },
 ],
};

const basePriorClose = {
 hero: {
  netWorth: 35300,
  liquidNetWorth: 34600,
  cashPosition: 16000,
  freeCash: 13500,
 },
 debtPosition: 100,
 receivable: 300,
 payable: 150,
 pocketsCommitted: 2200,
};

const findRow = (rows, metric) => rows.find((row) => row.metric === metric);

test('the month value is read straight from the reference month\'s overview, unchanged', () => {
 const rows = composeExecutiveSummaryRows(baseOverview, basePriorClose);

 assert.equal(findRow(rows, 'income').month, 6500);
 assert.equal(findRow(rows, 'expenses').month, 4950);
 assert.equal(findRow(rows, 'netMonthlyFlow').month, 1550);
 assert.equal(findRow(rows, 'netWorth').month, 43250);
 assert.equal(findRow(rows, 'netDebtPosition').month, 300);
 assert.equal(findRow(rows, 'pocketsCommitted').month, 3000);
});

test('year to date on a flow is the year\'s accumulated total, not a change', () => {
 const rows = composeExecutiveSummaryRows(baseOverview, basePriorClose);

 assert.equal(findRow(rows, 'income').yearToDate, 58000);
 assert.equal(findRow(rows, 'expenses').yearToDate, 44000);
 assert.equal(findRow(rows, 'netMonthlyFlow').yearToDate, 14000);
});

test('year to date on a balance is the change against the prior December close', () => {
 const rows = composeExecutiveSummaryRows(baseOverview, basePriorClose);

 assert.equal(findRow(rows, 'netWorth').yearToDate, 7950);
 assert.equal(findRow(rows, 'cashPosition').yearToDate, 2000);
 assert.equal(findRow(rows, 'freeCash').yearToDate, 1500);
 assert.equal(findRow(rows, 'netDebtPosition').yearToDate, 200);
 assert.equal(findRow(rows, 'receivable').yearToDate, 200);
 assert.equal(findRow(rows, 'payable').yearToDate, 50);
 assert.equal(findRow(rows, 'pocketsCommitted').yearToDate, 800);
});

test('a missing payable leg withholds liquid net worth\'s year to date with its own notice', () => {
 const overview = { ...baseOverview, hero: { ...baseOverview.hero, liquidNetWorth: null } };

 const rows = composeExecutiveSummaryRows(overview, basePriorClose);
 const liquidRow = findRow(rows, 'liquidNetWorth');

 assert.equal(liquidRow.month, null);
 assert.equal(liquidRow.yearToDate, null);
 assert.deepEqual(liquidRow.notices, [NO_DEBT_LEGS_NOTICE]);
});

test('a missing prior December payable leg also withholds the year to date change', () => {
 const priorClose = { ...basePriorClose, hero: { ...basePriorClose.hero, liquidNetWorth: null } };

 const rows = composeExecutiveSummaryRows(baseOverview, priorClose);
 const liquidRow = findRow(rows, 'liquidNetWorth');

 // The month value still resolved; only the year to date change could not.
 assert.equal(liquidRow.month, 42250);
 assert.equal(liquidRow.yearToDate, null);
 assert.deepEqual(liquidRow.notices, [NO_DEBT_LEGS_NOTICE]);
});

test('no income this year withholds the savings rate\'s year to date with its own notice', () => {
 const overview = {
  ...baseOverview,
  monthlySnapshot: [
   { domain: 'income', yearToDate: 0 },
   { domain: 'expense', yearToDate: 44000 },
   { domain: 'pocket', yearToDate: 0 },
  ],
 };

 const rows = composeExecutiveSummaryRows(overview, basePriorClose);
 const rateRow = findRow(rows, 'savingsRate');

 assert.equal(rateRow.yearToDate, null);
 assert.equal(rateRow.notices.length, 1);
});

test('the result and every row are frozen', () => {
 const rows = composeExecutiveSummaryRows(baseOverview, basePriorClose);

 assert.ok(Object.isFrozen(rows));
 assert.ok(Object.isFrozen(rows[0]));
 assert.ok(Object.isFrozen(rows[0].notices));
});
