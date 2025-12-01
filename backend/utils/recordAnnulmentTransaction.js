// backend/utils/recordAnnulmentTransaction.js

import pc from 'picocolors';
import { createError, handlePostgresError } from './errorHandling.js'; 
/*
🎯 GENERAL PURPOSE
This function is responsible for undoing/reversing the financial impact that a "Target" account had on other accounts.
RTA = Reverse Target Account (Revertir Cuenta Target) Retroactive Total Annulment
Example:
CUENTA TARGET: "Ventas Proyecto X"
TRANSACCIONES ORIGINALES:
1. Profit: Slack → Cliente A (+$100)
2. Loss:  Cliente B → Slack (-$50)

AL ELIMINAR TARGET, SE REVIERTE:
1. Anulación: Cliente A → Slack (-$100)  // Reverse Profit
2. Anulación: Slack → Cliente B (+$50)   // Reverse Loss
*/
/**
* 🛠️ Helper function to construct the annulment transaction description.
 * @param {boolean} isProfit - True if the correction/annulment results in a profit for the affected account (adjustment > 0).
 * @param {number} amount - The absolute value of the adjusted amount..
 * @param {string} currencyCode 
 * @param {string} perspective - 'affected' or 'slack'.
 * @param {string} affectedAccountName - Name of the affected account.
 * @returns {string} Formatted description.
 */
// Helper to build RTA transaction descriptions (as PnL movements)
function buildAnnulmentDescription(isProfit, amount, currencyCode, perspective, affectedAccountName, targetAccountName) {
  const action = isProfit ? 'DEPOSIT' : 'WITHDRAW';
  const sign = isProfit ? '+' : '-';
  // Standardized prefix for RTA Annulmnet description
  const prefix = `RTA Annulment Target(${targetAccountName}).`;
  return (perspective === 'affected')
   ?`${prefix}Correction in ${affectedAccountName}: ${sign}${amount} ${currencyCode} to revert original "${action}". For Deletion of ${targetAccountName} account.`
   :`${prefix}Counterpart Adjustment: ${isProfit ? '-' : '+'}${amount} ${currency} from ${affectedAccountName}. For Deletion of ${targetAccountName} account.`//The Slack account registers the opposite sign
  }
/**
* 💾 Records the two entries (Affected Account & Slack Account) to annul the 
financial impact of a Target Account, within a single transaction.
 * @param {object} client - The active transactional PostgreSQL client.
 * @param {object} annulmentData - Data needed for the annulment.
 * @returns {Promise<object[]>} An array with the two inserted transaction records.
 */
export const recordAnnulmentTransaction = async (
    client,
    annulmentData
) => {
// 1. Data Destructuring obtained by the service
   const {
    userId,
    affectedAccountId,
    affectedAccountName,
    affectedAccountCurrentBalance,// Used for logging/debug, not insert
    slackAccountId,
    slackAccountCurrentBalance,
    adjustmentAmount, // The signed value of the net impact (e.g.-50 or +120)
    newAffectedBalance, // The calculated final balance of the affected account
    newSlackBalance, // The calculated final balance of the Slack account
    currencyId,
    currencyCode,
    targetAccountName,
    pnlMovementTypeId,
    depositTypeId,
    withdrawTypeId,
    transactionDate,
    } = annulmentData;

// 2. Determine transaction Annulment flow
// If adjustmentAmount is > 0,it means the affected account receive a profit (Deposit action) balance to cancel the previous net loss (Withdraw) or viceversa,canceling the impact of the deleted account (target account) on this affected account.
 const isProfit = adjustmentAmount > 0;
 const absoluteAmount = Math.abs(adjustmentAmount);
  
// Source/Destination/Types Determination (Double Entry Logic)
// If Affected GAINS (+), Slack LOSES (-) -> Source=Slack, Dest=Affected
 const sourceAccountId = isProfit ? slackAccountId : affectedAccountId;
 const destinationAccountId = isProfit ? affectedAccountId : slackAccountId;

 const affectedTransactionTypeId = isProfit ? depositTypeId : withdrawTypeId;
 const slackTransactionTypeId = isProfit ? withdrawTypeId : depositTypeId;

// 3. Preparing the two transaction entries (Affected and Slack)
// Transaction 1: Registration for the AFFECTED ACCOUNT (A)
 const affectedTransactionOption = {
  userId,
  description: buildAnnulmentDescription(isProfit, absoluteAmount, currencyCode, 'affected', affectedAccountName, targetAccountName),
  movement_type_id: pnlMovementTypeId, // PnL movement type will be assigned
  status: 'complete',
  amount: adjustmentAmount, // Signed amount: + if deposit, - if withdraw
  currency_id: currencyId,
  account_id: affectedAccountId, //ID of the account that is being registered
  source_account_id: sourceAccountId,
  transaction_type_id: affectedTransactionTypeId,
  destination_account_id: destinationAccountId,
  transaction_actual_date: transactionDate,
  account_balance: newAffectedBalance //New balance after correction
 };

// Transaction 2: Entry for the SLACK ACCOUNT (S)
  const slackTransactionOption = {
   userId,
   description: buildAnnulmentDescription(isProfit, absoluteAmount, currencyCode, 'slack', affectedAccountName, targetAccountName),
   movement_type_id: pnlMovementTypeId, //dynamically assigned
   status: 'complete',
   amount: -adjustmentAmount, // Opposite signed amount
   currency_id: currencyId,
   account_id: slackAccountId, 
   source_account_id: sourceAccountId,
   transaction_type_id: slackTransactionTypeId,
   destination_account_id: destinationAccountId,
   transaction_actual_date: transactionDate,
   account_balance: newSlackBalance 
  };

  const insertQuery = `
   INSERT INTO transactions(
    user_id, description, movement_type_id, status, amount, currency_id, 
    account_id, source_account_id, transaction_type_id, destination_account_id, 
    transaction_actual_date, account_balance_after_tr
   )
   VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
   RETURNING transaction_id, account_id, amount;
  `;
    
// 4. Execution of the two insert queries within the transaction
 try {
  console.log(pc.yellow(`RTA: Recording adjustment for affected account ${affectedAccountId}`));

  const [resultInsertAffectedAccount, resultInsertSlackAccount]=await Promise.all ([
   client.query(insertQuery, Object.values(affectedTransactionOption)) ,
   client.query(insertQuery, Object.values(slackTransactionOption))
  ])
  const insertedTransactions = [...resultInsertAffectedAccount.rows[0], ...resultInsertSlackAccount.rows[0]]

  return insertedTransactions;

  } catch (error) {
//Standardized handling:Captures the SQL error and throws it to force ROLLBACK
 const messageError = `Error recording RTA annulment transactions for account ${affectedAccountId}.`;
 console.error(pc.red(messageError), error);

if (error instanceof Error) {
// JavaScript or PostgreSQL error 
 if (error.code && error.code.startsWith('23') || error.code.startsWith('22')) {
// PostgreSQL (codes 23xxx, 22xxx)
 const { code, message } = handlePostgresError(error);
 throw createError(code, message);
 } else {
 //JavaScript error
 throw createError(500, `RTA Annulment failed: ${error.message}`);
  }
 } else {
// Non standard error(string, obj, etc.)
 throw createError(500, `Unexpected error during RTA annulment: ${String(error)}`);
    }
  }
}