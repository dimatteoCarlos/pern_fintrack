//backend/utils/checkAndInsertAccount.js
import pc from 'picocolors';
import { createError } from './errorHandling.js';
import { pool } from '../db/configDB.js';

//Checks for the existence of a specific account (e.g., 'slack') by name and type.this check is restricted to bank account types with basic account data. 
//If not found, it inserts it. Handles both transactional client and standalone pool usage.

export const checkAndInsertAccount = async (
 clientOrPool,
 userId,
 accountName = 'slack',
 accountType = 'bank',
) => {
//0 initial validation
 if (!userId) throw new Error('User ID is required');
  if (!accountName) throw new Error('Account name is required');

// 1. Determine the database client connection:
 const isPool = clientOrPool === pool; 
// 🔑 Optimized check: If the object has a 'connect' method, assume it's the pool.
  // const isPool = typeof clientOrPool.connect === 'function';
 const dbClient=isPool
 ? await clientOrPool.connect()
 :clientOrPool
 const clientAcquired = isPool

  try {
   // 2. Check existence by User, Account Name, AND Account Type
   const chekAccountResult = await dbClient.query(
   `SELECT ua.* FROM user_accounts ua
     JOIN account_types act ON ua.account_type_id = act.account_type_id
     WHERE ua.user_id =$1
      AND ua.account_name = $2
      AND act.account_type_name=$3
      AND ua.deleted_at IS NULL; 
      `,
   [userId,accountName, accountType]
    );

   if (chekAccountResult.rows.length > 0) {
     const accountId = chekAccountResult.rows[0].account_id;
     console.log(pc.green(`checkAndInserAccount: ${accountName} account already exists with id ${accountId}`));
     return { exists: true, account: chekAccountResult.rows[0] };
    } else {
 // 3. Account Not Found, Proceed to Insert
 //--------------------------
 //Get account_type_id dynamically
   const accountTypeResult = await dbClient.query(
    'SELECT account_type_id FROM account_types WHERE account_type_name = $1',
    [accountType]
   );
   
   if (accountTypeResult.rows.length === 0) {
    throw new Error(`Account type '${accountType}' not found`);
   }
   
   const accountTypeId = accountTypeResult.rows[0].account_type_id;
//-------------------------------------
   const insertResult = await dbClient.query(
    'INSERT INTO user_accounts (user_id,account_name,account_type_id,currency_id,account_starting_amount,account_balance,account_start_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [
      userId,
      accountName,
      accountTypeId,//1, //bank
      1, //usd // Assuming 1 for usd/Default currency, adjust if dynamic currency is needed.
      0, // starting_amount
      0, //balance
      new Date(),
    ]
     );
   const newAccountId = insertResult.rows[0].account_id;
   console.log('insertResult', insertResult.rows)

   console.log(pc.green(`${accountName} account created successfully with ID: ${newAccountId}`));
    return { exists: false, account: insertResult.rows[0] };
    }
  } catch (error) {
    const messageError = `Error in checkAndInsertAccount: when processing counter account ${accountName}`;

    console.error(messageError, error);
    const { code, message } = handlePostgresError(error);

    if(code && code !== 500){
    throw (createError(code, message)); 
    }

    throw( createError(500, messageError));

  }finally {
  // Release the client ONLY IF it was acquired by this function (it was the pool)
    if (clientAcquired && dbClient && typeof dbClient.release === 'function') {
      dbClient.release();
       }
   };
}
//-----------------------------------
