// backend/src/fintrack_api/services/pocket_services/services/pocketAllocationService.js

// Write path for the ledger: committing money to a pocket, and releasing it
// back.
//
// Neither operation moves a balance. An allocation is a claim over money that
// stays exactly where it is, so nothing here writes a transaction and nothing
// here updates account_balance. A spend against committed money is still
// accepted, always, and the account then reports that it no longer covers what
// is committed to it — over-allocation is a state the app displays, never an
// error the database refuses.
//
// Allocate and release are the same decision with opposite effect. The client
// sends a positive amount to one endpoint or the other and never a sign: a
// contract where releasing means sending -100 is one typo away from inverting a
// financial decision, and no validator can tell an intended negative from a
// slipped one. The sign is written here.

import { pool } from '../../../../db/config/configDB.js';
import {
 MINIMUM_AMOUNT,
 isFiniteMoney,
 isWithinAmountRange,
 money,
 toAmount,
 toAmountString,
} from '../../budget_services/core/money.js';
import { currencyAmountConversion } from '../../fx_services/conversion/currencyAmountConversion.js';
import {
 getCurrencyCodeSync,
 getCurrencyId,
} from '../../../../utils/currencyLookup.js';
import {
 ACCOUNTING_CURRENCY_CODE,
 BACKDATING_WINDOW_MONTHS,
} from '../../../config/fintrackConfig.js';
import { getUserTimeZone } from '../../../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import {
 dayInZone,
 earliestDatableDay,
 isCalendarDate,
 todayInZone,
} from '../../../../utils/fintrackUtils/date-utils/resolveZonedWindow.js';
import { getPocketForUser } from '../db/pocketRepository.js';
import {
 getHeldByPocketFromAccount,
 insertAllocation,
 lockOwnedSourceAccount,
} from '../db/accountAllocationRepository.js';

// Bank and cash only. Never an investment account — its balance is a market
// valuation rather than spendable money, and a price move would put the account
// into a false over-allocated state. Never a debtor account, a category budget
// account or the internal 'slack' account, none of which hold the owner's
// spendable cash either.
const ELIGIBLE_SOURCE_TYPES = ['bank', 'cash'];

const INTERNAL_ACCOUNT_NAME = 'slack';

const forbidden = (message) =>
 Object.assign(new Error(message), { status: 403 });

const badRequest = (message) =>
 Object.assign(new Error(message), { status: 400 });

// 422, not 400: the payload parsed and every field is well formed. What fails is
// a rule about the row behind an id, or the relationship between two figures —
// neither of which a schema can see. That is the line this module's error shape
// draws, and the budget module drew it first.
const unprocessable = (message) =>
 Object.assign(new Error(message), { status: 422 });

// A figure inside a refusal, in the unit it is actually stated in. Every amount
// these messages name has passed convertTypedAmount, which refuses any account
// not kept in the accounting currency, so the unit is known here and does not
// have to be looked up.
//
// The symbol is asked of Intl and never held in a table here. The accounting
// currency is read from the environment and a deployment may change it, so a
// map in this module would be one more place to remember; Intl already answers
// for whatever code that variable carries, and it brings the currency's own
// grouping and decimal count with it. narrowSymbol, so a dollar reads "$"
// rather than "US$", and en-US because these messages are written in English.
//
// Built once and behind a guard: an unknown code makes the constructor throw,
// and a refusal that turns into a 500 tells the owner nothing about the rule it
// was refusing on. The fallback states the bare code, fixed-point so a round
// figure still reads 3140.70.
const accountingAmountFormat = (() => {
 try {
  return new Intl.NumberFormat('en-US', {
   style: 'currency',
   currency: ACCOUNTING_CURRENCY_CODE.toUpperCase(),
   currencyDisplay: 'narrowSymbol',
  });
 } catch {
  return null;
 }
})();

const statedAmount = (value) =>
 accountingAmountFormat
  ? accountingAmountFormat.format(toAmount(value))
  : `${ACCOUNTING_CURRENCY_CODE.toUpperCase()} ${toAmountString(value)}`;

/**
 * Validate an amount and return it at the scale of the column.
 *
 * Zero is rejected: the column carries CHECK (amount <> 0) because a zero row
 * states nothing and would appear in the history as an event that did not
 * happen. A sub-cent amount is positive on screen and stores as 0.00, so it is
 * refused here, where the minimum can be named.
 */
const normalizeAmount = (value) => {
 if (!isFiniteMoney(value)) {
  throw badRequest('amount must be a number.');
 }

 if (!isWithinAmountRange(value)) {
  throw badRequest('amount exceeds the maximum storable amount.');
 }

 const normalized = toAmount(value);

 if (normalized <= 0) {
  throw badRequest(
   `amount must be at least ${MINIMUM_AMOUNT} in the accounting currency.`,
  );
 }

 return normalized;
};

