// backend/src/fintrack_api/routes/transactionRoute.js
import express from 'express';
import { transferBetweenAccounts } from '../controllers/transactionController.js';

const router = express.Router();

//TRANSACTION BETWEEN ACCOUNTS, FOR TRACKER MOVEMENTS
router.use('/transfer-between-accounts', transferBetweenAccounts);

export default router;
