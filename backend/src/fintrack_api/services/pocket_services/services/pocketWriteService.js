// backend/src/fintrack_api/services/pocket_services/services/pocketWriteService.js

// Write path for the plan itself: creating a pocket, and overwriting its name,
// note, target and desired date.
//
// The line that decides every column here: an allocation is a decision about
// money and is APPENDED; a target and a date are the current statement of a plan
// and are OVERWRITTEN. There is no revision history in V1 and no valid-from
// column, so an edit leaves nothing behind.
//
// Target and date travel in one request because they are one decision. Split
// into two, the pair can disagree about which revision it belongs to — a new
// target saved against the old deadline states a pace the owner never chose.

import { pool } from '../../../../db/config/configDB.js';
import {
 MINIMUM_AMOUNT,
 isFiniteMoney,
 isWithinAmountRange,
 toAmount,
} from '../../budget_services/core/money.js';
import { getFreedCashByAccount } from '../db/accountAllocationRepository.js';
// The same converter every other write path in the API uses. Migration 014
// records what happens when one of them skips it: a figure typed as 50000 cop
// stored as 50000 usd, an error of three orders of magnitude the schema cannot
// detect afterwards.
import { currencyAmountConversion } from '../../fx_services/conversion/currencyAmountConversion.js';
import { getCurrencyId } from '../../../../utils/currencyLookup.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../config/fintrackConfig.js';
import {
 insertPocket,
 updatePocket,
 deletePocket,
 getPocketForUser,
} from '../db/pocketRepository.js';

const forbidden = (message) =>
 Object.assign(new Error(message), { status: 403 });

const badRequest = (message) =>
 Object.assign(new Error(message), { status: 400 });

/**
 * Validate an amount and return it at the scale of the column.
 *
 * The single choke point of the pocket write path, so nothing below it ever sees
 * an unnormalized amount. Zero is rejected here, unlike in the budget module: a
 * budget of zero means "stop budgeting", while a goal of zero is a plan with
 * nothing to reach and the column refuses it with CHECK (target_amount > 0).
 *
 * @param {*} value
 * @param {string} field - named in the message, so the caller knows what to fix
 * @returns {number} the amount rounded to the column's scale
 */
const normalizeAmount = (value, field) => {
 if (!isFiniteMoney(value)) {
  throw badRequest(`${field} must be a number.`);
 }

 if (!isWithinAmountRange(value)) {
  throw badRequest(`${field} exceeds the maximum storable amount.`);
 }

 const normalized = toAmount(value);

 // A sub-cent amount is positive on screen and stores as 0.00, which the CHECK
 // then refuses with a constraint name nobody can act on. Naming the minimum is
 // the only way the caller learns what to correct.
 if (normalized <= 0) {
  throw badRequest(
   `${field} must be at least ${MINIMUM_AMOUNT} in the accounting currency.`,
  );
 }

 return normalized;
};

/**
 * Convert a typed figure into the accounting currency and keep the proof.
 *
 * Converted before it is normalized, never after: the scale of the column
 * belongs to the stored currency, and rounding the origin figure first would
 * apply the rate to an amount the user never typed. The origin figure is
 * normalized separately, because it is a different amount in a different
 * currency and one rounding does not answer for the other.
 *
 * An identity conversion when the two codes match, so a figure already typed in
 * the accounting currency costs no rate lookup and still records what it did.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} db - the client of a
 *  transaction in flight, so a currency lookup shares its snapshot
 */
const convertToAccountingCurrency = async (db, amount, currencyCode, field) => {
 const converted = await currencyAmountConversion(
  amount,
  currencyCode,
  ACCOUNTING_CURRENCY_CODE,
 );

 return {
  amount: normalizeAmount(converted.amount.toNumber(), field),
  originalAmount: normalizeAmount(amount, field),
  originalCurrencyId: await getCurrencyId(db, currencyCode),
  exchangeRate: converted.rate,
  exchangeRateSource: converted.source,
  exchangeRateTimestamp: converted.fetchedAt,
 };
};

/**
 * Create a pocket.
 *
 * No money and no source account: the pocket lands at allocated 0 and the screen
 * offers to allocate now or later. Adding money at creation is what made a
 * pocket an account, which is the model this module replaced.
 *
 * @returns {Promise<number>} the new pocket id
 */
