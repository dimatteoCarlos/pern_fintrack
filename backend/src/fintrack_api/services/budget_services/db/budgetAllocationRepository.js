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
 * @param {object} client - Database client (pool or transaction)
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Date>} the month, as a DATE
 */
export async function resolveCurrentMonth(client, timeZone = 'UTC') {
 const { rows } = await client.query(
  `SELECT date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE $1)::date AS month`,
  [timeZone],
 );

 return rows[0].month;
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
 * The amount carried into a month by the decision that precedes it.
 *
 * Strictly earlier than the month asked for, which is what lets the write path
 * read the value the current month returns to WITHOUT reading back the row it
 * is about to write. Using `<=` here turns "only this month" into a no-op
 * (§5.1.1).
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
 * Write the budget for the current month, optionally as a one-month exception.
 *
 * The six steps of §5.1, in order. Every one of them fails silently if dropped,
 * and the failure only surfaces a month later — §5.1.1 records what each guards
 * against.
 *
 * Must run on a caller-supplied client: the two writes are one decision, and a
 * terminator committed without its allocation reverts a budget nobody changed.
 *
 * @param {boolean} onlyThisMonth - true writes the terminator that restores the
 *  previous amount from next month. false leaves the amount recurring, which is
 *  the normal case and has no name in the payload.
 * @returns {Promise<object>} the allocation written, and the terminator if any.
 */
export async function writeAllocation(
 client,
 accountId,
 budgetAmount,
 onlyThisMonth = false,
 timeZone = 'UTC',
) {
 const month = await resolveCurrentMonth(client, timeZone);

 // Read before writing: step 4 is about to overwrite the month this would
 // otherwise resolve to.
 const carried = await getAllocationBefore(client, accountId, month);

 // Safe only because V1 lets no user author a future month: the only row that
 // can exist beyond M is a terminator this same routine wrote. Without it, a
 // save that switches an exception back to recurring leaves the old terminator
 // in place and next month silently reverts. §13 records this as the V2 line.
 await client.query(
  `DELETE FROM budget_monthly_allocations
    WHERE account_id = $1
      AND budget_month > $2`,
  [accountId, month],
 );

 const { rows } = await client.query(
  `INSERT INTO budget_monthly_allocations (account_id, budget_month, budget_amount)
   VALUES ($1, $2, $3)
   ON CONFLICT (account_id, budget_month)
   DO UPDATE SET budget_amount = EXCLUDED.budget_amount,
     updated_at = CURRENT_TIMESTAMP
   RETURNING budget_allocation_id, account_id, budget_month, budget_amount`,
  [accountId, month, budgetAmount],
 );

 let terminator = null;

 if (onlyThisMonth) {
  // COALESCE to 0 rather than skipping the insert: with nothing to return to,
  // the next month must read as "no budget", and only a row can stop the
  // carry-forward. Skipping it would carry this amount forward forever — the
  // exact opposite of what the caller asked for.
  const { rows: nextRows } = await client.query(
   `INSERT INTO budget_monthly_allocations (account_id, budget_month, budget_amount)
    VALUES ($1, ($2::date + INTERVAL '1 month')::date, $3)
    RETURNING budget_allocation_id, budget_month, budget_amount`,
   [accountId, month, carried ?? 0],
  );

  terminator = {
   budgetAllocationId: nextRows[0].budget_allocation_id,
   budgetMonth: nextRows[0].budget_month,
   budgetAmount: toAmount(nextRows[0].budget_amount),
  };
 }

 return {
  budgetAllocationId: rows[0].budget_allocation_id,
  accountId: rows[0].account_id,
  budgetMonth: rows[0].budget_month,
  budgetAmount: toAmount(rows[0].budget_amount),
  onlyThisMonth,
  // What the following month returns to, so the caller can word the
  // confirmation without resolving it again.
  restoresTo: onlyThisMonth ? (carried ?? 0) : null,
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
) {
 // Same expression as the backfill in 012, so an account created by hand and
 // one migrated from the legacy column land on the same month. One AT TIME ZONE
 // only: a second would return a timestamptz, and casting that to date reads
 // the session's zone rather than the owner's.
 const { rows } = await client.query(
  `INSERT INTO budget_monthly_allocations (account_id, budget_month, budget_amount)
   VALUES ($1,
    date_trunc('month', $2::timestamptz AT TIME ZONE $3)::date,
    $4)
   ON CONFLICT (account_id, budget_month)
   DO UPDATE SET budget_amount = EXCLUDED.budget_amount,
     updated_at = CURRENT_TIMESTAMP
   RETURNING budget_allocation_id, account_id, budget_month, budget_amount`,
  [accountId, accountStartDate, timeZone, budgetAmount],
 );

 return {
  budgetAllocationId: rows[0].budget_allocation_id,
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
