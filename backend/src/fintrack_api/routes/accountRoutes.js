//backend\src\fintrack_api\routes\accountRoutes.js
//New Account Creation routes

import express from 'express';
//controllers
import {
  createBasicAccount,
  createDebtorAccount,
  createPocketAccount,
} from '../controllers/accountCreationController.js';

import {
  getAccounts,
  getAllAccountsByType,
  getAccountById,
  getAccountsByCategory,
} from '../controllers/getAccountController.js';

import { createCategoryBudgetAccount } from '../controllers/accountCategoryCreationcontroller.js';

import { getTransactionsForAccountById } from '../controllers/getTransactionsForAccountById.js';
import { verifyToken } from '../../middlewares/authMiddleware.js';

// import { verifyHeaderAuth, verifyUser } from '../middlewares/authMiddleware.js';
// router.post('/new_account/bank',verifyUser ,createBasicAccount);

const router = express.Router();

//CREATE ACCOUNTS BY ACCOUNT TYPE
router.post('/new_account/bank',
   //verifyToken,
  createBasicAccount); //bank
router.post('/new_account/income_source',
  // verifyToken,
createBasicAccount);
router.post('/new_account/investment', 
  // verifyToken,
  createBasicAccount);
router.post('/new_account/debtor', 
  // verifyToken,
  createDebtorAccount);

router.post('/new_account/pocket_saving',
  // verifyToken, 
  createPocketAccount);
  
router.post('/new_account/category_budget',
  //  verifyToken,
  createCategoryBudgetAccount);
//----------------------------
//RULES
//tracker movements - type accounts involved
//expense: bank and category_budget account types
//income: bank and income_source_accounts
//investment: investment_accounts
//pocket_saving: pocket_saving_accounts
//debtor: debtor_accounts

//GET USER ACCOUNT INFO BY TYPE, BY ID, ALL ACC.
router.get('/allAccounts',
  // verifyToken, 
  getAccounts);
router.get('/type',
  // verifyToken, 
  getAllAccountsByType);
router.get('/:accountId',
  // verifyToken,
   getAccountById);
router.get('/transactions/:accountId',
  // verifyToken, 
  getTransactionsForAccountById);

//GET USER ACCOUNT LIST INFO BY CATEGORY NAME
// get all category budget account type info associated to a category Name
//route: /api/fintrack/category/
router.get('/category/:categoryName',
  // verifyToken, 
  getAccountsByCategory);
//-------------------------------------
export default router;
