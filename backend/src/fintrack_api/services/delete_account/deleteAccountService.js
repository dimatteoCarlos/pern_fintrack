//backend/src/fintrack_api/services/delete_account/deleteAccountService.js

import pc from 'picocolors';
import { pool } from '../../../db/config/configDB.js';
import { createError, handlePostgresError } from '../../../utils/errorHandling.js';

//Constants from controller
// account deletion methods - not all implemented yet
//only implemented DELETION_TYPE_RTA
import {
  ADMIN_ACTION,
  DELETION_TYPE_HARD,
  DELETION_TYPE_SOFT,
  DELETION_TYPE_RTA,
  DELETION_TYPE_CLOSE,
  USER_ACTION,
  // RETIRED 2026-09-08 with the settlement policies:
  // CLOSE_POLICY_DISCARD,
  // CLOSE_POLICY_TRANSFER,
} from '../../controllers/accountDeleteController.js';

// RTA Utilities
import { checkAndInsertAccount } from '../../../utils/fintrackUtils/accountManagement/checkAndInsertAccount.js';

import { setAccountBalanceFromLedger } from '../../../utils/fintrackUtils/accountManagement/setAccountBalanceFromLedger.js';

import { recordAnnulmentTransaction } from '../../../utils/fintrackUtils/accountDeletionUtils/recordAnnulmentTransaction.js';
// RETIRED 2026-09-08. This import and the two below served CLOSE's settlement
// and have no live caller now that CLOSE refuses a non-zero balance instead of
// moving it. The modules stay on disk with their bodies intact; commenting the
// imports is what stops them being linked, which matters for
// recordClosureSettlement.js in particular - it imports the two policy
// constants that are themselves commented out in the controller, so linking it
// would fail rather than sit idle.
// import { recordClosureSettlement } from '../../../utils/fintrackUtils/accountDeletionUtils/recordClosureSettlement.js';
import { lockAndDeriveBalances } from '../../../utils/fintrackUtils/accountManagement/lockAndDeriveBalances.js';
import { eraseAccountTail } from '../../../utils/fintrackUtils/accountDeletionUtils/eraseAccountTail.js';
// The creation-side whitelist, reused as the deletion-side guard: an account
// type a user may not create is one they may not destroy either.
import { USER_CREATABLE_ACCOUNT_TYPES } from '../../../utils/fintrackUtils/accountDataRetrieval/accountUtils.js';
import { assessDeletionImpact } from './getAnnulmentImpactReport.js';
// import { assertTransferDestinationEligible } from './getCloseTransferDestinations.js';
// import { getCurrencyCode } from '../../../utils/currencyLookup.js';

// The name the system reserves for the compensation counterpart. Belongs in
// accountUtils.js beside NOT_BOUNDARY_ACCOUNT; declared here because that file
// is another session's to edit, and requested from its owner. The literal
// already appears in fifteen files, so naming it here centralises nothing -
// this is the only one of those comparisons gating a destructive action.
const BOUNDARY_ACCOUNT_NAME = 'slack';

// The account types CLOSE refuses to close at a non-zero balance (owner's
// ruling, 2026-09-08). Written out rather than derived from the catalog for
// the reason USER_CREATABLE_ACCOUNT_TYPES gives at accountUtils.js:78 - the
// catalog says what can exist, this says what this operation requires, and a
// type added to the catalog must not silently acquire a precondition.
const CLOSE_ZERO_BALANCE_TYPES = Object.freeze([
  'bank',
  'cash',
  'investment',
  'debtor',
]);
//=====================================
// 📋 MESSAGES CONFIGURATION
const messages = {
  notFound: {
    status: 404,
    messagefn: (id) => `Account with ID ${id} not found`,
    // "Account not found or access denied"
  },

  deletionTypeInvalid: {
    status: 400,
    messagefn: () => 'Invalid or unauthorized deletion type.',
  }, //IT will depnd on the type deletion methods defined.

  softDeleted: {
    status: 400,
    messagefn: () =>
      `Account is already marked for deletion or could not be found`,
  },

  failedToDeleted: {
    status: 500,
    messagefn: (id, actionType) =>
      `Failed to execute  ${actionType} fo account ${id}`,
    // 'Operation failed. Please try again later.'
  },

  adminAction: {
    status: 200,
    messagefn: (id, deletionTypeMethod, action) =>
      `Admin ${action}: Executing ${deletionTypeMethod} on account ${id}`,
  }, //Hard deleting

  userAction: {
    status: 200,
    messagefn: (id, action) =>
      `User ${action} User: Executing ${action}  on account ${id}`,
  }, // Soft Deleting

  success: {
    status: 202,
    messagefn: (id, actionType) =>
      `Account ${id} successfully processed for ${actionType}.`,
  },

  rtaSuccess: {
    status: 202,
    messagefn: (name, id, accountQty) =>
      `RTA Annulment and Hard Delete successfully executed for account ${name} (${id}). Total affected accounts adjusted: ${accountQty}.`,
  },

  rtaUserPermissionDenied: {
    status: 403,
    messagefn: () =>
      `Permission denied. RTA deletion requires administrative privileges.`,
  },
};
//========================================
// FETCHING COMMON TRANSACTIONAL IDS (MOVEMENTTYPE, TRANSACTIONTYPE) WITH CACHE
// 🗃️ CACHE MANAGEMENT
let cacheIds = null,
  cacheTimestamp = null;
const CACHE_TimeToLive = 10 * 60 * 1000; //10 min
// Retired 2026-09-07, kept commented rather than deleted so the wrong values
// stay visible as the hazard they were. All three were wrong against the base
// catalog seed (005_base_catalogs.sql), and two were each other's: movement
// type 1 is 'expense' and 'pnl' is 9; transaction type 1 is 'withdraw' and 2
// is 'deposit', so the deposit and withdraw ids were swapped. A fallback that
// invents catalog ids writes financial rows under a guessed type, which is
// worse than refusing to write - annulment pairs would land as the owner's
// ordinary expenses with their deposit/withdraw labels inverted. Found by
// pern-fintrack-cf.
// const DEFAULT_IDS = {
//   pnlMovementTypeId: 1, // ID conocido de 'pnl'
//   depositTypeId: 1, // ID conocido de 'deposit'
//   withdrawTypeId: 2, // ID conocido de 'withdraw'
// };

