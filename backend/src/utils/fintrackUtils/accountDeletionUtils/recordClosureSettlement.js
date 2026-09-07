// backend/src/utils/fintrackUtils/accountDeletionUtils/recordClosureSettlement.js

import pc from 'picocolors';
import { createError, handlePostgresError } from '../../errorHandling.js';
import { getCurrencyIdSync } from '../../currencyLookup.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../fintrack_api/config/fintrackConfig.js';
import {
  DEFAULT_EXCHANGE_RATE,
  DEFAULT_EXCHANGE_RATE_SOURCE,
} from '../../../fintrack_api/services/fx_services/core/fxConfig.js';
import {
  ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID,
  ACCOUNT_CLOSURE_TRANSACTION_TYPE_ID,
} from '../accountDataRetrieval/derivedBalance.js';

/*
 * DISCARD policy settlement (PLAN_ACCOUNT_DELETION.md §3.1/§4.1 step 4:
 * SETTLE). Writes the two-leg movement that brings the target account's
 * residual to zero before CLOSE marks it, crediting/debiting the boundary
 * account with the opposite amount - the same compensation counterpart RTA
 * uses, now identified structurally by account_type (unit 5).
 *
 * No RTA_ANNULMENT_TARGET_PREFIX: a closure is not an annulment, so it does
 * not carry RTA's signal (plan doc, "the settlement does not carry
 * RTA_ANNULMENT_TARGET_PREFIX"). Both rows carry movement_type_id 10 and
 * transaction_type_id 6 ('account-closure') regardless of direction - the
 * pair decided for this settlement rather than reusing deposit/withdraw
 * (plan doc, "Unit 5/7 catalog decision").
 */

// Which leg of the settlement pair a description is written for. Named because
// the comparison below is exact: a misspelled literal does not fail, it falls
// through to the counterpart branch and mislabels the row.
const PERSPECTIVE_TARGET = 'target';
const PERSPECTIVE_BOUNDARY = 'boundary';

const buildDescription = (perspective, amount, currencyCode, accountName) =>
  perspective === PERSPECTIVE_TARGET
    ? `Account closure settlement: residual ${amount} ${currencyCode} discarded on closing "${accountName}".`
    : `Account closure settlement: counterpart adjustment of ${amount} ${currencyCode} for closing "${accountName}".`;

/**
 * @param {object} client - the active transactional PostgreSQL client.
 * @param {object} settlementData
 * @param {string} settlementData.userId
 * @param {number} settlementData.targetAccountId
 * @param {string} settlementData.targetAccountName
 * @param {number} settlementData.boundaryAccountId
 * @param {number} settlementData.residual - the target's derived balance
 *   before settlement, signed. Zero must never reach this function - the
 *   caller decides whether there is anything to settle.
 * @param {number} settlementData.currencyId
 * @param {string} settlementData.currencyCode
 * @param {Date} settlementData.transactionDate
 * @returns {Promise<object[]>} the two inserted transaction records.
 */
export const recordClosureSettlement = async (client, settlementData) => {
  const {
    userId,
    targetAccountId,
    targetAccountName,
    boundaryAccountId,
    residual,
    currencyId,
    currencyCode,
    transactionDate,
  } = settlementData;

  const isTargetPositive = residual > 0;
  const absoluteAmount = Math.abs(residual);

  // FX provenance, stated rather than left to the column defaults. A closure
  // settlement is an internal movement in the account's own currency, so the
  // conversion genuinely is a no-op - but the defaults declare original_amount
  // 0 and original_currency_id 1, which is false whenever the residual is not
  // zero or the account is not in currency 1. Same fallback semantics as
  // recordTransaction.js, the system's general writer (pern-fintrack-02).
  const accountingCurrencyId = getCurrencyIdSync(ACCOUNTING_CURRENCY_CODE);
  const exchangeRateTimestamp = new Date();

  // Zeroing the target: its leg is the exact negation of the residual: a
  // positive balance is discarded (withdrawn), a negative one is forgiven
  // (deposited). The boundary account carries the opposite amount, so the
  // pair is double-entry - DISCARD's net-worth effect comes from the owner's
  // own dashboards excluding the boundary account, not from this write.
  const targetAmount = -residual;
  const boundaryAmount = residual;

  const sourceAccountId = isTargetPositive
    ? targetAccountId
    : boundaryAccountId;
  const destinationAccountId = isTargetPositive
    ? boundaryAccountId
    : targetAccountId;

  const targetTransactionOption = {
    userId,
    description: buildDescription(
      PERSPECTIVE_TARGET,
      absoluteAmount,
      currencyCode,
      targetAccountName,
    ),
    movement_type_id: ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID,
    status: 'complete',
    amount: targetAmount,
    currency_id: currencyId,
    account_id: targetAccountId,
    source_account_id: sourceAccountId,
    transaction_type_id: ACCOUNT_CLOSURE_TRANSACTION_TYPE_ID,
    destination_account_id: destinationAccountId,
    transaction_actual_date: transactionDate,
    // Not read back - every consumer of account_balance_after_tr derives the
    // figure from the ledger instead (§7, the single balance writer).
    account_balance: 0.0,
    // Key order is the bind order: the insert passes Object.values, so these
    // six must stay last and in the same order as the columns appended below.
    original_amount: targetAmount,
    original_currency_id: currencyId,
    exchange_rate: DEFAULT_EXCHANGE_RATE,
    exchange_rate_source: DEFAULT_EXCHANGE_RATE_SOURCE,
    exchange_rate_timestamp: exchangeRateTimestamp,
    exchange_rate_target_currency_id: accountingCurrencyId,
  };

  const boundaryTransactionOption = {
    userId,
    description: buildDescription(
      PERSPECTIVE_BOUNDARY,
      absoluteAmount,
      currencyCode,
      targetAccountName,
    ),
    movement_type_id: ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID,
    status: 'complete',
    amount: boundaryAmount,
    currency_id: currencyId,
    account_id: boundaryAccountId,
    source_account_id: sourceAccountId,
    transaction_type_id: ACCOUNT_CLOSURE_TRANSACTION_TYPE_ID,
    destination_account_id: destinationAccountId,
    transaction_actual_date: transactionDate,
    account_balance: 0.0,
    // Same as the target leg above, and for the same reason.
    original_amount: boundaryAmount,
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

  try {
    console.log(
      pc.yellow(
        `CLOSE: recording DISCARD settlement for account ${targetAccountId} (residual ${residual})`,
      ),
    );

    const [targetResult, boundaryResult] = await Promise.all([
      client.query(insertQuery, Object.values(targetTransactionOption)),
      client.query(insertQuery, Object.values(boundaryTransactionOption)),
    ]);

    return [targetResult.rows[0], boundaryResult.rows[0]];
  } catch (error) {
    const messageError = `Error recording closure settlement for account ${targetAccountId}.`;
    console.error(pc.red(messageError), error);

    if (
      error.code &&
      (error.code.startsWith('23') || error.code.startsWith('22'))
    ) {
      const { code, message } = handlePostgresError(error);
      throw createError(code, message);
    }
    throw createError(500, `Closure settlement failed: ${error.message}`);
  }
};
