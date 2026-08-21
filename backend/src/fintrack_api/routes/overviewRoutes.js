//backend/src/fintrack_api/routes/overviewRoutes.js

// Overview routes. Mounted under /api/fintrack/overview, already behind
// verifyToken and globalLimiter in app.js — no guard is restated here.
//
// GET /overview itself (§11 of the contract) is not routed yet: this phase
// builds the per-domain endpoint only. Declaring the path now with no handler
// would answer 404 on a URL the contract promises, which is worse than not
// declaring it.

import express from 'express';
import { getOverviewDomain } from '../controllers/overviewController.js';

const router = express.Router();

// The domain is a path segment and not a query parameter because it selects the
// calculator, not a filter over one result set.
router.get('/:domain', getOverviewDomain);

export default router;
