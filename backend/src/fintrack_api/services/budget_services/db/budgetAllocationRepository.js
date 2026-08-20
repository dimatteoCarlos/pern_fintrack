// backend/src/fintrack_api/services/budget_services/db/budgetAllocationRepository.js
// SQL for budget_monthly_allocations. Domain rules live in
// budgetAllocationService.js; this file only issues statements.
//
// A row is in force from its month onwards until a later row replaces it, so
// every read resolves the LAST row at or before the month asked for, and
// recurrence needs no column. See PLAN_BUDGET_V1 §3.3 and §4.
//
// The month is always resolved on the account owner's calendar. A boundary
// computed in any other zone lands in the neighbouring month when the owner
// reads it back.

import { toAmount } from '../core/money.js';

/**
 * First day of the current month on the owner's calendar.
 *
 * Derived server-side and never accepted from the client: that removes clock
 * skew, the device zone and a tampered month in one move (§7.3).
 *
 * Returned as text, not as a DATE. A DATE crossing the driver becomes a JS Date
 * at the node process's local midnight, and sending that back as a parameter
 * resolves through the session zone — the owner's calendar lost on the way out
 * and again on the way in. Text has no zone to lose.
 *
 * @param {object} client - Database client (pool or transaction)
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<{month: string}>} as 'YYYY-MM-DD'
 */
export async function resolveCurrentMonth(client, timeZone = 'UTC') {
 const { rows } = await client.query(
  `SELECT date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE $1)::date::text
            AS month`,
  [timeZone],
 );

 return { month: rows[0].month };
}

/**
 * The budget in force for one account in one month.
 *
 * @returns {Promise<number|null>} the amount, or null when no row precedes the
 *  month — which reads as "never budgeted", distinct from a stored 0 (§3.5).
 */
export async function getAllocationForMonth(client, accountId, month) {
 const { rows } = await client.query(
  `SELECT budget_amount
     FROM budget_monthly_allocations
    WHERE account_id = $1
      AND budget_month <= $2
    ORDER BY budget_month DESC
    LIMIT 1`,
  [accountId, month],
 );

 return rows.length === 0 ? null : toAmount(rows[0].budget_amount);
}

/**
 * The last decision taken strictly BEFORE a month.
 *
 * Uncalled since R41. The write path needs the amount in force AT the month,
 * which is getAllocationForMonth; reading the month before returns a different
 * number as soon as a row exists at M, and the terminator restored it (§5.1.1).
 *
 * Kept rather than deleted (§9.4): authoring a future month — the V2 boundary —
 * is what a strictly-earlier lookup would serve.
 *
 * @returns {Promise<number|null>} null when nothing precedes the month.
 */
export async function getAllocationBefore(client, accountId, month) {
 const { rows } = await client.query(
  `SELECT budget_amount
     FROM budget_monthly_allocations
    WHERE account_id = $1
      AND budget_month < $2
    ORDER BY budget_month DESC
    LIMIT 1`,
  [accountId, month],
 );

 return rows.length === 0 ? null : toAmount(rows[0].budget_amount);
}

/**
 * The month after a bound.
 *
 * Derived in SQL so month arithmetic stays in the language that owns the
 * calendar, and returned as text for the reason resolveCurrentMonth is: a DATE
 * crossing the driver loses the zone it was computed in.
 */
async function monthAfter(client, month) {
 const { rows } = await client.query(
  `SELECT ($1::date + INTERVAL '1 month')::date::text AS month`,
  [month],
 );

 return rows[0].month;
}

