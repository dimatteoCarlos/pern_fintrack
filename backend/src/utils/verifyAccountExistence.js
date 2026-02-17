//backend\src\utils\verifyAccountExistence.js
//verifyAccountExistence, verifyAccountExists
import pc from 'picocolors';
import { pool } from '../db/configDB.js';
// import { handlePostgresError } from './errorHandling.js';
//-------------------------
//VERIFY EXISTENCE OF ACCOUNT BY ACCOUNT_NAME AND ACCOUNT TYPE
//------------------------
//adaptar a accountId y deleted_at
export const verifyAccountExistence = async (
  dbClient = null,
  userId,
  account_name,
  account_type_name = 'bank'
) => {
  const accountExistQuery = {
    text: `SELECT 1
    FROM user_accounts ua
    JOIN account_types act ON ua.account_type_id = act.account_type_id
    WHERE ua.user_id = $1 AND ua.account_name ILIKE $2 AND act.account_type_name ILIKE $3
    LIMIT 1`,
    values: [userId, `%${account_name}%`, `%${account_type_name}%`],
  };
  const db = dbClient || pool;
  try {
   // Check if dbClient is valid
    if (!dbClient || typeof dbClient.query !== 'function') {
      throw new Error('Invalid database client provided to verifyAccountExistence');
    }

    const accountExistResult = await db.query(accountExistQuery);
    
    const accountExist = accountExistResult.rows.length > 0;

    if (accountExist) {
      const message = `Account(s) with a similar name "${account_name}" was found of type "${account_type_name}". Try again with different attributes.`;
      console.log(pc.blueBright(message));
      throw new Error(message);
    }
    return accountExist;
  } catch (error) {
    console.error('Error verifying account existence:', error);
    throw error;
  }
};
//----------------------------------
//verify that the account exists and handle error if does not exist
export const verifyAccountExists = async (
  clientOrPool=null,
  userId,
  account_name,
  account_type_name = 'bank'
) => {
  const db=clientOrPool || pool;
  const accountExistQuery = {
    text: `SELECT 1, ua.account_id FROM user_accounts ua
     JOIN account_types act
      ON ua.account_type_id = act.account_type_id
     WHERE ua.user_id = $1
      AND ua.account_name ILIKE $2
      AND act.account_type_name ILIKE $3
     LIMIT 1`,
    values: [userId, `%${account_name}%`, `%${account_type_name}%`],
  };
  try {
    const accountExistResult = await db.query(accountExistQuery);
    const accountExist = accountExistResult.rows.length > 0;

    if (!accountExist) {
      const message = `Account(s) "${account_name}" was NOT found of type "${account_type_name}". Try again with an existent account.`;
      console.log(pc.blueBright(message));
      throw new Error(message);
    }
    return{ accountExist, accountId:accountExistResult.rows[0].account_id};
    // return accountExist;
  } catch (error) {
    console.error('Error verifying account existence:', error);
    throw error;
  }
};
