// backend/src/fintrack_api/services/budget_services/services/budgetPolicyService.js
// Write path for budget policies. Reads live in budgetTransactionRepository.js.
//
// Allocations are SCD Type 2: a change never overwrites. The active row is
// closed (valid_until = NOW()) and a new one opened, so every past budget
// stays queryable. `valid_until IS NULL` marks the active version — there is
// no redundant flag to keep in sync.

import { withTransaction } from '../../../../utils/withTransaction.js';
import { ALLOWED_FREQUENCIES } from '../core/budgetConfig.js';

const forbidden = (message) =>
 Object.assign(new Error(message), { status: 403 });

const badRequest = (message) =>
 Object.assign(new Error(message), { status: 400 });

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
 * Replace the active allocation of a policy with a new version.
 *
 * Closing the old row and opening the new one happen in ONE transaction. Split
 * across two, a failure between them leaves the policy with zero active rows
 * (the budget disappears) or two (getBudgetDataForAccounts returns duplicate
 * rows per account and Overview totals double, with no error raised).
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
 // Mirrors CHECK (budget_amount > 0). Validating here turns a constraint
 // violation into a 400 with a usable message instead of a 500.
 if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
  throw badRequest('budgetAmount must be a number greater than 0.');
 }

 // The subquery below resolves an unknown code to NULL, which the NOT NULL
 // column reports as a 500. Checking here turns it into a 400.
 if (!ALLOWED_FREQUENCIES.includes(budgetFrequencyCode)) {
  throw badRequest(`budgetFrequencyCode must be one of: ${ALLOWED_FREQUENCIES.join(', ')}.`);
 }

 return withTransaction(pool, async (client) => {
  await lockOwnedPolicy(client, userId, budgetPolicyId);

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
 });
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
 updateBudgetAllocation,
 getBudgetAllocationHistory,
 getFrequencyCatalog,
};
