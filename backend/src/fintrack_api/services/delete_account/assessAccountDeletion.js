// backend/src/fintrack_api/services/delete_account/assessAccountDeletion.js

/**
 * What this account's deletion options are, and what each one costs.
 *
 * Unit 6 of PLAN_ACCOUNT_DELETION.md: one read reachable ahead of ANY deletion
 * type, not one preview per type. The two endpoints that exist today each serve
 * a type that was already chosen - the impact report answers "what will RTA
 * do", the close preview answers "what will CLOSE do" - so the choice between
 * them has to be made before there is anything to base it on. This answers the
 * question that comes first.
 *
 * WHY THE FOUR OPTIONS ARE NOT PARALLEL, which is the thing an owner cannot
 * discover from the endpoints that exist. Hard delete refuses an account whose
 * ledger residual is not zero, for any caller, and its own refusal names RTA as
 * the way to reach zero. So the options form an order, not a menu, and an
 * assessment that listed four equal choices would be lying about three of them.
 *
 * WHY IT TAKES NO LOCK, deliberately, against the unit's own wording. The plan
 * describes the assessment as the lock-then-compute step, and for an execution
 * path that is right - assessDeletionImpact exists for exactly that and RTA
 * calls it. A lock taken here would be released when this request ends, long
 * before the owner confirms anything, so it would cost contention and buy no
 * guarantee. What protects the confirmation is the execution path deriving
 * again under its own lock and refusing on a mismatch, which is already built.
 *
 * WHAT IT DOES NOT DECIDE. Hard delete's erasure scope and revert-to-active are
 * open rulings. This endpoint reports the consequences the code already
 * produces and invents none: every figure here is read from the same service
 * the execution path uses, so a consequence it states is one the engine
 * actually applies.
 */

import {
 getAnnulmentImpactReport,
 getPocketAllocationImpact,
 getUnattributedAnnulmentTotal,
 foldNetAdjustmentTotal,
} from './getAnnulmentImpactReport.js';

import { getClosePreview } from './getClosePreview.js';

import {
 DELETION_TYPE_CLOSE,
 DELETION_TYPE_HARD,
 DELETION_TYPE_RTA,
 DELETION_TYPE_SOFT,
} from '../../controllers/accountDeleteController.js';

/**
 * Assess every deletion type for one live account.
 *
 * @param {object} db - pool; this is a read and takes no lock, see above
 * @param {string} userId
 * @param {number} targetAccountId
 * @returns {Promise<object>} the account, the options, and the pocket backing
 *   that some of those options destroy
 */
