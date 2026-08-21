// src/fintrack_api/controllers/overviewController.js

// Overview Controller – HTTP request handlers for the Overview module.
//
// The same three rules as budgetController, for the same reasons.
//
// No handler accepts the CURRENT month. It is resolved here on the account
// owner's calendar, so a request cannot name it and cannot carry the device's
// clock skew into a report. A PAST month does travel: the server cannot guess
// which month the user is looking at.
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
} from '../../validation/zod/overviewValidators.js';

import { overviewExpenseService } from '../services/overview_services/services/overviewExpenseService.js';
import { overviewIncomeService } from '../services/overview_services/services/overviewIncomeService.js';
import { overviewPnlService } from '../services/overview_services/services/overviewPnlService.js';
import { makeReportingWindow } from '../services/overview_services/core/monthArithmetic.js';
import { getCurrentMonth } from '../services/budget_services/db/budgetTransactionRepository.js';
import { pool } from '../../db/config/configDB.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';

// Which calculator answers for which domain.
//
// A map and not a switch, so adding the next domain is one row next to the ones
// already there. Each entry is wrapped rather than passed as a bare method
// reference: the services are object literals today and none of them reads
// `this`, but a reference detached from its object is a trap that only shows up
// the day one of them starts to.
const DOMAIN_CALCULATORS = {
 expense: (...args) => overviewExpenseService.getExpenseDomainData(...args),
 income: (...args) => overviewIncomeService.getIncomeDomainData(...args),
 pnl: (...args) => overviewPnlService.getPnlDomainData(...args),
};

/**
 * Answer a failed validation with the issues that caused it.
 *
 * Zod 4 renamed the issue list: reading ZodError.errors yields undefined, which
 * JSON.stringify drops, and every 400 goes out with an empty body telling the
 * caller the request failed but never which field. Same shape as
 * budgetController.js:57-66 so both modules report a rejection alike.
 *
 * An unrecognized key is the one issue whose path is EMPTY — the offending key
 * is not on the path, it is in issue.keys — so `path.join('.')` yields "" and
 * the response names nothing. That is exactly the case the strict schemas exist
 * to report: overviewValidators states that a retired parameter answers 400
 * naming the key, and without this branch it did not.
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

/** GET /api/fintrack/overview/:domain */
export async function getOverviewDomain(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { domain } = overviewDomainParamsSchema.parse(req.params);
  const { month, page, pageSize } = overviewDomainQuerySchema.parse(req.query);

  const calculator = DOMAIN_CALCULATORS[domain];

  if (!calculator) {
   return res.status(501).json({
    status: 501,
    message: `The ${domain} calculator is not implemented yet.`,
   });
  }

  // Resolved here rather than inside the service: the zone is read once per
  // request and passed down, so no service resolves identity on its own.
  const timeZone = await getUserTimeZone(pool, userId);
  const currentMonth = await getCurrentMonth(pool, timeZone);

  // 422 and not 400: the request parsed and the month is well formed, it is
  // simply later than any month that exists on the owner's calendar. That is a
  // relationship with a calendar, which no schema can see.
  if (month && month > currentMonth) {
   return res.status(422).json({
    status: 422,
    message: `month ${month.slice(0, 7)} is later than the current month ${currentMonth.slice(0, 7)}.`,
   });
  }

  // One window for the whole request. Resolved here for the same reason the
  // zone is: six calculators each shifting their own months would be six
  // chances to disagree about which month a page is reporting.
  const window = makeReportingWindow(month ?? currentMonth);

  const data = await calculator(pool, userId, { window, page, pageSize }, timeZone);

  res.status(200).json({
   status: 200,
   message: `Overview data for domain ${domain} retrieved successfully`,
   data,
  });
 } catch (error) {
  if (error.name === 'ZodError') {
   return respondWithZodIssues(res, error);
  }
  // A repository raising createError carries its own status; anything without
  // one is unexpected and belongs to the error handler.
  if (error.status) {
   return res.status(error.status).json({ status: error.status, message: error.message });
  }
  next(error);
 }
}
