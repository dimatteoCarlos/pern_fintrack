//backend/src/fintrack_api/routes/index.js
import express from 'express';
import accountRoutes from './accountRoutes.js';
import transactionRoutes from './transactionRoute.js';
import dashboardRoutes from './dashboardRoutes.js';

//------------------------
const router = express.Router();
router.use('/account',
 accountRoutes); //create, edit and read(get) accounts

router.use('/transaction',
 transactionRoutes);//movements between accounts

router.use('/dashboard', 
 dashboardRoutes);//overview info


export default router;
