// backend/src/fintrack_api/controllers/pocketController.js

// Pocket module – HTTP request handlers.
//
// The owner's time zone is resolved here, once per request, and passed down —
// no service resolves identity on its own. That is what puts the deadline and
// the allocation dates on the user's calendar instead of the server's.
//
// There is no 404 in this module. A pocket id that does not exist and one that
// belongs to someone else both answer 403: splitting them would let a caller
// walk the id space and learn which pockets are other users'. The rest of the
// shape is the budget module's — 400 is what a schema can see, 422 is what it
// cannot, and 401 is the absent session.

import { pool } from '../../db/config/configDB.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import { pocketBoardService } from '../services/pocket_services/services/pocketBoardService.js';
import { pocketDetailService } from '../services/pocket_services/services/pocketDetailService.js';
import { pocketWriteService } from '../services/pocket_services/services/pocketWriteService.js';
import { pocketAllocationService } from '../services/pocket_services/services/pocketAllocationService.js';
import { getCalendarToday } from '../services/pocket_services/db/pocketRepository.js';
import {
 pocketParamsSchema,
 createPocketBodySchema,
 updatePocketBodySchema,
 allocationBodySchema,
 boardQuerySchema,
} from '../../validation/zod/pocketValidators.js';

/**
 * Answer a failed validation with the issues that caused it.
 *
 * Zod 4 renamed the issue list: ZodError.errors no longer exists, and reading it
 * yields undefined, which JSON.stringify drops from the payload — a 400 telling
 * the caller the request failed but never which field. Same shape the budget
 * module and validateRequest.js already use.
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

/**
 * Turn a service error into its response.
 *
 * A service raises an Error carrying a status when the failure is a decision the
 * domain took — 403 for a pocket that is not the caller's, 422 for a rule a
 * schema cannot check. Anything with no status is unexpected and goes to the
 * error middleware, which is what keeps a real defect from being reported as a
 * business rule.
 */
const respondWithServiceError = (res, next, error) => {
 if (error.name === 'ZodError') {
  return respondWithZodIssues(res, error);
 }

 if (error.status) {
  return res
   .status(error.status)
   .json({ status: error.status, message: error.message });
 }

 return next(error);
};

/**
 * GET /api/fintrack/pocket/board?month=YYYY-MM
 *
 * The month is optional and its absence means the current one. The current
 * month is resolved here on the owner's calendar and never accepted from the
 * client: a browser in Auckland and one in Bogotá disagree about which month it
 * is for several hours a day, and only the server knows which one is the
 * owner's.
 *
 * A later month is refused with 422 rather than clamped. Clamping would answer
 * a question the caller did not ask and label it with a month it did not name;
 * the interface disables the forward arrow at the current month, so the refusal
 * is unreachable from the screen and exists for the URL typed by hand.
 */
export async function getPocketBoard(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const query = boardQuerySchema.safeParse(req.query);

  if (!query.success) {
   return respondWithZodIssues(res, query.error);
  }

  const timeZone = await getUserTimeZone(pool, userId);
  const today = await getCalendarToday(pool, timeZone);
  const currentMonth = `${today.slice(0, 7)}-01`;
  const monthStart = query.data.month ?? currentMonth;

  if (monthStart > currentMonth) {
   return res.status(422).json({
    status: 422,
    message: `month ${monthStart.slice(0, 7)} is later than the current month ${currentMonth.slice(0, 7)}.`,
   });
  }

  const board = await pocketBoardService.getBoard(
   pool,
   userId,
   timeZone,
   monthStart,
  );

  // 200 with an empty pockets[] and a null-figured summary, never 400. A user
  // who owns no pocket has asked a valid question and the answer is "none" —
  // which is what the two dashboard endpoints got wrong, answering 400 and
  // making an empty board indistinguishable from a broken request.
  return res.status(200).json({
   status: 200,
   message: 'Pocket board retrieved successfully',
   data: board,
  });
 } catch (error) {
  return next(error);
 }
}

