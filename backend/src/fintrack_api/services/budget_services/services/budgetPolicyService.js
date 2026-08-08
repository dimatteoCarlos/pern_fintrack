// backend/src/fintrack_api/services/budget_services/services/budgetPolicyService.js
// Write path for budget policies. Reads live in budgetTransactionRepository.js.
//
// Allocations are SCD Type 2: a change never overwrites. The active row is
// closed and a new one opened, so every past budget stays queryable.
// `valid_until IS NULL` marks the active version — there is no redundant flag
// to keep in sync.
//
// Every boundary written here is a canonical period boundary, never an instant.
// A budget belongs to a period, so closing one version at NOW() and opening the
// next at the same instant splits that period in two fragments, and a quarterly
// budget then prices each fragment at floor(1/3) = 0.

import { withTransaction } from '../../../../utils/withTransaction.js';
import { resolvePeriod } from '../../../../utils/fintrackUtils/date-utils/periodResolver.js';
import {
 ALLOWED_ALLOCATION_FREQUENCIES,
 DEFAULT_ALLOCATION_INTENT,
 DEFAULT_FREQUENCY,
} from '../core/budgetConfig.js';
import {
 MINIMUM_AMOUNT,
 isFiniteMoney,
 isWithinAmountRange,
 money,
 toAmount,
} from '../core/money.js';

const forbidden = (message) =>
 Object.assign(new Error(message), { status: 403 });

const badRequest = (message) =>
 Object.assign(new Error(message), { status: 400 });

/**
 * Validate an allocation and return the amount in its storable form.
 *
 * This is the entry boundary of ROUNDING-POLICY.md: the single choke point for
 * the three write paths, so nothing below it ever sees an unnormalized amount.
 *
 * budget_amount mirrors CHECK (budget_amount > 0). The frequency code is
 * resolved by a subquery that yields NULL for an unknown code, which the NOT
 * NULL column reports as a 500; checking here makes both a 400.
 *
 * @returns {number} the amount rounded to the scale of the column.
 */
const normalizeAllocationInput = (budgetAmount, budgetFrequencyCode) => {
 if (!isFiniteMoney(budgetAmount)) {
  throw badRequest('budgetAmount must be a number greater than 0.');
 }

 // Magnitude cannot be normalized, only truncated, so it is rejected (P5).
 if (!isWithinAmountRange(budgetAmount)) {
  throw badRequest('budgetAmount exceeds the maximum storable amount.');
 }

 // Extra decimals are over-specified, not invalid: the form typed no digit
 // limit. Rounding once here is what lets the no-op guard below compare
 // exactly, instead of leaving Postgres to round in the cast.
 const normalizedAmount = toAmount(budgetAmount);

 // Checked after normalizing: 0.004 is positive but stores as 0.00, which the
 // CHECK constraint would surface as a 500 instead of a message.
 if (normalizedAmount <= 0) {
  // Two different mistakes, and "greater than 0" only describes one of them.
  // A sub-cent amount is positive on screen, so naming the minimum is the only
  // way the caller learns what to correct.
  throw badRequest(
   money(budgetAmount).greaterThan(0)
    ? `budgetAmount must be at least ${MINIMUM_AMOUNT} in the account currency.`
    : 'budgetAmount must be a number greater than 0.',
  );
 }

 if (!ALLOWED_ALLOCATION_FREQUENCIES.includes(budgetFrequencyCode)) {
  throw badRequest(
   `budgetFrequencyCode must be one of: ${ALLOWED_ALLOCATION_FREQUENCIES.join(', ')}.`,
  );
 }

 return normalizedAmount;
};

/**
 * Resolve a policy the caller owns, locking it for the rest of the transaction.
 *
 * Ownership is proven by joining through to user_accounts.user_id rather than
 * trusting the caller's budgetPolicyId. FOR UPDATE closes the window between
 * the check and the write: without the lock two concurrent updates could both
 * observe one active allocation and both insert a replacement.
 */
const lockOwnedPolicy = async (client, userId, budgetPolicyId) => {
 const { rows } = await client.query(
  `SELECT bp.budget_policy_id
     FROM budget_policies bp
     JOIN user_accounts ua ON ua.account_id = bp.account_id
    WHERE bp.budget_policy_id = $1
      AND ua.user_id = $2
      FOR UPDATE OF bp`,
  [budgetPolicyId, userId],
 );

 if (rows.length === 0) {
  // Deliberately not 404. Distinguishing "does not exist" from "not yours"
  // would let a caller enumerate other users' policy IDs.
  throw forbidden('Budget policy not found or not owned by the authenticated user.');
 }

 return rows[0].budget_policy_id;
};

