// src/fintrack_api/controllers/overviewController.js

// Overview Controller – HTTP request handlers for the Overview module.
//
// The same three rules as budgetController, for the same reasons.
//
// No handler accepts the CURRENT month. It is resolved inside the query on the
// account owner's calendar, so a request cannot name it and cannot carry the
// device's clock skew into a report. A PAST month does travel: the server cannot
// guess which month the user is looking at.
//
// No handler accepts an account id either, and that is why there is no ownership
// check in this file. The account set is derived server-side from the token's
// user id, so there is no id from the client to validate — the hole budget's
// handlers close by checking every element simply does not open here.
//
// There is no 404 for a domain that exists in the contract but has no calculator
// yet: that answers 501. A 404 would say the URL is wrong and a 400 would say
// the domain is invalid, and both are false statements about a domain the
// contract defines and this phase has not built.

import {
 overviewDomainParamsSchema,
 overviewDomainQuerySchema,
 IMPLEMENTED_OVERVIEW_DOMAINS,
} from '../../validation/zod/overviewValidators.js';

import { overviewExpenseService } from '../services/overview_services/services/overviewExpenseService.js';
import { pool } from '../../db/config/configDB.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';

/**
 * Answer a failed validation with the issues that caused it.
 *
 * Zod 4 renamed the issue list: reading ZodError.errors yields undefined, which
 * JSON.stringify drops, and every 400 goes out with an empty body telling the
 * caller the request failed but never which field. Same shape as
 * budgetController.js:57-66 so both modules report a rejection alike.
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

/** GET /api/fintrack/overview/:domain */
export async function getOverviewDomain(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { domain } = overviewDomainParamsSchema.parse(req.params);
  const { month, page, pageSize } = overviewDomainQuerySchema.parse(req.query);

  if (!IMPLEMENTED_OVERVIEW_DOMAINS.includes(domain)) {
   return res.status(501).json({
    status: 501,
    message: `The ${domain} calculator is not implemented yet.`,
   });
  }

  // Resolved here rather than inside the service: the zone is read once per
  // request and passed down, so no service resolves identity on its own.
  const timeZone = await getUserTimeZone(pool, userId);

  const data = await overviewExpenseService.getExpenseDomainData(
   pool,
   userId,
   { month, page, pageSize },
   timeZone,
  );

  res.status(200).json({
   status: 200,
   message: `Overview data for domain ${domain} retrieved successfully`,
   data,
  });
 } catch (error) {
  if (error.name === 'ZodError') {
   return respondWithZodIssues(res, error);
  }
  // 422 from the month resolver: the query parsed and the month is well formed,
  // it is simply later than the current one. Anything without a status is
  // unexpected and belongs to the error handler.
  if (error.status) {
   return res.status(error.status).json({ status: error.status, message: error.message });
  }
  next(error);
 }
}
