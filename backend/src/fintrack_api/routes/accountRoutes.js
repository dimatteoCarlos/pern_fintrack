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
import express, { Router } from 'express';
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

// 🛠️ ACCOUNT EDITION CONTROLLER
import {patchAccountById} from '../controllers/accountEditController.js';

// 🗑 ACCOUNT DELETE CONTROLLER
import { verifyUser } from '../../middlewares/authMiddleware.js';
import { executeAccountDeletion, generateImpactReport } from '../controllers/accountDeleteController.js';
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
//-----
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
// ---------------------------------
// 🛠️ ACCOUNT EDITION ROUTES (UPDATE)
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

// =================================
// 🗑 ACCOUNT DELETION & RECONCILIATION ROUTE
// 📝 Route for getting the impact report before deletion
// Path: GET /api/fintrack/account/delete/report_of_affected_accounts/:targetAccountId
//--------------------------------------
router.get(
 '/delete/report_of_affected_accounts/:targetAccountId',
 verifyUser, // 🛡️ Authentication required
 generateImpactReport
);

// ==================================
// 💣 DELETE EXECUTION ENDPOINT (WRITE)
// Purpose: Executes SOFT, HARD, or RTA deletion atomically.
// Path: DELETE /api/fintrack/account/delete/:targetAccountId
// Payload (RTA): Must contain deletionType, impactReport, and targetAccountName in the body.
// ====================================
// 📝 Route for final deletion (Soft or Atomic Hard Delete)
// DELETE /api/fintrack/account/delete/:accountId
router.delete('/delete/:targetAccountId',
verifyUser, 
executeAccountDeletion 
);


//------------------------------
export default router;
