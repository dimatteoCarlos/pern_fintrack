// Contract tests for the multi-sheet XLSX writer
// (export_api/core/writers/writeXlsx.js: writeXlsxWorkbook).

import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import { writeXlsxWorkbook } from '../../src/export_api/core/writers/writeXlsx.js';

const SUMMARY_COLUMNS = [
 { key: 'metric', label: 'Metric', type: 'text' },
 { key: 'month', label: 'Month', type: 'number' },
];

const BALANCE_COLUMNS = [
 { key: 'account', label: 'Account', type: 'text' },
 { key: 'balance', label: 'Balance', type: 'number' },
];

test('each entry becomes its own named sheet, in order', async () => {
 const buffer = await writeXlsxWorkbook([
  { name: 'Executive Summary', columns: SUMMARY_COLUMNS, rows: [{ metric: 'Net worth', month: 1650 }] },
  { name: 'Accounts & Balances', columns: BALANCE_COLUMNS, rows: [{ account: 'Slack', balance: 300 }] },
 ]);

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);

 assert.deepEqual(
  workbook.worksheets.map((sheet) => sheet.name),
  ['Executive Summary', 'Accounts & Balances'],
 );
});

test('a negative amount is a real numeric cell in each sheet', async () => {
 const buffer = await writeXlsxWorkbook([
  { name: 'Accounts & Balances', columns: BALANCE_COLUMNS, rows: [{ account: 'Slack', balance: -45.5 }] },
 ]);

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);
 const cell = workbook.getWorksheet('Accounts & Balances').getRow(2).getCell(2);

 assert.equal(cell.type, ExcelJS.ValueType.Number);
 assert.equal(cell.value, -45.5);
});

test('a text cell starting with "=" is guarded as a formula, per sheet', async () => {
 const buffer = await writeXlsxWorkbook([
  { name: 'Accounts & Balances', columns: BALANCE_COLUMNS, rows: [{ account: '=cmd|/c calc', balance: 1 }] },
 ]);

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);
 const cell = workbook.getWorksheet('Accounts & Balances').getRow(2).getCell(1);

 assert.equal(cell.type, ExcelJS.ValueType.String);
 assert.equal(cell.value, "'=cmd|/c calc");
});

test('each sheet freezes and bolds its own header row', async () => {
 const buffer = await writeXlsxWorkbook([
  { name: 'Executive Summary', columns: SUMMARY_COLUMNS, rows: [] },
  { name: 'Accounts & Balances', columns: BALANCE_COLUMNS, rows: [] },
 ]);

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);

 workbook.worksheets.forEach((sheet) => {
  assert.equal(sheet.getRow(1).font.bold, true);
  assert.equal(sheet.views[0].state, 'frozen');
  assert.equal(sheet.views[0].ySplit, 1);
 });
});

test('a sheet\'s header does not leak into the next sheet\'s columns', async () => {
 const buffer = await writeXlsxWorkbook([
  { name: 'Executive Summary', columns: SUMMARY_COLUMNS, rows: [] },
  { name: 'Accounts & Balances', columns: BALANCE_COLUMNS, rows: [] },
 ]);

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);

 assert.equal(workbook.getWorksheet('Executive Summary').getRow(1).getCell(1).value, 'Metric');
 assert.equal(workbook.getWorksheet('Accounts & Balances').getRow(1).getCell(1).value, 'Account');
});

test('writeXlsxWorkbook adds no automatic Metadata sheet', async () => {
 const buffer = await writeXlsxWorkbook([
  { name: 'Executive Summary', columns: SUMMARY_COLUMNS, rows: [] },
 ]);

 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer);

 assert.equal(workbook.getWorksheet('Metadata'), undefined);
});
