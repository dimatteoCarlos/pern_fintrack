// Contract tests for the level-2 sections.
//
// Level 2 exists to decompose figures level 1 already publishes, so the property
// every one of these builders owes is the same: a part cannot disagree with the
// whole it came from. These tests hold that arithmetic, and the two conventions
// that carry meaning beside it — absent is "no statement was run" while empty is
// "the owner has none", and a withheld ratio is null and never 0.
//
// No database. Every builder is pure and takes the rows a repository would have
// returned.

import test from 'node:test';
import assert from 'node:assert/strict';

import { MINIMUM_AMOUNT } from '../../src/fintrack_api/services/budget_services/core/money.js';
import {
 ANALYSIS_DERIVED,
 ANALYSIS_FULL,
 isFullAnalysis,
 wantsAnalysis,
} from '../../src/fintrack_api/services/overview_services/core/analysisLevels.js';
import { makeDistribution } from '../../src/fintrack_api/services/overview_services/core/makeDistribution.js';
import {
 makeIncomeAnalysis,
 UNATTRIBUTED_INCOME_NOTICE,
} from '../../src/fintrack_api/services/overview_services/core/makeIncomeAnalysis.js';
import {
 makeExpenseAnalysis,
 NO_CATEGORIZATION_NOTICE,
} from '../../src/fintrack_api/services/overview_services/core/makeExpenseAnalysis.js';
import { makePnlAnalysis } from '../../src/fintrack_api/services/overview_services/core/makePnlAnalysis.js';
import {
 makeInvestmentAnalysis,
 NO_CONTRIBUTION_HISTORY_NOTICE,
 NO_PORTFOLIO_NOTICE,
} from '../../src/fintrack_api/services/overview_services/core/makeInvestmentAnalysis.js';
import {
 ANALYSIS_NEEDS_FULL_NOTICE,
 makeDebtAnalysis,
 NO_DEBT_NOTICE,
 OWED_BY_USER,
 OWED_TO_USER,
 SETTLED,
} from '../../src/fintrack_api/services/overview_services/core/makeDebtAnalysis.js';
import {
 makePocketAnalysis,
 NO_POCKETS_PLANNED_NOTICE,
 OVERCOMMITTED_NOTICE,
} from '../../src/fintrack_api/services/overview_services/core/makePocketAnalysis.js';

const months = [
 { month: '2026-08-01', totalAmount: 100 },
 { month: '2026-09-01', totalAmount: 200 },
];

test('an absent level asks for no analysis at all', () => {
 // The default, and the reason a client that has not been updated receives the
 // payload it received before level 2 existed.
 assert.equal(wantsAnalysis(undefined), false);
 assert.equal(wantsAnalysis('deep'), false);
 assert.equal(wantsAnalysis(ANALYSIS_DERIVED), true);
 assert.equal(isFullAnalysis(ANALYSIS_DERIVED), false);
 assert.equal(isFullAnalysis(ANALYSIS_FULL), true);
});

test('a distribution ranks by amount and breaks ties by label', () => {
 const ranked = makeDistribution(
  [
   { label: 'Bravo', amount: 25 },
   { label: 'Alfa', amount: 25 },
   { label: 'Charlie', amount: 50 },
  ],
  100,
 );

 assert.deepEqual(ranked.map((part) => part.label), ['Charlie', 'Alfa', 'Bravo']);
 assert.deepEqual(ranked.map((part) => part.rank), [1, 2, 3]);
 assert.deepEqual(ranked.map((part) => part.share), [0.5, 0.25, 0.25]);
});

test('a share carries four decimals, not the two an amount carries', () => {
 // 1% resolution would collapse the tail of a distribution: every source under
 // one percent would report the same share.
 const [part] = makeDistribution([{ label: 'Only', amount: 1 }], 3000);

 assert.equal(part.share, 0.0003);
});

test('a share of nothing is null and never zero', () => {
 const [part] = makeDistribution([{ label: 'Only', amount: 0 }], 0);

 assert.equal(part.share, null);
});

test('a distribution keeps the fields the caller put on the row', () => {
 const [part] = makeDistribution([{ label: 'Salary', accountId: 7, amount: 10 }], 10);

 assert.equal(part.accountId, 7);
 assert.equal(part.share, 1);
});

test('income shares are shares of the card figure and concentration is read off them', () => {
 const analysis = makeIncomeAnalysis({
  level: ANALYSIS_FULL,
  months,
  totalAmount: 200,
  sources: [
   { accountId: 1, accountName: 'Salary', amount: 150 },
   { accountId: 2, accountName: 'Rent', amount: 50 },
  ],
 });

 assert.equal(analysis.bySource[0].share, 0.75);
 // Read, never recomputed: the headline ratio and the first row of the list
 // cannot disagree.
 assert.equal(analysis.concentration, analysis.bySource[0].share);
 assert.deepEqual(analysis.meta.notices, []);
});