//🎯 GET COMMON TRANSACTION IDs
const getCommonIds = async (clientDb) => {
  //'clientDb' should be an active connection (pool or transactional clientDb)
  //Check valid cache
  if (
    cacheIds &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < CACHE_TimeToLive
  ) {
    console.log('📦 Using cached common IDs');
    return cacheIds;
  }
  console.log('🔄 Fetching common IDs from database...');

  const queries = [
    clientDb.query(
      "SELECT movement_type_id FROM movement_types WHERE movement_type_name = 'pnl'",
    ),

    clientDb.query(
      "SELECT transaction_type_id FROM transaction_types WHERE transaction_type_name = 'deposit'",
    ),

    clientDb.query(
      "SELECT transaction_type_id FROM transaction_types WHERE transaction_type_name = 'withdraw'",
    ),
  ];

  let pnlRes, depositRes, withdrawRes;

  // Only the query itself is guarded. A connection that drops is transient and
  // a cache read moments old is still the truth; a catalog row that is absent
  // is neither, so its check sits below, outside this handler's reach.
  try {
    [pnlRes, depositRes, withdrawRes] = await Promise.all(queries);
  } catch (error) {
    console.error('❌ Failed to fetch common IDs:', error);

    if (
      cacheIds &&
      cacheIds.pnlMovementTypeId &&
      cacheIds.depositTypeId &&
      cacheIds.withdrawTypeId
    ) {
      console.warn('⚠️ Using stale cache due to fetch error');
      return cacheIds;
    }

    throw createError(
      500,
      'Could not read the transaction/movement type catalog, and no cached ids are available.',
    );
  }

  // Was inside the try above, where the catch beneath it swallowed this throw
  // and returned invented ids in its place - the guard written to fail loudly
  // on a missing catalog row silently produced a wrong one instead. Raised
  // here so it escapes (pern-fintrack-cf, 2026-09-07).
  if (
    pnlRes.rows.length === 0 ||
    depositRes.rows.length === 0 ||
    withdrawRes.rows.length === 0
  ) {
    throw createError(
      500,
      'Required transaction/movement types (pnl, deposit, withdraw) not found in DB.',
    );
  }

  //Update cache
  cacheIds = {
    pnlMovementTypeId: pnlRes.rows[0].movement_type_id,

    depositTypeId: depositRes.rows[0].transaction_type_id,

    withdrawTypeId: withdrawRes.rows[0].transaction_type_id,
  };

  cacheTimestamp = Date.now();
  console.log('✅ Common IDs cached successfully');

  return cacheIds;
}; //END of getCommonIds
//---------------------------------------------
//function for manually cleaning cache
// export const clearCommonIdsCache = () => {
//  cacheIds = null;
//  cacheTimestamp = null;
// };

//=============================================
// 🔧 RTA ANNULMENT PROCESSING
// * 🚀 PROCESS RTA ANNULMENT
// * Handles the complete RTA flow with atomic transaction
//=============================================
const processRTAAnnulment = async (
  dbClient,
  userId,
  targetAccountId,
  targetAccountName,
  transactionDate,
  accountName,
) => {
  // 2. Get/Create Slack Account
  const slackAccountInfo = await checkAndInsertAccount(dbClient, userId);

  const slackAccount = slackAccountInfo.account;

  // Locks the target account, then computes its impact report inside that
  // lock - closing the TOCTOU gap where a client-supplied impactReport, read
  // before this transaction (or even this request) began, was trusted as-is
  // at execution time (PLAN_ACCOUNT_DELETION.md unit 6). Shared with any
  // other deletion type that needs the same guarantee, via
  // assessDeletionImpact - never the client-supplied copy the old code
  // received as a parameter.
  const impactReport = await assessDeletionImpact(
    dbClient,
    userId,
    targetAccountId,
  );

  console.log(
    pc.yellow(
      `Executing RTA adjustments for ${impactReport.length} affected accounts...`,
    ),
  );

  // Every account this annulment touches, locked and derived before a single
  // figure is computed from it: the compensation account and each affected one.
  //
  // The stored column has drifted from the ledger — the compensation account
  // reads −75.97 stored against −90.22 derived — so every corrected balance
  // was built on a wrong starting point and written back, carrying the error
  // forward.
  //
  // The report keeps its own figure: that one is what the owner was SHOWN when
  // they confirmed, and it is now derived too.
  const ledgerBalances = await lockAndDeriveBalances(dbClient, userId, [
    ...impactReport.map((row) => row.affectedAccountId),
    slackAccount.account_id,
    // The RTA lock set is {A} u cp(A) (PLAN_ACCOUNT_DELETION.md §4.3). Already
    // held above, re-acquiring it here is a no-op within the same transaction.
    targetAccountId,
  ]);

  const ledgerBalanceOf = (accountId) =>
    parseFloat(ledgerBalances.get(accountId));

  let finalSlackBalance = ledgerBalanceOf(slackAccount.account_id);

  // A NON-EMPTY REPORT IS NOT THE SAME AS A REVERSAL THAT MOVES ANYTHING,
  // measured 2026-09-07. An account created with a starting amount and never
  // used since has exactly one qualifying row - its own opening, whose source is
  // the compensation account - so the report holds a single entry whose affected
  // account IS slackAccount. The loop below then hands recordAnnulmentTransaction
  // an affectedAccountId equal to its slackAccountId, so both legs are written on
  // that one account, +adjustment and -adjustment, and the ledger nets them to
  // zero. The erasure afterwards drops the target's own row and keeps the
  // compensation account's counter row, so the residual leaves the books with no
  // entry this deletion wrote - the same outcome the hard delete produces on the
  // same account, which it refuses with a 409. For that shape the two paths
  // differ by the gate alone, not by what they do.
  if (impactReport.length > 0) {
    // 1. Fetch Common IDs (Movement/Transaction Types)
    const { pnlMovementTypeId, depositTypeId, withdrawTypeId } =
      await getCommonIds(dbClient);

    // 3. Calculate all balance changes first (immutable phase)
    // 3.a Calculate all balances of affected accounts(immutable phase)
    const balanceCalculations = impactReport.map((row) => ({
      ...row,
      // From the locked ledger, not from the report's figure. The two agree
      // whenever nothing moved between the report and this transaction, and
      // when they disagree it is this one that is right.
      newAffectedBalance:
        ledgerBalanceOf(row.affectedAccountId) +
        row.affectedAccountNetAdjustmentAmount,
    }));

    console.log('balanceCalcultaions', balanceCalculations);

    //3.b Calculate final balance of slack account
    let totalAffectedAccountAdjustement = 0;

    for (const row of impactReport) {
      totalAffectedAccountAdjustement += row.affectedAccountNetAdjustmentAmount;
    }

    finalSlackBalance =
      ledgerBalanceOf(slackAccount.account_id) - totalAffectedAccountAdjustement;

    console.log('finalSlackBlaance:', finalSlackBalance);

    // 4. Process each affected account
    for (const calculation of balanceCalculations) {
      const {
        affectedAccountId,
        affectedAccountName,
        affectedAccountCurrentBalance,
        // affectedAccountCurrentBalance: calculation.affectedAccountCurrentBalance,
        affectedAccountNetAdjustmentAmount,

        affectedAccountCurrencyId,
        affectedAccountCurrencyCode,
        newAffectedBalance,
      } = calculation;

      // Prepare annulment data
      const annulmentData = {
        userId,
        affectedAccountId,
        affectedAccountName,

        affectedAccountCurrentBalance,
        // affectedAccountCurrentBalance: calculation.affectedAccountCurrentBalance,
        adjustmentAmount: affectedAccountNetAdjustmentAmount,
        newAffectedBalance,

        slackAccountId: slackAccount.account_id,
        // Logged, not inserted. Derived like everything else here, so the log
        // line cannot contradict the arithmetic printed beside it.
        slackAccountCurrentBalance: ledgerBalanceOf(slackAccount.account_id),
        newSlackBalance: finalSlackBalance,

        currencyId: affectedAccountCurrencyId,
        currencyCode: affectedAccountCurrencyCode,

        targetAccountName, //from frontend
        pnlMovementTypeId,
        depositTypeId,
        withdrawTypeId,
        transactionDate: transactionDate,
      };

      // Record annulment transaction
      await recordAnnulmentTransaction(dbClient, annulmentData);

      // The stored column is written AFTER the rows that justify it, from the
      // ledger's own arithmetic. newAffectedBalance above predicts the same
      // figure - derived plus the adjustment, and the annulment row carries
      // exactly that adjustment - so the two agree; when they ever disagree it
      // is this one that is right, because it is the only one nobody computed.
      await setAccountBalanceFromLedger(dbClient, affectedAccountId, userId);
    }

    // 5. Re-derive the compensation account, once, after every counterpart row
    // of the loop above is in the ledger. Its annulment rows carry the negated
    // adjustments, so the ledger produces finalSlackBalance on its own.
    const slackRow = await setAccountBalanceFromLedger(
      dbClient,
      slackAccount.account_id,
      userId,
    );

    // What the service reports is what the column holds, not what was predicted.
    finalSlackBalance = parseFloat(slackRow.account_balance);
  } else {
    // This log line is wrong about one thing only: what follows is NOT the hard
    // delete. That path refuses with 409 unless the target derives to zero; RTA
    // reaches the same erasure with no balance gate at all.
    //
    // An earlier version of this comment claimed the gap was reachable through
    // an account opened with a starting amount whose opening row names itself as
    // both source and destination. RETRACTED 2026-09-07, same session: the two
    // halves are mutually exclusive. A funded opening names the compensation
    // account as its source, so it is distinct and enters the report.
    //
    // THE REASON FIRST GIVEN FOR THAT RETRACTION WAS ALSO WRONG, and the
    // difference decides how a future gate is written (pern-fintrack-02, checked
    // here in the writers). It ran: self-referential implies the transaction type
    // is 'account-opening', which implies the amount is zero. The middle step
    // does not hold for bank, income_source or investment: createBasicAccount
    // calls neither helper. It sets both key columns from its own isTransfer,
    // which IS the nonzero-amount test, while its transaction type is 'deposit'
    // for bank and investment at any amount, zero included. So a zero-amount bank
    // account carries a self-referential opening row typed 'deposit', and a
    // predicate keyed on the type name misses it. The 'account-opening' rule is
    // reached only from the category-budget controller. Test the two columns
    // against each other, never the type name.
    //
    // What is still true and is why this branch keeps a comment: the residual
    // and the impact report are computed from different sources. The residual is
    // the stored account_starting_amount column plus the account's rows with its
    // own opening zeroed (derivedBalance.js, three sites); the report sums rows.
    // They agree by construction - the column adds back exactly what the zeroing
    // removes - not by a rule anything enforces. No reachable row is known to
    // make them disagree; none is claimed here either. Whether RTA should carry
    // the zero gate anyway is one of the four deletion types Carlos reopened on
    // 2026-09-07, and it is a design question rather than a defect report.
    console.log(
      pc.yellow(
        'RTA: No net financial impact to correct. Proceeding to hard delete.',
      ),
    );
  }
  //--------------------------------------
  // 6. Erase the target: detach and scrub every surviving reference to it,
  // then drop its own rows and the account (PLAN_ACCOUNT_DELETION.md §4.1
  // steps 6d/7d/8d). Required since migration 018 - a bare DELETE here fails
  // under RESTRICT the moment any transaction still references this account.
  await eraseAccountTail(dbClient, userId, targetAccountId, accountName);
  console.log(
    pc.red(`Target Account ${targetAccountId} and transactions ERASED.`),
  );

  return {
    adjustedAccounts: impactReport.length,
    finalSlackBalance,
  };

  // return {
  //        status: messages.rtaSuccess.status,
  //        message: messages.rtaSuccess.messagefn(targetAccountName, targetAccountId, impactReport.length),
  //        data: {
  //            deletedAccountId: targetAccountId,
  //            action: 'RTA_ANNULMENT',
  //            accountsCorrected: impactReport.length,
  //            deletionType: DELETION_TYPE_RTA,
  //            adjustedAccounts: impactReport.length,
  //            finalSlackBalance,
  //            actionType: 'RTA_ANNULMENT'
  //        }
  //    };

  // return {
  //   status: messages.rtaSuccess.status,
  //   message: messages.rtaSuccess.messagefn(targetAccountName),
  //   data: {
  //     deletedAccountId: accountId,
  //     action: actionType,
  //     accountsCorrected: impactReport.length
  //   }
  // };
}; //END of processRTAAnnulment