export const assessAccountDeletion = async (db, userId, targetAccountId) => {
 // First and alone, because it is the one call that can refuse. It 404s for an
 // account that does not exist, is not this owner's, or is already closed or
 // deleted - and computing an impact report for any of those would be work
 // done to be thrown away. Scoping the assessment to live accounts is also
 // what keeps it honest: a closed account's remaining option is
 // revert-to-active, which has no ruling yet, so listing options for one would
 // mean inventing them.
 const closePreview = await getClosePreview(db, userId, targetAccountId);

 const [impactReport, unattributed, pocketImpact] = await Promise.all([
  getAnnulmentImpactReport(db, userId, targetAccountId),
  getUnattributedAnnulmentTotal(db, userId, targetAccountId),
  getPocketAllocationImpact(db, userId, targetAccountId),
 ]);

 // Text on the way out, because the close confirmation echoes it back and the
 // driver's float conversion would round it in transit. Parsed here only to
 // decide what the engine will allow, never to be published as a number.
 const residual = parseFloat(closePreview.targetAccount.residual);

 // Exact, not a tolerance, and that is the whole point of this comparison. The
 // hard-delete refusal tests parseFloat(balance) !== 0 against a balance
 // derived by lockAndDeriveBalances, which builds it from the same
 // derivedAccountBalanceSql expression the close preview above used. Testing
 // it any other way here would let the assessment offer an option the
 // execution then refuses with a 409 the owner has no way to have predicted.
 const isSettled = residual === 0;

 const canTransfer = closePreview.destinationCount > 0;

 // The part of this account's balance that the annulment's own rows do not
 // account for: the residual, less what RTA will move onto other accounts, less
 // what an earlier deletion already reversed.
 //
 // WHY IT IS EXPECTED TO BE ZERO, and why it is published anyway. The residual
 // and the impact report are computed from different sources - the residual is
 // the stored account_starting_amount column plus the account's rows with its
 // own opening zeroed, the report sums rows whose two key columns differ. They
 // agree by construction, because the column adds back exactly what the zeroing
 // removes, not because anything enforces it. A figure that is zero by
 // construction is worth publishing precisely so a reader sees when it stops
 // being zero.
 //
 // RETRACTED 2026-09-07, by the session that wrote it: this comment used to
 // claim a reachable case - an account opened with a starting amount whose
 // opening row names itself as both source and destination. That combination
 // cannot occur: a self-referential opening implies a zero starting amount, and
 // a funded one names the compensation account. No reachable case is claimed
 // here now.
 //
 // The implication holds through two different mechanisms and not the one
 // written here first (pern-fintrack-02, checked in the writers). On the
 // category-budget path it is the transaction type: an opening row is made
 // self-referential only for type 'account-opening', which is returned only for
 // an amount of exactly zero. On the bank, income_source and investment path
 // createBasicAccount inlines both decisions instead - the columns come from its
 // own isTransfer, which IS the nonzero-amount test, while the type is 'deposit'
 // for bank and investment at any amount. A zero-amount bank account therefore
 // has a self-referential opening row typed 'deposit'. Anything gating on this
 // must compare the two columns, not read the type name. Debtor accounts are
 // never self-referential at any amount, since their type is always lend or
 // borrow.
 //
 // Rounded to cents for the same reason the adjustment total is: the three
 // terms are floats and this figure is displayed, never compared.
 const totalNetAdjustmentAmount = foldNetAdjustmentTotal(impactReport);
 const unreversedResidualAmount =
  Math.round(
   (residual - totalNetAdjustmentAmount - unattributed.amount) * 100,
  ) / 100;

 return {
  targetAccount: closePreview.targetAccount,

  // Shared rather than repeated under each option, with each option saying
  // whether it destroys them. Pockets this account backs are the same set
  // whichever type is chosen; what differs is what happens to them.
  pocketImpact,

  options: [
   {
    deletionType: DELETION_TYPE_CLOSE,
    available: true,
    // Settling is what a close IS, not a precondition it can fail: an account
    // holding nothing still closes, it just has no residual to move.
    requiresSettlement: !isSettled,
    destinations: closePreview.destinations,
    destinationCount: closePreview.destinationCount,
    // An owner whose only other bank account of this currency is the one being
    // closed has nowhere to transfer to and must discard. Stated here so the
    // screen can present it as the answer it is, rather than as an empty
    // dropdown the owner reads as a loading failure.
    availablePolicies: canTransfer ? ['DISCARD', 'TRANSFER'] : ['DISCARD'],
    // The account row survives, so its pocket allocations do too - the erasure
    // tail is the only thing that deletes them and a close never runs it. The
    // allocations are then backed by an account settled to zero, which is a
    // consequence worth showing rather than a defect to fix here.
    removesPocketAllocations: false,
    keepsHistory: true,
    // One thing decides whether the name returns to circulation: does a row
    // survive. verifyAccountExistence matches on owner, lowercased name and
    // lowercased type with no state test, and the schema carries no unique
    // index on the name, so any surviving row holds its name against a new
    // creation forever. CLOSE keeps the row, so the name stays taken.
    releasesAccountName: false,
   },
   {
    deletionType: DELETION_TYPE_SOFT,
    available: true,
    // Nothing is settled and nothing is reversed: the account stops
    // circulating while still holding whatever it held. That is the
    // difference from CLOSE, and the reason the residual is worth showing
    // beside this option rather than only beside the close.
    leavesResidualUnsettled: !isSettled,
    removesPocketAllocations: false,
    keepsHistory: true,
    // Was true, and that was a promise the creation guard refuses (found by
    // pern-fintrack-e4, 2026-09-07). Soft delete keeps the row and
    // verifyAccountExistence has no state test, so the name stays taken: an
    // owner told the name was free met "already exists" on the next screen.
    // Only HARD and RTA release one, because only they delete the row.
    releasesAccountName: false,
   },
   {
    deletionType: DELETION_TYPE_RTA,
    available: true,
    impactReport,
    affectedAccountsCount: impactReport.length,
    totalNetAdjustmentAmount,
    // Beside the total, never inside it: an earlier deletion already reversed
    // these amounts, so the execution path acts on none of them.
    unattributedAmount: unattributed.amount,
    unattributedTransactionCount: unattributed.transactionCount,
    // What this option costs the owner and the ledger, which no other field
    // here states. HARD's reason quotes the residual as the reason it is
    // unavailable and names this option as the way forward, so an owner
    // following that instruction must be able to see that this option does not
    // settle the residual - it erases it.
    unreversedResidualAmount,
    erasesUnsettledResidual: unreversedResidualAmount !== 0,
    removesPocketAllocations: true,
    keepsHistory: false,
    releasesAccountName: true,
   },
   {
    deletionType: DELETION_TYPE_HARD,
    available: isSettled,
    // The refusal the engine will raise, quoted before the owner meets it, and
    // naming the route to making it available - which is what makes this an
    // assessment rather than a disabled button. CLOSE leads and RTA follows,
    // matching the engine's own 409: an owner who is done with an account
    // wants the residual moved out, while RTA reverses the account's effect on
    // OTHER accounts and is the answer to a different question.
    reason: isSettled
     ? undefined
     : `This account holds ${closePreview.targetAccount.residual} and cannot be erased until that is settled. Close it to move the residual out, or use RTA instead if the account's effects on other accounts should be reversed.`,
    removesPocketAllocations: true,
    keepsHistory: false,
    releasesAccountName: true,
   },
  ],
 };
};
