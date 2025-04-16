import express from 'express';
import {
  addTransaction,
  getDashboardInformation,
  getTransaction,
  transferMoneyToAccount,
} from '../controllers/transactionController.js';

const router = express.Router();

// const select = true;
// const middlewareFn = select ? verifyUser : verifyHeaderAuth;
router.get('/', getTransaction);
router.get('/dashboard', getDashboardInformation);
router.post('/add-transaction/:account_id', addTransaction);
router.put('/transfer-money', transferMoneyToAccount);

export default router;