//========================================
// 🗑️ STANDARD SOFT/HARD DELETE PROCESSING
//========================================
/**
 * 📝 PROCESS STANDARD DELETE
 * Handles soft and hard delete operations
 */
const processStandardDelete = async (
  dbClient,
  userId,
  targetAccountId,
  deletionType,
  isAdmin,
  accountCheck,
) => {
  let actionType;

  // Administrative privilege suspended for account deletion (Carlos,
  // 2026-09-07): any owner may run any deletion type on their own account
  // for now. The original condition is kept rather than removed, so
  // restoring the restriction is one line in each of the three sites that
  // enforced it - here, and the two guards further down this file.
  // if (isAdmin && deletionType === DELETION_TYPE_HARD) {
  if (deletionType === DELETION_TYPE_HARD) {
    // Hard delete: detach/scrub/drop, see eraseAccountTail.
    actionType = ADMIN_ACTION;
    console.log(
      pc.red(`Admin HARD DELETE for account ${targetAccountId} by user ${userId}`),
    );

    // A closed account is not erasable (Carlos, 2026-09-07). CLOSE settles the
    // residual and keeps the row on purpose - that preserved history is the
    // whole product of closing. HARD read only the balance, and a closed
    // account's balance is zero by construction, so it erased exactly the rows
    // the close existed to keep. SOFT already refuses this; the omission here
    // was that the two branches tested different columns for the same state.
    // Checked before the lock: a refusal should not take one.
    //
    // KNOWN DEFECT where 034 has not been applied: accountCheck selects ua.*,
    // so this is a property read, undefined !== null is true, and every hard
    // delete is refused with a message asserting the account was closed and
    // settled when it never was. Not repaired here - loosening the comparison
    // turns it into a permit on exactly the databases where the system-account
    // guard's type arm is blind, so it is Carlos's call, not a cleanup.
    if (accountCheck.rows[0].closed_at !== null) {
      throw createError(
        400,
        `Account ${targetAccountId} was closed and settled. A closed account cannot be hard deleted; its balance has already been moved and its row is kept deliberately.`,
      );
    }

    // Settlement guard (PLAN_ACCOUNT_DELETION.md "HARD/DELETE settlement gap",
    // 2026-09-06). §3.2 requires settling the residual before erasure -
    // "unless those rows already sum to zero, the global ledger stops
    // closing". Rather than erase a nonzero-balance account unsettled, refuse
    // it. The lock closes the same concurrency gap RTA's own execution closed
    // (unit 6): held here, nothing can change the balance between this check
    // and the erasure below.
    const targetBalances = await lockAndDeriveBalances(dbClient, userId, [
      targetAccountId,
    ]);
    const targetBalance = parseFloat(targetBalances.get(targetAccountId));

    // CLOSE leads and RTA follows, because they answer different intentions
    // (Carlos, 2026-09-07). Moving the residual out is what an owner who is
    // done with an account wants; RTA reverses the account's effect on OTHER
    // accounts, writing annulment pairs against rows the owner never touched.
    // The previous wording named RTA alone, sending the ordinary case to the
    // one path that rewrites other accounts' history.
    if (targetBalance !== 0) {
      throw createError(
        409,
        `Account ${targetAccountId} holds ${targetBalance} and cannot be hard-deleted until that is settled. Close it to move the residual out - transferred to an account you choose, or discarded - or use RTA instead if the account's effects on other accounts should be reversed.`,
      );
    }

    await eraseAccountTail(
      dbClient,
      userId,
      targetAccountId,
      accountCheck.rows[0].account_name,
    );
    return { actionType, deletionType, rowCount: 1 };
  } else if (deletionType === DELETION_TYPE_SOFT) {
    // Soft delete. The two refusals are separate now that closed_at exists:
    // both states set deleted_at, so a single message on that column described
    // whichever state the account was NOT in half the time. closed_at is
    // checked first because a closed account carries both columns during the
    // dual-write window, and "closed" is the more specific of the two.
    if (accountCheck.rows[0].closed_at !== null) {
      throw createError(
        400,
        `Account ${targetAccountId} was closed and settled. A closed account cannot be soft deleted; its balance has already been moved and its row is kept deliberately.`,
      );
    }

    if (accountCheck.rows[0].deleted_at !== null) {
      throw createError(400, 'Account already soft deleted');
    }
    actionType = USER_ACTION;
    console.log(
      pc.yellow(`User SOFT DELETE for account ${targetAccountId} by user ${userId}`),
    );
  } else {
    throw createError(400, 'Invalid or unauthorized deletion type.');
  }

  // Only the soft-delete branch reaches here - hard delete returns above.
  //
  // Both columns in the guard, and closed_at is not redundant with the
  // precondition above it. The precondition read accountCheck, which was
  // selected earlier in this transaction; the guard is evaluated by the UPDATE
  // itself. A close committing in between passes the first and must not pass
  // the second - otherwise a settled account is stamped as soft deleted and the
  // row that was kept deliberately reads as an ordinary deletion. rowCount 0
  // then raises the 500 below, which is the right answer: the caller's read of
  // the account is stale.
  const queryText =
    'UPDATE user_accounts ua SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE (ua.account_id = $1 AND ua.user_id = $2) AND ua.deleted_at IS NULL AND ua.closed_at IS NULL';
  // $2 (user_id) was never bound before this fix: the query always required
  // it but only targetAccountId was passed, so every soft delete threw a
  // Postgres bind-count error before this change.
  const result = await dbClient.query(queryText, [targetAccountId, userId]);

  if (result.rowCount === 0) {
    throw createError(
      500,
      `Failed to ${deletionType} account ${targetAccountId}`,
    );
  }

  // ✅
  return {
    actionType,
    deletionType,
    rowCount: result.rowCount,
  };
}; //END of processStandardDelete

