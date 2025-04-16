import pc from 'picocolors';
import { pool } from '../src/db/configDB.js';
import { handlePostgresError } from './errorHandling.js';

//----------------------------------------------------------------------------
export const checkAndInsertAccount = async (userId, accountName = 'slack') => {
  try {
    const chekAccountResult = await pool.query(
      'SELECT * FROM user_accounts WHERE account_name = $1',
      [accountName]
    );
    if (chekAccountResult.rows.length > 0) {
      const accountId = chekAccountResult.rows[0].account_id;
      console.log(`${accountName} account already exists with id ${accountId}`);
      return { exists: true, account: chekAccountResult.rows[0] };
    } else {
      const insertResult = await pool.query(
        'INSERT INTO user_accounts (user_id,account_name,account_type_id,currency_id,account_starting_amount,account_balance,account_start_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [
          userId,
          accountName,
          1, //bank
          1, //usd
          0, //amount
          0, //balance
          new Date(),
        ]
      );
      console.log(insertResult.rows[0]);
      console.log(`${accountName} account was created `);

      return { exists: false, account: insertResult.rows[0] };
    }
  } catch (error) {
    const message = `Error creating ${accountName} account`;
    console.error(message, error);
    throw new Error(message);
    // throw handlePostgresError(error);
    // return res.status(500).json({ status: 500, message });
  }
};
//-------------------------------------------
