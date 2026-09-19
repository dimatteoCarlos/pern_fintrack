// src/fintrack_api/controllers/budgetController.js

// Budget Controller – HTTP request handlers for the Budget module.
// Validates requests using Zod schemas from budgetValidators.js, calls services,
// and returns JSON or CSV.
//
// No handler accepts the CURRENT month. It is resolved inside the query, on the
// account owner's calendar, so a request cannot name it at all and cannot carry
// the device's clock skew into a budget. A PAST month does travel — as from/to
// on a range, as month on a status — because the server cannot guess which
// months the user is looking at. Reading a past month never makes it writable:
// only the current one is.
//
// There is no 404 in this module. An id that does not exist and an id that
// belongs to someone else both answer 403: splitting them would let a caller
// walk the id space and learn which accounts are other users'.

import {
 budgetAccountsStatusBodySchema,
 currentBudgetParamsSchema,
 currentBudgetBodySchema,
 seriesParamsSchema,
 seriesQuerySchema,
 exportQuerySchema,
} from '../../validation/zod/budgetValidators.js';

import { budgetCalculationService } from '../services/budget_services/services/budgetCalculationService.js';
import { budgetAllocationService } from '../services/budget_services/services/budgetAllocationService.js';
import { pool } from '../../db/config/configDB.js';
import { getAccountsByType } from '../../utils/fintrackUtils/accountDataRetrieval/accountUtils.js';
import {
 convertSeriesToCSV,
 buildBudgetSeriesSheets,
 CSV_CONTENT_TYPE,
 XLSX_CONTENT_TYPE,
} from '../../utils/fintrackUtils/exportUtils.js';
import { writeXlsxWorkbook } from '../../export_api/core/writers/writeXlsx.js';
import { getModuleTransactionRows } from '../../export_api/services/moduleTransactionsService.js';
import { getCurrentMonth } from '../services/budget_services/db/budgetTransactionRepository.js';
import { detailWindowFor } from '../services/overview_services/core/monthArithmetic.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUsername } from '../../utils/authUtils/getUsername.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import { moduleExportFileName } from '../../export_api/core/exportFileName.js';

/**
 * Return every category_budget account the caller has ever had, keyed by id.
 *
 * Every handler that receives an accountId from the client must check it
 * against this set. verifyToken proves who the caller is; it proves nothing
 * about which accounts they may read. Without this, passing another user's
 * accountId returns that user's budget — the same hole A2 closed elsewhere.
 *
 * EVER HAD, AND A CLOSED CATEGORY IS IN IT. Until 2026-09-19 this map was built
 * by a query that filtered closed and deleted accounts out, so asking any of the
 * three endpoints below about a category the owner had closed answered 403 —
 * "not found or not owned" about an account they do own and whose past months
 * are still theirs to read. Ownership is not circulation.
 *
 * Each entry carries the first and last month it reports, cut on the owner's
 * calendar, which is what the handlers narrow by when the client names no ids.
 * Two answers, one round trip.
 */
const getOwnedBudgetAccounts = async (userId, timeZone) => {
 const accounts = await getAccountsByType(userId, 'category_budget', timeZone);
 return new Map(accounts.map((a) => [a.accountId, a]));
};

/**
 * The ids whose reporting window overlaps the span being asked about.
 *
 * WHAT THE CLIENT GETS WHEN IT NAMES NONE. A category the owner closed in April
 * belongs in a report about March and not in one about May, so the default set
 * follows the span asked for rather than the state today. Before this it
 * followed today, which meant a closed category vanished from every month,
 * including the ones it was open and spending in.
 *
 * OVERLAP AND NOT CONTAINMENT, which is why both ends are compared and crossed.
 * A category opened halfway through a twelve-month export belongs in it, and so
 * does one closed halfway through. Testing only one end would drop one of the
 * two and nothing would say which.
 *
 * `from` and `to` are the same month for a status, which makes that case the
 * degenerate one rather than a second rule.
 */
const idsOverlapping = (owned, from, to) =>
 [...owned.values()]
  .filter(
   (account) =>
    account.startMonth <= to &&
    (account.closedMonth === null || account.closedMonth >= from),
  )
  .map((account) => account.accountId);

/**
 * Answer a failed validation with the issues that caused it.
 *
 * Zod 4 renamed the issue list: ZodError.errors no longer exists, and reading it
 * yielded undefined, which JSON.stringify drops from the payload. Every 400 this
 * module returned carried an empty body, telling the caller the request failed
 * but never which field. The shape matches the one validateRequest.js already
 * defines for the auth module.
 */
const respondWithZodIssues = (res, error) =>
 res.status(400).json({
  status: 400,
  message: 'Validation Error',
  errors: error.issues.map((issue) => ({
   field: issue.path.join('.'),
   message: issue.message,
   code: issue.code,
  })),
 });

