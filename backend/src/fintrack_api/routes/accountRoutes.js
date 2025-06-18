import express from 'express';
//controllers
import {
  createBasicAccount,
  createDebtorAccount,
  createPocketAccount,
  // createCategoryBudgetAccount,
} from '../controllers/accountCreationController.js';

import {
  getAccounts,
  getAllAccountsByType,
  getAccountById,
} from '../controllers/getAccountController.js';
import { createCategoryBudgetAccount } from '../controllers/accountCategoryCreationcontroller.js';
import { getTransactionsForAccountById } from '../controllers/getTransactionsForAccountById.js';

// import { createCategoryBudgetAccount } from '../controllers/accountCategoryCreationController.js';

// const select = true;
// import { verifyHeaderAuth, verifyUser } from '../middlewares/authMiddleware.js';
// router.post('/new_account/bank',verifyUser ,createBasicAccount);
const router = express.Router();

//CREATE ACCOUNTS BY ACCOUNT TYPE
router.post('/new_account/bank', createBasicAccount); //bank
router.post('/new_account/income_source', createBasicAccount);
router.post('/new_account/investment', createBasicAccount);
router.post('/new_account/debtor', createDebtorAccount);
router.post('/new_account/pocket_saving', createPocketAccount);
router.post('/new_account/category_budget', createCategoryBudgetAccount);
//---------------------------------------------
//RULES
//tracker movements - type accounts involved
//expense: bank and category_budget account types
//income: bank and income_source_accounts
//investment: investment_accounts
//pocket_saving: pocket_saving_accounts
//debtor: debtor_accounts

//GET USER ACCOUNT INFO BY TYPE, BY ID, ALL ACC.
router.get('/allAccounts', getAccounts);
router.get('/type', getAllAccountsByType);
router.get('/:accountId', getAccountById);
router.get('/transactions/:accountId', getTransactionsForAccountById);
//----------------------------------------------
export default router;
