// backend/src/fintrack_api/routes/budgetRoutes.js
// 🧩 ROUTES: Budget module
//
// Mounted under /api/fintrack, which app.js already guards with verifyToken
// and globalLimiter. Every handler below resolves identity from the token via
// requireUserId — no route here accepts a user ID from the client.

import express from 'express';
import {
  getSummary,
  getBudgetAccountsStatus,
  getFrequencies,
  updatePolicy,
  getHistory,
  exportCSV,
} from '../controllers/budgetController.js';

const router = express.Router();

// GET /api/fintrack/budget/summary?accountId=&frequency=&date=&startDate=&endDate=
router.get('/summary', getSummary);

// POST /api/fintrack/budget/accounts/status  { accountIds: [] , ... }
router.post('/accounts/status', getBudgetAccountsStatus);

// GET /api/fintrack/budget/frequencies
router.get('/frequencies', getFrequencies);

// PUT /api/fintrack/budget/policy/:budgetPolicyId
router.put('/policy/:budgetPolicyId', updatePolicy);

// GET /api/fintrack/budget/history/:budgetPolicyId
router.get('/history/:budgetPolicyId', getHistory);

// GET /api/fintrack/budget/export?accountId=&frequency=...
router.get('/export', exportCSV);

export default router;
