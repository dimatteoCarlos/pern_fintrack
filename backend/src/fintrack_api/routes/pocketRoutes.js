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
} from '../controllers/pocketController.js';

const router = express.Router();

// GET /api/fintrack/pocket/board
// No parameters: the board is every pocket the caller owns, and both halves of
// the screen — the header totals and the list — are read from this one answer.
//
// Declared before /:pocketId, which would otherwise match 'board' and send the
// literal to a parameter that expects an id.
router.get('/board', getPocketBoard);

// GET /api/fintrack/pocket/:pocketId
// The whole detail screen from one request: the hero, the source breakdown and
// the allocation history are three views of the same rows, and three requests
// would let them disagree about what the pocket holds.
router.get('/:pocketId', getPocketDetail);

export default router;