/** GET /api/fintrack/pocket/:pocketId */
export async function getPocketDetail(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { pocketId } = pocketParamsSchema.parse(req.params);

  const timeZone = await getUserTimeZone(pool, userId);
  const detail = await pocketDetailService.getDetail(
   pool,
   userId,
   pocketId,
   timeZone,
  );

  return res.status(200).json({
   status: 200,
   message: 'Pocket retrieved successfully',
   data: detail,
  });
 } catch (error) {
  return respondWithServiceError(res, next, error);
 }
}

/** POST /api/fintrack/pocket */
export async function createPocket(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const body = createPocketBodySchema.parse(req.body);

  const pocketId = await pocketWriteService.createPocket(userId, body);

  // The whole detail payload, not just the id. The screen that follows a
  // creation is the detail screen, and a second request for a pocket this
  // handler just wrote is a round trip with nothing to learn.
  const timeZone = await getUserTimeZone(pool, userId);
  const detail = await pocketDetailService.getDetail(
   pool,
   userId,
   pocketId,
   timeZone,
  );

  return res.status(201).json({
   status: 201,
   message: 'Pocket created successfully',
   data: detail,
  });
 } catch (error) {
  return respondWithServiceError(res, next, error);
 }
}

/** PATCH /api/fintrack/pocket/:pocketId */
export async function editPocket(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { pocketId } = pocketParamsSchema.parse(req.params);
  const body = updatePocketBodySchema.parse(req.body);

  await pocketWriteService.editPocket(userId, pocketId, body);

  // The recomputed figures come back with the write. A new target moves the gap
  // and the monthly pace it implies, and that pace is the figure the owner is
  // actually choosing — derived here, never on the client.
  const timeZone = await getUserTimeZone(pool, userId);
  const detail = await pocketDetailService.getDetail(
   pool,
   userId,
   pocketId,
   timeZone,
  );

  return res.status(200).json({
   status: 200,
   message: 'Pocket updated successfully',
   data: detail,
  });
 } catch (error) {
  return respondWithServiceError(res, next, error);
 }
}

/**
 * Commit money to a pocket, or release it back, and answer with the whole
 * detail screen.
 *
 * One handler for both, because the two requests are the same decision with
 * opposite effect and only the endpoint distinguishes them. The client sends a
 * positive amount either way and never a sign.
 *
 * The response is the detail payload rather than the row written: one decision
 * changes the hero, the source breakdown and the history at once, and a client
 * that patched one of them from the row would be deriving the other two.
 */
const writeAllocation = async (direction, req, res, next) => {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { pocketId } = pocketParamsSchema.parse(req.params);
  const body = allocationBodySchema.parse(req.body);

  await pocketAllocationService[direction](userId, pocketId, body);

  const timeZone = await getUserTimeZone(pool, userId);
  const detail = await pocketDetailService.getDetail(
   pool,
   userId,
   pocketId,
   timeZone,
  );

  return res.status(201).json({
   status: 201,
   message:
    direction === 'allocate'
     ? 'Funds allocated successfully'
     : 'Funds released successfully',
   data: detail,
  });
 } catch (error) {
  return respondWithServiceError(res, next, error);
 }
};

/** DELETE /api/fintrack/pocket/:pocketId */
export async function deletePocketById(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { pocketId } = pocketParamsSchema.parse(req.params);

  const result = await pocketWriteService.removePocket(userId, pocketId);

  // What each account gets back travels in the answer, so the result states the
  // same thing the confirmation promised. There is no impact report to run
  // first: deleting a pocket moves no money.
  return res.status(200).json({
   status: 200,
   message: 'Pocket deleted successfully',
   data: result,
  });
 } catch (error) {
  return respondWithServiceError(res, next, error);
 }
}

/** POST /api/fintrack/pocket/:pocketId/allocations */
export const allocateToPocket = (req, res, next) =>
 writeAllocation('allocate', req, res, next);

/** POST /api/fintrack/pocket/:pocketId/releases */
export const releaseFromPocket = (req, res, next) =>
 writeAllocation('release', req, res, next);