/**
 * Write a budget over a closed range of months, or from one month onwards.
 *
 * A row is in force until a later row replaces it, so a bounded change needs no
 * column of its own: overwrite the range, then state again at the far edge what
 * the months beyond it were already worth.
 *
 *  1. read the amount that governs the month after `to`, BEFORE anything is
 *     written — steps 2 and 3 both destroy the evidence.
 *  2. delete the decisions inside the range, which this one replaces.
 *  3. write the new amount at `from`.
 *  4. restore step 1's amount at `to` + 1, so the change stops there.
 *
 * With `to` null there is no far edge: steps 1 and 4 do not run and step 2 loses
 * its ceiling, which is what "from this month on" means — every later decision
 * goes. That is the one destructive branch, and asking before taking it is the
 * caller's job, not this one's.
 *
 * Must run on a caller-supplied client: the four statements are one decision,
 * and a terminator committed without its allocation reverts a budget nobody
 * changed.
 *
 * @param {number} budgetAmount - the amount in the account's currency, already
 *  converted and normalized by the service.
 * @param {string} from - first month in force, as 'YYYY-MM-01'
 * @param {string|null} to - last month in force, or null for no end
 * @param {object} fx - the conversion that produced budgetAmount:
 *  { originalAmount, originalCurrencyId, rate, source, fetchedAt, targetCurrencyId }.
 *  Required, with no default: a default identity here is exactly the silence
 *  migration 014 was written to end.
 * @returns {Promise<object>} the amount written, what the range gives back to,
 *  and the months whose stored decision this write replaced.
 */
export async function writeAllocation(
 client,
 accountId,
 budgetAmount,
 from,
 to,
 fx,
) {
 // Read AT `to` + 1, not at `from`: a row already sitting on the far edge states
 // what that month is worth, and carrying `from`'s amount there would overwrite
 // a decision this write was never asked to touch.
 const restoresFrom = to === null ? null : await monthAfter(client, to);
 const restoresTo =
  restoresFrom === null
   ? null
   : await getAllocationForMonth(client, accountId, restoresFrom);

 // The ceiling IS the condition: bounded by `to` when there is one, unbounded
 // when there is not. COALESCE rather than two statements, so the months removed
 // come back the same way whichever branch ran.
 const { rows: overwritten } = await client.query(
  `DELETE FROM budget_monthly_allocations
    WHERE account_id = $1
      AND budget_month > $2::date
      AND budget_month <= COALESCE($3::date, 'infinity'::date)
    RETURNING budget_month::text`,
  [accountId, from, to],
 );

 // budget_amount is the converted figure; the six columns beside it are what
 // make it auditable. Every one of them is overwritten on conflict: a month
 // rewritten in a new currency whose old FX metadata survived would describe a
 // figure that is no longer there.
 const { rows } = await client.query(
  `INSERT INTO budget_monthly_allocations (
     account_id, budget_month, budget_amount,
     original_budget_amount, original_currency_id,
     exchange_rate, exchange_rate_source, exchange_rate_timestamp,
     exchange_rate_target_currency_id)
   VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)
   ON CONFLICT (account_id, budget_month)
   DO UPDATE SET budget_amount = EXCLUDED.budget_amount,
     original_budget_amount = EXCLUDED.original_budget_amount,
     original_currency_id = EXCLUDED.original_currency_id,
     exchange_rate = EXCLUDED.exchange_rate,
     exchange_rate_source = EXCLUDED.exchange_rate_source,
     exchange_rate_timestamp = EXCLUDED.exchange_rate_timestamp,
     exchange_rate_target_currency_id = EXCLUDED.exchange_rate_target_currency_id,
     updated_at = CURRENT_TIMESTAMP
   RETURNING budget_allocation_id, account_id, budget_month::text, budget_amount,
     original_budget_amount, exchange_rate`,
  [
   accountId,
   from,
   budgetAmount,
   fx.originalAmount,
   fx.originalCurrencyId,
   fx.rate,
   fx.source,
   fx.fetchedAt,
   fx.targetCurrencyId,
  ],
 );

 if (restoresFrom !== null) {
  // DO NOTHING, not DO UPDATE: a row on the far edge is the decision being
  // restored, and step 1 already read its amount. Writing it back is a no-op at
  // best, and the statement would otherwise raise 23505 the moment one exists.
  //
  // Falling back to 0 when nothing governed that month: with no amount to return
  // to, the months after the range would carry this one forward forever, which
  // is the opposite of a bounded change. Only a row stops the carry-forward.
  //
  // Identity FX, in the account's own currency: this amount was read out of
  // this table, so it is already the accounting figure and nobody typed it.
  // Recording the origin currency of the write above would claim a user stated
  // this month in a currency they never saw.
  await client.query(
   `INSERT INTO budget_monthly_allocations (
      account_id, budget_month, budget_amount,
      original_budget_amount, original_currency_id,
      exchange_rate, exchange_rate_source, exchange_rate_timestamp,
      exchange_rate_target_currency_id)
    VALUES ($1, $2::date, $3, $3, $4, 1.0, 'identity', CURRENT_TIMESTAMP, $4)
    ON CONFLICT (account_id, budget_month) DO NOTHING`,
   [accountId, restoresFrom, restoresTo ?? 0, fx.targetCurrencyId],
  );
 }

 return {
  accountId: rows[0].account_id,
  budgetMonth: rows[0].budget_month,
  budgetAmount: toAmount(rows[0].budget_amount),
  // The figure as it was typed, and the rate that turned it into the one above.
  // Returned so the caller can confirm the conversion instead of leaving the
  // user to wonder why the amount they entered reads differently (014).
  originalAmount: toAmount(rows[0].original_budget_amount),
  exchangeRate: Number(rows[0].exchange_rate),
  // What the month after the range gives back, and which month that is, so the
  // caller can word the confirmation without resolving either again. Both null
  // when the change has no end.
  restoresTo: restoresFrom === null ? null : (restoresTo ?? 0),
  restoresFrom,
  // The months whose stored decision this write replaced, ascending. Sorted
  // here because DELETE ... RETURNING takes no ORDER BY, and text sorts
  // chronologically since every bound is a first of month.
  overwrittenMonths: overwritten.map((row) => row.budget_month).sort(),
 };
}

