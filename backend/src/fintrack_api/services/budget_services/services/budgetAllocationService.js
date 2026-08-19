// backend/src/fintrack_api/services/budget_services/services/budgetAllocationService.js
// Write path for monthly budget allocations. SQL lives in
// budgetAllocationRepository.js; the rules that decide whether to write live here.
//
// A budget is an amount assigned to one expense account for one calendar month,
// in force from that month until a later row replaces it. Nothing is prorated,
// nothing carries over, and no surplus reaches the next month: there is no
// balance entity for one to live in (PLAN_BUDGET_V1 §0).

import {
 MINIMUM_AMOUNT,
 isFiniteMoney,
 isWithinAmountRange,
 money,
 toAmount,
} from '../core/money.js';
import {
 getAllocationForMonth,
 insertFirstAllocation,
 resolveCurrentMonth,
 writeAllocation,
} from '../db/budgetAllocationRepository.js';
// The one value of appliesUntil that is not a month. Imported rather than
// repeated here: it is a term of the wire contract, and a second copy is a
// second thing to keep in step.
import { OPEN_ENDED } from '../../../../validation/zod/budgetValidators.js';

const forbidden = (message) =>
 Object.assign(new Error(message), { status: 403 });

const badRequest = (message) =>
 Object.assign(new Error(message), { status: 400 });

// 422, not 400: the payload parsed and every field is well formed. What fails is
// the relationship between two of them, or between one and the owner's calendar
// — neither of which a schema can see. Same convention the read path uses.
const unprocessable = (message) =>
 Object.assign(new Error(message), { status: 422 });

/**
 * Validate an amount and return it at the scale of the column.
 *
 * The entry boundary of ROUNDING-POLICY.md: the single choke point for every
 * write, so nothing below it sees an unnormalized amount.
 *
 * Zero is accepted, because it is how "stop budgeting" is expressed — an absent
 * row terminates nothing under carry-forward (§3.4). Rejecting it belongs to the
 * form, not here: the amount field refuses 0, and only the explicit remove
 * action sends it.
 *
 * @returns {number} the amount rounded to the column's scale.
 */
const normalizeAmount = (budgetAmount) => {
 if (!isFiniteMoney(budgetAmount)) {
  throw badRequest('budgetAmount must be a number.');
 }

 if (!isWithinAmountRange(budgetAmount)) {
  throw badRequest('budgetAmount exceeds the maximum storable amount.');
 }

 const normalizedAmount = toAmount(budgetAmount);

 if (normalizedAmount < 0) {
  throw badRequest('budgetAmount cannot be negative.');
 }

 // A sub-cent amount is positive on screen and stores as 0.00, which means
 // "stop budgeting" — a different decision from the one the user made. Naming
 // the minimum is the only way the caller learns what to correct.
 if (normalizedAmount === 0 && money(budgetAmount).greaterThan(0)) {
  throw badRequest(
   `budgetAmount must be at least ${MINIMUM_AMOUNT} in the account currency, or exactly 0 to stop budgeting.`,
  );
 }

 return normalizedAmount;
};

/**
 * Resolve an account the caller owns, locking it for the rest of the transaction.
 *
 * Ownership is proven by joining to user_accounts.user_id rather than trusting
 * the accountId. FOR UPDATE closes the window between the check and the write:
 * two concurrent saves could otherwise both read the amount in force and both
 * act on a state that no longer holds.
 *
 * Deliberately not 404. Distinguishing "does not exist" from "not yours" would
 * let a caller enumerate other users' account ids.
 *
 * account_start_month comes back alongside the raw date because a write has to
 * be told whether the month it names existed yet, and comparing against the raw
 * date would reject the account's own first month whenever the account started
 * after the 1st. Truncated with a single AT TIME ZONE, the same expression the
 * backfill in 012 used, so an account created by hand and one migrated from the
 * legacy column report the same start month.
 */
const lockOwnedAccount = async (client, userId, accountId, timeZone = 'UTC') => {
 const { rows } = await client.query(
  `SELECT ua.account_id,
          ua.account_start_date,
          date_trunc('month', ua.account_start_date AT TIME ZONE $3)::date::text
            AS account_start_month
     FROM user_accounts ua
    WHERE ua.account_id = $1
      AND ua.user_id = $2
      FOR UPDATE OF ua`,
  [accountId, userId, timeZone],
 );

 if (rows.length === 0) {
  throw forbidden('Account not found or not owned by the authenticated user.');
 }

 return rows[0];
};

/**
 * Write the first allocation of a newly created budget account.
 *
 * Takes a client, not a pool: account creation already owns a transaction, and
 * an allocation committed on its own connection would outlive a rollback of the
 * very account it belongs to.
 *
 * No ownership check: the caller just created the account inside this same
 * transaction, so there is no id to verify against.
 *
 * @returns {Promise<object>} the allocation created.
 */
async function createAllocationForAccount(
 client,
 accountId,
 budgetAmount,
 accountStartDate,
 timeZone = 'UTC',
) {
 return insertFirstAllocation(
  client,
  accountId,
  normalizeAmount(budgetAmount),
  accountStartDate,
  timeZone,
 );
}

