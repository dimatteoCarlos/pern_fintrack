// backend/src/fintrack_api/routes/transactionRoute.js
import express from 'express';
import { getTransactionById, transferBetweenAccounts } from '../controllers/transactionController.js';

const router = express.Router();

//TRANSACTION BETWEEN ACCOUNTS, FOR TRACKER MOVEMENTS
router.use('/transfer-between-accounts', transferBetweenAccounts);

// GET transaction by ID (with FX metadata)
//GET /api/fintrack/transaction/:transactionId
router.get('/:transactionId', getTransactionById);


export default router;