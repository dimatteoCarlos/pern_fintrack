// Contract tests for the generic XLSX writer (export_api/core/writers/writeXlsx.js).
//
// Re-reads the produced buffer with exceljs itself, the same way a reviewer
// verified V1's plan (PLAN_EXPORT.md §15.1): "XLSX re-read with exceljs shows
// numeric cells."

import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import { writeXlsx } from '../../src/export_api/core/writers/writeXlsx.js';

const COLUMNS = [
 { key: 'name', label: 'Account Name', type: 'text' },
 { key: 'amount', label: 'Amount', type: 'number' },
 { key: 'date', label: 'Date', type: 'date' },
 { key: 'closed', label: 'Closed', type: 'boolean' },
];

test('a negative amount is written as a real numeric cell', async () => {
 const buffer = await writeXlsx({
  columns: COLUMNS,
  rows: [{ name: 'Groceries', amount: -45.5, date: '2026-09-01', closed: false }],
 });

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);
 const sheet = workbook.getWorksheet('Sheet1');
 const cell = sheet.getRow(2).getCell(2);

 assert.equal(cell.type, ExcelJS.ValueType.Number);
 assert.equal(cell.value, -45.5);
});

test('a text cell starting with "=" is guarded as a formula', async () => {
 const buffer = await writeXlsx({
  columns: COLUMNS,
  rows: [{ name: '=cmd|/c calc', amount: 1, date: '2026-09-01', closed: true }],
 });

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);
 const sheet = workbook.getWorksheet('Sheet1');
 const cell = sheet.getRow(2).getCell(1);

 assert.equal(cell.type, ExcelJS.ValueType.String);
 assert.equal(cell.value, "'=cmd|/c calc");
});

test('the header row is frozen and bold', async () => {
 const buffer = await writeXlsx({ columns: COLUMNS, rows: [] });

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);
 const sheet = workbook.getWorksheet('Sheet1');

 assert.equal(sheet.getRow(1).font.bold, true);
 assert.equal(sheet.views[0].state, 'frozen');
 assert.equal(sheet.views[0].ySplit, 1);
});

test('meta produces a second Metadata sheet with no user_id field', async () => {
 const buffer = await writeXlsx({
  columns: COLUMNS,
  rows: [],
  meta: { generatedAt: '2026-09-15T12:00:00.000Z', rowCount: 0 },
 });

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);
 const metaSheet = workbook.getWorksheet('Metadata');

 assert.ok(metaSheet, 'Metadata sheet must exist when meta is provided');
 assert.equal(metaSheet.getRow(2).getCell(1).value, 'generatedAt');
 assert.equal(metaSheet.getRow(2).getCell(2).value, '2026-09-15T12:00:00.000Z');
});

test('no Metadata sheet is added when meta is omitted', async () => {
 const buffer = await writeXlsx({ columns: COLUMNS, rows: [] });

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);

 assert.equal(workbook.getWorksheet('Metadata'), undefined);
});
