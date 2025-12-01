//recordTransaction.js

import pc from 'picocolors';
import { pool } from '../src/db/configDB.js';
import { handlePostgresError } from './errorHandling.js';

export async function recordTransaction(option) {
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
      account_balance
    } = option;
    // console.log('🚀 ~ recordTransaction ~ options:', options);

    //start the transaction
    // await client.pool.query('BEGIN');

    const transactionResult = await pool.query({
      text: `INSERT INTO transactions(user_id, description, movement_type_id, status, amount,currency_id, account_id, source_account_id,transaction_type_id,destination_account_id, transaction_actual_date, account_balance_after_tr)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
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
        account_balance
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

       return `${note ? note + '. ' : ''}${action} ${amount} ${currency} ${transactionType === 'deposit' ? 'received from' : 'to'} account "${sourceAccountName}" (${sourceAccountType}) ${transactionType === 'deposit' ? 'credited to' : 'debited from'} "${destinationAccountName}" (${destinationAccountType}). Date: ${new Date(date).toLocaleDateString()}`;
}
*/

// REFACTOR
// backend/utils/recordTransaction.js

// import pc from 'picocolors';
// import { pool } from '../src/db/configDB.js'; // MUST BE IMPORTED for the isPool check
// import { createError, handlePostgresError } from './errorHandling.js';

//*
//  * 💾 Records a single transaction row in the database, handling both pool and transactional client.
//  * NOTE: This function only registers ONE transaction row (either source or destination).
//  * For double-entry (e.g., transfers, PnL), it must be called twice.
//  * * @param {object} clientOrPool - The active transactional client or the global pool.
//  * @param {object} options - Transaction data object.
//  * @returns {Promise<object>} The inserted transaction row.
//  */
// export const recordTransaction = async (clientOrPool, options) => {
//     // 0. Initial validation
//     if (!options || !options.userId || !options.accountId || !options.amount) {
//         throw createError(400, 'recordTransaction: Missing required fields (userId, accountId, amount, etc.)');
//     }

//     // 1. Determine the database client connection:
//     // The most robust check: comparing the object reference to the imported pool.
//     const isPool = clientOrPool === pool;
//     const dbClient = isPool ? await clientOrPool.connect() : clientOrPool;
//     const clientAcquired = isPool;

//     try {
//         const {
//             userId,
//             description,
//             movement_type_id,
//             status,
//             amount, // Signed amount for the account_id row
//             currency_id,
//             account_id,
//             source_account_id,
//             transaction_type_id,
//             destination_account_id,
//             transaction_actual_date,
//             account_balance,
//         } = options;

//         const insertQuery = `
//             INSERT INTO transactions(
//                 user_id, description, movement_type_id, status, amount, currency_id, 
//                 account_id, source_account_id, transaction_type_id, destination_account_id, 
//                 transaction_actual_date, account_balance_after_tr
//             )
//             VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
//             RETURNING *;
//         `;

//         const values = [
//             userId,
//             description,
//             movement_type_id,
//             status,
//             amount,
//             currency_id,
//             account_id,
//             source_account_id,
//             transaction_type_id,
//             destination_account_id,
//             transaction_actual_date ?? new Date(),
//             account_balance,
//         ];

//         console.log(pc.magenta(`Recording transaction for account ${account_id}. Amount: ${amount}`));
//         const result = await dbClient.query(insertQuery, values);

//         if (result.rows.length === 0) {
//             throw createError(500, 'Failed to record transaction: No rows returned.');
//         }

//         return result.rows[0];

//     } catch (error) {
//         const messageError = `Error in recordTransaction for account ${options.accountId}.`;
//         console.error(pc.red(messageError), error);

//         // Standardized error handling for services: THROW error to ensure ROLLBACK.
//         const { code, message } = handlePostgresError(error);
//         throw createError(code, message);

//     } finally {
//         // Release the client ONLY IF it was acquired by this function (it was the pool)
//         if (clientAcquired && dbClient && typeof dbClient.release === 'function') {
//             dbClient.release();
//         }
//     }
// }


