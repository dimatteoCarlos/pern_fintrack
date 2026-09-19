// backend/src/fintrack_api/controllers/closedAccountExportController.js

// The closed-account registry as a downloadable file.
//
// A controller of its own rather than a handler added to getAccountController:
// that file answers JSON for eleven account reads and is written in the account
// module's older style, and an export handler is a different kind of response -
// it sets Content-Type and Content-Disposition and sends bytes. The same split
// debtController.js already makes for the same reason.
//
// No account id travels from the client, so there is no ownership check: the
// closure set is derived server-side from the token's user id, the same reason
// getClosedAccounts carries none.

import { pool } from '../../db/config/configDB.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUsername } from '../../utils/authUtils/getUsername.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import { moduleExportFileName } from '../../export_api/core/exportFileName.js';
import { closedAccountExportQuerySchema } from '../../validation/zod/accountValidators.js';
import { getClosedAccountRegistryForExport } from '../services/delete_account/getClosedAccountRegistry.js';
import {
 convertClosedAccountsToCSV,
 buildClosedAccountSheets,
 CSV_CONTENT_TYPE,
 XLSX_CONTENT_TYPE,
} from '../../utils/fintrackUtils/exportUtils.js';
import { writeXlsxWorkbook } from '../../export_api/core/writers/writeXlsx.js';

/**
 * Answer a failed validation with the issues that caused it.
 *
 * Same shape as debtController.js:52-63, including the empty-path branch an
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
 * The months the closures in the file fall in, not the day it was downloaded.
 * Two downloads of the same registry taken on different days are the same file
 * and are named alike.
 *
 * 'all-time' when the file has no rows, the word exportFileName.js:40 already
 * uses for an export with no bounds - and it is the honest one here: the filter
 * covered every month and matched nothing.
 */
const closurePeriod = (closures) => {
 const months = closures
  .map((closure) => (closure.closedAt ?? '').slice(0, 7))
  .filter(Boolean)
  .sort();

 if (months.length === 0) return 'all-time';

 const first = months[0];
 const last = months[months.length - 1];
 return first === last ? first : `${first}_${last}`;
};

/**
 * Write the closed-account export in the format that was asked for.
 *
 * Shared by both answers, which is what makes the empty file well formed: the
 * same converter produces it, so it carries the header row of the file it would
 * have been.
 */
const sendClosedAccountExport = async (res, { format, filename, closures }) => {
 res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

 if (format === 'xlsx') {
  const workbook = await writeXlsxWorkbook(buildClosedAccountSheets(closures));

  res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
  return res.status(200).send(workbook);
 }

 res.setHeader('Content-Type', CSV_CONTENT_TYPE);
 return res.status(200).send(convertClosedAccountsToCSV(closures));
};

/**
 * GET /api/fintrack/account/closed/export?format=csv|xlsx&search=&type=&sort=&order=
 *
 * One row per closed account in either writer, and EVERY row the filter matches:
 * the reader below carries no LIMIT, unlike the list endpoint behind the same
 * screen, which caps a page at 20 and a request at 100.
 *
 * An owner who has closed nothing, and a search that matched nothing, both get
 * a well-formed empty file with its header row and a 200 - never a plain-text
 * sentence, which would be a broken download for a browser that has already
 * been told a spreadsheet is coming.
 */
export async function exportClosedAccounts(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { format, ...filters } = closedAccountExportQuerySchema.parse(req.query);

  // The zone renders the three dates on the owner's calendar; the name rides
  // along for the filename only. Read in the same round trip, the shape
  // exportController.js:44-47 already uses.
  const [timeZone, username] = await Promise.all([
   getUserTimeZone(pool, userId),
   getUsername(pool, userId),
  ]);

  const closures = await getClosedAccountRegistryForExport(
   pool,
   userId,
   filters,
   timeZone,
  );

  return sendClosedAccountExport(res, {
   format,
   filename: moduleExportFileName({
    dataset: 'closed-accounts',
    period: closurePeriod(closures),
    format,
    username,
   }),
   closures,
  });
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
