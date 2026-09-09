// backend/utils/recordAnnulmentTransaction.js

import pc from 'picocolors';
import { createError, handlePostgresError } from '../../errorHandling.js';
import { getCurrencyIdSync } from '../../currencyLookup.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../fintrack_api/config/fintrackConfig.js';
import { RTA_ANNULMENT_TARGET_PREFIX } from './annulmentRowIdentity.js';
import {
  DEFAULT_EXCHANGE_RATE,
  DEFAULT_EXCHANGE_RATE_SOURCE,
} from '../../../fintrack_api/services/fx_services/core/fxConfig.js';

// Kept so the three overview repositories that import the prefix from here
// keep working unchanged. They can repoint to annulmentRowIdentity.js whenever
// that module chooses; nothing forces it, and nothing breaks either way.
export { RTA_ANNULMENT_TARGET_PREFIX } from './annulmentRowIdentity.js';

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
// Overview's overviewInvestmentRepository.js, overviewMonthlyRepository.js and
// overviewTransactionRepository.js filter transactions on this exact prefix.
// Changing the string here without updating them breaks them silently:
// annulment rows would start counting as ordinary activity, with no error
// anywhere.
//
// "Silently" means two different things depending on which card reads the rows,
// and only one of them is harmless-looking (pern-fintrack-cf, 2026-09-07). On
// the investment card both prefix-keyed terms sit in the same comparison, so a
// row moving between them conserves the total and the reconciliation notice
// cannot fire - wrong composition, right sum. On the profit-and-loss figure a
// single annulment leg enters the realised total as if it were a real gain, the
// figure moves, and nothing compares that figure to anything. The rows do not
// cancel there: the affected leg sits on the owner's account and its opposite on
// the compensation account.
//
// The prefix moved to annulmentRowIdentity.js, and this module now reads it
// from there like every other consumer. It is the identity of a stored row and
// five read-only predicates in the overview module depend on it, so it should
// not sit in a module whose job is to WRITE - a read path had to import a
// writer to get a string. Re-exported below so nothing has to be repointed in
// the same change that moves it.

/**
 * 🛠️ Helper function to construct the annulment transaction description.
 * @param {boolean} isProfit - True if the correction/annulment results in a profit for the affected account (adjustment > 0).
 * @param {number} amount - The absolute value of the adjusted amount..
 * @param {string} currencyCode
 * @param {string} perspective - PERSPECTIVE_AFFECTED or PERSPECTIVE_COUNTERPART.
 * @param {string} affectedAccountName - Name of the affected account.
 * @returns {string} Formatted description.
 */
// Which leg of the annulment pair a description is written for. Named because
// the comparison below is exact: a misspelled literal does not fail, it falls
// through to the counterpart branch and mislabels the row. The counterpart is
// no longer called 'slack' here either - the account is identified by its
// boundary type, not by that name.
const PERSPECTIVE_AFFECTED = 'affected';
const PERSPECTIVE_COUNTERPART = 'counterpart';

// Helper to build RTA transaction descriptions (as PnL movements)
function buildAnnulmentDescription(
  isProfit,
  amount,
  currencyCode,
  perspective,
  affectedAccountName,
  targetAccountName,
) {
  const action = isProfit ? 'DEPOSIT' : 'WITHDRAW';
  const sign = isProfit ? '+' : '-';
  const prefix = `${RTA_ANNULMENT_TARGET_PREFIX}${targetAccountName}).`;
  return perspective === PERSPECTIVE_AFFECTED
    ? `${prefix}Correction in ${affectedAccountName}: ${sign}${amount} ${currencyCode} to revert original "${action}". For Deletion of ${targetAccountName} account.`
    : `${prefix}Counterpart Adjustment: ${isProfit ? '-' : '+'}${amount} ${currencyCode} from ${affectedAccountName}. For Deletion of ${targetAccountName} account.`; //The Slack account registers the opposite sign
}
/**
* 💾 Records the two entries (Affected Account & Slack Account) to annul the 
financial impact of a Target Account, within a single transaction.
 * @param {object} client - The active transactional PostgreSQL client.
 * @param {object} annulmentData - Data needed for the annulment.
 * @returns {Promise<object[]>} An array with the two inserted transaction records.
 */
