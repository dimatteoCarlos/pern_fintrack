// backend/src/fintrack_api/routes/debtRoutes.js
// 🧩 ROUTES: Debt module
//
// Mounted under /api/fintrack, which app.js already guards with verifyToken and
// globalLimiter. The handler resolves identity from the token via requireUserId —
// no route here accepts a user ID from the client.

import express from 'express';
import { exportDebtAnalysis } from '../controllers/debtController.js';

const router = express.Router();

// GET /api/fintrack/debt/export?month=YYYY-MM&format=csv|xlsx
// One row per counterparty at the close of the month, with the direction named
// beside the balance so the reader never infers it from the sign; the workbook
// adds the two legs month by month. The figures themselves stay on
// GET /overview/debt: this route changes the format, not the calculation.
router.get('/export', exportDebtAnalysis);

export default router;