/**
 * The instant where the outgoing version ends and the incoming one begins.
 *
 * One boundary for both rows, so the timeline has neither a gap nor an overlap.
 *
 * A correction returns the replaced version to its own start: it spans zero
 * time, the read predicate (valid_until > date) can never find it, and the
 * record keeps it while stating that it never governed anything (PLAN_F 5.3).
 * A version not yet in force is closed the same way whatever the intent — there
 * is nothing to preserve in a period it never priced.
 *
 * A change ends the period in progress under the frequency that is governing
 * it, not the incoming one: a quarter already under way finishes as a quarter.
 */
const resolveReplacementBoundary = (active, intent, now) => {
 if (intent === 'correct' || active.valid_from > now) {
  return active.valid_from;
 }

 // end is the first day after the period, which is exactly the next period's
 // start: the boundary needs no arithmetic of its own.
 return resolvePeriod(active.budget_frequency_code, now).end;
};

/**
 * Close the active allocation of a policy and open its replacement.
 *
 * Both statements must run on the same client. Split across two transactions, a
 * failure between them leaves the policy with zero active rows (the budget
 * disappears) or two (getBudgetDataForAccounts returns duplicate rows per
 * account and Overview totals double, with no error raised).
 *
 * @param {string} intent - 'correct' replaces the version in place, 'change'
 *  opens the next period. See ALLOCATION_INTENTS.
 * @returns {Promise<object>} the newly created allocation row.
 */
const replaceActiveAllocation = async (
 client,
 budgetPolicyId,
 budgetAmount,
 budgetFrequencyCode,
 intent,
) => {
 const now = new Date();

 // Read before writing: the boundary depends on the outgoing row's own start
 // and frequency, which the UPDATE is about to overwrite.
 const { rows: activeRows } = await client.query(
  `SELECT a.valid_from, bft.budget_frequency_code
     FROM budget_policy_allocations a
     JOIN budget_frequency_types bft
       ON bft.budget_frequency_type_id = a.budget_frequency_type_id
    WHERE a.budget_policy_id = $1
      AND a.valid_until IS NULL`,
  [budgetPolicyId],
 );

 const active = activeRows[0] ?? null;

 // No active row means nothing to supersede, so the amount comes into force at
 // the start of the period containing today, the same rule Create follows.
 const boundary = active
  ? resolveReplacementBoundary(active, intent, now)
  : resolvePeriod(budgetFrequencyCode, now).start;

 if (active) {
  await client.query(
   `UPDATE budget_policy_allocations
       SET valid_until = $2,
        close_reason = $3
     WHERE budget_policy_id = $1
       AND valid_until IS NULL`,
   [budgetPolicyId, boundary, intent === 'correct' ? 'corrected' : 'superseded'],
  );
 }

 // The code is resolved in the INSERT itself. A separate lookup would be a
 // second roundtrip for a value the same transaction is about to use.
 const { rows } = await client.query(
  `INSERT INTO budget_policy_allocations
     (budget_policy_id, budget_amount, budget_frequency_type_id, valid_from)
   VALUES ($1, $2,
    (SELECT budget_frequency_type_id FROM budget_frequency_types
      WHERE budget_frequency_code = $3),
    $4)
   RETURNING budget_allocation_id,
    budget_policy_id,
    budget_amount,
    budget_frequency_type_id,
    valid_from,
    valid_until`,
  [budgetPolicyId, budgetAmount, budgetFrequencyCode, boundary],
 );

 return {
  budgetAllocationId: rows[0].budget_allocation_id,
  budgetPolicyId: rows[0].budget_policy_id,
  budgetAmount: toAmount(rows[0].budget_amount),
  budgetFrequencyTypeId: rows[0].budget_frequency_type_id,
  budgetFrequencyCode,
  validFrom: rows[0].valid_from,
  validUntil: rows[0].valid_until,
  // Echoed so the caller can word the confirmation without re-deriving what it
  // asked for; validFrom is the date the new amount starts governing.
  intent,
 };
};

/**
 * Replace the active allocation of a policy the caller owns.
 *
 * Owns its transaction: this is the entry point for PUT /budget/policy/:id,
 * where no other write is in flight.
 *
 * @returns {Promise<object>} the newly created allocation row.
 */
