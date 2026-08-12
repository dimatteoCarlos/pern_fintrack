// backend/src/fintrack_api/routes/budgetRoutes.js
// 🧩 ROUTES: Budget module
//
// Mounted under /api/fintrack, which app.js already guards with verifyToken
// and globalLimiter. Every handler below resolves identity from the token via
// requireUserId — no route here accepts a user ID from the client.
//
// Four routes, down from six. /summary answered the same question as
// /accounts/status with one id; /frequencies and /policy/:id read tables that no
// longer exist; /history/:id is replaced by /accounts/:id/series below.

import express from 'express';
import {
 getBudgetAccountsStatus,
 setCurrentBudget,
 getBudgetAccountSeries,
 exportCSV,
} from '../controllers/budgetController.js';

const router = express.Router();

// POST /api/fintrack/budget/accounts/status  { accountIds: [] }
router.post('/accounts/status', getBudgetAccountsStatus);

// PUT /api/fintrack/budget/accounts/:accountId/current  { amount, onlyThisMonth }
router.put('/accounts/:accountId/current', setCurrentBudget);

// GET /api/fintrack/budget/accounts/:accountId/series?from=&to=
// Both bounds are optional and default to the last twelve months.
router.get('/accounts/:accountId/series', getBudgetAccountSeries);

// GET /api/fintrack/budget/export?accountId=&from=&to=
// All three are optional: accountId omitted covers every budget account owned,
// and an omitted range is the current month.
router.get('/export', exportCSV);

export default router;
