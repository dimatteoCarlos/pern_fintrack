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
// The request's vocabulary is defined by the controller, and this file compares
// against it rather than restating the two strings. The import closes a cycle
// (controller -> service -> here -> controller), which is safe because the
// binding is read when a settlement is written and never while the module
// evaluates; the same cycle already exists between the controller and the
// deletion service.
import {
  CLOSE_POLICY_DISCARD,
  CLOSE_POLICY_TRANSFER,
} from '../../../fintrack_api/controllers/accountDeleteController.js';

/*
 * CLOSE settlement, both policies (PLAN_ACCOUNT_DELETION.md §3.1/§4.1 step 4:
 * SETTLE). Writes the two-leg movement that brings the target account's
 * residual to zero before CLOSE marks it, crediting/debiting the counterpart
 * account with the opposite amount.
 *
 * WHICH COUNTERPART is the whole difference between the two policies, and it
 * is the caller's to decide:
 *  - DISCARD sends the residual to the boundary account, the same compensation
 *    counterpart RTA uses, identified structurally by account_type (unit 5).
 *    Every published figure excludes that account, so the owner's net worth
 *    falls by the residual.
 *  - TRANSFER sends it to an account the owner picked, validated against the
 *    frozen eligibility rule (getCloseTransferDestinations.js). Both accounts
 *    are live and inside every published set, so the two legs cancel and net
 *    worth is unchanged.
 *
 * The rows are otherwise identical, which is why there is one writer: the
 * 18-column insert and its six FX columns exist once, and a second writer for
 * the second policy would drift from this one column by column.
 *
 * BOTH POLICIES CARRY movement_type_id 10, not the transfer type, even though
 * TRANSFER really is a transfer between two of the owner's accounts. Movement
 * type 6 is read as SPENDING by five consumers - the budget's actual_spent in
 * four queries of budgetTransactionRepository.js, the overview's monthly
 * expense series and its transaction list, and the category-budget cumulative
 * figure in getTransactionsForAccountById.js - all of which sum signed amounts
 * over an account set. A negative type-6 leg on the closing account would
 * report as negative spending for the month of the closure, and the positive
 * leg as spending on the destination. Movement type 10 is read by exactly one
 * consumer, overviewInvestmentRepository.js, and it reads it as the closure
 * adjustment, which is what this row is.
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
const PERSPECTIVE_COUNTERPART = 'counterpart';

// The DISCARD strings are unchanged to the byte. Rows already settled carry
// them, and they are the only signal a reader has for what a pre-TRANSFER
// closure did.
const buildDescription = (
  perspective,
  policy,
  { amount, currencyCode, targetAccountName, counterpartAccountName },
) => {
  if (policy === CLOSE_POLICY_TRANSFER) {
    return perspective === PERSPECTIVE_TARGET
      ? `Account closure settlement: residual ${amount} ${currencyCode} transferred to "${counterpartAccountName}" on closing "${targetAccountName}".`
      : `Account closure settlement: ${amount} ${currencyCode} received from "${targetAccountName}" on its closing.`;
  }

  return perspective === PERSPECTIVE_TARGET
    ? `Account closure settlement: residual ${amount} ${currencyCode} discarded on closing "${targetAccountName}".`
    : `Account closure settlement: counterpart adjustment of ${amount} ${currencyCode} for closing "${targetAccountName}".`;
};

/**
 * @param {object} client - the active transactional PostgreSQL client.
 * @param {object} settlementData
 * @param {string} settlementData.userId
 * @param {number} settlementData.targetAccountId
 * @param {string} settlementData.targetAccountName
 * @param {string} [settlementData.policy] - CLOSE_POLICY_DISCARD or
 *   CLOSE_POLICY_TRANSFER. Anything else, absent included, writes the DISCARD
 *   wording: the policy chooses the text, never the arithmetic, so a caller
 *   that omits it gets a mislabelled row rather than a misplaced amount.
 * @param {number} settlementData.counterpartAccountId - the boundary account
 *   under DISCARD, the owner's chosen destination under TRANSFER.
 * @param {string} [settlementData.counterpartAccountName] - read only by the
 *   TRANSFER wording, which names where the money went.
 * @param {number} settlementData.residual - the target's derived balance
 *   before settlement, signed. Zero must never reach this function - the
 *   caller decides whether there is anything to settle.
 * @param {number} settlementData.currencyId - the CLOSING account's currency,
 *   stamped on both legs. Under TRANSFER the eligibility rule has already
 *   forced the destination to hold the same one, so the pair agrees with both
 *   accounts it sits on; under DISCARD the boundary account's own currency is
 *   not read, which is recorded in the plan doc as a risk rather than fixed
 *   here.
 * @param {string} settlementData.currencyCode
 * @param {Date} settlementData.transactionDate
 * @returns {Promise<object[]>} the two inserted transaction records.
 */
export const recordClosureSettlement = async (client, settlementData) => {
  const {
    userId,
    targetAccountId,
    targetAccountName,
    policy = CLOSE_POLICY_DISCARD,
    counterpartAccountId,
    counterpartAccountName,
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
  // positive balance is moved out (withdrawn), a negative one is covered
  // (deposited). The counterpart account carries the opposite amount, so the
  // pair is double-entry either way. DISCARD's net-worth effect comes from the
  // owner's own dashboards excluding the boundary account, not from this write,
  // which is why the same two amounts leave net worth unchanged under TRANSFER.
  const targetAmount = -residual;
  const counterpartAmount = residual;

  const sourceAccountId = isTargetPositive
    ? targetAccountId
    : counterpartAccountId;
  const destinationAccountId = isTargetPositive
    ? counterpartAccountId
    : targetAccountId;

  const descriptionParts = {
    amount: absoluteAmount,
    currencyCode,
    targetAccountName,
    counterpartAccountName,
  };

  const targetTransactionOption = {
    userId,
    description: buildDescription(
      PERSPECTIVE_TARGET,
      policy,
      descriptionParts,
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

  const counterpartTransactionOption = {
    userId,
    description: buildDescription(
      PERSPECTIVE_COUNTERPART,
      policy,
      descriptionParts,
    ),
    movement_type_id: ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID,
    status: 'complete',
    amount: counterpartAmount,
    currency_id: currencyId,
    account_id: counterpartAccountId,
    source_account_id: sourceAccountId,
    transaction_type_id: ACCOUNT_CLOSURE_TRANSACTION_TYPE_ID,
    destination_account_id: destinationAccountId,
    transaction_actual_date: transactionDate,
    account_balance: 0.0,
    // Same as the target leg above, and for the same reason.
    original_amount: counterpartAmount,
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
        `CLOSE: recording ${policy} settlement for account ${targetAccountId} (residual ${residual}, counterpart ${counterpartAccountId})`,
      ),
    );

    const [targetResult, counterpartResult] = await Promise.all([
      client.query(insertQuery, Object.values(targetTransactionOption)),
      client.query(insertQuery, Object.values(counterpartTransactionOption)),
    ]);

    return [targetResult.rows[0], counterpartResult.rows[0]];
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
