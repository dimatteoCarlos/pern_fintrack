// backend/src/utils/fintrackUtils/accountDeletionUtils/accountErasability.js

/**
 * Whether an account can be removed physically without destroying anything that
 * is not its own.
 *
 * WHAT THIS IS FOR. An account opened by mistake and never used has no history
 * worth preserving, and marking it closed leaves a permanent row in every
 * historical read for something that never happened. CLOSE keeps the row for
 * every account that has a past; this decides which accounts have none.
 *
 * THE DATABASE IS NOT THE GUARD, AND THAT IS THE REASON THIS FILE EXISTS.
 * Measured on `fintrack_dev` 2026-09-18: every foreign key that would have
 * blocked the removal - `transactions.account_id`, its three other account
 * columns, `pocket_allocations.source_account_id`,
 * `budget_monthly_allocations.account_id` and
 * `debtor_accounts.selected_account_id` - points at `account_registry` and not
 * at `user_accounts`, all of them RESTRICT. The only keys still naming
 * `user_accounts` are the four extension tables, all CASCADE. So
 * `DELETE FROM user_accounts` never fails on a reference. Migration 035 moved
 * every block onto the archive, which means the condition has to be stated in
 * code or it is not stated at all.
 *
 * THE WARNING THIS ANSWERS. `eraseAccountTail.js:104-114` records that
 * `insertAllocation` writes to `pocket_allocations` and emits nothing into
 * `transactions`, so an account can be backing savings pockets while its sole
 * ledger row is its own opening: "Any precondition for physical removal that is
 * stated over transaction rows alone admits exactly that account." Three of the
 * five tests below are there for that reason and none of them reads
 * `transactions`.
 *
 * WHAT IS DELIBERATELY NOT A TEST.
 *
 * **The balance.** An account whose only row is its own opening holds exactly
 * its starting amount, and test 2 having passed means no other account funded
 * it - the figure was declared, never moved. Removing it takes that amount out
 * of the owner's net worth, which is the correct outcome for an account that
 * should not have existed. The figure is published in the result so the screen
 * can say the number before the owner confirms; it does not block.
 *
 * **The account's name appearing in another row's description.** The erasure
 * tail rewrites descriptions because a row that referenced the account keeps the
 * name after its key is nulled. Test 2 passing means no such row exists, and
 * what would be left is coincidence: an account named `Ahorros` blocked because
 * an unrelated note says "ahorros". A text match is not a reference.
 *
 * **Being already closed.** That is the close's own guard and answers a
 * different question. This function is asked of live accounts and of closed ones
 * alike, and says the same thing about both.
 *
 * **A category's first budget month.** Creating a category budget always writes
 * one row into `budget_monthly_allocations` - the reason is at
 * `accountCategoryCreationcontroller.js:349-353`: every read path resolves the
 * amount from that table, so an account created without one came back as
 * unbudgeted whatever the owner typed. Counting that row as history would make
 * the type most often created by mistake the one type that can never be removed.
 * It is the same kind of row as the opening transaction test 1 already excludes:
 * written by the creation path, meaningless without the account, destroyed with
 * it. A SECOND month is not - it means the owner carried the category forward,
 * and that is a decision with a past. Carlos, 2026-09-19.
 *
 * ONE STATEMENT AND NOT FIVE. The five counts are scalar subqueries of a single
 * query so the answer is one snapshot of the database. Five statements can
 * straddle a concurrent write and produce a verdict that was never true of any
 * single moment.
 *
 * THE REFERENCE COUNTS ARE NOT SCOPED TO THE OWNER, and the account read is.
 * Account ids are unique across users, so a row belonging to somebody else
 * cannot legitimately name this account - and if one does, that is a broken
 * invariant and the right answer is to refuse the removal rather than to filter
 * the evidence out of the count.
 *
 * ADVISORY BEFORE THE TRANSACTION, DECISIVE INSIDE IT. The assessment endpoint
 * calls this on the pool so the screen can warn; the close calls it again on its
 * own client, after the row lock, and acts on that second answer. Between the
 * two a transfer can be written against the account. The last line of defence is
 * the database itself: `account_registry` is the RESTRICT target of every one of
 * those keys, so a delete that raced a reference fails loudly instead of
 * succeeding over a dangling one.
 */

// movement_types.movement_type_id, the 'account-opening' row. The same id
// derivedBalance.js names; declared there as
// ACCOUNT_OPENING_MOVEMENT_TYPE_ID and imported rather than repeated.
import { ACCOUNT_OPENING_MOVEMENT_TYPE_ID } from '../accountDataRetrieval/derivedBalance.js';

// How many budget months a category carries before the owner has decided
// anything. Exactly one, written by the creation path itself, and it is the
// budget's counterpart to the opening transaction. Named rather than written as
// a bare `> 1`, which leaves the next reader asking which month that is.
const BUDGET_MONTHS_WRITTEN_AT_CREATION = 1;

/**
 * @typedef {object} ErasabilityVerdict
 * @property {boolean} isErasable - true when all five tests pass
 * @property {string[]} blockers - one sentence per failed test, empty when erasable
 * @property {object} counts - the raw figures the verdict was formed from
 * @property {number} counts.ownMovements - own ledger rows that are not its own opening
 * @property {number} counts.referencedByOtherAccounts - rows on other accounts naming it
 * @property {number} counts.pocketAllocations - savings-pocket commitments it backs
 * @property {number} counts.budgetMonths - budget months recorded against it, the
 *  first of which is written by the creation path and does not block
 * @property {number} counts.namedByDebtors - debtor accounts holding it as counterparty
 * @property {string} accountName - read from the database, never from the request
 * @property {string} startingAmount - what removing it takes out of net worth
 */

