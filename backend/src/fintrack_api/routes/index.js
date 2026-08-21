//backend/src/fintrack_api/routes/index.js
import express from 'express';
import accountRoutes from './accountRoutes.js';
import transactionRoutes from './transactionRoute.js';
import dashboardRoutes from './dashboardRoutes.js';
import currencyRoutes from './currencyRoutes.js';
import budgetRoutes from './budgetRoutes.js';
import overviewRoutes from './overviewRoutes.js';

//------------------------
const router = express.Router();
router.use('/currency',
 currencyRoutes); //handling currency catalog and exchange rates

router.use('/account',
 accountRoutes); //create, edit and read(get) accounts

router.use('/transaction',
 transactionRoutes);//movements between accounts

router.use('/dashboard',
 dashboardRoutes);//overview info

router.use('/budget',
 budgetRoutes);//budget policies, allocations and summaries

//Mounted beside /dashboard, not inside it: /dashboard is the legacy aggregate
//Overview is being moved off (D6), and the two have to answer at the same time
//while the frontend switches screen by screen.
router.use('/overview',
 overviewRoutes);//per-domain overview calculators


export default router;
