//backend/utils/getAccountById/getAccountDataById.ts
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