test('income with no attributed source says so and still ranks it', () => {
 const analysis = makeIncomeAnalysis({
  level: ANALYSIS_FULL,
  months,
  totalAmount: 200,
  sources: [
   { accountId: null, accountName: null, amount: 120 },
   { accountId: 3, accountName: 'Salary', amount: 80 },
  ],
 });

 assert.ok(analysis.meta.notices.includes(UNATTRIBUTED_INCOME_NOTICE));
 assert.equal(analysis.bySource[0].accountId, null);
 assert.equal(analysis.bySource[0].share, 0.6);
});

test('the derived income level runs no source statement', () => {
 const analysis = makeIncomeAnalysis({
  level: ANALYSIS_DERIVED,
  months,
  totalAmount: 200,
  sources: undefined,
 });

 assert.equal(analysis.bySource, undefined);
 assert.equal(analysis.concentration, undefined);
 assert.equal(analysis.series.length, 2);
});

test('the expense split sums back to the card total', () => {
 const analysis = makeExpenseAnalysis({
  level: ANALYSIS_DERIVED,
  months,
  totalAmount: 200,
  categorizedExpense: 120,
 });

 assert.equal(analysis.categorization.categorized, 120);
 assert.equal(analysis.categorization.uncategorized, 80);
});

test('an expense with no budget withholds the split instead of reporting zero', () => {
 const analysis = makeExpenseAnalysis({
  level: ANALYSIS_DERIVED,
  months,
  totalAmount: 200,
  categorizedExpense: null,
 });

 assert.equal(analysis.categorization, undefined);
 assert.deepEqual(analysis.meta.notices, [NO_CATEGORIZATION_NOTICE]);
});

test('the two parts of a losing month still partition its result', () => {
 const analysis = makePnlAnalysis({
  level: ANALYSIS_DERIVED,
  months,
  totalAmount: -300,
  realizedFromInvestment: -500,
 });

 // A negative part is a real answer here, and the pair still adds up: a loss on
 // the investment accounts beside a gain everywhere else.
 assert.equal(analysis.byAccountType.investment, -500);
 assert.equal(analysis.byAccountType.other, 200);
 assert.deepEqual(analysis.meta.notices, []);
});

const balancedCard = {
 capitalContributed: 1000,
 realizedPnl: 250,
 closureAdjustment: -50,
 ledgerBalance: 1200,
};

test('a reconciliation that closes publishes zero against its own tolerance', () => {
 const analysis = makeInvestmentAnalysis({
  level: ANALYSIS_DERIVED,
  card: balancedCard,
 });

 assert.equal(analysis.reconciliation.difference, 0);
 // Published rather than assumed: a client finding anything under this has
 // found floating point, not a discrepancy.
 assert.equal(analysis.reconciliation.tolerance, MINIMUM_AMOUNT);
 assert.equal(analysis.balanceByAccount, undefined);
 assert.equal(analysis.contributionHistory, undefined);
});

test('a reconciliation that does not close publishes the signed gap', () => {
 const analysis = makeInvestmentAnalysis({
  level: ANALYSIS_DERIVED,
  card: { ...balancedCard, ledgerBalance: 1150 },
 });

 assert.equal(analysis.reconciliation.difference, 50);
 assert.ok(Math.abs(analysis.reconciliation.difference) > analysis.reconciliation.tolerance);
});

test('the investment portfolio distributes over the ledger balance the card published', () => {
 const analysis = makeInvestmentAnalysis({
  level: ANALYSIS_FULL,
  card: balancedCard,
  balances: [
   { accountId: 1, accountName: 'Broker', balance: 900 },
   { accountId: 2, accountName: 'Fund', balance: 300 },
  ],
  contributions: { rows: [{ transactionId: 4, amount: 1000 }], totalRows: 12 },
 });

 assert.deepEqual(analysis.balanceByAccount.map((part) => part.share), [0.75, 0.25]);
 // A page of a history, and the count says so. Three rows off an owner with
 // twelve contributions would otherwise read as an owner with three.
 assert.equal(analysis.contributionHistory.rows.length, 1);
 assert.equal(analysis.contributionHistory.totalRows, 12);
});

test('an empty portfolio and an empty history are two separate notices', () => {
 const analysis = makeInvestmentAnalysis({
  level: ANALYSIS_FULL,
  card: balancedCard,
  balances: [],
  contributions: { rows: [], totalRows: 0 },
 });

 assert.deepEqual(analysis.meta.notices, [NO_PORTFOLIO_NOTICE, NO_CONTRIBUTION_HISTORY_NOTICE]);
 assert.equal(analysis.balanceByAccount, undefined);
 assert.equal(analysis.contributionHistory, undefined);
});

const debtMonths = ['2026-08-01', '2026-09-01'];
const debtBalances = [
 { month: '2026-08-01', accountId: 1, accountName: 'Ana', balance: 300 },
 { month: '2026-08-01', accountId: 2, accountName: 'Beto', balance: -100 },
 { month: '2026-09-01', accountId: 1, accountName: 'Ana', balance: 300 },
 { month: '2026-09-01', accountId: 2, accountName: 'Beto', balance: -500 },
 { month: '2026-09-01', accountId: 3, accountName: 'Cora', balance: 0 },
];

