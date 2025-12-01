import pc from 'picocolors';
import { pool } from '../src/db/configDB.js';
//------------------------------
export const updateAccountBalance = async (
  newBalance,
  accountId,
  transactionActualDate = new Date()
) => {
  const insertBalanceQuery = {
    text: `UPDATE user_accounts SET account_balance=$1, updated_at = $2 WHERE account_id = $3 RETURNING *`,
    values: [newBalance, transactionActualDate, accountId],
  };

  try {
    const updatedAccountResult = await pool.query(insertBalanceQuery);
    //assure the existence of updatedAccountResult
    return updatedAccountResult.rows[0];
  } catch (error) {
    console.error('Error updating account balance:', error);
    throw error;
  }
};