/**
 * Resolve the day the decision is dated on, and refuse one outside the window.
 *
 * The same three checks the movement path runs, in the same order and on the
 * owner's calendar: the shape of the day, that it is not in the future, and
 * that it is not before the floor of the back-dating window. The fourth, the
 * source account's opening day, needs the account row and runs below with it.
 *
 * The window is the app's rule and not this module's: a decision nobody can
 * date a movement on is a decision nobody may date an allocation on either.
 *
 * @returns {{requestedDay: string, todayForOwner: string, asOfDay: string|null}}
 *  asOfDay is null on today, which is what routes the conversion to the current
 *  rate exactly as it did before this existed.
 */
const resolveAllocationDay = (requested, timeZone) => {
 const todayForOwner = todayInZone(timeZone);
 const requestedDay = typeof requested === 'string' ? requested.trim() : '';

 if (requestedDay === '') {
  return { requestedDay: '', todayForOwner, asOfDay: null };
 }

 if (!isCalendarDate(requestedDay)) {
  throw badRequest('allocationDate must be a calendar day, YYYY-MM-DD.');
 }

 if (requestedDay > todayForOwner) {
  throw unprocessable(
   `An allocation cannot be dated after today, ${todayForOwner}.`,
  );
 }

 const windowFloor = earliestDatableDay(todayForOwner, BACKDATING_WINDOW_MONTHS);

 if (requestedDay < windowFloor) {
  throw unprocessable(`An allocation cannot be dated before ${windowFloor}.`);
 }

 return {
  requestedDay,
  todayForOwner,
  asOfDay: requestedDay < todayForOwner ? requestedDay : null,
 };
};

/**
 * Prove the source account may back a pocket at all.
 *
 * A structurally valid payload naming an account of the wrong kind is a 422, not
 * a 400: every field parses, and what fails is a domain rule about the account
 * behind the id.
 *
 * @param {object} account - the locked row
 * @param {string} chosenDay - YYYY-MM-DD, or '' when the decision is undated
 * @param {string} timeZone - the owner's IANA zone
 */
const assertEligibleSource = (account, chosenDay, timeZone) => {
 // The account's opening day is the fourth check of the window, and it is here
 // rather than beside the other three because only this point holds the row.
 // Calendar days on both sides, never instants: account_start_date keeps an
 // arbitrary wall-clock time, so an account opened at 20:00 would refuse a
 // decision on its own opening day, which composes to 12:00.
 if (chosenDay !== '') {
  const openingDay = dayInZone(account.accountStartDate, timeZone);

  if (openingDay && chosenDay < openingDay) {
   throw unprocessable(
    `Account "${account.accountName}" was opened on ${openingDay} and cannot back an allocation dated before it.`,
   );
  }
 }

 if (account.deletedAt !== null) {
  throw unprocessable(
   `Account "${account.accountName}" has been deleted and cannot back a pocket.`,
  );
 }

 if (account.accountName === INTERNAL_ACCOUNT_NAME) {
  throw unprocessable('The internal account cannot back a pocket.');
 }

 if (!ELIGIBLE_SOURCE_TYPES.includes(account.accountType)) {
  throw unprocessable(
   `Account "${account.accountName}" is of type ${account.accountType}; only ${ELIGIBLE_SOURCE_TYPES.join(' and ')} accounts can back a pocket.`,
  );
 }
};

/**
 * Convert the typed figure into the accounting currency and keep the proof.
 *
 * @param {string|null} asOfDay - the day to value on, null for today
 * @param {string} timeZone - the owner's IANA zone
 *
 * The target is the accounting currency and not the account's own, deliberately:
 * pockets.target_amount is in that unit, so an allocation stored in it is
 * directly comparable to the goal it is measured against. The guard below is
 * what makes the two the same question — every account in this database is kept
 * in the accounting currency, and an account that is not would have its balance
 * compared against a total in another unit at an implicit 1:1.
 */
const convertTypedAmount = async (
 client,
 amount,
 currencyCode,
 account,
 asOfDay,
 timeZone,
) => {
 const accountCurrency = getCurrencyCodeSync(account.currencyId);

 if (accountCurrency !== ACCOUNTING_CURRENCY_CODE) {
  throw unprocessable(
   `Account "${account.accountName}" is kept in ${accountCurrency}; a pocket allocation is measured in ${ACCOUNTING_CURRENCY_CODE} and the two cannot be compared.`,
  );
 }

 // The day the decision is dated on, so a back-dated allocation is valued at
 // the rate that was in force then. Null on today, which routes the resolver to
 // the current rate. Without it the row would carry a date from August and a
 // rate from September, and the preview the owner approved would not be the
 // figure the row stores.
 const converted = await currencyAmountConversion(
  amount,
  currencyCode,
  ACCOUNTING_CURRENCY_CODE,
  asOfDay,
  // The same zone asOfDay was decided on, so the resolver's future guard and
  // this module's floor agree on which day it is.
  timeZone,
 );

 return {
  amount: normalizeAmount(converted.amount.toNumber()),
  // Normalized on its own and not derived from the converted figure: it is a
  // different amount in a different currency, and one rounding does not answer
  // for the other.
  originalAmount: normalizeAmount(amount),
  // Resolved on this transaction's client, not the pool: the write is inside
  // BEGIN, and a lookup on a second connection would not see a currency row
  // added by an uncommitted migration on this one.
  originalCurrencyId: await getCurrencyId(client, currencyCode),
  exchangeRate: converted.rate,
  exchangeRateSource: converted.source,
  exchangeRateTimestamp: converted.fetchedAt,
 };
};

