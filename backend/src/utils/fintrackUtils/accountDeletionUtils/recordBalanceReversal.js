// backend/src/utils/fintrackUtils/accountDeletionUtils/recordBalanceReversal.js

import pc from 'picocolors';
import { createError, handlePostgresError } from '../../errorHandling.js';
import { getCurrencyIdSync } from '../../currencyLookup.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../fintrack_api/config/fintrackConfig.js';
import {
  DEFAULT_EXCHANGE_RATE,
  DEFAULT_EXCHANGE_RATE_SOURCE,
} from '../../../fintrack_api/services/fx_services/core/fxConfig.js';
import {
  BALANCE_REVERSAL_MOVEMENT_TYPE_ID,
  BALANCE_REVERSAL_TRANSACTION_TYPE_ID,
} from '../accountDataRetrieval/derivedBalance.js';

/*
 * "Reverse the balance and close", the write half. Settled by the owner on
 * 2026-09-08 and recorded in PLAN_CLOSE_ACCOUNT.md section 14.
 *
 * WHAT THE OWNER CHOOSES IS WHETHER TO USE IT, AND NOTHING ELSE. No
 * destination, no amount, no date, no currency, no method, no split. The amount
 * is the negation of the account's own balance and the counterpart is the
 * compensation account, so the only decision left on the screen is the button.
 * That is why the label reads "reverse the balance" and never "withdraw" or
 * "deposit": naming a direction would imply the owner picked one.
 *
 * ONE OPERATION, TWO LEDGER LEGS. The books are double entry, so what the owner
 * sees as one action is the leg on the target account and the leg on the
 * compensation account. Both carry movement type 11 and both carry
 * reversal_of_account_id naming the same account, so what is identified
 * structurally is the operation rather than either leg.
 *
 * WHY THIS IS NOT recordClosureSettlement.js, which it is otherwise shaped
 * like. That writer served two policies and its whole variability was WHICH
 * counterpart received the residual - the owner picked a destination under
 * TRANSFER, or the boundary account took it under DISCARD. Both policies were
 * withdrawn on 2026-09-08. This operation has one counterpart by construction,
 * so a policy parameter here would be a parameter with one legal value, and the
 * descriptions differ because the two operations mean different things: a
 * settlement said where the money went, a reversal says a position was
 * neutralised. Reviving that writer to carry a third policy would also revive
 * movement type 10, which the investment card reads as its closure adjustment.
 *
 * WHY reversal_of_account_id IS SATISFIABLE AT THE MOMENT THIS RUNS, given it
 * references account_registry rather than user_accounts. The registry row for
 * an account exists from the account's own creation - migration 035 installs
 * the trigger fn_register_account_identity on user_accounts and backfills every
 * existing account - so the parent row is already there when this writes, and
 * it is still there afterwards, which is the point: the close deletes the
 * user_accounts row moments later in this same transaction and the registry row
 * survives it. A key into the live table would either refuse that delete or be
 * nulled by it.
 *
 * THE COLUMN IS NOT OPTIONAL AND THE DATABASE SAYS SO. Migration 037 carries
 * `CHECK ((movement_type_id = 11) = (reversal_of_account_id IS NOT NULL))`, so
 * a leg written without it is rejected rather than stored as a reversal nothing
 * can find. Stated here because that is a promise this file relies on rather
 * than one it makes.
 *
 * ORDERING CONSTRAINT ON THE FIRST ROW THIS EVER WRITES, and it is not about
 * this file's correctness. `investment` is in CLOSE_ZERO_BALANCE_TYPES, so a
 * reversal can land on an investment account. overviewInvestmentRepository.js
 * bounds its `realized` CTE to movement types 9 and 10 while the balance side
 * sums every row of the account, so a type 11 row sits inside the balance and
 * inside no explaining term, and makeInvestmentCard.js:136-139 then pushes
 * UNRECONCILED_BALANCE_NOTICE at :141 - telling the owner their figures do not
 * add up while their money is fine. That edit belongs to the overview module
 * and is routed there; it is named here because this file is what produces the
 * row that triggers it.
 */

const buildTargetDescription = (amount, currencyCode, counterpartAccountName) =>
  `Balance reversal: ${amount} ${currencyCode} moved to "${counterpartAccountName}" so this account could be closed at zero.`;

const buildCounterpartDescription = (amount, currencyCode, targetAccountName) =>
  `Balance reversal: ${amount} ${currencyCode} received from "${targetAccountName}", which was closed.`;

/**
 * @param {object} client - the active transactional PostgreSQL client. Never
 *   the pool: this runs inside the close's own transaction, and the state
 *   "reversed, not closed" must not be reachable.
 * @param {object} reversalData
 * @param {string} reversalData.userId
 * @param {number} reversalData.targetAccountId - the account being closed. Also
 *   the value written to reversal_of_account_id on BOTH legs.
 * @param {string} reversalData.targetAccountName
 * @param {number} reversalData.counterpartAccountId - the compensation account,
 *   resolved by the caller through checkAndInsertAccount, which identifies it
 *   structurally by account_type 'boundary' rather than by name alone.
 * @param {string} reversalData.counterpartAccountName
 * @param {number} reversalData.balance - the target's derived balance before
 *   the reversal, signed. Zero must never reach this function: an account
 *   already at zero needs no reversal, and writing a pair of zero-amount legs
 *   would put an operation in the ledger that neutralised nothing.
 * @param {number} reversalData.currencyId - the CLOSING account's currency,
 *   stamped on both legs. The compensation account's own currency is not read,
 *   which is the same limitation recordClosureSettlement.js carried under
 *   DISCARD and is recorded in the plan doc rather than fixed here.
 * @param {string} reversalData.currencyCode
 * @param {Date} reversalData.transactionDate
 * @returns {Promise<object[]>} the two inserted transaction records, target
 *   leg first.
 */
