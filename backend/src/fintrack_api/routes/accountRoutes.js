//backend\src\fintrack_api\routes\accountRoutes.js
//----------------------------
//RULES
//tracker movements - type accounts consist on:
//expense: bank and category_budget account types
//income: bank and income_source_accounts
//investment: investment_accounts
//pocket_saving: pocket_saving_accounts
//debtor: debtor_accounts
//------------------------------
import express from 'express';
// 📚 ACCOUNT CREATION CONTROLLERS (basic (bank, investment, income), debtor, pocket)
import {
  createBasicAccount,
  createDebtorAccount,
  createPocketAccount,
} from '../controllers/accountCreationController.js';

// 📚 ACCOUNT READING CONTROLLERS
import {
  getAccounts,
  getAllAccountsByType,
  getAccountById,
  getAccountsByCategory,
// getCategoryBudgetFullDataEndpoint,
} from '../controllers/getAccountController.js';

// 📚 CATEGORY_BUDGET ACCOUNT Creation Controller
import { createCategoryBudgetAccount } from '../controllers/accountCategoryCreationcontroller.js';

// 📚 TRANSACTIONS CONTROLLER
import { getTransactionsForAccountById } from '../controllers/getTransactionsForAccountById.js';
// import { verifyToken } from '../../middlewares/authMiddleware.js';

// 📚 ACCOUNT EDITION CONTROLLER
import {patchAccountById} from '../controllers/accountEditController.js';

//----------------------------------
// ROUTES
//----------------------------------
const router = express.Router();
// ---------------------------------
// 📝 CREATE ACCOUNT ROUTES
// ---------------------------------
router.post('/new_account/bank',
   //verifyToken,
  createBasicAccount); 

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

// ---------------------------------
// 🛠️ ACCOUNT EDITION ROUTES
// ---------------------------------
//Route for getting account details info for edition form
// GET /api/fintrack/account/details/:accountId
router.get('/details/:accountId', 
  getAccountById // RE-USED
);

// Route for partially update an existing account
// PATCH /api/fintrack/account/edit/:accountId
router.patch('/edit/:accountId',
patchAccountById 
);

//------------------------------
//GET USER ACCOUNT INFO BY TYPE, BY ID, ALL ACC.
// ---------------------------------
// 📖 ACCOUNT READING (GET) ROUTES
// ---------------------------------
router.get('/allAccounts',
  // verifyToken, 
  getAccounts);

router.get('/type',
  // verifyToken, 
  getAllAccountsByType);

router.get('/:accountId',
  // verifyToken,
   getAccountById);

// ---------------------------------
// 📖 ACCOUNT READING (GET) ROUTES
// ---------------------------------
router.get('/transactions/:accountId',
  // verifyToken, 
  getTransactionsForAccountById);

// ---------------------------------
// 📝 GET USER ACCOUNT LIST INFO BY CATEGORY NAME
// ---------------------------------
// get all category budget account type info associated to a category Name
//route: /api/fintrack/category/
router.get('/category/:categoryName',
  // verifyToken, 
  getAccountsByCategory);

//----------------------
//  router.get('/:accountId/category-budget-full', getCategoryBudgetFullDataEndpoint); 
//----------------------
export default router;
