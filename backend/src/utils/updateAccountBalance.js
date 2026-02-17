//backend/src/utils/updateAccountBalance.js
import pc from 'picocolors';
import { pool } from '../db/configDB.js';

//------------------------------
console.log(pc.bgMagentaBright('updateAccountBalance.js'))
//------------------------------
export const updateAccountBalance = async (
  clientOrPool=null,
  newBalance,
  accountId,
  transactionActualDate = new Date()
) => {
  const db=clientOrPool || pool;
  const insertBalanceQuery = {
    text: `UPDATE user_accounts SET account_balance=$1, updated_at = $2 WHERE account_id = $3 RETURNING *`,
    values: [newBalance, transactionActualDate, accountId],
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
