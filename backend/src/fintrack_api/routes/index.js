import express from 'express';

import accountRoutes from './accountRoutes.js';
import transactionRoutes from './transactionRoute.js';
import dashboardRoutes from './dashboardRoutes.js';
import listRoutes from './listRoutes.js';

//---multicurrency----
// import dashboardMulticurrencyRoutes from './dashboardMulticurrencyRoutes.js';

const router = express.Router();

router.use('/account', accountRoutes); //create and read(get) accounts

router.use('/transaction', transactionRoutes);

router.use('/dashboard', dashboardRoutes);

router.use('/account/type', listRoutes); //for catalog table data

//MULTICURRENCY
// router.use('/dashboard/multicurrency', dashboardMulticurrencyRoutes);

export default router;
