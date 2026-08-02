// backend/src/fintrack_api/services/budget_services/services/budgetPolicyService.js
// Write path for budget policies. Reads live in budgetTransactionRepository.js.
//
// Allocations are SCD Type 2: a change never overwrites. The active row is
// closed (valid_until = NOW()) and a new one opened, so every past budget
// stays queryable. `valid_until IS NULL` marks the active version — there is
// no redundant flag to keep in sync.

import { withTransaction } from '../../../../utils/withTransaction.js';
import { ALLOWED_FREQUENCIES, DEFAULT_FREQUENCY } from '../core/budgetConfig.js';

const forbidden = (message) =>
 Object.assign(new Error(message), { status: 403 });

const badRequest = (message) =>
 Object.assign(new Error(message), { status: 400 });

/**
 * Reject an allocation the database would reject anyway, with a usable message.
 *
 * budget_amount mirrors CHECK (budget_amount > 0). The frequency code is
 * resolved by a subquery that yields NULL for an unknown code, which the NOT
 * NULL column reports as a 500; checking here makes both a 400.
 */
const assertAllocationInput = (budgetAmount, budgetFrequencyCode) => {
 if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
  throw badRequest('budgetAmount must be a number greater than 0.');
 }

 if (!ALLOWED_FREQUENCIES.includes(budgetFrequencyCode)) {
  throw badRequest(`budgetFrequencyCode must be one of: ${ALLOWED_FREQUENCIES.join(', ')}.`);
 }
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
 * Close the active allocation of a policy and open its replacement.
 *
 * Both statements must run on the same client. Split across two transactions, a
 * failure between them leaves the policy with zero active rows (the budget
 * disappears) or two (getBudgetDataForAccounts returns duplicate rows per
 * account and Overview totals double, with no error raised).
 *
 * @returns {Promise<object>} the newly created allocation row.
 */
const replaceActiveAllocation = async (
 client,
 budgetPolicyId,
 budgetAmount,
 budgetFrequencyCode,
) => {
 // NOW() is transaction-scoped in Postgres, so the close and the open share
 // one timestamp. That is intended: the history has no gap between versions.
 await client.query(
  `UPDATE budget_policy_allocations
      SET valid_until = NOW()
    WHERE budget_policy_id = $1
      AND valid_until IS NULL`,
  [budgetPolicyId],
 );

 // The code is resolved in the INSERT itself. A separate lookup would be a
 // second roundtrip for a value the same transaction is about to use.
 const { rows } = await client.query(
  `INSERT INTO budget_policy_allocations
     (budget_policy_id, budget_amount, budget_frequency_type_id, valid_from)
   VALUES ($1, $2,
    (SELECT budget_frequency_type_id FROM budget_frequency_types
      WHERE budget_frequency_code = $3),
    NOW())
   RETURNING budget_allocation_id,
    budget_policy_id,
    budget_amount,
    budget_frequency_type_id,
    valid_from,
    valid_until`,
  [budgetPolicyId, budgetAmount, budgetFrequencyCode],
 );

 return {
  budgetAllocationId: rows[0].budget_allocation_id,
  budgetPolicyId: rows[0].budget_policy_id,
  budgetAmount: parseFloat(rows[0].budget_amount),
  budgetFrequencyTypeId: rows[0].budget_frequency_type_id,
  budgetFrequencyCode,
  validFrom: rows[0].valid_from,
  validUntil: rows[0].valid_until,
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
) {
 assertAllocationInput(budgetAmount, budgetFrequencyCode);

 return withTransaction(pool, async (client) => {
  await lockOwnedPolicy(client, userId, budgetPolicyId);

  return replaceActiveAllocation(client, budgetPolicyId, budgetAmount, budgetFrequencyCode);
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
 * for the months between its start and its creation.
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
 assertAllocationInput(budgetAmount, budgetFrequencyCode);

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
  [budgetPolicyId, budgetAmount, budgetFrequencyCode, validFrom],
 );

 return {
  budgetPolicyId,
  budgetAllocationId: rows[0].budget_allocation_id,
  budgetAmount: parseFloat(rows[0].budget_amount),
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

 assertAllocationInput(budgetAmount, targetCode);

 if (!current.budget_policy_id) {
  return createBudgetPolicyForAccount(
   client,
   accountId,
   budgetAmount,
   targetCode,
   current.account_start_date,
  );
 }

 if (
  current.budget_allocation_id
  && Number(current.budget_amount) === budgetAmount
  && current.budget_frequency_code === targetCode
 ) {
  return null;
 }

 return replaceActiveAllocation(client, current.budget_policy_id, budgetAmount, targetCode);
}

/**
 * Every version of a policy's allocation, newest first.
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
     a.valid_until
    FROM budget_policy_allocations a
    JOIN budget_policies bp ON bp.budget_policy_id = a.budget_policy_id
    JOIN user_accounts ua ON ua.account_id = bp.account_id
    JOIN budget_frequency_types bft
      ON bft.budget_frequency_type_id = a.budget_frequency_type_id
   WHERE a.budget_policy_id = $1
     AND ua.user_id = $2
   ORDER BY a.valid_from DESC`,
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
  budgetAmount: parseFloat(row.budget_amount),
  budgetFrequencyTypeId: row.budget_frequency_type_id,
  budgetFrequencyCode: row.budget_frequency_code,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  isActive: row.valid_until === null,
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