export const recordAnnulmentTransaction = async (client, annulmentData) => {
  // 1. Data Destructuring obtained by the service
  const {
    userId,
    affectedAccountId,
    affectedAccountName,
    affectedAccountCurrentBalance, // Used for logging/debug, not insert
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

  // FX provenance, stated rather than left to the column defaults. An
  // annulment is an internal movement in the affected account's own currency,
  // so the conversion genuinely is a no-op - but the defaults declare
  // original_amount 0 and original_currency_id 1, which is false whenever the
  // adjustment is not zero or the account is not in currency 1. Same fallback
  // semantics as recordTransaction.js, the general writer (pern-fintrack-02).
  const accountingCurrencyId = getCurrencyIdSync(ACCOUNTING_CURRENCY_CODE);
  const exchangeRateTimestamp = new Date();

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
    description: buildAnnulmentDescription(
      isProfit,
      absoluteAmount,
      currencyCode,
      PERSPECTIVE_AFFECTED,
      affectedAccountName,
      targetAccountName,
    ),
    movement_type_id: pnlMovementTypeId, // PnL movement type will be assigned
    status: 'complete',
    amount: adjustmentAmount, // Signed amount: + if deposit, - if withdraw
    currency_id: currencyId,
    account_id: affectedAccountId, //ID of the account that is being registered
    source_account_id: sourceAccountId,
    transaction_type_id: affectedTransactionTypeId,
    destination_account_id: destinationAccountId,
    transaction_actual_date: transactionDate,
    // Stops being persisted. Every reader of account_balance_after_tr derives
    // the figure from the ledger and only inherits the key, so anything written
    // here is read by nobody and can only go stale. The key stays because the
    // insert below passes Object.values, so its position is the twelfth bind.
    // newAffectedBalance is still computed and still updates user_accounts.
    account_balance: 0.0,
    // Key order is the bind order: the insert passes Object.values, so these
    // six must stay last and in the same order as the columns appended below.
    original_amount: adjustmentAmount,
    original_currency_id: currencyId,
    exchange_rate: DEFAULT_EXCHANGE_RATE,
    exchange_rate_source: DEFAULT_EXCHANGE_RATE_SOURCE,
    exchange_rate_timestamp: exchangeRateTimestamp,
    exchange_rate_target_currency_id: accountingCurrencyId,
  };

  // Transaction 2: Entry for the SLACK ACCOUNT (S)
  const slackTransactionOption = {
    userId,
    description: buildAnnulmentDescription(
      isProfit,
      absoluteAmount,
      currencyCode,
      PERSPECTIVE_COUNTERPART,
      affectedAccountName,
      targetAccountName,
    ),
    movement_type_id: pnlMovementTypeId, //dynamically assigned
    status: 'complete',
    amount: -adjustmentAmount, // Opposite signed amount
    currency_id: currencyId,
    account_id: slackAccountId,
    source_account_id: sourceAccountId,
    transaction_type_id: slackTransactionTypeId,
    destination_account_id: destinationAccountId,
    transaction_actual_date: transactionDate,
    // Same as the affected account's entry above, and for the same reason.
    account_balance: 0.0,
    // Same as the affected account's entry above, and for the same reason.
    original_amount: -adjustmentAmount,
    original_currency_id: currencyId,
    exchange_rate: DEFAULT_EXCHANGE_RATE,
    exchange_rate_source: DEFAULT_EXCHANGE_RATE_SOURCE,
    exchange_rate_timestamp: exchangeRateTimestamp,
    exchange_rate_target_currency_id: accountingCurrencyId,
  };

  const insertQuery = `
   INSERT INTO transactions(
    user_id, description, movement_type_id, status, amount, currency_id,
    account_id, source_account_id, transaction_type_id, destination_account_id,
    transaction_actual_date, account_balance_after_tr,
    original_amount, original_currency_id, exchange_rate, exchange_rate_source,
    exchange_rate_timestamp, exchange_rate_target_currency_id
   )
   VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
    $13, $14, $15, $16, $17, $18)
   RETURNING transaction_id, account_id, amount;
  `;

  // 4. Execution of the two insert queries within the transaction
  try {
    console.log(
      pc.yellow(
        `RTA: Recording adjustment for affected account ${affectedAccountId}`,
      ),
    );

    // BOTH LEGS OR NEITHER, and before migration 031 that is a money statement
    // rather than a tidiness one. The affected account can BE the compensation
    // account: a target created with a starting amount and never used since has
    // one qualifying row, its own opening, whose counterparty is the boundary -
    // so both rows below are written on that single account, equal and opposite.
    // Pre-031 the compensation account is typed bank (031's retype selects
    // account_name = 'slack' AND account_type_id = 1) and the Overview's bank
    // balance reads types bank and cash with no annulment-prefix filter at all
    // (pern-fintrack-cf, in their files). So the pair lands inside the owner's
    // bank balance and that figure is right only because the two cancel. These
    // inserts share the caller's transaction and commit together; writing one
    // leg alone, on a retry path or a refactor, moves the owner's bank balance.
    const [resultInsertAffectedAccount, resultInsertSlackAccount] =
      await Promise.all([
        client.query(insertQuery, Object.values(affectedTransactionOption)),

        client.query(insertQuery, Object.values(slackTransactionOption)),
      ]);

    const insertedTransactions = [
      resultInsertAffectedAccount.rows[0],
      resultInsertSlackAccount.rows[0],
    ];

    console.log('insertedTransactions', insertedTransactions);

    return insertedTransactions;
  } catch (error) {
    //Standardized handling:Captures the SQL error and throws it to force ROLLBACK
    const messageError = `Error recording RTA annulment transactions for account ${affectedAccountId}.`;
    console.error(pc.red(messageError), error);

    if (error instanceof Error) {
      // JavaScript or PostgreSQL error
      if (
        (error.code && error.code.startsWith('23')) ||
        error.code.startsWith('22')
      ) {
        // PostgreSQL (codes 23xxx, 22xxx)
        const { code, message } = handlePostgresError(error);
        throw createError(code, message);
      } else {
        //JavaScript error
        throw createError(500, `RTA Annulment failed: ${error.message}`);
      }
    } else {
      // Non standard error(string, obj, etc.)
      throw createError(
        500,
        `Unexpected error during RTA annulment: ${String(error)}`,
      );
    }
  }
};