/**
 * Ask whether an account can be removed physically.
 *
 * @param {import('pg').PoolClient | import('pg').Pool} client - the pool for an
 *  advisory read, or the transaction's own client when the close is deciding
 * @param {string} userId - UUID from the token; the account read is scoped to it
 * @param {number} accountId - the account being assessed
 * @returns {Promise<ErasabilityVerdict | null>} null when the owner has no such
 *  account, which is not a verdict and must not be read as one
 */
export const assessAccountErasability = async (client, userId, accountId) => {
 const { rows } = await client.query({
  text: `
    SELECT
      ua.account_name,
      ua.account_starting_amount::text AS starting_amount,

      -- 1. Its own ledger rows, excluding the row that opens it. The exclusion
      -- is one row and not one movement type: a leg of type ${ACCOUNT_OPENING_MOVEMENT_TYPE_ID}
      -- sitting on this account with opening_for_account_id pointing somewhere
      -- else is this account FUNDING another account's opening, which is a real
      -- outflow and counts as a movement. derivedBalance.js:29-41 is where that
      -- distinction was measured and why the column exists.
      (SELECT COUNT(*)::int
         FROM transactions t
        WHERE t.account_id = ua.account_id
          AND NOT (t.movement_type_id = $3
                   AND t.opening_for_account_id = ua.account_id)
      ) AS own_movements,

      -- 2. Rows belonging to OTHER accounts that name this one. A transfer's
      -- counterpart leg, the debit leg of an opening this account funded, and
      -- the compensation account's half of a balance reversal all land here.
      -- An account that needed a reversal to reach zero is therefore never
      -- erasable, with no rule of its own: the reversal wrote that row.
      (SELECT COUNT(*)::int
         FROM transactions t
        WHERE t.account_id <> ua.account_id
          AND (t.source_account_id = ua.account_id
            OR t.destination_account_id = ua.account_id
            OR t.opening_for_account_id = ua.account_id
            OR t.reversal_of_account_id = ua.account_id)
      ) AS referenced_by_other_accounts,

      -- 3. Savings-pocket commitments this account backs. No transaction row
      -- stands in their place, which is the whole point of testing them here.
      (SELECT COUNT(*)::int
         FROM pocket_allocations p
        WHERE p.source_account_id = ua.account_id
      ) AS pocket_allocations,

      -- 4. Budget months recorded against it. Same shape as the pockets: the
      -- rows exist with no ledger row to reveal them. Counted in full here and
      -- compared against the one the creation path writes, below - the SQL
      -- reports what is there and the verdict decides what it means.
      (SELECT COUNT(*)::int
         FROM budget_monthly_allocations b
        WHERE b.account_id = ua.account_id
      ) AS budget_months,

      -- 5. Debtor accounts holding this one as their designated counterparty.
      -- The column is nullable with no ledger row behind it, so an account can
      -- be somebody's counterparty having never moved a cent.
      (SELECT COUNT(*)::int
         FROM debtor_accounts d
        WHERE d.selected_account_id = ua.account_id
      ) AS named_by_debtors

    FROM user_accounts ua
    WHERE ua.account_id = $1
      AND ua.user_id = $2`,
  values: [accountId, userId, ACCOUNT_OPENING_MOVEMENT_TYPE_ID],
 });

 // No row is not a verdict. The caller decides what an account it does not own
 // means for the operation it is running; answering false here would tell it
 // the account exists and is not erasable, which is a different and untrue
 // thing.
 if (rows.length === 0) return null;

 const row = rows[0];

 const counts = {
  ownMovements: row.own_movements,
  referencedByOtherAccounts: row.referenced_by_other_accounts,
  pocketAllocations: row.pocket_allocations,
  budgetMonths: row.budget_months,
  namedByDebtors: row.named_by_debtors,
 };

 // Every failed test is reported, not just the first. The owner asking why an
 // account will not disappear deserves the whole answer, and a screen that can
 // only show one reason sends them round the loop once per reason.
 const blockers = [];

 if (counts.ownMovements > 0) {
  blockers.push(
   `The account has ${counts.ownMovements} movement(s) of its own beyond its opening.`,
  );
 }
 if (counts.referencedByOtherAccounts > 0) {
  blockers.push(
   `${counts.referencedByOtherAccounts} movement(s) on other accounts name this one.`,
  );
 }
 if (counts.pocketAllocations > 0) {
  blockers.push(
   `The account backs ${counts.pocketAllocations} savings pocket commitment(s).`,
  );
 }
 // The one month creation writes does not block; a second one does. The account
 // that has never been carried into another month has a plan and no past.
 if (counts.budgetMonths > BUDGET_MONTHS_WRITTEN_AT_CREATION) {
  blockers.push(
   `The account has ${counts.budgetMonths} budget months recorded against it, beyond the one its creation wrote.`,
  );
 }
 if (counts.namedByDebtors > 0) {
  blockers.push(
   `${counts.namedByDebtors} debtor account(s) name this one as their counterparty.`,
  );
 }

 return {
  isErasable: blockers.length === 0,
  blockers,
  counts,
  accountName: row.account_name,
  startingAmount: row.starting_amount,
 };
};

export default assessAccountErasability;
