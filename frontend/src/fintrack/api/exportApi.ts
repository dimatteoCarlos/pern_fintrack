// frontend/src/fintrack/api/exportApi.ts
//
// Every download the frontend issues, from /api/export and from the three
// module endpoints under /api/fintrack. Follows overviewApi.ts:
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
import {
 url_budget_export,
 url_closed_accounts_export,
 url_debt_export,
 url_export_movements,
 url_export_statement,
 url_pocket_export,
} from '../../urlConfig';
import { OverviewActivityMovementType } from '../types/overviewTypes';
import {
 ClosedAccountOrderType,
 ClosedAccountSortKeyType,
} from '../editionAndDeletion/types/closedAccountsTypes';

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

// ===================================
// The three module lists, each as a downloadable file
// ===================================
// Same shape as the two above and the same helper: absent keys are dropped
// rather than sent empty, and the saved name comes from the server's own
// Content-Disposition. The fallback names below are only used when that header
// is missing.
//
// format is always sent, never left to the endpoint's default, so the query
// states what the reader asked for.
//
// The CURRENT month never travels on any of the three, which is the rule the
// budget and pocket url blocks already state: the server resolves it on the
// owner's calendar. Only a month or a range the reader navigated to is sent.

// The URL carries 'YYYY-MM' (MonthPicker.tsx:72) and the two month endpoints
// take the first of that month, so the day is added here instead of at every
// call site. A value that already carries a day is re-spelled, not appended to.
const firstOfMonth = (month: string): string => `${month.slice(0, 7)}-01`;

export type BudgetExportQuery = {
 format: ExportFormat;
 // One budget account instead of every one the owner holds. No screen sends it
 // yet: the category list exports the whole month.
 accountId?: number | string;
 // A historical range, both bounds as 'YYYY-MM-01'. A single month is the same
 // month on both.
 from?: string;
 to?: string;
};

/**
 * Download the budget rows for the month on screen.
 *
 * @throws {Error} the server's own message when the request failed
 */
export const downloadBudgetExport = async (
 query: BudgetExportQuery,
): Promise<void> => {
 const params: Record<string, string> = { format: query.format };

 if (query.accountId !== undefined) params.accountId = String(query.accountId);
 if (query.from) params.from = firstOfMonth(query.from);
 if (query.to) params.to = firstOfMonth(query.to);

 await downloadFile(
  url_budget_export,
  params,
  `fintrack-budget${query.from ? `-${query.from.slice(0, 7)}` : ''}.${query.format}`,
 );
};

// One optional month beside the format, which is all the pocket and debt
// exports take.
export type MonthExportQuery = {
 format: ExportFormat;
 // 'YYYY-MM' or 'YYYY-MM-01'; both are normalised to the first of the month.
 month?: string;
};

// Both endpoints below build the same two keys from the same rule.
const monthParams = (query: MonthExportQuery): Record<string, string> => ({
 format: query.format,
 ...(query.month ? { month: firstOfMonth(query.month) } : {}),
});

/**
 * Download the pocket board for the month on screen.
 *
 * @throws {Error} the server's own message when the request failed
 */
export const downloadPocketExport = async (
 query: MonthExportQuery,
): Promise<void> => {
 await downloadFile(
  url_pocket_export,
  monthParams(query),
  `fintrack-pockets${query.month ? `-${query.month.slice(0, 7)}` : ''}.${query.format}`,
 );
};

/**
 * Download the debtor list.
 *
 * @throws {Error} the server's own message when the request failed
 */
export const downloadDebtExport = async (
 query: MonthExportQuery,
): Promise<void> => {
 await downloadFile(
  url_debt_export,
  monthParams(query),
  `fintrack-debts${query.month ? `-${query.month.slice(0, 7)}` : ''}.${query.format}`,
 );
};

// The registry takes no month: a closure is dated and never repeats, so what
// cuts this list is the search and the account type, and what orders it is the
// sort pair — the four the toolbar is applying, so the file says what the
// screen says. The page size does not travel: the file carries every row the
// filter matched, not the screenful being read.
export type ClosedAccountsExportQuery = {
 format: ExportFormat;
 search?: string;
 // The account_types.account_type_name the filter holds, 'bank' and its
 // siblings. Empty is every type, and is dropped rather than sent.
 type?: string;
 sort?: ClosedAccountSortKeyType;
 order?: ClosedAccountOrderType;
};

/**
 * Download the closed-account registry as the screen is filtering and sorting it.
 *
 * @throws {Error} the server's own message when the request failed
 */
export const downloadClosedAccountsExport = async (
 query: ClosedAccountsExportQuery,
): Promise<void> => {
 const params: Record<string, string> = { format: query.format };

 // Trimmed and dropped-when-empty exactly as useClosedAccounts:53-54 builds the
 // list request, so the file and the screen are cut by the same two values.
 if (query.search?.trim()) params.search = query.search.trim();
 if (query.type) params.type = query.type;
 if (query.sort) params.sort = query.sort;
 if (query.order) params.order = query.order;

 await downloadFile(
  url_closed_accounts_export,
  params,
  `fintrack-closed-accounts.${query.format}`,
 );
};
