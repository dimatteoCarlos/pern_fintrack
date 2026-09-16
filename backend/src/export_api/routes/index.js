// backend/src/export_api/routes/index.js
//
// Export routes. Mounted under /api/export, behind verifyToken (app.js) and
// this module's own exportRateLimiter — the global limiter is off while rate
// limiting is revised (REMARKS R23), and an export costs more per request
// than the reads it is off for.

import express from 'express';
import { getMovementsExport, getStatementExport } from '../controllers/exportController.js';
import { exportRateLimiter } from '../middlewares/exportRateLimiter.js';

const router = express.Router();

router.get('/movements', exportRateLimiter, getMovementsExport);
router.get('/statement', exportRateLimiter, getStatementExport);

export default router;
