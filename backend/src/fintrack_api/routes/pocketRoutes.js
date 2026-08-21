// backend/src/fintrack_api/routes/pocketRoutes.js
// 🧩 ROUTES: Pocket module
//
// Mounted under /api/fintrack, which app.js already guards with verifyToken and
// globalLimiter. The handler resolves identity from the token via
// requireUserId — this route accepts no user ID from the client.

import express from 'express';
import { getPocketBoard } from '../controllers/pocketController.js';

const router = express.Router();

// GET /api/fintrack/pocket/board
// No parameters: the board is every pocket the caller owns, and both halves of
// the screen — the header totals and the list — are read from this one answer.
router.get('/board', getPocketBoard);

export default router;
