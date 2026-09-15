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

import { downloadFile } from '../helpers/downloadFile';
import { url_export_movements } from '../../urlConfig';
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
