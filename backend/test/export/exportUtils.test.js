// Contract tests for the Budget CSV export.
//
// The case worth freezing is the negative amount: escapeCsvField's formula
// guard matches a leading "-", which is also how every negative amount is
// written. Routing amounts through it turned a numeric cell into text.

import test from 'node:test';
import assert from 'node:assert/strict';

import { convertSeriesToCSV } from '../../src/utils/fintrackUtils/exportUtils.js';

const seriesWith = (months) => [
 { accountName: 'Groceries', subcategory: 'Food', currency: 'USD', months },
];

test('a negative remaining budget stays a plain number, not text', () => {
 const csv = convertSeriesToCSV(
  seriesWith([
   {
    month: '2026-09-01',
    budgetAmount: 100,
    actualSpent: 145,
    remainingBudget: -45,
    executionPercentage: 145,
   },
  ]),
 );

 const [, row] = csv.split('\r\n');
 assert.ok(row.includes(',-45.00,'), `expected a bare -45.00, got: ${row}`);
 assert.ok(!row.includes("'-45.00"), `remaining budget must not be quoted as text: ${row}`);
});

test('an account name starting with "=" is still guarded as a formula', () => {
 const csv = convertSeriesToCSV(
  seriesWith([
   {
    month: '2026-09-01',
    budgetAmount: 100,
    actualSpent: 50,
    remainingBudget: 50,
    executionPercentage: 50,
   },
  ]).map((account) => ({ ...account, accountName: '=cmd|/c calc' })),
 );

 const [, row] = csv.split('\r\n');
 assert.ok(row.startsWith("'=cmd|/c calc,"), `formula-like account name must stay guarded: ${row}`);
});

test('a null execution percentage renders as an empty cell, not 0.00', () => {
 const csv = convertSeriesToCSV(
  seriesWith([
   {
    month: '2026-09-01',
    budgetAmount: 0,
    actualSpent: 0,
    remainingBudget: 0,
    executionPercentage: null,
   },
  ]),
 );

 const [, row] = csv.split('\r\n');
 assert.equal(row, 'Groceries,Food,USD,monthly,2026-09-01,0.00,0.00,0.00,');
});