async function createPocket(userId, body) {
 const client = await pool.connect();

 try {
  await client.query('BEGIN');

  const accountingCurrencyId = await getCurrencyId(
   client,
   ACCOUNTING_CURRENCY_CODE,
  );

  const converted = await convertToAccountingCurrency(
   client,
   body.targetAmount,
   body.currency,
   'targetAmount',
  );

  const pocketId = await insertPocket(client, userId, {
   name: body.name,
   note: body.note ?? null,
   targetAmount: converted.amount,
   // The accounting currency, which is the unit target_amount is expressed in.
   // Never the typed one: that pair below is audit metadata, not a unit.
   currencyId: accountingCurrencyId,
   desiredDate: body.desiredDate,
   originalTarget: converted.originalAmount,
   originalCurrencyId: converted.originalCurrencyId,
   exchangeRate: converted.exchangeRate,
   exchangeRateSource: converted.exchangeRateSource,
   exchangeRateTimestamp: converted.exchangeRateTimestamp,
   exchangeRateTargetCurrencyId: accountingCurrencyId,
  });

  await client.query('COMMIT');

  return pocketId;
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {
  client.release();
 }
}

/**
 * Overwrite the plan of one pocket.
 *
 * The pocket's own currency is not editable and no request can change it:
 * restating the unit would restate every past allocation. The currency sent
 * beside a new target names the unit that target was TYPED in, and it leaves the
 * same six-column trail creation does.
 *
 * @throws {Error & {status: 403}} when the pocket is missing or not the caller's
 */
async function editPocket(userId, pocketId, body) {
 const client = await pool.connect();

 try {
  await client.query('BEGIN');

  // Ownership is proven by reading the row under the caller's user_id, and the
  // update repeats that condition rather than trusting this read: between the
  // two there is a transaction, not a promise.
  const existing = await getPocketForUser(client, userId, pocketId);

  if (existing === null) {
   throw forbidden('Pocket not found or not owned by the authenticated user.');
  }

  const fields = {
   name: body.name,
   noteWasSent: Object.prototype.hasOwnProperty.call(body, 'note'),
   // null clears the note; an absent key leaves it alone. Collapsing the two
   // would make "remove this note" unexpressible.
   note: body.note ?? null,
   desiredDate: body.desiredDate,
  };

  if (body.targetAmount !== undefined) {
   const converted = await convertToAccountingCurrency(
    client,
    body.targetAmount,
    body.currency,
    'targetAmount',
   );

   fields.targetAmount = converted.amount;
   fields.originalTarget = converted.originalAmount;
   fields.originalCurrencyId = converted.originalCurrencyId;
   fields.exchangeRate = converted.exchangeRate;
   fields.exchangeRateSource = converted.exchangeRateSource;
   fields.exchangeRateTimestamp = converted.exchangeRateTimestamp;
  }

  const updated = await updatePocket(client, userId, pocketId, fields);

  if (!updated) {
   throw forbidden('Pocket not found or not owned by the authenticated user.');
  }

  await client.query('COMMIT');
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {
  client.release();
 }
}

/**
 * Delete a pocket, at any net, and answer with what each account gets back.
 *
 * Never refused for a non-zero net. An allocation never moved money, so deleting
 * the ledger with the pocket destroys no financial fact: the cash simply stops
 * being committed and returns to each source account's unassigned cash. No
 * balance is written and no transaction is recorded, because none was ever
 * wrong — which is exactly what separates this from deleting an account, where
 * money really did move and an impact report has to precede it.
 *
 * There is no close operation and no archive. A pocket that no longer applies is
 * deleted, which is why the schema carries no status column for one to live in.
 *
 * The freed figures are read inside the transaction, before the delete:
 * afterwards the ledger is gone by cascade. They are what the confirmation
 * promised, so the confirmation and the result state the same thing.
 *
 * @throws {Error & {status: 403}} when the pocket is missing or not the caller's
 */
async function removePocket(userId, pocketId) {
 const client = await pool.connect();

 try {
  await client.query('BEGIN');

  const existing = await getPocketForUser(client, userId, pocketId);

  if (existing === null) {
   throw forbidden('Pocket not found or not owned by the authenticated user.');
  }

  const freed = await getFreedCashByAccount(client, userId, pocketId);

  const deleted = await deletePocket(client, userId, pocketId);

  if (!deleted) {
   throw forbidden('Pocket not found or not owned by the authenticated user.');
  }

  await client.query('COMMIT');

  return {
   pocketId,
   name: existing.name,
   freed: freed.map((row) => ({
    accountId: row.accountId,
    accountName: row.accountName,
    freedCash: toAmount(row.freedCash),
   })),
  };
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {
  client.release();
 }
}

export const pocketWriteService = {
 createPocket,
 editPocket,
 removePocket,
};