//========================================
// 🔒 CLOSE PROCESSING (unit 7, PLAN_ACCOUNT_DELETION.md §3.1/§4.1)
//========================================

// RETIRED 2026-09-08 by the owner, in his words: "Si CLOSE ya no genera
// movement_type_id = 10, entonces el gate esta protegiendo una condicion que ya
// no puede ocurrir bajo el nuevo diseno." The gate below refused every CLOSE
// until the investment card's reconciliation accounted for movement_type_id 10.
// That type reached the card through recordClosureSettlement, and the settlement
// left the executable flow in the same commit that made CLOSE refuse a non-zero
// balance instead of settling it - so no path can write a type 10 row and the
// condition the gate waited for can no longer arise.
//
// It is not replaced by another gate. The owner's contract for CLOSE is balance
// zero, release the pocket commitments, terminate the budget, write the
// registry, delete the account - and no accounting entry anywhere in it.
//
// Kept commented rather than deleted, like the two retired policies above,
// because the measurement recorded in it is the evidence that both branches
// carried the same closure-adjustment term. That evidence stays readable even
// though the gate it justified is gone.

// // Release gate ("Gate, stated per branch, not per person", plan doc, unit
// // 5/7 catalog decision): no movement_type_id 10 row could be written until
// // overviewInvestmentRepository.js's reconciliation accounted for that type on
// // BOTH main and feat/overview.
// //
// // Cleared 2026-09-07, Carlos, on measurements rather than on this code looking
// // ready. Both branches carry the SAME closure-adjustment term: the filter is
// // identical at origin - the closure movement type OR a description beginning
// // with the annulment prefix - and the realised term excludes those same
// // prefixed rows under a NULL-safe negation. An earlier version of this line
// // said feat/overview sums the movement type alone, which understated it
// // (pern-fintrack-cf, verified here by comparing the two trees at that
// // expression); the version before that said main had no such term at all,
// // which was true when written and stopped being true when the Investment card
// // shipped it.
// //
// // What that means for a later reader checking whether this gate's precondition
// // still holds: feat/vercel-serverless has no close path, so no closure-typed
// // row can exist in data it writes and the term is carried there by the prefix
// // alone - free text that the erasure tail's REPLACE can rewrite. That tail
// // ships on the branch; the movement type that would back the term up does not.
// //
// // What the measurement covered, so a later reader knows what it does not: a
// // real settlement written through this path on fintrack_dev moves the card's
// // closure term by exactly the negation of the residual and leaves the realised
// // term alone, the identity closes, and only the target leg is inside the
// // published account set - the boundary counterpart stays out. Rolled back both
// // times. See scripts/verifyClosureSettlement.js for the writer and
// // scripts/verifyCloseAccount.js for this whole path.
// const CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED = true;

