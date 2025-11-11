//backend/src/fintrack_api/routes/index.js
import express from 'express';
import accountRoutes from './accountRoutes.js';
import transactionRoutes from './transactionRoute.js';
import dashboardRoutes from './dashboardRoutes.js';

// import { verifyToken } from '../../middlewares/authMiddleware.js';
//------------------------
const router = express.Router();
router.use('/account',
    // verifyToken,
   accountRoutes); //create, edit and read(get) accounts

router.use('/transaction',
 // verifyToken,
   transactionRoutes);//movements between accounts

router.use('/dashboard', 
  // verifyToken,
  dashboardRoutes);//overview info


export default router;
