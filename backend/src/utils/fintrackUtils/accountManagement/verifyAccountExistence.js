//backend\src\utils\verifyAccountExistence.js
//verifyAccountExistence, verifyAccountExists
import pc from 'picocolors';
import { pool } from '../../../db/config/configDB.js';
// import { handlePostgresError } from './errorHandling.js';
//-------------------------
//VERIFY EXISTENCE OF ACCOUNT BY ACCOUNT_NAME AND ACCOUNT TYPE
//------------------------
//adaptar a accountId y deleted_at
export const verifyAccountExistence = async (
  dbClient = null,
  userId,
  account_name,
  account_type_name = 'bank',
) => {
  // Exact match, not `ILIKE '%name%'`. The substring form matched any stored
  // name CONTAINING this one, so creating 'mini/frutas/need' was rejected by
  // an existing 'mercadomini/frutas/need'. Case is folded on both sides.
  const accountExistQuery = {
    text: `SELECT 1
    FROM user_accounts ua
    JOIN account_types act ON ua.account_type_id = act.account_type_id
    WHERE ua.user_id = $1
     AND LOWER(ua.account_name) = LOWER($2)
     AND LOWER(act.account_type_name) = LOWER($3)
    LIMIT 1`,
    values: [userId, account_name, account_type_name],
  };
  const db = dbClient || pool;
  try {
    // Check if dbClient is valid
    if (!dbClient || typeof dbClient.query !== 'function') {
      throw new Error(
        'Invalid database client provided to verifyAccountExistence',
      );
    }

    const accountExistResult = await db.query(accountExistQuery);

    const accountExist = accountExistResult.rows.length > 0;

    if (accountExist) {
      const message = `An account named "${account_name}" of type "${account_type_name}" already exists. Try again with a different name.`;
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
  clientOrPool = null,
  userId,
  account_name,
  account_type_name = 'bank',
) => {
  const db = clientOrPool || pool;
  // Same fix as above, and it matters more here: this one returns account_id,
  // which the caller uses to move money. The substring form could hand back a
  // different account than the one asked for. ORDER BY makes LIMIT 1 stop
  // depending on whichever row Postgres happens to return first.
  const accountExistQuery = {
    text: `SELECT 1, ua.account_id FROM user_accounts ua
     JOIN account_types act
      ON ua.account_type_id = act.account_type_id
     WHERE ua.user_id = $1
      AND LOWER(ua.account_name) = LOWER($2)
      AND LOWER(act.account_type_name) = LOWER($3)
     ORDER BY ua.account_id
     LIMIT 1`,
    values: [userId, account_name, account_type_name],
  };
  try {
    const accountExistResult = await db.query(accountExistQuery);
    const accountExist = accountExistResult.rows.length > 0;

    if (!accountExist) {
      const message = `Account(s) "${account_name}" was NOT found of type "${account_type_name}". Try again with an existent account.`;
      console.log(pc.blueBright(message));
      throw new Error(message);
    }
    return { accountExist, accountId: accountExistResult.rows[0].account_id };
    // return accountExist;
  } catch (error) {
    console.error('Error verifying account existence:', error);
    throw error;
  }
};