async function updateBudgetAllocation(
 pool,
 userId,
 budgetPolicyId,
 budgetAmount,
 budgetFrequencyCode,
 intent = DEFAULT_ALLOCATION_INTENT,
) {
 const normalizedAmount = normalizeAllocationInput(budgetAmount, budgetFrequencyCode);

 return withTransaction(pool, async (client) => {
  await lockOwnedPolicy(client, userId, budgetPolicyId);

  return replaceActiveAllocation(
   client,
   budgetPolicyId,
   normalizedAmount,
   budgetFrequencyCode,
   intent,
  );
 });
}

/**
 * Open a policy and its first allocation for a newly created budget account.
 *
 * Takes a client, not a pool: account creation already owns a transaction, and
 * a policy committed on its own connection would outlive a rollback of the very
 * account it belongs to.
 *
 * validFrom is the account start date, not NOW(). The amount comes into force
 * when the account does; a backdated account would otherwise report zero budget
 * for the months between its start and its creation. It is snapped to the start
 * of the period containing that date, because the first version has to cover
 * the whole period it opens or the account's first quarter prices at zero.
 *
 * @returns {Promise<object>} the policy and allocation just created.
 */
async function createBudgetPolicyForAccount(
 client,
 accountId,
 budgetAmount,
 budgetFrequencyCode,
 validFrom,
) {
 // Normalizing again when applyAllocationForAccount routes here is harmless:
 // rounding an already-rounded amount is idempotent.
 const normalizedAmount = normalizeAllocationInput(budgetAmount, budgetFrequencyCode);

 // new Date() accepts both the Date the edit path passes and the ISO string the
 // creation controller reads from the request body.
 const alignedFrom = resolvePeriod(budgetFrequencyCode, new Date(validFrom)).start;

 const { rows: policyRows } = await client.query(
  `INSERT INTO budget_policies (account_id)
     VALUES ($1)
  RETURNING budget_policy_id`,
  [accountId],
 );

 const budgetPolicyId = policyRows[0].budget_policy_id;

 const { rows } = await client.query(
  `INSERT INTO budget_policy_allocations
     (budget_policy_id, budget_amount, budget_frequency_type_id, valid_from)
   VALUES ($1, $2,
    (SELECT budget_frequency_type_id FROM budget_frequency_types
      WHERE budget_frequency_code = $3),
    $4)
   RETURNING budget_allocation_id,
    budget_amount,
    budget_frequency_type_id,
    valid_from`,
  [budgetPolicyId, normalizedAmount, budgetFrequencyCode, alignedFrom],
 );

 return {
  budgetPolicyId,
  budgetAllocationId: rows[0].budget_allocation_id,
  budgetAmount: toAmount(rows[0].budget_amount),
  budgetFrequencyTypeId: rows[0].budget_frequency_type_id,
  budgetFrequencyCode,
  validFrom: rows[0].valid_from,
 };
}

/**
 * Apply a budget change made through the account editor, keyed by account.
 *
 * Takes a client for the same reason createBudgetPolicyForAccount does: account
 * edition already owns a transaction, and the amount written to the legacy
 * cba.budget column must commit or roll back together with the allocation.
 *
 * An account with no policy gets one, dated from the account start. That covers
 * every account created before the policy tables existed and every row the 010
 * backfill skipped: the first edit repairs them instead of leaving them
 * invisible to the read path forever.
 *
 * @returns {Promise<object|null>} the new allocation, or null when nothing
 *  changed — the edit form resends the budget on every save, and versioning an
 *  unchanged amount would add a history row per save and move valid_from
 *  forward, re-pricing months that were already settled.
 */
