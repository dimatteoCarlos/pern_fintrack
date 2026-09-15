// Contract tests for the generic CSV writer (export_api/core/writers/writeCsv.js).
//
// The case worth freezing is the same one commit 0 fixed for the Budget CSV:
// a negative 'number' cell must stay a plain number, never guarded as if it
// were a formula-prefixed 'text' cell.

import test from 'node:test';
import assert from 'node:assert/strict';

import { writeCsv } from '../../src/export_api/core/writers/writeCsv.js';

const COLUMNS = [
 { key: 'name', label: 'Account Name', type: 'text' },
 { key: 'amount', label: 'Amount', type: 'number' },
 { key: 'date', label: 'Date', type: 'date' },
 { key: 'closed', label: 'Closed', type: 'boolean' },
];

test('a negative amount stays a plain number, not text', () => {
 const csv = writeCsv(
  { columns: COLUMNS, rows: [{ name: 'Groceries', amount: -45.5, date: '2026-09-01', closed: false }] },
  { bom: false },
 );

 const [, row] = csv.split('\r\n');
 assert.equal(row, 'Groceries,-45.5,2026-09-01,false');
});

test('a text cell starting with "=" is guarded as a formula', () => {
 const csv = writeCsv(
  { columns: COLUMNS, rows: [{ name: '=cmd|/c calc', amount: 10, date: '2026-09-01', closed: true }] },
  { bom: false },
 );

 const [, row] = csv.split('\r\n');
 assert.ok(row.startsWith("'=cmd|/c calc,"), `formula-like text must stay guarded: ${row}`);
});

test('a null or undefined cell renders empty, never "null" or 0', () => {
 const csv = writeCsv(
  { columns: COLUMNS, rows: [{ name: 'Rent', amount: null, date: undefined, closed: null }] },
  { bom: false },
 );

 const [, row] = csv.split('\r\n');
 assert.equal(row, 'Rent,,,');
});

test('a text field with a comma is quoted, per RFC 4180', () => {
 const csv = writeCsv(
  { columns: COLUMNS, rows: [{ name: 'Doe, John', amount: 1, date: '2026-09-01', closed: false }] },
  { bom: false },
 );

 const [, row] = csv.split('\r\n');
 assert.ok(row.startsWith('"Doe, John",'), `comma-bearing text must be quoted: ${row}`);
});

test('bom defaults to true and can be disabled', () => {
 const withBom = writeCsv({ columns: COLUMNS, rows: [] });
 const withoutBom = writeCsv({ columns: COLUMNS, rows: [] }, { bom: false });

 assert.ok(withBom.startsWith('﻿'));
 assert.ok(!withoutBom.startsWith('﻿'));
});
