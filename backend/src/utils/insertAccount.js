import pc from 'picocolors';
import { pool } from '../db/configDB.js';
// import { handlePostgresError } from './errorHandling.js';
//-----------------------------------------------------------------------------
export const insertAccount = async (
  userId,
  account_name,
  accountTypeIdReq,
  currencyIdReq,
  account_starting_amount,
  account_balance,
  account_start_date
) => {
  const insertQuery = {
    text: `INSERT INTO user_accounts(
  user_id,
  account_name,
  account_type_id,
  currency_id,
  account_starting_amount,
  account_balance,
  account_start_date,
  updated_at
  ) VALUES($1,$2,$3,$4,$5,$6,$7, $8) RETURNING *`,
    values: [
      userId,
      account_name,
      accountTypeIdReq,
      currencyIdReq,
      account_starting_amount,
      account_balance, //initial balance
      account_start_date,
      new Date()
    ],
  };
  try {
    const accountResult = await pool.query(insertQuery);
    const account_basic_data = accountResult.rows[0];
    console.log("🚀 ~ account_basic_data:", accountResult.rows[0])
    
    return {account_basic_data};
  } catch (error) {
    console.error('Error verifying account existence:', error);
    throw error;
  }
};