/** POST /api/fintrack/budget/accounts/status */
export async function getBudgetAccountsStatus(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { accountIds: requestedIds, month } = budgetAccountsStatusBodySchema.parse(req.body);

  // Resolved before the ownership map and not after it: the map's month
  // boundaries are cut on the owner's calendar, so the zone has to be in hand
  // first. It is fetched once per request and the service receives it, rather
  // than going to the users table itself.
  const timeZone = await getUserTimeZone(pool, userId);

  const owned = await getOwnedBudgetAccounts(userId, timeZone);

  // Check EVERY element. Validating only the first would let a caller hide
  // foreign ids behind one of their own.
  if (requestedIds) {
   const foreign = requestedIds.filter((id) => !owned.has(id));
   if (foreign.length > 0) {
    return res.status(403).json({
     status: 403,
     message: `${foreign.length} account(s) not found or not owned by the authenticated user.`,
    });
   }
  }

  // An omitted accountIds asks for the whole set, which is derived from the
  // ownership map itself — so those ids need no ownership check: they came from
  // it. This is what lets one request serve the three levels of the budget
  // drill-down instead of one request per level.
  //
  // Narrowed to the month being reported rather than to the whole map. A request
  // that names no month is about the current one, which the server named on
  // every row of the map for the reason stated at the head of this file.
  const reportedMonth = month ?? [...owned.values()][0]?.currentMonth ?? null;
  const accountIds =
   requestedIds ??
   (reportedMonth === null ? [] : idsOverlapping(owned, reportedMonth, reportedMonth));

  const response = await budgetCalculationService.getBudgetAccountsStatus(
   pool,
   accountIds,
   timeZone,
   month
  );

  res.status(200).json(response);
 } catch (error) {
  if (error.name === 'ZodError') {
   return respondWithZodIssues(res, error);
  }
  // 422 from the month resolver: the payload parsed and the month is well
  // formed, it is simply later than the current one — a relationship no schema
  // can see. Anything without a status is unexpected.
  if (error.status) {
   return res.status(error.status).json({ status: error.status, message: error.message });
  }
  next(error);
 }
}

/** PUT /api/fintrack/budget/accounts/:accountId/current */
export async function setCurrentBudget(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { accountId } = currentBudgetParamsSchema.parse(req.params);
  // The parsed object is forwarded whole rather than rebuilt field by field: a
  // field the schema validates and the hand-written literal omits reaches the
  // service as undefined, which is how currency was lost between the two.
  const allocation = currentBudgetBodySchema.parse(req.body);

  // Ownership is enforced inside the service, in the same transaction as the
  // write. Checking it here instead would leave a window between the check and
  // the update.
  const timeZone = await getUserTimeZone(pool, userId);

  const result = await budgetAllocationService.setCurrentMonthBudget(
   pool,
   userId,
   accountId,
   allocation,
   timeZone
  );

  res.status(200).json(result);
 } catch (error) {
  if (error.name === 'ZodError') {
   return respondWithZodIssues(res, error);
  }
  // The service raises 400, 403 and 422 with a status already attached; anything
  // without one is unexpected and belongs to the error handler.
  if (error.status) {
   return res.status(error.status).json({ status: error.status, message: error.message });
  }
  next(error);
 }
}

/** GET /api/fintrack/budget/accounts/:accountId/series */
export async function getBudgetAccountSeries(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { accountId } = seriesParamsSchema.parse(req.params);
  const { from, to } = seriesQuerySchema.parse(req.query);

  const timeZone = await getUserTimeZone(pool, userId);

  // Ownership only. This handler narrows nothing: the client named one account
  // and the series itself reports no month outside that account's own window.
  // A closed category answers here now, which is the whole point — its past is
  // what a twelve-month series is for.
  const owned = await getOwnedBudgetAccounts(userId, timeZone);
  if (!owned.has(accountId)) {
   return res.status(403).json({
    status: 403,
    message: 'Account not found or not owned by the authenticated user.',
   });
  }

  const response = await budgetCalculationService.getBudgetAccountSeries(
   pool,
   accountId,
   { from, to },
   timeZone
  );

  res.status(200).json(response);
 } catch (error) {
  if (error.name === 'ZodError') {
   return respondWithZodIssues(res, error);
  }
  // 422 from the range resolver: the query parsed, the values are simply not
  // answerable together. Anything without a status is unexpected.
  if (error.status) {
   return res.status(error.status).json({ status: error.status, message: error.message });
  }
  next(error);
 }
}

