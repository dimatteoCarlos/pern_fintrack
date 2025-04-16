//recordTransaction.js

import pc from 'picocolors';
import { pool } from '../src/db/configDB.js';
import { handlePostgresError } from './errorHandling.js';

export async function recordTransaction(options) {
  try {
    const {
      userId,
      description,
      movement_type_id,
      status,
      amount,
      currency_id,
      account_id,
      source_account_id,
      transaction_type_id,
      destination_account_id,
      transaction_actual_date,
    } = options;
    // console.log('🚀 ~ recordTransaction ~ options:', options);

    //start the transaction
    // await client.pool.query('BEGIN');

    const transactionResult = await pool.query({
      text: `INSERT INTO transactions(user_id, description, movement_type_id, status, amount,currency_id, account_id, source_account_id,transaction_type_id,destination_account_id, transaction_actual_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      values: [
        userId,
        description,
        movement_type_id,
        status,
        amount,
        currency_id,
        account_id,
        source_account_id,
        transaction_type_id,
        destination_account_id,
        transaction_actual_date,
      ],
    });
    // console.log(transactionResult.rows[0]);
    // await client.query('COMMIT');
    // const message = 'Transaction successfully completed.';
    // console.log(pc.yellowBright(message));

    return transactionResult.rows[0];
  } catch (error) {
    // await client.query('ROLLBACK');
    const message = error.message || `Error when recording transaction.`;
    console.error(pc.redBright(message), 'from record transaction');
    throw handlePostgresError(error);
  }
}

/*
"transaction_info": {
				"transaction_id": 10,
				"user_id": "ec688f88-574e-460a-8d98-2cf42d7975dd",
				"description": "Transaction: account-opening .Account slack of type: bank with id: 100. Account reference: bank_28)",
				"amount": "0.00",
				"movement_type_id": 8,
				"transaction_type_id": 5,
				"currency_id": 1,
				"account_id": 100,
				"source_account_id": 100,
				"destination_account_id": 100,
				"status": "complete",
				"transaction_actual_date": "2025-01-01T04:00:00.000Z",
				"created_at": "2025-03-19T20:12:05.094Z"
			}




*/
