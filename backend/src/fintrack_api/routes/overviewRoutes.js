//backend/src/fintrack_api/routes/overviewRoutes.js

// Overview routes. Mounted under /api/fintrack/overview, already behind
// verifyToken and globalLimiter in app.js — no guard is restated here.
//
// Both endpoints of the contract are routed: the page of §11 and the per-domain
// drill-down of §12.

import express from 'express';
import { getOverview, getOverviewDomain } from '../controllers/overviewController.js';

const router = express.Router();

// The page. Declared before the parameterised route for readability only — '/'
// and '/:domain' cannot match the same request, so the order carries no
// behaviour.
router.get('/', getOverview);

// The domain is a path segment and not a query parameter because it selects the
// calculator, not a filter over one result set.
router.get('/:domain', getOverviewDomain);

export default router;
