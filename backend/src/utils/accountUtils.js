// backend/src/utils/accountUtils.js
//getUserIdFromAccount, getSlackAccountId, getAccountTypeId
import { pool } from "../db/configDB.js";
import { createError } from "../../utils/errorHandling.js";

// Helper function to get account type ID
export async function getAccountTypeId(accountTypeName) {
  const accountTypeQuery = `SELECT * FROM account_types`;
  const accountTypeResult = await pool.query(accountTypeQuery);
  const accountType = accountTypeResult.rows.find(
    (type) => type.account_type_name === accountTypeName.trim()
  );
  return accountType?.account_type_id;
}

// ⚙️ UTILITY: GET USER ID FROM TARGET ACCOUNT

// 🔑 UTILITY: GET USER ID FROM ACCOUNT ID

export const getUserIdFromAccount = async (clientOrPool, targetAccountId)=>{
const dbClient=clientOrPool.connect?
 await clientOrPool.connect():clientOrPool

let releaseClient = dbClient.connect
 ?()=>dbClient.release()
 :null

// Determine if it is needed to get a new client from the pool or use an existing one
try {
 const userQuery = `
  SELECT user_id
  FROM user_accounts
  WHERE account_id = $1
   AND deleted_at IS NULL
 `
 const result = await dbClient.query(userQuery, [targetAccountId]) 

 if (!result.rows.length===0){
  throw createError(404, `Account with ID ${targetAccountId} not found`)
 }
 return result.rows[0].user_id
} catch (error) {
  throw error;
} finally {
  if (releaseClient) {
// RELEASE THE CLIENT ONLY IF IT WAS ACQUIRED IN THIS FUNCTION
   releaseClient(); 
  }
 }
}
//--------------------------------
// 🔍 UTILITY FOR SLACK ACCOUNT
/**
* 💡 Checks for the existence of the 'slack' compensation account and returns its ID. Used for the reporting phase (outside of a transaction).
*/
export const getSlackAccountId = async ( userId)=>{
 const accountName = 'slack'
 const accountType = 'bank'
 const slackQuery = `
  SELECT ua.* FROM user_accounts ua
   JOIN account_types act
    ON ua.account_type_id = act.account_type_id
  WHERE ua.user_id = $1
   AND ua.account_name = $2
   AND act.account_type_name=$3
   AND ua.deleted_at IS NULL; 
     `;
 const result = await pool.query(slackQuery, [userId,accountName, accountType])

 if(result.rows.length===0){
  throw createError(404, 'The required compensation account "slack" was not found for this user. Please create it first.')
 }
 return result.rows[0]
 // return result.rows[0].account_id
    
 }
//-------------










