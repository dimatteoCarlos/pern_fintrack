//backend/src/fintrack_api/routes/overviewRoutes.js

// Overview routes. Mounted under /api/fintrack/overview, already behind
// verifyToken and globalLimiter in app.js — no guard is restated here.
//
// Three endpoints: the page of §11, the per-domain drill-down of §12, and the
// activity section of §10 on the range its reader chooses.

import express from 'express';
import {
 getOverview,
 getOverviewActivity,
 getOverviewDomain,
} from '../controllers/overviewController.js';

const router = express.Router();

// The page.
router.get('/', getOverview);

// Activity, and the order here CARRIES BEHAVIOUR. A literal segment and a
// parameter both match /activity, and the first declaration wins: below the
// parameterised route this handler would never run, and the request would answer
// 400 naming activity as an invalid domain — a correct message about the wrong
// reading of the URL, which is the kind of failure that survives review.
//
// It is not a domain and does not belong under /:domain even though the URL
// looks alike. A domain selects one of six calculators over the reference month;
// this reads every domain over a range the caller chose.
router.get('/activity', getOverviewActivity);

// The domain is a path segment and not a query parameter because it selects the
// calculator, not a filter over one result set.
router.get('/:domain', getOverviewDomain);

export default router;