/**
 * Commit money to a pocket, or release it back to the account.
 *
 * The check and the insert are ONE transaction with the source account locked
 * FOR UPDATE. Two simultaneous requests would otherwise both read the same
 * unassigned cash and both pass, and the account would end up committed beyond
 * what it holds with neither request having done anything wrong.
 *
 * @param {'allocate'|'release'} direction
 * @returns {Promise<object>} the row written, and the figures it moved
 */
const writeLedgerRow = async (direction, userId, pocketId, body) => {
 // The zone, and the three checks that need nothing but it, run BEFORE the
 // transaction opens. The conversion below depends on the day they resolve, and
 // an HTTP call to a rate provider inside an open transaction would hold it for
 // the length of a network round trip.
 const timeZone = await getUserTimeZone(pool, userId);

 const { requestedDay, asOfDay } = resolveAllocationDay(
  body.allocationDate,
  timeZone,
 );

 const client = await pool.connect();

 try {
  await client.query('BEGIN');

  const pocket = await getPocketForUser(client, userId, pocketId);

  if (pocket === null) {
   throw forbidden('Pocket not found or not owned by the authenticated user.');
  }

  const account = await lockOwnedSourceAccount(
   client,
   userId,
   body.sourceAccountId,
  );

  if (account === null) {
   throw forbidden('Account not found or not owned by the authenticated user.');
  }

  assertEligibleSource(account, requestedDay, timeZone);

  const converted = await convertTypedAmount(
   client,
   body.amount,
   body.currency,
   account,
   asOfDay,
   timeZone,
  );

  const requested = money(converted.amount);

  if (direction === 'allocate') {
   // The precondition of allocating, and of nothing else. It lives here rather
   // than in a CHECK because a CHECK would also block the insert of a real
   // expense, which must always be accepted.
   const unassignedCash = money(account.accountBalance).minus(
    account.accountAllocated,
   );

   if (requested.greaterThan(unassignedCash)) {
    throw unprocessable(
     `Cannot commit ${statedAmount(requested)} to this pocket: "${account.accountName}" has ${statedAmount(unassignedCash)} of unassigned cash.`,
    );
   }
  } else {
   // The running sum of the (pocket, source account) pair may never go below
   // zero: a pocket cannot give back to an account more than it holds from it,
   // and it is what forces the release form to name a source rather than a
   // total.
   const held = money(
    await getHeldByPocketFromAccount(
     client,
     userId,
     pocketId,
     body.sourceAccountId,
    ),
   );

   if (requested.greaterThan(held)) {
    throw unprocessable(
     `Cannot release ${statedAmount(requested)} from "${account.accountName}": this pocket holds ${statedAmount(held)} from it.`,
    );
   }
  }

  // The sign is written here and nowhere else. original_amount carries it too,
  // so the stored figure stays the origin figure times the rate and the audit
  // pair reconciles in both magnitude and direction.
  const sign = direction === 'allocate' ? 1 : -1;

  const written = await insertAllocation(client, userId, {
   pocketId,
   sourceAccountId: body.sourceAccountId,
   amount: toAmount(requested.times(sign)),
   // The validated day, and null whenever it is today: a decision taken now
   // keeps the real current instant, and only a past one is anchored at noon.
   // It is the same value the conversion was priced on, so the row's date and
   // its rate can never describe two different days.
   allocationDate: asOfDay,
   timeZone,
   originalAmount: toAmount(money(converted.originalAmount).times(sign)),
   originalCurrencyId: converted.originalCurrencyId,
   exchangeRate: converted.exchangeRate,
   exchangeRateSource: converted.exchangeRateSource,
   exchangeRateTimestamp: converted.exchangeRateTimestamp,
   // The unit amount is expressed in, which is the unit the pocket's target is
   // expressed in. Read from the account, whose currency the guard above has
   // already proven to be that one.
   exchangeRateTargetCurrencyId: account.currencyId,
  });

  await client.query('COMMIT');

  return {
   allocationId: Number(written.allocationId),
   pocketId,
   sourceAccountId: account.accountId,
   sourceAccountName: account.accountName,
   amount: toAmount(written.amount),
  };
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {
  client.release();
 }
};

export const pocketAllocationService = {
 /** POST /pocket/:pocketId/allocations */
 allocate: (userId, pocketId, body) =>
  writeLedgerRow('allocate', userId, pocketId, body),

 /** POST /pocket/:pocketId/releases */
 release: (userId, pocketId, body) =>
  writeLedgerRow('release', userId, pocketId, body),
};
