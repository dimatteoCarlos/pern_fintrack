import pc from 'picocolors';
import { pool } from '../src/db/configDB.js';
// import { handlePostgresError } from './errorHandling.js';

////this check is restricted to bank account type
export const checkAndInsertAccount = async (
  userId,
  accountName = 'slack',
  accountType = 'bank',
) => {
  try {
    const chekAccountResult = await pool.query(
      `SELECT ua.* FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      WHERE ua.user_id =$1 AND ua.account_name = $2 AND act.account_type_name=$3 
      `,
      [userId,accountName, accountType]
    );
    if (chekAccountResult.rows.length > 0) {
      const accountId = chekAccountResult.rows[0].account_id;
      console.log('from checkAndINserAccount', `${accountName} account already exists with id ${accountId}`);
      return { exists: true, account: chekAccountResult.rows[0] };
    } else {
      //old version creates a slack account
      //new version would create a new account named accountName, but, shoudl not be necessary nor recommendable
      //  SE PUEDE OPTIMIZAR DESPUES DE REVISAR CON EL CLIENTE LO QUE REALMENTE NECESITA SEGUN REQUERIMIENTO ORIGINAL
      const insertResult = await pool.query(
        'INSERT INTO user_accounts (user_id,account_name,account_type_id,currency_id,account_starting_amount,account_balance,account_start_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [
          userId,
          accountName,
          1, //bank
          1, //usd . would be an input for multicurrency
          0, //amount
          0, //balance
          new Date(),
        ]
      );
      // console.log(insertResult.rows[0]);
      // console.log(`${accountName} account was created `);

      return { exists: false, account: insertResult.rows[0] };
    }
  } catch (error) {
    const message = `Error creating counter account ${accountName}`;
    console.error(message, error);
    throw new Error(message);
    // throw handlePostgresError(error);
    // return res.status(500).json({ status: 500, message });
  }
};
//-------------------------------------------
