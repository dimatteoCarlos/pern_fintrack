import pc from 'picocolors';
import { pool } from '../db/configDB.js';
// import { handlePostgresError } from './errorHandling.js';
//--------------------------------

export const insertAccount = async (
  clientOrPool=null,
  userId,
  account_name,
  accountTypeIdReq,
  currencyIdReq,
  account_starting_amount,
  account_balance,
  account_start_date
) => {
  const db = clientOrPool || pool;
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
      new Date(),
    ],
  };
  try {
   console.log(pc.green('inserAccount: '), account_name)
    const accountResult = await db.query(insertQuery);
    const account_basic_data = accountResult.rows[0];
    console.log("🚀 ~ account_basic_data:", accountResult.rows[0])
    
    return {account_basic_data};
  } catch (error) {
    console.error('Error verifying account existence:', error);
    throw error;
  }
};
