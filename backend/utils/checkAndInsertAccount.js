import pc from 'picocolors';
import { pool } from '../src/db/configDB.js';
import { createError } from './errorHandling.js';
// import { handlePostgresError } from './errorHandling.js';

//Checks for the existence of a specific account (e.g., 'slack') by name and type.this check is restricted to bank account types with basic account data.
export const checkAndInsertAccount = async (clientOrPool,
  userId,
  accountName = 'slack',
  accountType = 'bank',
) => {
// 1. Determine the database client:
// If the argument has a .connect method (it's the pool), acquire a client.
  // Otherwise (it's already a client), use it directly.
 const isPool = clientOrPool.connect; 
 const dbClient=isPool?
 await clientOrPool.connect():clientOrPool

  try {
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
    // Account Not Found, Proceed to Insert
    const insertResult = await dbClient.query(
      'INSERT INTO user_accounts (user_id,account_name,account_type_id,currency_id,account_starting_amount,account_balance,account_start_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [
        userId,
        accountName,
        1, //bank
        1, //usd // Assuming 1 for usd/Default currency, adjust if dynamic currency is needed.
        0, //amount
        0, //balance
        new Date(),
      ]
      );
   const newAccountId = insertResult.rows[0].account_id;

   console.log(pc.green(`${accountName} account created successfully with ID: ${newAccountId}`));
    return { exists: false, account: insertResult.rows[0] };
    }
  } catch (error) {
    const message = `Error creating counter account ${accountName}`;
    console.error(message, error);
    throw createError(500, message);

  }finally {
    // Release the client ONLY IF it was acquired by this function (it was the pool)
    if (isPool) {
      dbClient.release();
       }
   };
}
//-----------------------------------