// The months the data is about, not the day it was downloaded. Two exports of
// the same range taken on different days are the same file and are named alike;
// a single-month range keeps the one month as its name.
const rangeLabel = (first, last) => (first === last ? first : `${first}_${last}`);

/**
 * Write the budget export in the format that was asked for.
 *
 * Shared by the no-accounts answer and the normal one, which is what makes the
 * empty file well formed: the same converter produces it, so it carries the
 * header row and says what it would have contained.
 */
const sendBudgetExport = async (res, { format, filename, accounts, detail }) => {
 res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

 if (format === 'xlsx') {
  const workbook = await writeXlsxWorkbook(buildBudgetSeriesSheets(accounts, detail));

  res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
  return res.status(200).send(workbook);
 }

 res.setHeader('Content-Type', CSV_CONTENT_TYPE);
 return res.status(200).send(convertSeriesToCSV(accounts, detail));
};

/**
 * GET /api/fintrack/budget/export?accountId=&from=&to=&format=csv|xlsx
 *
 * One row per account per month in either writer. The workbook has one sheet,
 * because the month series is the finest grain this calculator resolves.
 */
export async function exportCSV(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { accountId, from, to, format } = exportQuerySchema.parse(req.query);

  // The owner's name rides along for the filename only. Read in the same round
  // trip as the zone, the shape exportController.js:44-47 already uses.
  const [timeZone, username] = await Promise.all([
   getUserTimeZone(pool, userId),
   getUsername(pool, userId),
  ]);

  const owned = await getOwnedBudgetAccounts(userId, timeZone);

  if (accountId && !owned.has(accountId)) {
   return res.status(403).json({
    status: 403,
    message: 'Account not found or not owned by the authenticated user.',
   });
  }

  // The span the default set is narrowed by, computed WIDE on purpose. The
  // service resolves the real range from from/to with a default span of 1, and
  // this handler has to narrow before it can call the service — so a missing end
  // is filled with the owner's current month and the two are ordered. Any range
  // the resolver can produce sits inside this one, which is the safe direction:
  // a category that is in the span and reports nothing costs an empty section,
  // while one left out of the span is data the file silently lacks.
  //
  // The second read runs only for an owner with no account at all, who has no
  // row to carry the month and still needs one to name the empty file.
  const currentMonth =
   [...owned.values()][0]?.currentMonth ?? (await getCurrentMonth(pool, timeZone));
  const ends = [from ?? currentMonth, to ?? currentMonth].filter(Boolean).sort();

  const filenameFor = (period) =>
   moduleExportFileName({ dataset: 'budget', period, format, username });

  // An owner with no budget account gets a well-formed empty file in the format
  // that was asked for, header row and all. It used to answer a plain-text
  // sentence, which became a broken download once the screen offered a format
  // menu: the browser has already been told a spreadsheet is coming.
  if (owned.size === 0) {
   return sendBudgetExport(res, {
    format,
    filename: filenameFor(rangeLabel(ends[0], ends[ends.length - 1])),
    accounts: [],
    detail: { rows: [], window: detailWindowFor(ends[ends.length - 1]) },
   });
  }

  const accountIds = accountId
   ? [accountId]
   : idsOverlapping(owned, ends[0] ?? '', ends[ends.length - 1] ?? '9999-12-01');

  // The default span is 1, not the 12 /series uses. An export with no range is
  // the current month, which is what this endpoint returned before it accepted
  // one — a default of a year would change the meaning of a request that
  // already works.
  const series = await budgetCalculationService.getBudgetAccountsSeries(
   pool,
   accountIds,
   { from, to },
   timeZone,
   1
  );

  // Thirteen months ending at the month the summary reports, the same depth the
  // debt export already reads. The summary keeps its own range: the two describe
  // different windows on purpose, and the detail block names its own.
  const detailWindow = detailWindowFor(series.to);

  // The account set is resolved over the WIDENED window, not over the summary's
  // range. Narrowing it to the summary's accounts would silently drop the
  // movements of a category that existed ten months ago and not this month.
  const detailAccountIds = accountId
   ? [accountId]
   : idsOverlapping(owned, detailWindow.from, detailWindow.to);

  const detail = {
   rows: await getModuleTransactionRows(
    pool,
    userId,
    { from: detailWindow.from, to: detailWindow.to, accountIds: detailAccountIds },
    timeZone,
   ),
   window: detailWindow,
  };

  return sendBudgetExport(res, {
   format,
   filename: filenameFor(rangeLabel(series.from, series.to)),
   accounts: series.accounts,
   detail,
  });
 } catch (error) {
  if (error.name === 'ZodError') {
   return respondWithZodIssues(res, error);
  }
  if (error.status) {
   return res.status(error.status).json({ status: error.status, message: error.message });
  }
  next(error);
 }
}