/**
 * Write the first allocation of a newly created account.
 *
 * Dated at the account's START month, not the current one: the amount comes
 * into force when the account does, and a backdated account would otherwise
 * report no budget for the months between its start and its creation.
 *
 * Nothing terminates it, so it recurs — which is what an account created with a
 * budget means. The creation form offers no exception checkbox (§7.1).
 *
 * @returns {Promise<object>} the allocation created.
 */
export async function insertFirstAllocation(
 client,
 accountId,
 budgetAmount,
 accountStartDate,
 timeZone = 'UTC',
 currencyId,
) {
 // Same expression as the backfill in 012, so an account created by hand and
 // one migrated from the legacy column land on the same month. One AT TIME ZONE
 // only: a second would return a timestamptz, and casting that to date reads
 // the session's zone rather than the owner's.
 // Identity FX in the account's own currency, and not the conversion the
 // account creation performed. That conversion IS recorded — on
 // category_budget_accounts, by migration 014, which owns the origin of the
 // figure this row mirrors. Repeating it here would be a second copy to keep in
 // step, and 010 already refused a currency column for that reason.
 const { rows } = await client.query(
  `INSERT INTO budget_monthly_allocations (
     account_id, budget_month, budget_amount,
     original_budget_amount, original_currency_id,
     exchange_rate, exchange_rate_source, exchange_rate_timestamp,
     exchange_rate_target_currency_id)
   VALUES ($1,
    date_trunc('month', $2::timestamptz AT TIME ZONE $3)::date,
    $4, $4, $5, 1.0, 'identity', CURRENT_TIMESTAMP, $5)
   ON CONFLICT (account_id, budget_month)
   DO UPDATE SET budget_amount = EXCLUDED.budget_amount,
     original_budget_amount = EXCLUDED.original_budget_amount,
     updated_at = CURRENT_TIMESTAMP
   RETURNING budget_allocation_id, account_id, budget_month::text, budget_amount`,
  [accountId, accountStartDate, timeZone, budgetAmount, currencyId],
 );

 return {
  accountId: rows[0].account_id,
  budgetMonth: rows[0].budget_month,
  budgetAmount: toAmount(rows[0].budget_amount),
 };
}

/**
 * Drop every allocation of an account.
 *
 * The second of the two removal verbs (§5.4): "this account is not budgeted",
 * which erases the history. The other verb — "stop budgeting" — writes a 0 row
 * and belongs to writeAllocation, because it must preserve what came before.
 *
 * @returns {Promise<number>} rows deleted.
 */
export async function deleteAllocationsForAccount(client, accountId) {
 const { rowCount } = await client.query(
  `DELETE FROM budget_monthly_allocations WHERE account_id = $1`,
  [accountId],
 );

 return rowCount;
}
