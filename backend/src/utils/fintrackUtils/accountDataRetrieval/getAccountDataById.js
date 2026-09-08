// backend/src/utils/fintrackUtils/accountDataRetrieval/getAccountDataById.js
//
// RETIRED — an unfinished draft that has never been able to run. It is commented
// out rather than deleted, per the standing rule on superseded code.
//
// The live path it duplicates is getAccountById in getAccountController.js,
// wired to GET /:accountId in accountRoutes.js.
//
// THREE FAULTS, ANY ONE OF WHICH STOPS IT
//
// 1. The pool import names "../../src/db/configDB". From this directory that
//    resolves to src/utils/fintrackUtils/src/db/configDB, which does not exist;
//    the module is at src/db/config/configDB.js. The specifier also carries no
//    .js extension, which ESM requires. The file throws on load.
// 2. getSpecificAccountQuery is called and never imported, and no module in the
//    repository defines it. A ReferenceError, if the load ever succeeded.
// 3. calculateBudgetMetrics is called and never imported either. Its only two
//    copies are the module-local const in calculateBudgetMetrics.js, which
//    exports nothing, and the one in getAccountController.js, now retired.
//
// AND THE FIGURE IT WOULD HAVE PUBLISHED IS WRONG
//
// The enrichment block subtracts an account balance from category_budget_accounts.budget.
// A category_budget account's balance is accumulated spend over the account's
// whole life: movementInputHandler.js declares the expense movement as
// bank -> category_budget, so every spend deposits onto that account and no
// movement takes it back down. budget is one month's plan. Subtracting a
// lifetime total from a monthly figure yields a remainder that falls further
// behind every month the account lives. Migration 010 moved the plan into
// budget_monthly_allocations, one row per month, and the figure a caller wants
// is served by GET /api/fintrack/budget/summary.
//
// The SELECT below also reads `ua.*`, which carries the stored account_balance
// column instead of the ledger derivation (derivedBalance.js).

/**

// Service layer: fetches account data and enriches it based on account type
// (for category_budget accounts: adds remain and statusAlert fields)

import { pool } from "../../src/db/configDB";

//=============================
export const getAccountDataById = async (userId, accountId) =>{

try{
//BASIC VALIDATION
 if (!userId || !accountId) {
   throw new Error('User ID and Account ID are required');
 }

//GET BASIC ACCOUNT INFO
 const basicAccountInfo = await pool.query({
  text: `SELECT act.account_type_name, ua.*
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.account_id = $1 AND ua.user_id = $2`,
   values: [accountId, userId],
 });

 if (basicAccountInfo.rows.length === 0) {
     throw new Error('Account not found or user mismatch');
   } 

 const { account_type_name } = basicAccountInfo.rows[0];  

//VALIDATE ACCOUNT TYPE
 const validTypes = ['pocket_saving', 'category_budget', 'bank', 'investment', 'income_source', 'debtor'];
  if (!validTypes.includes(account_type_name)) {
    throw new Error(`Unsupported account type: ${account_type_name}`);
  }

//GET SPECIFIC DATA AS PER ACCOUTN TYPE
  let accountData;
  
  if (['bank', 'investment', 'income_source'].includes(account_type_name)) {

    accountData = basicAccountInfo.rows[0];
  } else {
//SPECIFIC DATA ACCOUNT
    const specificQuery = getSpecificAccountQuery(account_type_name, userId, accountId);

    const specificResult = await pool.query(specificQuery);
    
    if (specificResult.rows.length === 0) {
      throw new Error(`No specific data found for ${account_type_name} account`);
    }
    
    accountData = specificResult.rows[0];
  }

// ENRICH DATA CATEGORY_BUDGET
 if (account_type_name === 'category_budget') {
 const { remain, statusAlert } = calculateBudgetMetrics(
   parseFloat(accountData.account_balance),
   parseFloat(accountData.budget)
 );
 accountData.remain = remain;
 accountData.statusAlert = statusAlert;
 }

 return {
   success: true,
   data: accountData,
   accountType: account_type_name
 };

}catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
*/
