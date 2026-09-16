// backend/src/export_api/core/knownLimits.js
//
// PLAN_EXPORT.md §9 "Known limits", worded for the owner reading the file:
// no internal identifiers, no column names. Shared by the XLSX Metadata &
// Audit sheet (statementExportService.js) and the PDF's numbered notes
// (writePdf.js), so the two formats state the exact same three sentences
// rather than carrying two independently-worded copies that can drift apart.

export const KNOWN_LIMITS = [
 'Closed accounts drop out of past closes.',
 'Debtors closed in past months can make receivable less payable differ from the net debt position.',
 'A negative bank or investment balance nets inside its total and is not moved to liabilities.',
];