export const recordBalanceReversal = async (client, reversalData) => {
  const {
    userId,
    targetAccountId,
    targetAccountName,
    counterpartAccountId,
    counterpartAccountName,
    balance,
    currencyId,
    currencyCode,
    transactionDate,
  } = reversalData;

  // Refused rather than treated as a no-op. A caller reaching here with zero
  // has misread the account's state, and returning an empty pair would let the
  // close proceed on that misreading without anything saying so.
  if (!balance) {
    throw createError(
      400,
      `Balance reversal refused for account ${targetAccountId}: the balance is already zero.`,
    );
  }

  const isTargetPositive = balance > 0;
  const absoluteAmount = Math.abs(balance);

  // FX provenance, stated rather than left to the column defaults. A reversal
  // is an internal movement in the account's own currency, so the conversion
  // genuinely is a no-op - but the defaults declare original_amount 0 and
  // original_currency_id 1, which is false whenever the balance is not zero or
  // the account is not in currency 1.
  const accountingCurrencyId = getCurrencyIdSync(ACCOUNTING_CURRENCY_CODE);
  const exchangeRateTimestamp = new Date();

  // The target's leg is the exact negation of its balance: a positive balance
  // is moved out, a negative one is covered. The compensation account carries
  // the opposite amount, so the pair is double entry either way and the ledger
  // still sums to zero afterwards.
  //
  // NET WORTH DOES NOT MOVE, and that is not a property of these two amounts.
  // It holds because the leg that receives the balance sits on an account
  // excluded from net worth and from every aggregate balance - a domain rule in
  // the queries, not a condition on the close screen.
  const targetAmount = -balance;
  const counterpartAmount = balance;

  const sourceAccountId = isTargetPositive
    ? targetAccountId
    : counterpartAccountId;
  const destinationAccountId = isTargetPositive
    ? counterpartAccountId
    : targetAccountId;

  const targetTransactionOption = {
    userId,
    description: buildTargetDescription(
      absoluteAmount,
      currencyCode,
      counterpartAccountName,
    ),
    movement_type_id: BALANCE_REVERSAL_MOVEMENT_TYPE_ID,
    status: 'complete',
    amount: targetAmount,
    currency_id: currencyId,
    account_id: targetAccountId,
    source_account_id: sourceAccountId,
    transaction_type_id: BALANCE_REVERSAL_TRANSACTION_TYPE_ID,
    destination_account_id: destinationAccountId,
    transaction_actual_date: transactionDate,
    // Not read back - every consumer of account_balance_after_tr derives the
    // figure from the ledger instead.
    account_balance: 0.0,
    // The identity of the operation, on both legs. It names the account whose
    // position was neutralised, which is the target on either leg - the
    // compensation account's leg is part of the same operation and says so.
    reversal_of_account_id: targetAccountId,
    // Key order is the bind order: the insert passes Object.values, so these
    // six must stay last and in the same order as the columns below.
    original_amount: targetAmount,
    original_currency_id: currencyId,
    exchange_rate: DEFAULT_EXCHANGE_RATE,
    exchange_rate_source: DEFAULT_EXCHANGE_RATE_SOURCE,
    exchange_rate_timestamp: exchangeRateTimestamp,
    exchange_rate_target_currency_id: accountingCurrencyId,
  };

  const counterpartTransactionOption = {
    userId,
    description: buildCounterpartDescription(
      absoluteAmount,
      currencyCode,
      targetAccountName,
    ),
    movement_type_id: BALANCE_REVERSAL_MOVEMENT_TYPE_ID,
    status: 'complete',
    amount: counterpartAmount,
    currency_id: currencyId,
    account_id: counterpartAccountId,
    source_account_id: sourceAccountId,
    transaction_type_id: BALANCE_REVERSAL_TRANSACTION_TYPE_ID,
    destination_account_id: destinationAccountId,
    transaction_actual_date: transactionDate,
    account_balance: 0.0,
    reversal_of_account_id: targetAccountId,
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
    transaction_actual_date, account_balance_after_tr, reversal_of_account_id,
    original_amount, original_currency_id, exchange_rate, exchange_rate_source,
    exchange_rate_timestamp, exchange_rate_target_currency_id
   )
   VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
    $14, $15, $16, $17, $18, $19)
   RETURNING transaction_id, account_id, amount, reversal_of_account_id;
  `;

  try {
    console.log(
      pc.yellow(
        `CLOSE: reversing balance ${balance} on account ${targetAccountId} against ${counterpartAccountId}`,
      ),
    );

    // SEQUENTIAL, NOT Promise.all, and the difference is not style. Both legs
    // run on one transactional client; two queries issued concurrently on a
    // single pg client are serialised by the driver anyway, and interleaving
    // them makes which leg failed unreadable in the error. The settlement
    // writer used Promise.all here and had the same client.
    const targetResult = await client.query(
      insertQuery,
      Object.values(targetTransactionOption),
    );
    const counterpartResult = await client.query(
      insertQuery,
      Object.values(counterpartTransactionOption),
    );

    return [targetResult.rows[0], counterpartResult.rows[0]];
  } catch (error) {
    const messageError = `Error recording balance reversal for account ${targetAccountId}.`;
    console.error(pc.red(messageError), error);

    if (
      error.code &&
      (error.code.startsWith('23') || error.code.startsWith('22'))
    ) {
      const { code, message } = handlePostgresError(error);
      throw createError(code, message);
    }

    throw createError(500, messageError);
  }
};

export default recordBalanceReversal;
