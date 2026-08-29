//backend/src/utils/updateAccountBalance.js

// Updates account balance in user_accounts table after a transaction.
// updated_at records when the row was last touched, never the movement date.

import pc from 'picocolors';
import { pool } from '../../../db/config/configDB.js';

//------------------------------
console.log(pc.magentaBright('File: updateAccountBalance.js', '\n'));
console.log('\n', pc.yellowBright('DATA BASE COMMENTS ARE IN SPANISH'), '\n');
//------------------------------
export const updateAccountBalance = async (
  clientOrPool = null,
  newBalance,
  accountId,
) => {
  const db = clientOrPool || pool;
  const insertBalanceQuery = {
    text: `UPDATE user_accounts SET account_balance=$1, updated_at = NOW() WHERE account_id = $2 RETURNING *`,
    values: [newBalance, accountId],
  };

  try {
    const updatedAccountResult = await db.query(insertBalanceQuery);
    //assure the existence of updatedAccountResult
    return updatedAccountResult.rows[0];
  } catch (error) {
    console.error('Error updating account balance:', error);
    throw error;
  }
};
