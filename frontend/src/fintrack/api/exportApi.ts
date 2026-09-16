// frontend/src/fintrack/api/exportApi.ts
//
// The only way into /api/export from the frontend. Follows overviewApi.ts:
// absent keys are dropped rather than sent empty, because the endpoint's
// schema is strict and refuses a zero-length search.
//
// V1's only caller is RecentActivity, and it sends exactly the query already
// active on screen: search, type and period. accountIds and category are API
// capabilities this screen has no control for (PLAN_EXPORT.md §11) and are
// not sent.
//
// downloadStatementExport is a second, unrelated caller of the same
// downloadFile helper: one reference month, never a range (PLAN_EXPORT.md §9).

import { downloadFile } from '../helpers/downloadFile';
import { url_export_movements, url_export_statement } from '../../urlConfig';
import { OverviewActivityMovementType } from '../types/overviewTypes';

export type ExportFormat = 'csv' | 'xlsx';

export type ExportMovementsQuery = {
 from?: string | null;
 to?: string | null;
 search?: string;
 movementType?: OverviewActivityMovementType;
 format: ExportFormat;
};

/**
 * Download the `transactions` dataset for the active activity query.
 *
 * @throws {Error} the server's own message when the request failed
 */
export const downloadMovementsExport = async (query: ExportMovementsQuery): Promise<void> => {
 const params: Record<string, string> = { format: query.format };

 if (query.from) params.from = query.from;
 if (query.to) params.to = query.to;
 if (query.search) params.search = query.search;
 if (query.movementType) params.movementType = query.movementType;

 await downloadFile(url_export_movements, params, `fintrack-movements.${query.format}`);
};

// The statement's own format union. Not ExportFormat above: that one is
// 'csv' | 'xlsx' for /export/movements and has no 'pdf' member.
export type StatementFormat = 'xlsx' | 'pdf';

export type ExportStatementQuery = {
 // 'YYYY-MM' or 'YYYY-MM-DD'/'YYYY-MM-01' — the backend's monthBound
 // validator accepts both.
 month: string;
 format: StatementFormat;
};

// 'YYYY-MM-01' sliced to 'YYYY-MM'. Used as the fallback filename when the
// server sends no Content-Disposition, and reused by the trigger's menu to
// name each format before it is chosen.
export const statementFileName = (month: string, format: StatementFormat): string =>
 `fintrack-statement-${month.slice(0, 7)}.${format}`;

/**
 * Download the period statement — one month, as a workbook or a PDF summary.
 *
 * @throws {Error} the server's own message when the request failed
 */
export const downloadStatementExport = async (query: ExportStatementQuery): Promise<void> => {
 await downloadFile(
  url_export_statement,
  { month: query.month, format: query.format },
  statementFileName(query.month, query.format),
 );
};