/**
 * 📝 PROCESS CLOSE ACCOUNT
 * CLOSE as the owner ruled it on 2026-09-08: refuse the close if the account
 * still holds money, then mark it closed. It settles nothing, transfers
 * nothing, discards nothing, reverses nothing and writes no transaction of any
 * kind. In his words, "CLOSE solamente elimina la entidad de cuenta y conserva
 * su identidad/historia."
 *
 * The refusal covers bank, cash, investment and debtor. The owner resolves a
 * balance outside CLOSE - through the ordinary transfer screen - and closes
 * afterwards, which leaves him a movement he can read instead of one written
 * on his behalf against an account no view renders.
 *
 * WHAT IS NOT HERE YET, and each has its own block of the plan: releasing what
 * the account committed to pockets, the terminating zero on the budget series,
 * stamping the registry row with the closure columns and close_reason, and
 * deleting the user_accounts row. Until those land this path still marks the
 * row rather than deleting it, which is the behaviour that shipped before and
 * stays correct on its own.
 *
 * Exported so it can be exercised on a caller's own transaction. The only
 * other way in is deleteAccountService, which opens a connection and commits,
 * so nothing could check what this writes without really closing an account.
 * It takes the client rather than opening one, which is what makes a
 * rolled-back verification possible - see scripts/verifyCloseAccount.js and
 * scripts/verifyCloseTransfer.js.
 *
 * @param {object} accountCheck - the target's row, already read with its
 *   account_type_name joined in. The type is what decides whether the
 *   zero-balance refusal applies, so this path never re-queries it.
 */
