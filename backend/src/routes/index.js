import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import accountRoutes from './accountRoutes.js';
import transactionRoutes from './transactionRoutes.js'
import { authDetectClienttype } from '../middlewares/authDetectClientType.js';

const router = express.Router(); 
console.log('index routes');

router.use('/auth', authDetectClienttype,authRoutes);


router.use('/user', userRoutes);
router.use('/account', accountRoutes);
router.use('/transaction', transactionRoutes);

export default router;

