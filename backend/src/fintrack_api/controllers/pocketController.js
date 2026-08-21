// backend/src/fintrack_api/controllers/pocketController.js

// Pocket module – HTTP request handlers.
//
// One handler so far. It takes no parameters at all: the board is every pocket
// the caller owns, and identity comes from the token. There is nothing for a
// client to name, and therefore nothing it can name wrongly.
//
// The owner's time zone is resolved here, once per request, and passed down —
// no service resolves identity on its own. That is what puts the deadline and
// the start date on the user's calendar instead of the server's.

import { pool } from '../../db/config/configDB.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import { pocketBoardService } from '../services/pocket_services/services/pocketBoardService.js';

/** GET /api/fintrack/pocket/board */
export async function getPocketBoard(req, res, next) {
 try {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const timeZone = await getUserTimeZone(pool, userId);
  const board = await pocketBoardService.getBoard(pool, userId, timeZone);

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