export const processCloseAccount = async (
  dbClient,
  userId,
  targetAccountId,
  accountCheck,
  transactionDate,
  // RETIRED 2026-09-08. The three parameters that drove the settlement:
  // policy, destinationAccountId, expectedResidual. Removed from the
  // signature rather than left as ignored parameters, so a caller that still
  // passes them is a syntax error to read rather than a silent no-op.
) => {
  // RETIRED 2026-09-08 with the constant above. The 409 it raised named a
  // reconciliation that no longer has anything to reconcile: the movement type
  // it waited for has no writer left. Retired here and not merely made
  // unreachable, so a reader does not have to resolve a constant to find out
  // whether CLOSE can run.
  // if (!CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED) {
  // // 409, not 503: this is not a transient outage a retry will clear - it is
  // // a permanent block on the current system state (main's investment card
  // // has no closure-adjustment term yet). 503 reads as retryable to generic
  // // client/proxy retry logic, which would loop forever on a gate that only
  // // a code change lifts (pern-fintrack-cf, 2026-09-06). Same reasoning as
  // // the HARD-delete guard above, which uses 409 for the same kind of
  // // state-dependent refusal.
  // throw createError(
  // 409,
  // 'CLOSE is not released yet: the investment card reconciliation on main ' +
  // 'and feat/overview must account for movement_type_id 10 first (see ' +
  // 'PLAN_ACCOUNT_DELETION.md, unit 5/7 catalog decision, "Gate, stated ' +
  // 'per branch"). Coordinate with the Overview branch before clearing ' +
  // 'this gate.',
  // );
  // }

  // The two states are distinguishable as of migration 034, and this is the
  // refusal that needed it. Both set deleted_at, so a single check on that
  // column answered "already closed" to an account that had been soft deleted
  // and never closed - a message describing the wrong state, and the reason
  // closed_at was added rather than deleted_at renamed.
  //
  // closed_at first: a closed account carries both columns while the dual-write
  // stands, and closed is the more specific answer.
  if (accountCheck.rows[0].closed_at !== null) {
    throw createError(400, `Account ${targetAccountId} is already closed.`);
  }

  if (accountCheck.rows[0].deleted_at !== null) {
    throw createError(
      400,
      `Account ${targetAccountId} was deleted and cannot be closed. Closing settles a residual, and a deleted account is no longer in circulation to hold one.`,
    );
  }

// RETIRED 2026-09-08, kept per the standing rule that code is commented and
// not deleted. Everything from here to the settlement below implemented CLOSE's
// two settlement policies. The owner withdrew them from the executable flow on
// 2026-09-08: "CLOSE no liquida, no transfiere, no descarta, no revierte y no
// genera accounting entries. CLOSE solamente elimina la entidad de cuenta y
// conserva su identidad/historia."
//
// TRANSFER is not gone from FinTrack - it is gone from the close operation. The
// owner's sequence is: a close on an account with a balance is refused, the
// owner moves the balance out through the ordinary transfer screen, and closes
// afterwards. DISCARD has no successor at all: it wrote a movement_type_id 10
// pair against the compensation account, and because every published total
// excludes that account by name the owner's net worth fell with no line item
// anywhere on screen explaining it.

//   if (policy !== CLOSE_POLICY_DISCARD && policy !== CLOSE_POLICY_TRANSFER) {
//     throw createError(
//       400,
//       `CLOSE policy '${policy}' is not recognised. Expected '${CLOSE_POLICY_DISCARD}' or '${CLOSE_POLICY_TRANSFER}'.`,
//     );
//   }
//
//   const isTransfer = policy === CLOSE_POLICY_TRANSFER;
//
//   // The owner's echo of the residual, parsed here and compared after the lock
//   // (§4.1 step 3). Parsed before the lock for the same reason the destination
//   // id is: a malformed request should not take a row lock on its way to being
//   // refused. 400 rather than 409 - no state of the database makes a missing or
//   // unparseable number valid.
//   const confirmedResidual = Number(expectedResidual);
//
//   if (
//     expectedResidual === null ||
//     expectedResidual === undefined ||
//     expectedResidual === '' ||
//     !Number.isFinite(confirmedResidual)
//   ) {
//     throw createError(
//       400,
//       'CLOSE requires expectedResidual, the balance you were shown for this account. ' +
//         'Read it from the close preview endpoint and send it back with the request.',
//     );
//   }
//
//   // Which account the residual goes to. Resolved before the lock because the
//   // lock set has to name it (§4.3: CLOSE + TRANSFER locks { A, D }), and
//   // VALIDATED after it - see below.
//   let counterpartAccountId;
//   let counterpartAccountName;
//
//   if (isTransfer) {
//     // 400, not 409: a request that names no destination is malformed, and no
//     // state of the database would make it valid. An ineligible destination is
//     // the other case and answers 409, in getCloseTransferDestinations.js.
//     const requestedDestinationId = Number.parseInt(destinationAccountId, 10);
//
//     if (!Number.isInteger(requestedDestinationId)) {
//       throw createError(
//         400,
//         `CLOSE with the ${CLOSE_POLICY_TRANSFER} policy requires destinationAccountId, the account the residual is moved to.`,
//       );
//     }
//
//     counterpartAccountId = requestedDestinationId;
//   } else {
//     // Get/create the boundary account - the same compensation counterpart RTA
//     // uses, identified structurally by account_type (unit 5). Only DISCARD
//     // reaches this: creating a boundary account for a policy that never
//     // settles against one would leave a side effect behind for nothing.
//     const boundaryAccountInfo = await checkAndInsertAccount(dbClient, userId);
//     counterpartAccountId = boundaryAccountInfo.account.account_id;
//     counterpartAccountName = boundaryAccountInfo.account.account_name;
//   }
//
  // 1 LOCK + 2 ASSESS: lock the target and derive its balance from the locked
  // state. The lock set was { A, D } while CLOSE settled against a counterpart
  // D; with the settlement retired there is no second account to serialise
  // against, and the lock exists now only so the balance the refusal reads is
  // the balance the close acts on.
  const balances = await lockAndDeriveBalances(dbClient, userId, [
    targetAccountId,
  ]);
  const residual = parseFloat(balances.get(targetAccountId));

  // THE ZERO-BALANCE PRECONDITION, ruled by the owner on 2026-09-08 and the
  // reason the settlement above is retired. The refusal replaces the
  // settlement rather than preceding it: closing is a lifecycle fact and
  // stops being an accounting one.
  //
  // FOUR TYPES, not seven. bank, cash, investment and debtor hold money, so a
  // balance on one of them is money that would leave the owner's net worth
  // with no movement to explain it.
  //
  // income_source is waived by the owner's earlier ruling, and the reason is
  // measured off the writers rather than assumed: the income source is always
  // the source leg and that leg carries a negative amount, so its balance runs
  // below zero with every income it records. Requiring zero there would refuse
  // every income source that ever worked.
  //
  // pocket_saving and category_budget are absent for a different reason. A
  // pocket is a plan since migration 020 emptied the pocket accounts, and a
  // category budget's balance is what was spent through it, not money it
  // holds. Neither figure is money to move out, so there is nothing for a zero
  // condition to protect.
  const targetTypeName = String(
    accountCheck.rows[0].account_type_name ?? '',
  ).toLowerCase();

  if (CLOSE_ZERO_BALANCE_TYPES.includes(targetTypeName) && residual !== 0) {
    // 409, not 400: the request was well formed and the state is what refuses
    // it. The same reading the stale-residual refusal used, and the message
    // names the remedy because the close screen turns it into a button.
    throw createError(
      409,
      `Account ${targetAccountId} holds ${residual} and an account of type ` +
        `'${targetTypeName}' has to reach zero before it can be closed. Move ` +
        'the balance to another of your accounts first, then close it. ' +
        'Closing moves no money and settles nothing.',
    );
  }


//   // 3 VALIDATE, first half: the owner confirmed an amount, so the amount about
//   // to be settled has to be that one. Compared here rather than before the lock
//   // because only now is the residual the one the settlement will actually use -
//   // checked earlier, a transaction could still land in between and the check
//   // would have proved nothing.
//   //
//   // Compared in cents. Both sides describe a DECIMAL(15,2) column, but they
//   // arrive as floats - the derived residual through the driver, the echo
//   // through JSON - and 1.39 is not exactly representable in either, so a strict
//   // comparison would refuse requests that agree to the cent.
//   //
//   // This runs before the destination check because it needs no query: a request
//   // whose amount is already stale is refused without asking the database
//   // anything further. 409, not 400 - the request was valid when the owner sent
//   // it, and the state moved underneath it, which is the same reason an
//   // ineligible destination answers 409.
//   if (Math.round(confirmedResidual * 100) !== Math.round(residual * 100)) {
//     throw createError(
//       409,
//       `The balance of account ${targetAccountId} changed after you were shown it: ` +
//         `you confirmed ${confirmedResidual}, it now holds ${residual}. ` +
//         'Nothing was closed or settled. Review the new balance and confirm again.',
//     );
//   }
//
//   // 3 VALIDATE, second half, and deliberately after the lock rather than
//   // before it. Read first, the destination could be closed, retyped or
//   // re-currencied by another transaction between the check and the settlement,
//   // and the write would land on an account that was eligible only in the past.
//   //
//   // The destination is validated whether or not there is a residual to move.
//   // A request naming an ineligible account is wrong about what it asked for,
//   // and accepting it silently whenever the balance happens to be zero would
//   // make the rule hold only sometimes.
//   if (isTransfer) {
//     const destination = await assertTransferDestinationEligible(
//       dbClient,
//       userId,
//       targetAccountId,
//       counterpartAccountId,
//     );
//
//     counterpartAccountName = destination.accountName;
//   }
//
//   // 4 SETTLE: write the pair only if there is something to settle. A target
//   // already at zero needs no transaction - a zero-amount row would carry no
//   // financial meaning and would still show up in the closure term as a row.
//   if (residual !== 0) {
//     const currencyCode = await getCurrencyCode(
//       dbClient,
//       accountCheck.rows[0].currency_id,
//     );
//
//     await recordClosureSettlement(dbClient, {
//       userId,
//       targetAccountId,
//       targetAccountName: accountCheck.rows[0].account_name,
//       policy,
//       counterpartAccountId,
//       counterpartAccountName,
//       residual,
//       currencyId: accountCheck.rows[0].currency_id,
//       currencyCode,
//       transactionDate,
//     });
//
//     await setAccountBalanceFromLedger(dbClient, targetAccountId, userId);
//     await setAccountBalanceFromLedger(dbClient, counterpartAccountId, userId);
//   }
//
//   // 5 ASSERT residual(A) = 0 - re-derive rather than trust the arithmetic,
//   // the same discipline the HARD-delete guard above applies before its own
//   // decision.
//   const postSettlementBalances = await lockAndDeriveBalances(
//     dbClient,
//     userId,
//     [targetAccountId],
//   );
//   const postResidual = parseFloat(postSettlementBalances.get(targetAccountId));
//   if (postResidual !== 0) {
//     throw createError(
//       500,
//       `Settlement failed to zero account ${targetAccountId} (residual ${postResidual}).`,
//     );
//   }
//
  // 6c MARK: CLOSE keeps the row and writes BOTH columns, for as long as the
  // readers have not been swept.
  //
  // closed_at is the real one - it is what this path means, and migration 034
  // added it beside deleted_at rather than renaming it precisely so that both
  // states could exist at once. deleted_at is written alongside because every
  // reader still filters on it: stopping now would put closed accounts back in
  // circulation everywhere the sweep has not reached. It comes out when the
  // sweep is deployed, not when it is written.
  //
  // CURRENT_TIMESTAMP is the transaction's start time, so all three columns get
  // one identical value rather than three readings of the clock - which is why
  // 034 declares closed_at with the same type as deleted_at.
  //
  // The guard stays deleted_at IS NULL and must not become closed_at IS NULL
  // while the dual-write stands: a soft-deleted account carries deleted_at and
  // no closed_at, and a closed_at guard would let this path close it.
  const markResult = await dbClient.query(
    `UPDATE user_accounts
        SET closed_at = CURRENT_TIMESTAMP,
            deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      WHERE account_id = $1 AND user_id = $2 AND deleted_at IS NULL
      RETURNING account_id`,
    [targetAccountId, userId],
  );

  if (markResult.rowCount === 0) {
    throw createError(500, `Failed to close account ${targetAccountId}`);
  }

  return {
    actionType: USER_ACTION,
    deletionType: DELETION_TYPE_CLOSE,
    // The balance the account carried at the moment it closed. Named
    // closingBalance and not settledResidual because nothing was settled: on
    // the four types that require zero it is 0 by the refusal above, and on
    // the other types it is whatever the account held, reported and left
    // alone.
    closingBalance: residual,
    rowCount: 1,
    // RETIRED 2026-09-08 with the settlement policies. The response used to
    // name the policy applied and the account the residual moved to; CLOSE
    // moves nothing now, so there is no destination to report.
    // policy,
    // settledResidual: residual,
    // destinationAccountId: isTransfer ? counterpartAccountId : null,
    // destinationAccountName: isTransfer ? counterpartAccountName : null,
  };
}; //END of processCloseAccount

