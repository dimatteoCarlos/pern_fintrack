
import express from 'express';
import {
  dashboardMovementTransactions,
  dashboardTotalBalanceAccountByType,
  dashboardTotalBalanceAccounts,
  dashboardMovementTransactionsByType,
  dashboardMovementTransactionsSearch,
  dashboardAccountSummaryList,
} from '../controllers/dashboardController.js';
import {} from '../controllers/transactionController.js';
import { dashboardMonthlyTotalAmountByType } from '../controllers/dashboardMonthlyTotalAmountByType.js';
// import { verifyToken } from '../../middlewares/authMiddleware.js';

const router = express.Router();

//GET TOTAL BALANCE OF ALL ACCOUNTS BUT SLACK
router.get('/balance/',
  //  verifyToken,
dashboardTotalBalanceAccounts);

//GET TOTAL BALANCE, TOTAL BUDGET, TOTAL TARGET, TOTAL DEBTORS AND MORE
router.get('/balance/type/',
// verifyToken, 
dashboardTotalBalanceAccountByType);

//GET SUMMARY OF CATEGORIES, POCKETS, AND DEBTORS
router.get('/balance/summary/',
  // verifyToken, 
 dashboardAccountSummaryList);

//GET TOTAL AND AVERAGE of MONTH EXPENSES FOR CATEGORIES AND INCOME
router.get(
  '/balance/monthly_total_amount_by_type/',
  // verifyToken,
  dashboardMonthlyTotalAmountByType
);
//----------------------
//GET TRACKER MOVEMENT TRANSACTIONS BY MOVEMENT TYPE AND CORRESPONDING PRE FIXED ACCOUNT
router.get('/movements/movement/',
// verifyToken, 
 dashboardMovementTransactions);

//GET TRACKER MOVEMENT TRANSACTIONS BY PERIOD, MOVEMENT TYPE, ACCOUNT TYPE OR TRANSACTION TYPE
router.get('/movements/account_type/',
// verifyToken, 
dashboardMovementTransactionsByType);

//GET TRACKER MOVEMENT TRANSACTIONS BY PERIOD,  AND SEARCH MOVEMENT TYPE, ACCOUNT TYPE AND TRANSACTION TYPE AND OTHERS
router.get('/movements/search/',
  // verifyToken,
  dashboardMovementTransactionsSearch);

export default router;

//----------------------