test('the derived debt level publishes nothing and says why', () => {
 // The net series is already fetched and would be free. It is refused because a
 // net position that has not moved is exactly what hides both legs doubling,
 // which is the reading this level exists to stop.
 const analysis = makeDebtAnalysis({ level: ANALYSIS_DERIVED });

 assert.equal(analysis.byCounterparty, undefined);
 assert.equal(analysis.legsOverTime, undefined);
 assert.deepEqual(analysis.meta.notices, [ANALYSIS_NEEDS_FULL_NOTICE]);
});

test('an owner with no counterparty gets the empty notice, not the level one', () => {
 const analysis = makeDebtAnalysis({
  level: ANALYSIS_FULL,
  balances: [],
  months: debtMonths,
  referenceMonth: '2026-09-01',
 });

 assert.deepEqual(analysis.meta.notices, [NO_DEBT_NOTICE]);
});

test('counterparties rank by magnitude, so the largest debt outranks a smaller credit', () => {
 const analysis = makeDebtAnalysis({
  level: ANALYSIS_FULL,
  balances: debtBalances,
  months: debtMonths,
  referenceMonth: '2026-09-01',
 });

 assert.deepEqual(analysis.byCounterparty.map((row) => row.accountName), ['Beto', 'Ana', 'Cora']);
 assert.deepEqual(analysis.byCounterparty.map((row) => row.direction), [
  OWED_BY_USER,
  OWED_TO_USER,
  SETTLED,
 ]);
 // The ranking is taken at the reference month and at no other: August's rows
 // are in the same result set and must not reach it.
 assert.equal(analysis.byCounterparty.length, 3);
});

test('both debt legs are positive magnitudes, one point per month', () => {
 const analysis = makeDebtAnalysis({
  level: ANALYSIS_FULL,
  balances: debtBalances,
  months: debtMonths,
  referenceMonth: '2026-09-01',
 });

 assert.deepEqual(analysis.legsOverTime, [
  { month: '2026-08', receivable: 300, payable: 100 },
  { month: '2026-09', receivable: 300, payable: 500 },
 ]);
});

test('the ranking leaves the repository rows in the order they arrived', () => {
 const rows = [...debtBalances];
 const first = rows[0];

 makeDebtAnalysis({
  level: ANALYSIS_FULL,
  balances: rows,
  months: debtMonths,
  referenceMonth: '2026-09-01',
 });

 assert.equal(rows[0], first);
});

const pockets = [{ pocketId: 1, name: 'Trip', target: 500, allocated: 200 }];

test('the derived pocket level publishes the plans and not the cash comparison', () => {
 const analysis = makePocketAnalysis({
  level: ANALYSIS_DERIVED,
  months,
  pockets,
  committed: 200,
 });

 assert.equal(analysis.progressByPocket.length, 1);
 assert.equal(analysis.committedAgainstFree, undefined);
});

test('an owner with no plan gets a notice instead of an empty list', () => {
 const analysis = makePocketAnalysis({
  level: ANALYSIS_DERIVED,
  months,
  pockets: [],
  committed: 0,
 });

 assert.equal(analysis.progressByPocket, undefined);
 assert.deepEqual(analysis.meta.notices, [NO_POCKETS_PLANNED_NOTICE]);
});

test('the three cash terms add up when no account is overcommitted', () => {
 const analysis = makePocketAnalysis({
  level: ANALYSIS_FULL,
  months,
  pockets,
  committed: 200,
  bankBalance: 1000,
  freeCash: 800,
 });

 assert.equal(analysis.committedAgainstFree.flooredShortfall, 0);
 assert.deepEqual(analysis.meta.notices, []);
});

test('the floored shortfall is what the per-account floor absorbed', () => {
 // One account holds 100 against 300 committed and another holds 900 against
 // nothing: free cash is 900, not 700, because a surplus cannot cover another
 // account's shortfall. The gap is published rather than left to a subtraction
 // that would produce a wrong number for exactly the owner who needs it right.
 const analysis = makePocketAnalysis({
  level: ANALYSIS_FULL,
  months,
  pockets,
  committed: 300,
  bankBalance: 1000,
  freeCash: 900,
 });

 assert.equal(analysis.committedAgainstFree.flooredShortfall, 200);
});

test('promising more than the accounts hold is reported and is not an error', () => {
 const analysis = makePocketAnalysis({
  level: ANALYSIS_FULL,
  months,
  pockets,
  committed: 1200,
  bankBalance: 1000,
  freeCash: 0,
 });

 assert.ok(analysis.meta.notices.includes(OVERCOMMITTED_NOTICE));
 assert.equal(analysis.committedAgainstFree.bankBalance, 1000);
});