//===================================
// 🛡️ TRANSACTION MANAGEMENT
/**
 * ⚡ EXECUTE WITH TRANSACTION SAFETY
 * Wrapper for transactional operations with proper cleanup
 */
// const executeWithTransaction = async (operation, needsTransaction = true) => {
//   let dbClient = null;

//   try {
//     if (needsTransaction) {
//       dbClient = await pool.connect();
//       await dbClient.query('BEGIN');
//     }

//     const result = await operation(dbClient || pool);

//     if (needsTransaction) {
//       await dbClient.query('COMMIT');
//     }

//     return result;
//   } catch (error) {
//     if (dbClient) {
//       try {
//         await dbClient.query('ROLLBACK');
//         console.error(pc.red('Transaction ROLLBACK successful.'));
//       } catch (rollbackError) {
//         console.error(pc.red('Error during ROLLBACK:'), rollbackError);
//       }
//     }
//     throw error;
//   } finally {
//     if (dbClient && dbClient.release) {
//       dbClient.release();
//     }
//   }
// };//END of executeWithTransaction
//===================================
// 🎯 MAIN SERVICE FUNCTION
/**
 * ⚛️ DELETE ACCOUNT SERVICE
 * Main entry point for account deletion operations
 */
//===================================
// 🔑 Deletes an account based on deletionType (SOFT, HARD, RTA).
// RTA executes a full atomic transaction to annul history before hard deletion.

