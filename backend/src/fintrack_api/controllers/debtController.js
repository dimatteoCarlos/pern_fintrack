// backend/src/fintrack_api/controllers/debtController.js

// Debt module – HTTP request handlers.
//
// One handler today: the per-counterparty export, in either of two formats. The
// debt figures themselves are served by GET /overview/debt, and this module
// exists because a file download is a different response format, not a different
// calculation — the analysis is read through overviewDebtService and nothing is
// recomputed here.
//
// No account id travels from the client, so there is no ownership check: the
// debtor set is derived server-side from the token's user id, the same reason
// overviewController carries none.

import { pool } from '../../db/config/configDB.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUsername } from '../../utils/authUtils/getUsername.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import { moduleExportFileName } from '../../export_api/core/exportFileName.js';
import { overviewDebtService } from '../services/overview_services/services/overviewDebtService.js';
import { resolveWindowOr422 } from './overviewController.js';
import { debtExportQuerySchema } from '../../validation/zod/overviewValidators.js';
import {
 convertDebtAnalysisToCSV,
 buildDebtAnalysisSheets,
 CSV_CONTENT_TYPE,
 XLSX_CONTENT_TYPE,
} from '../../utils/fintrackUtils/exportUtils.js';
import { writeXlsxWorkbook } from '../../export_api/core/writers/writeXlsx.js';
import { getModuleTransactionRows } from '../../export_api/services/moduleTransactionsService.js';
import { getDebtAccountIds } from '../services/overview_services/db/overviewAccountRepository.js';
import { detailWindowFor } from '../services/overview_services/core/monthArithmetic.js';

// The depth byCounterparty is served at, and the smallest transaction page that
// still satisfies the calculator. makeDebtAnalysis publishes the ranking at the
// full level only (makeDebtAnalysis.js ANALYSIS_NEEDS_FULL_NOTICE), and the
// export needs no transaction rows at all.
const ANALYSIS_ONLY = {
 page: 1,
 pageSize: 1,
 includeTransactionRows: false,
 analysis: 'full',
};

/**
 * Answer a failed validation with the issues that caused it.
 *
 * Same shape as overviewController.js:76-86, including the empty-path branch an
 * unrecognized key produces: Zod puts the offending key in issue.keys and not on
 * the path, so joining the path alone reports a 400 that names nothing.
 */
const respondWithZodIssues = (res, error) =>
 res.status(400).json({
  status: 400,
  message: 'Validation Error',
  errors: error.issues.map((issue) => ({
   field: issue.path.length > 0
    ? issue.path.join('.')
    : (issue.keys ?? []).join(', '),
   message: issue.message,
   code: issue.code,
  })),
 });

/**
 * GET /api/fintrack/debt/export?month=YYYY-MM&format=csv|xlsx
 *
 * One row per counterparty at the close of the requested month, as a
 * comma-separated table or as a workbook whose second sheet is the two legs
 * month by month. The month is optional and its absence means the owner's
 * current one, resolved on the owner's calendar by resolveWindowOr422 — which is
 * also what refuses a later month with 422, with the same message /overview
 * answers.
 *
 * Both sheets come off the ONE call below. legsOverTime is already on the
 * analysis the ranking comes from, so a second read would let the last point of
 * the series disagree with the ranking drawn beside it.
 */
export async function exportDebtAnalysis(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { month, format } = debtExportQuerySchema.parse(req.query);

  // The owner's name rides along for the filename only. Read in the same round
  // trip as the zone, the shape exportController.js:44-47 already uses.
  const [timeZone, username] = await Promise.all([
   getUserTimeZone(pool, userId),
   getUsername(pool, userId),
  ]);

  const window = await resolveWindowOr422(res, timeZone, month);
  if (!window) return;

  const debt = await overviewDebtService.getDebtDomainData(
   pool,
   userId,
   { window, ...ANALYSIS_ONLY },
   timeZone,
  );

  const asOfMonth = window.referenceMonth.slice(0, 7);
  // The month the balances were read at, not the day they were downloaded.
  const nameFor = (format) =>
   moduleExportFileName({ dataset: 'debt', period: asOfMonth, format, username });

  // The movements bounded to the months the second block spans, which is the
  // only range this summary has: byCounterparty is a balance AT one close and
  // names no window of its own. Taken from detailWindowFor so the three exports
  // read the same depth; it resolves to the window's own analysisStart.
  const detailWindow = detailWindowFor(window.referenceMonth);
  const debtorIds = await getDebtAccountIds(pool, userId);
  const detail = {
   rows: await getModuleTransactionRows(
    pool,
    userId,
    { from: detailWindow.from, to: detailWindow.to, accountIds: debtorIds },
    timeZone,
   ),
   window: detailWindow,
  };

  // byCounterparty and legsOverTime are both ABSENT, not empty, when the owner
  // has no debt in either direction (makeDebtAnalysis.js NO_DEBT_NOTICE). Either
  // writer then answers 200 with headers and no rows, never a 400: owning no
  // debtor is a valid answer.
  if (format === 'xlsx') {
   const workbook = await writeXlsxWorkbook(
    buildDebtAnalysisSheets(
     debt.analysis?.byCounterparty,
     debt.analysis?.legsOverTime,
     asOfMonth,
     debt.card?.currency,
     detail,
    ),
   );

   res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
   res.setHeader('Content-Disposition', `attachment; filename="${nameFor('xlsx')}"`);
   return res.status(200).send(workbook);
  }

  const csv = convertDebtAnalysisToCSV(
   debt.analysis?.byCounterparty,
   asOfMonth,
   debt.card?.currency,
   debt.analysis?.legsOverTime,
   detail,
  );

  res.setHeader('Content-Type', CSV_CONTENT_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${nameFor('csv')}"`);
  return res.status(200).send(csv);
 } catch (error) {
  if (error.name === 'ZodError') {
   return respondWithZodIssues(res, error);
  }
  if (error.status) {
   return res.status(error.status).json({ status: error.status, message: error.message });
  }
  return next(error);
 }
}
