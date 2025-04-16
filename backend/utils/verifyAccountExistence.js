import pc from 'picocolors';
import { pool } from '../src/db/configDB.js';
// import { handlePostgresError } from './errorHandling.js';
//-----------------------------------------------------------------------------
export const verifyAccountExistence = async (
  userId,
  account_name,
  account_type_name = 'bank'
) => {
  const accountExistQuery = {
    text: `SELECT 1 FROM user_accounts ua
           JOIN account_types act ON ua.account_type_id = act.account_type_id
           WHERE ua.user_id = $1 AND ua.account_name ILIKE $2 AND act.account_type_name ILIKE $3
           LIMIT 1`,
    values: [userId, `%${account_name}%`, `%${account_type_name}%`],
  };
  try {
    const accountExistResult = await pool.query(accountExistQuery);
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
//--------------------------------------------------------------------------
