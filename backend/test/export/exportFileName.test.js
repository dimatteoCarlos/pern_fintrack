// Contract tests for export_api/core/exportFileName.js.
//
// The rule worth freezing: the name carries the months the data is about, not
// the day it was downloaded (PLAN_EXPORT.md §11).

import test from 'node:test';
import assert from 'node:assert/strict';

import { exportFileName } from '../../src/export_api/core/exportFileName.js';

test('no bounds names the file all-time', () => {
 assert.equal(
  exportFileName({ from: null, to: null, format: 'csv' }),
  'fintrack-movements-all-time.csv',
 );
});

test('the same month on both bounds names a single month', () => {
 assert.equal(
  exportFileName({ from: '2026-09-01', to: '2026-09-01', format: 'xlsx' }),
  'fintrack-movements-2026-09.xlsx',
 );
});

test('different months name a range', () => {
 assert.equal(
  exportFileName({ from: '2026-01-01', to: '2026-03-01', format: 'csv' }),
  'fintrack-movements-2026-01_2026-03.csv',
 );
});

test('only one bound present names that month', () => {
 assert.equal(
  exportFileName({ from: '2026-05-01', to: null, format: 'csv' }),
  'fintrack-movements-2026-05.csv',
 );
 assert.equal(
  exportFileName({ from: null, to: '2026-05-01', format: 'csv' }),
  'fintrack-movements-2026-05.csv',
 );
});
