// backend/src/export_api/core/writers/writeCsv.js
//
// Turns an already-resolved dataset into an RFC 4180 CSV document. No
// FinTrack import (architecture rule 4, PLAN_EXPORT.md §2): it receives
// { columns, rows } and represents them, computing nothing.
//
// The guard is type-based, never column-name-based (PLAN_EXPORT.md §7): only
// a 'text' cell can be mistaken for a formula by Excel or Sheets, so only
// 'text' cells are checked. A 'number' cell keeps a leading '-' as a sign,
// not a formula prefix — the defect commit 0 fixed for the Budget CSV.

const TEXT = 'text';
const NUMBER = 'number';
const DATE = 'date';
const BOOLEAN = 'boolean';

const guardFormula = (raw) => (/^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw);

/**
 * Escape one CSV text field per RFC 4180: quoted only when it carries a
 * delimiter, a quote, CR or LF; embedded quotes doubled.
 */
const escapeCsvText = (value) => {
 const raw = value === null || value === undefined ? '' : String(value);
 const guarded = guardFormula(raw);
 return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

const formatCsvCell = (value, type) => {
 if (value === null || value === undefined) return '';
 switch (type) {
  case NUMBER:
   return Number.isFinite(Number(value)) ? String(value) : '';
  case BOOLEAN:
   return value ? 'true' : 'false';
  case DATE:
   return String(value);
  case TEXT:
  default:
   return escapeCsvText(value);
 }
};

/**
 * @param {{columns: Array<{key: string, label: string, type: 'text'|'number'|'date'|'boolean'}>,
 *  rows: object[]}} dataset - resolved dataset, no further lookups needed
 * @param {{bom?: boolean}} [options] - bom defaults to true (PLAN_EXPORT.md §5)
 * @returns {string} CSV text, CRLF row endings, optional leading UTF-8 BOM
 */
export function writeCsv({ columns, rows }, { bom = true } = {}) {
 const header = columns.map((column) => escapeCsvText(column.label)).join(',');
 const body = rows.map((row) =>
  columns.map((column) => formatCsvCell(row[column.key], column.type)).join(','),
 );

 // CRLF is the RFC 4180 line ending; some strict importers reject bare LF.
 const text = [header, ...body].join('\r\n');
 return bom ? `﻿${text}` : text;
}
