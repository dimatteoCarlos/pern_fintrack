// backend/src/fintrack_api/routes/pocketRoutes.js
// 🧩 ROUTES: Pocket module
//
// Mounted under /api/fintrack, which app.js already guards with verifyToken and
// globalLimiter. Every handler resolves identity from the token via
// requireUserId — no route here accepts a user ID from the client.

import express from 'express';
import {
 getPocketBoard,
 getPocketDetail,
 createPocket,
 editPocket,
} from '../controllers/pocketController.js';

const router = express.Router();

// GET /api/fintrack/pocket/board
// No parameters: the board is every pocket the caller owns, and both halves of
// the screen — the header totals and the list — are read from this one answer.
//
// Declared before /:pocketId, which would otherwise match 'board' and send the
// literal to a parameter that expects an id.
router.get('/board', getPocketBoard);

// POST /api/fintrack/pocket
// { name, note?, targetAmount, currency, desiredDate }
// No source account and no money: a pocket is created empty and the screen then
// offers to allocate. currency is the unit the target was TYPED in; the server
// converts and stores what it did.
router.post('/', createPocket);

// PATCH /api/fintrack/pocket/:pocketId
// { name?, note?, targetAmount?, currency?, desiredDate? }
// Target and date in one request, because they are one decision. The pocket's
// own currency is not editable: restating it would restate every past
// allocation.
router.patch('/:pocketId', editPocket);

// GET /api/fintrack/pocket/:pocketId
// The whole detail screen from one request: the hero, the source breakdown and
// the allocation history are three views of the same rows, and three requests
// would let them disagree about what the pocket holds.
router.get('/:pocketId', getPocketDetail);

export default router;
