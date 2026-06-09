// backend/src/utils/fintrackUtils/transactionManagement/recordTransaction.js

// Inserts a transaction record into the database
// Handles both single transactions and transaction batches via connection pooling

// 💰 TRANSACTION RECORDER: Persists a single transaction with FX snapshot

import pc from 'picocolors';
import { pool } from '../../../db/config/configDB.js';
import { handlePostgresError } from '../../errorHandling.js';
import { getCurrencyIdSync } from '../../../utils/currencyLookup.js';

import { ACCOUNTING_CURRENCY_CODE } from '../../../fintrack_api/config/fintrackConfig.js';
import {
  DEFAULT_ORIGINAL_AMOUNT,
  DEFAULT_EXCHANGE_RATE,
  DEFAULT_EXCHANGE_RATE_SOURCE,
} from '../../../fintrack_api/config/constants.js';
// ===================================
// Record a single transaction with optional FX details
// ===================================
export async function recordTransaction(clientOrPool = null, option) {
  const dbClient = clientOrPool || pool;
  const accountingCurrencyId  = getCurrencyIdSync(ACCOUNTING_CURRENCY_CODE);

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
      account_balance,
     //FX fields
      original_amount,
      original_currency_id,
      exchange_rate,
      exchange_rate_source,
      exchange_rate_timestamp,
      exchange_rate_target_currency_id,
    } = option;
    // console.log('🚀 ~ recordTransaction ~ options:', options);
    
// ===================================
// Prepare values array with default fallbacks for FX fields
// ===================================
const values = [
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
      account_balance,
      // FX fields with defaults
      original_amount ?? DEFAULT_ORIGINAL_AMOUNT,
      original_currency_id ?? accountingCurrencyId,
      exchange_rate ?? DEFAULT_EXCHANGE_RATE,
      exchange_rate_source ?? DEFAULT_EXCHANGE_RATE_SOURCE,
      exchange_rate_timestamp ?? new Date(),
      exchange_rate_target_currency_id ?? accountingCurrencyId,
    ];

 // Extended INSERT with all FX columns   
    const transactionResult = await dbClient.query({
      text: `INSERT INTO transactions (user_id, description, movement_type_id, status, amount,currency_id, account_id, source_account_id,transaction_type_id,destination_account_id, transaction_actual_date, account_balance_after_tr,
      original_amount, original_currency_id, exchange_rate, exchange_rate_source, exchange_rate_timestamp, exchange_rate_target_currency_id
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      values,
    });
    // console.log(transactionResult.rows[0]);

    return transactionResult.rows[0];
  } catch (error) {
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
