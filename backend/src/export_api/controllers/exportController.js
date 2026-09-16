// backend/src/export_api/controllers/exportController.js
//
// Export Controller — HTTP request handlers for the Data Export module.
// Same shape as overviewController.js and budgetController.js: requireUserId,
// then a Zod parse, then the service, so a rejection reads alike across every
// module.

import { exportMovementsQuerySchema, exportStatementQuerySchema } from '../validation/exportValidators.js';
import { exportTransactions } from '../services/transactionExportService.js';
import { exportStatement } from '../services/statementExportService.js';
import { pool } from '../../db/config/configDB.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import { resolveWindowOr422 } from '../../fintrack_api/controllers/overviewController.js';

/**
 * Same shape as overviewController.js's respondWithZodIssues: Zod 4 renamed
 * the issue list, and every 400 without this branch went out with an empty
 * body.
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

/** GET /api/export/movements */
export async function getMovementsExport(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { from, to, search, movementType, category, accountIds, format } =
   exportMovementsQuerySchema.parse(req.query);

  const timeZone = await getUserTimeZone(pool, userId);

  const { buffer, filename, contentType, rowCount } = await exportTransactions(
   pool,
   userId,
   { from, to, search, movementType, category, accountIds, format },
   timeZone,
  );

  // One line per export: who, what dataset, what format, which filters, how
  // many rows, and when (PLAN_EXPORT.md §6 step 14). No amounts and no row
  // contents travel into the log.
  console.log('[export] transactions', {
   userId,
   dataset: 'transactions',
   format,
   from: from ?? null,
   to: to ?? null,
   search: search ?? null,
   movementType: movementType ?? null,
   category: category ?? null,
   accountIds: accountIds ?? null,
   rowCount,
   generatedAt: new Date().toISOString(),
  });

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(buffer);
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

/** GET /api/export/statement */
export async function getStatementExport(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { month, format } = exportStatementQuerySchema.parse(req.query);

  const timeZone = await getUserTimeZone(pool, userId);

  // Same ceiling GET /overview applies to the same field: a future month
  // parses fine and is refused here, on its relationship to the owner's
  // calendar, not on shape.
  const window = await resolveWindowOr422(res, timeZone, month);
  if (!window) return;

  const { buffer, filename, contentType, rowCount } = await exportStatement(
   pool,
   userId,
   { window },
   timeZone,
   format,
  );

  console.log('[export] statement', {
   userId,
   dataset: 'statement',
   format,
   referenceMonth: window.referenceMonth,
   rowCount,
   generatedAt: new Date().toISOString(),
  });

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(buffer);
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
