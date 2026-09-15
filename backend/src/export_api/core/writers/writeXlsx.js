// backend/src/export_api/core/writers/writeXlsx.js
//
// Turns an already-resolved dataset into an XLSX workbook. No FinTrack import
// (architecture rule 4, PLAN_EXPORT.md §2): it receives { columns, rows,
// meta } and represents them, computing nothing.
//
// The formula guard is type-based, the same rule writeCsv.js applies: only a
// 'text' cell can carry a formula prefix Excel would evaluate; 'number',
// 'date' and 'boolean' cells keep their real type so a negative amount stays
// numeric and sortable.

import ExcelJS from 'exceljs';

const TEXT = 'text';
const NUMBER = 'number';
const DATE = 'date';
const BOOLEAN = 'boolean';

const guardFormula = (raw) => (/^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw);

const toCellValue = (value, type) => {
 if (value === null || value === undefined) return null;
 switch (type) {
  case NUMBER:
   return Number.isFinite(Number(value)) ? Number(value) : null;
  case BOOLEAN:
   return Boolean(value);
  case DATE:
   return value instanceof Date ? value : new Date(value);
  case TEXT:
  default:
   return guardFormula(String(value));
 }
};

// One data sheet, shared by writeXlsx (one sheet per workbook) and
// writeXlsxWorkbook (several named sheets in one workbook) below, so the
// header freeze, autofilter and formula guard are written once and cannot
// drift between the two callers.
const appendDataSheet = (workbook, sheetName, { columns, rows }) => {
 const sheet = workbook.addWorksheet(sheetName);

 sheet.columns = columns.map((column) => ({
  header: column.label,
  key: column.key,
  width: Math.max(column.label.length + 2, 12),
  style: column.type === NUMBER ? { numFmt: '#,##0.00' } : undefined,
 }));

 rows.forEach((row) => {
  const record = {};
  columns.forEach((column) => {
   record[column.key] = toCellValue(row[column.key], column.type);
  });
  sheet.addRow(record);
 });

 sheet.views = [{ state: 'frozen', ySplit: 1 }];
 sheet.autoFilter = {
  from: { row: 1, column: 1 },
  to: { row: 1, column: columns.length },
 };
 sheet.getRow(1).font = { bold: true };

 return sheet;
};

/**
 * @param {{columns: Array<{key: string, label: string, type: 'text'|'number'|'date'|'boolean'}>,
 *  rows: object[], meta?: Record<string, string|number>}} dataset - resolved
 *  dataset; meta becomes a second "Metadata" sheet when present
 * @param {{sheetName?: string}} [options]
 * @returns {Promise<Buffer>}
 */
export async function writeXlsx({ columns, rows, meta }, { sheetName = 'Sheet1' } = {}) {
 const workbook = new ExcelJS.Workbook();
 appendDataSheet(workbook, sheetName, { columns, rows });

 // Never user_id (PLAN_EXPORT.md §11): meta carries only what identifies the
 // file's contents, not its owner.
 if (meta && Object.keys(meta).length > 0) {
  const metaSheet = workbook.addWorksheet('Metadata');
  metaSheet.columns = [
   { header: 'Field', key: 'field', width: 20 },
   { header: 'Value', key: 'value', width: 40 },
  ];
  Object.entries(meta).forEach(([field, value]) => {
   metaSheet.addRow({ field, value: value === null || value === undefined ? '' : String(value) });
  });
  metaSheet.getRow(1).font = { bold: true };
 }

 return workbook.xlsx.writeBuffer();
}

/**
 * Several named sheets in one workbook — the period statement's Executive
 * Summary, Transactions, Accounts & Balances and Metadata & Audit sheets.
 * Each sheet is an ordinary dataset written the same way writeXlsx writes its
 * one sheet; there is no side "Metadata" sheet here the way writeXlsx adds
 * one from a `meta` object — a statement's own Metadata & Audit sheet is one
 * more entry in `sheets`, built by the caller like the other three
 * (PLAN_EXPORT.md §7: "tables, not a dashboard").
 *
 * @param {Array<{name: string, columns: Array<{key: string, label: string,
 *  type: 'text'|'number'|'date'|'boolean'}>, rows: object[]}>} sheets - in
 *  the order they should appear in the workbook
 * @returns {Promise<Buffer>}
 */
export async function writeXlsxWorkbook(sheets) {
 const workbook = new ExcelJS.Workbook();
 sheets.forEach(({ name, columns, rows }) => appendDataSheet(workbook, name, { columns, rows }));

 return workbook.xlsx.writeBuffer();
}