export const deleteAccountService = async (
  // FROM REQUEST OBJECT:
  userId,
  targetAccountId,
  userRole,
  deletionType,
  // CONDITIONAL RTA PARAMETER:
  targetAccountName = 'Unknown', // RTA execution data - cosmetic only, see processRTAAnnulment
  // CONDITIONAL CLOSE PARAMETERS:
  policy, // which settlement policy CLOSE applies (CLOSE_POLICY_DISCARD | CLOSE_POLICY_TRANSFER); ignored by every other deletion type
  destinationAccountId, // where the residual goes under TRANSFER; ignored by DISCARD and by every other deletion type
  expectedResidual, // the balance the owner was shown and confirmed; required by CLOSE under both policies, ignored by every other deletion type
) => {
  // =========================================
  // 🚀 RTA ANNULMENT EXECUTION (ATOMIC TRANSACTION)
  // =========================================
  console.log('Executing:', 'RTA ANNULMENT EXECUTION FROM :');
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  console.log('deleteAccountService', userId);

  // 1. Initial Validation: Check if the Target Account exists
  // The type name joins in for the system-account guard below. INNER is safe:
  // 033_require_account_type.sql made account_type_id NOT NULL, so no account
  // row can fail to match. Every existing reader of accountCheck takes named
  // columns off ua.*, which this leaves untouched.
  const accountCheck = await pool.query(
    `SELECT ua.*, act.account_type_name
       FROM user_accounts ua
       JOIN account_types act ON ua.account_type_id = act.account_type_id
      WHERE ua.account_id = $1 AND ua.user_id = $2`,
    [targetAccountId, userId],
  );

  if (accountCheck.rows.length === 0) {
    throw createError(
      messages.notFound.status,
      messages.notFound.messagefn(targetAccountId),
    );
  }

 // Carlos's ruling, 2026-09-07: the compensation account, and any other
 // account the system creates for itself, cannot be deleted by any method.
 // Reusing the creation whitelist keeps creation and deletion on one list so
 // they cannot drift. Before the branch deliberately, so one guard covers all
 // four deletion types.
 //
 // Both arms ask about the row, never about a resolved account: the resolver
 // can fork, and a resolve-and-compare guard would protect one sibling only.
 const targetAccountTypeName = String(
  accountCheck.rows[0].account_type_name ?? '',
 ).toLowerCase();

 // The name arm is not redundant: the type only exists once 031 has run, and
 // before it this account is typed 'bank', which is on the whitelist. Full
 // argument, including the accepted false positive and the retirement
 // condition, in PLAN_ACCOUNT_DELETION.md under the system-account guard.
 //
 // storedAccountName, not the targetAccountName parameter this function
 // already carries: that one is client-supplied and cosmetic by its own
 // declaration. A guard must read the stored row.
 const storedAccountName = accountCheck.rows[0].account_name;
 const isBoundaryByName =
  String(storedAccountName ?? '')
   .trim()
   .toLowerCase() === BOUNDARY_ACCOUNT_NAME;

 if (
  !USER_CREATABLE_ACCOUNT_TYPES.includes(targetAccountTypeName) ||
  isBoundaryByName
 ) {
  throw createError(
   403,
   isBoundaryByName
    ? `Account ${targetAccountId} is named '${storedAccountName}', the name the system reserves for the compensation counterpart it posts closures and reversals against. It cannot be closed, deleted or reversed. Rename it first if it is your own account.`
    : `Account ${targetAccountId} is a '${targetAccountTypeName}' account created and maintained by the system. It cannot be closed, deleted or reversed.`,
  );
 }
  //------------------------------------------
  // 🚀 RTA Annulment Flow (Atomic Transaction)
  // ------------------------------------------
  //validate deletion type
  if (deletionType === DELETION_TYPE_RTA) {
    // 1. TRANSACTION_SETUP - Inicialización y validación
    // Administrative privilege suspended (Carlos, 2026-09-07): RTA is open to
    // the account's owner. Kept commented rather than removed so the
    // restriction can be restored without rewriting it.
    // if (!isAdmin) {
    //   throw createError(
    //     messages.rtaUserPermissionDenied.status,
    //     messages.rtaUserPermissionDenied.messagefn(),
    //   );
    // }

    // A closed account is not reversible either (Carlos's ruling on hard
    // delete, 2026-09-07, extended here for the same reason and one more).
    // RTA ends in the same eraseAccountTail, so without this it destroys the
    // preserved history and the pocket allocations through the other door -
    // raised by `e4` while the hard-delete guard was being written.
    // The extra reason is money: closing wrote a settlement pair moving the
    // residual out, those rows belong to this account, and the impact report
    // reads them. RTA would annul the destination's receipt of the residual
    // while erasing the account that sent it, so the residual would be taken
    // back from a live account and returned to nothing.
    //
    // Same pre-034 defect as the hard-delete branch's copy of this test, held
    // for the same reason. With that one, no deletion type can be applied to a
    // closed account - which fixes its OWN name in its settlement pair, but not
    // the counterpart's: the erasure rewrite is keyed on the account being
    // deleted, so under TRANSFER, deleting the counterpart later replaces its
    // name in the closed account's surviving leg. Under DISCARD the
    // counterpart is the compensation account, which the guard above refuses.
    if (accountCheck.rows[0].closed_at !== null) {
      throw createError(
        400,
        `Account ${targetAccountId} was closed and settled. A closed account cannot be reverted with RTA; its residual has already been moved and reversing it now would take that amount back from the account that received it.`,
      );
    }

    let dbClient;
    try {
      const transactionDate = new Date();
      // 2. BEGIN_HANDLER - Manejo seguro de BEGIN transaction
      dbClient = await pool.connect();
      await dbClient.query('BEGIN');
      console.log(
        pc.red('RTA Transaction BEGIN for Target ID:'),
        targetAccountId,
      );

      // 3. RTA PROCESS EXECUTION - processRTAAnnulment locks the target
      // account, computes its own impact report inside this transaction
      // (never a client-supplied one), and handles both the non-empty and
      // zero-impact cases internally.
      const rtaData = await processRTAAnnulment(
        dbClient,
        userId,
        +targetAccountId,
        targetAccountName,
        transactionDate,
        // The name to scrub out of surviving descriptions: the account's
        // actual current name, not the client-supplied targetAccountName
        // used above to build the new annulment rows' text.
        accountCheck.rows[0].account_name,
      );

      const rtaResult = {
        adjustedAccounts: rtaData.adjustedAccounts,
        finalSlackBalance: rtaData.finalSlackBalance,
        actionType: 'RTA_ANNULMENT',
      };

      // 5. COMMIT_HANDLER - (ÚNICO PUNTO DE COMMIT)
      await dbClient.query('COMMIT');
      console.log(pc.green('RTA Transaction COMMIT successful.'));

      // 6. RTA_SUCCESS_RESPONSE - Respuesta exitosa estandarizada
      console.log(
        'RTA_SUCCESS_RESPONSE msg:',
        messages.rtaSuccess.messagefn(
          targetAccountName,
          targetAccountId,
          rtaResult.adjustedAccounts,
        ),
      );

      return {
        status: messages.rtaSuccess.status,

        message: messages.rtaSuccess.messagefn(
          targetAccountName,
          targetAccountId,
          rtaResult.adjustedAccounts,
        ),

        data: {
          deletedAccountId: targetAccountId,
          action: rtaResult.actionType,
          accountsCorrected: rtaResult.adjustedAccounts,
          deletionType: DELETION_TYPE_RTA,
          finalSlackBalance: rtaResult.finalSlackBalance,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      // 7. ROLLBACK_HANDLER - Manejo de errores con ROLLBACK
      if (dbClient) {
        try {
          await dbClient.query('ROLLBACK');
          console.error(
            pc.red('RTA Transaction ROLLBACK due to error:'),
            error.message,
          );
        } catch (rollbackError) {
          console.error(pc.red('CRITICAL: Rollback failed:'), rollbackError);
        }
      }

      // 8. ERROR_PROPAGATION - Manejo unificado de errores
      console.error(pc.red('RTA Annulment failed:'), error);

      // Usar mensajes configurados para errores conocidos
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error; // Preservar errores de negocio existentes
      }
      // Para errores no manejados, usar handlePostgresError
      const { code, message } = handlePostgresError(error);
      throw createError(code, message);
    } finally {
      // 9 . CLIENT_CLEANUP - Liberación garantizada de dbClient
      if (dbClient && dbClient.release) {
        dbClient.release();
        console.log(pc.yellow('Database client released back to pool.'));
      }
    }
  }
  // ============================================
  // 🗑️ STANDARD DELETE FLOW
  // ============================================
  else {
    let dbClient;
    try {
      // ✅ Usar transacción también para STANDARD DELETE
      dbClient = await pool.connect();
      await dbClient.query('BEGIN');

      // 10. STANDARD_DELETE_VALIDATION - specific validations
      // Administrative privilege suspended (Carlos, 2026-09-07): hard delete
      // is open to the account's owner. Kept commented rather than removed.
      // The balance check inside processStandardDelete is NOT a privilege
      // check and stays in force - it refuses to erase an account whose
      // ledger residual is not zero, for any caller.
      // if (!isAdmin && deletionType === DELETION_TYPE_HARD) {
      //   throw createError(
      //     403,
      //     'Hard delete requires administrative privileges',
      //   );
      // }

      if (
        deletionType !== DELETION_TYPE_SOFT &&
        deletionType !== DELETION_TYPE_HARD &&
        deletionType !== DELETION_TYPE_CLOSE
      ) {
        throw createError(
          messages.deletionTypeInvalid.status,
          messages.deletionTypeInvalid.messagefn(),
        );
      }

      // 11. STANDARD_DELETE_EXECUTION
      const deleteResult =
        deletionType === DELETION_TYPE_CLOSE
          ? await processCloseAccount(
              dbClient,
              userId,
              targetAccountId,
              accountCheck,
              new Date(),
              // RETIRED 2026-09-08 with the settlement policies:
              // policy, destinationAccountId, expectedResidual
            )
          : await processStandardDelete(
              dbClient,
              userId,
              targetAccountId,
              deletionType,
              isAdmin,
              accountCheck,
            );
      await dbClient.query('COMMIT');

      // 12. RESPONSE_FORMATTER
      let successMessage;
      if (deletionType === DELETION_TYPE_HARD) {
        successMessage = messages.adminAction.messagefn(
          targetAccountId,
          'HARD_DELETE',
          'executed',
        );
      } else if (deletionType === DELETION_TYPE_CLOSE) {
        // Where the residual went is part of the outcome, not a detail: the
        // two policies differ by exactly that, and a message that only names
        // the amount reads identically for a transfer and for a write-off.
        successMessage = deleteResult.destinationAccountId
          ? `Account ${targetAccountId} closed. Residual settled: ${deleteResult.settledResidual}, transferred to "${deleteResult.destinationAccountName}".`
          : `Account ${targetAccountId} closed. Residual settled: ${deleteResult.settledResidual}, discarded to the system account.`;
      } else {
        successMessage = messages.userAction.messagefn(
          targetAccountId,
          'SOFT_DELETE',
        );
      }

      return {
        status: messages.success.status,
        message: successMessage,
        data: {
          deletedAccountId: targetAccountId,
          action: deleteResult.actionType,
          deletionType: deleteResult.deletionType,
          timestamp: new Date().toISOString(),
          ...(deletionType === DELETION_TYPE_CLOSE && {
            policy: deleteResult.policy,
            settledResidual: deleteResult.settledResidual,
            destinationAccountId: deleteResult.destinationAccountId,
            destinationAccountName: deleteResult.destinationAccountName,
          }),
        },
      };
    } catch (error) {
      if (dbClient) {
        await dbClient.query('ROLLBACK');
      }

      // 13. ERROR_PROPAGATION - Unified Error handler
      console.error(pc.red('Standard delete failed:'), error);

      // Usar mensajes configurados cuando sea posible
      if (error.message?.includes('already soft deleted')) {
        throw createError(
          messages.softDeleted.status,
          messages.softDeleted.messagefn(),
        );
      }
      if (error.message?.includes('Failed to')) {
        throw createError(
          messages.failedToDeleted.status,
          messages.failedToDeleted.messagefn(targetAccountId, deletionType),
        );
      }

      //  handlePostgresError for db errors
      if (error.code) {
        const { code, message } = handlePostgresError(error);
        throw createError(code, message);
      }
      throw error; // Propagar error original
    } finally {
      if (dbClient) {
        dbClient.release();
      }
    }
  }
};