/**
 * Apply a budget change made through the account editor.
 *
 * Recurrent by definition: the account editor has no control for choosing how
 * long the amount lasts, so every change it makes runs from the current month
 * with no end. Bounded changes belong to the budget screen, which sends them to
 * PUT /budget/accounts/:accountId/current.
 *
 * Takes a client for the same reason createAllocationForAccount does: the
 * allocation must commit or roll back together with the cba.budget write it
 * mirrors.
 *
 * An account with no allocation gets its first one, dated from the account
 * start. That repairs every account created before this table existed and every
 * row the backfill skipped, instead of leaving it invisible to the read path.
 *
 * @returns {Promise<object|null>} accountId, budgetMonth and budgetAmount —
 *  always those three, whichever path wrote the row, so the shape does not
 *  depend on state the caller cannot see. null when the amount already in force
 *  is the one being sent: the edit form resends the budget on every save, and
 *  writing it back would delete a terminator the user set from the budget
 *  screen — silently turning a one-month exception into a permanent change.
 */
async function applyAllocationForAccount(
 client,
 userId,
 accountId,
 budgetAmount,
 timeZone = 'UTC',
) {
 const account = await lockOwnedAccount(client, userId, accountId, timeZone);
 const normalizedAmount = normalizeAmount(budgetAmount);

 const { month } = await resolveCurrentMonth(client, timeZone);
 const inForce = await getAllocationForMonth(client, accountId, month);

 if (inForce === null) {
  return createAllocationForAccount(
   client,
   accountId,
   normalizedAmount,
   account.account_start_date,
   timeZone,
  );
 }

 // Both sides are already at the column's scale, so this compares exactly and
 // rounds nothing.
 if (inForce === normalizedAmount) {
  return null;
 }

 const written = await writeAllocation(
  client,
  accountId,
  normalizedAmount,
  month,
  null,
 );

 // Projected to the three contract fields. The editor writes no end, so nothing
 // is restored and restoresTo is always null here (§7.4).
 return {
  accountId: written.accountId,
  budgetMonth: written.budgetMonth,
  budgetAmount: written.budgetAmount,
 };
}

/**
 * Set the budget of one account over a range of months, from the budget screen.
 *
 * The only write that carries a range, because the budget screen is the only
 * place that asks how long the amount should last. The account editor has no
 * such control and routes to applyAllocationForAccount instead.
 *
 * Owns its transaction: the allocation and the row that restores the previous
 * amount at the far edge are one decision, and a restore committed without its
 * allocation reverts a budget nobody changed. The account-editor writes take a
 * caller-supplied client for the opposite reason — theirs must roll back with
 * the account row they mirror.
 *
 * The month IS taken from the request, and the three rules a schema cannot check
 * are enforced here: it may not be later than today on the owner's calendar, it
 * may not precede the month the account starts, and a range may not end before
 * it begins. A month is a text bound of the form 'YYYY-MM-01', so `<` and `>`
 * compare chronologically and nothing below parses a date.
 *
 * @param {object} allocation - { amount, month, appliesUntil }, already coerced
 *  by the validator. appliesUntil is a month or OPEN_ENDED.
 * @returns {Promise<object>} what was written, what the range gives back to, and
 *  the months it replaced.
 */
async function setCurrentMonthBudget(
 pool,
 userId,
 accountId,
 allocation,
 timeZone = 'UTC',
) {
 const { amount, month, appliesUntil } = allocation;

 // Checked before a connection is taken: it reads no row and no calendar, so a
 // range that contradicts itself costs nothing to reject.
 if (appliesUntil !== OPEN_ENDED && appliesUntil < month) {
  throw unprocessable(
   `appliesUntil (${appliesUntil}) must not be earlier than month (${month}).`,
  );
 }

 const client = await pool.connect();

 try {
  await client.query('BEGIN');

  const account = await lockOwnedAccount(client, userId, accountId, timeZone);
  const { month: currentMonth } = await resolveCurrentMonth(client, timeZone);

  // The same rule a read is held to: V1 has no future to write into either. A
  // later month would be a budget with no spending to compare it against, and
  // the range that reaches it is appliesUntil, not this bound.
  if (month > currentMonth) {
   throw unprocessable(
    `month (${month}) must not be later than the current month (${currentMonth}).`,
   );
  }

  // Before the account existed there is nothing to budget. A row dated earlier
  // would also outrank the first allocation and silently take over the months
  // between, which no screen would ever show.
  if (month < account.account_start_month) {
   throw unprocessable(
    `month (${month}) is earlier than the account start month (${account.account_start_month}).`,
   );
  }

  const written = await writeAllocation(
   client,
   accountId,
   normalizeAmount(amount),
   month,
   appliesUntil === OPEN_ENDED ? null : appliesUntil,
  );

  await client.query('COMMIT');

  // appliesUntil is echoed in the caller's own vocabulary rather than as the
  // null the repository speaks, so the response reads back as the request.
  return {
   accountId: written.accountId,
   budgetMonth: written.budgetMonth,
   budgetAmount: written.budgetAmount,
   appliesUntil,
   restoresTo: written.restoresTo,
   restoresFrom: written.restoresFrom,
   overwrittenMonths: written.overwrittenMonths,
  };
 } catch (error) {
  await client.query('ROLLBACK');
  throw error;
 } finally {
  client.release();
 }
}

export const budgetAllocationService = {
 createAllocationForAccount,
 applyAllocationForAccount,
 setCurrentMonthBudget,
};
