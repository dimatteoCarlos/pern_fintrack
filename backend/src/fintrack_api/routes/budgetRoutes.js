// backend/src/fintrack_api/routes/budgetRoutes.js
// 🧩 ROUTES: Budget module
//
// Mounted under /api/fintrack, which app.js already guards with verifyToken
// and globalLimiter. Every handler below resolves identity from the token via
// requireUserId — no route here accepts a user ID from the client.
//
// Three routes, down from six. /summary answered the same question as
// /accounts/status with one id; /frequencies, /policy/:id and /history/:id all
// read tables that no longer exist.

import express from 'express';
import {
  getBudgetAccountsStatus,
  setCurrentBudget,
  exportCSV,
} from '../controllers/budgetController.js';

const router = express.Router();

// POST /api/fintrack/budget/accounts/status  { accountIds: [] }
router.post('/accounts/status', getBudgetAccountsStatus);

// PUT /api/fintrack/budget/accounts/:accountId/current  { amount, onlyThisMonth }
router.put('/accounts/:accountId/current', setCurrentBudget);

// GET /api/fintrack/budget/export?accountId=
// accountId is optional: omitted, the file covers every budget account owned.
router.get('/export', exportCSV);

export default router;