async function applyAllocationForAccount(
 client,
 userId,
 accountId,
 budgetAmount,
 budgetFrequencyCode = null,
 intent = DEFAULT_ALLOCATION_INTENT,
) {
 // FOR UPDATE OF ua serializes concurrent edits of the same account: without
 // it two saves could both read one active allocation and both open a
 // replacement, breaching uq_budget_allocation_active.
 const { rows } = await client.query(
  `SELECT ua.account_start_date,
     p.budget_policy_id,
     a.budget_allocation_id,
     a.budget_amount,
     bft.budget_frequency_code
    FROM user_accounts ua
    LEFT JOIN budget_policies p ON p.account_id = ua.account_id
    LEFT JOIN budget_policy_allocations a
      ON a.budget_policy_id = p.budget_policy_id
     AND a.valid_until IS NULL
    LEFT JOIN budget_frequency_types bft
      ON bft.budget_frequency_type_id = a.budget_frequency_type_id
   WHERE ua.account_id = $1
     AND ua.user_id = $2
     FOR UPDATE OF ua`,
  [accountId, userId],
 );

 if (rows.length === 0) {
  throw forbidden('Account not found or not owned by the authenticated user.');
 }

 const current = rows[0];
 // An edit that does not mention the frequency keeps the one in force. Falling
 // back to the default instead would silently reset a quarterly budget to
 // monthly every time the user changed only the amount.
 const targetCode =
  budgetFrequencyCode ?? current.budget_frequency_code ?? DEFAULT_FREQUENCY;

 const normalizedAmount = normalizeAllocationInput(budgetAmount, targetCode);

 if (!current.budget_policy_id) {
  return createBudgetPolicyForAccount(
   client,
   accountId,
   normalizedAmount,
   targetCode,
   current.account_start_date,
  );
 }

 // Both sides are already at the column's scale, so this compares exactly and
 // rounds nothing: the incoming amount was normalized on entry, and the stored
 // one is read through toAmount rather than parseFloat.
 //
 // Compared against the latest version, which after a deferred change is the
 // one not yet in force. That is the intended reading: resending the pending
 // figure asks for nothing new, while resending the one still in force is a
 // request to drop the pending change, and must version.
 if (
  current.budget_allocation_id
  && toAmount(current.budget_amount) === normalizedAmount
  && current.budget_frequency_code === targetCode
 ) {
  return null;
 }

 return replaceActiveAllocation(
  client,
  current.budget_policy_id,
  normalizedAmount,
  targetCode,
  intent,
 );
}

/**
 * Every version of a policy's allocation, newest first.
 *
 * closeReason is what makes the list readable. A correction and a forward
 * change leave the same shape otherwise, and two versions over one period with
 * nothing saying why is worse than no history at all.
 *
 * @returns {Promise<Array<object>>}
 */
async function getBudgetAllocationHistory(pool, userId, budgetPolicyId) {
 const { rows } = await pool.query(
  `SELECT a.budget_allocation_id,
     a.budget_policy_id,
     a.budget_amount,
     a.budget_frequency_type_id,
     bft.budget_frequency_code,
     a.valid_from,
     a.valid_until,
     a.close_reason
    FROM budget_policy_allocations a
    JOIN budget_policies bp ON bp.budget_policy_id = a.budget_policy_id
    JOIN user_accounts ua ON ua.account_id = bp.account_id
    JOIN budget_frequency_types bft
      ON bft.budget_frequency_type_id = a.budget_frequency_type_id
   WHERE a.budget_policy_id = $1
     AND ua.user_id = $2
   ORDER BY a.valid_from DESC, a.budget_allocation_id DESC`,
  [budgetPolicyId, userId],
 );

 // An empty result means the policy is missing OR not owned. Same reasoning as
 // lockOwnedPolicy: do not let the response distinguish the two.
 if (rows.length === 0) {
  throw forbidden('Budget policy not found or not owned by the authenticated user.');
 }

 return rows.map((row) => ({
  budgetAllocationId: row.budget_allocation_id,
  budgetPolicyId: row.budget_policy_id,
  budgetAmount: toAmount(row.budget_amount),
  budgetFrequencyTypeId: row.budget_frequency_type_id,
  budgetFrequencyCode: row.budget_frequency_code,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  isActive: row.valid_until === null,
  closeReason: row.close_reason,
  // A version closed at its own start priced nothing. Derived here rather than
  // left to the client, which would have to compare two dates to learn it.
  neverInForce:
   row.valid_until !== null
   && row.valid_until.getTime() === row.valid_from.getTime(),
 }));
}

/**
 * The active frequency catalog, in display order.
 *
 * Serving it lets the UI build its selector from the database instead of a
 * hard-coded list of surrogate ids.
 */
async function getFrequencyCatalog(pool) {
 const { rows } = await pool.query(
  `SELECT budget_frequency_type_id,
    budget_frequency_code,
    budget_frequency_name,
    sort_order
   FROM budget_frequency_types
   WHERE is_active = TRUE
   ORDER BY sort_order ASC`,
 );

 return rows.map((row) => ({
  budgetFrequencyTypeId: row.budget_frequency_type_id,
  budgetFrequencyCode: row.budget_frequency_code,
  budgetFrequencyName: row.budget_frequency_name,
  sortOrder: row.sort_order,
 }));
}

export const budgetPolicyService = {
 createBudgetPolicyForAccount,
 applyAllocationForAccount,
 updateBudgetAllocation,
 getBudgetAllocationHistory,
 getFrequencyCatalog,
};
