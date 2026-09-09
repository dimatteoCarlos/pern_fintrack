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
// Uncommented 2026-09-08 for the balance reversal, which stamps the currency
// code into both legs' descriptions. It had been commented with the settlement
// that used it.
import { getCurrencyCode } from '../../../utils/currencyLookup.js';
import { recordBalanceReversal } from '../../../utils/fintrackUtils/accountDeletionUtils/recordBalanceReversal.js';

// Block 3 step 1. Both are reused rather than reimplemented, on the owner's
// ruling of 2026-09-08: the close does not write its own version of a release
// or of a budget decision, it calls the ones the modules already own.
import { pocketAllocationService } from '../pocket_services/services/pocketAllocationService.js';
import {
 resolveCurrentMonth,
 writeAllocation,
} from '../budget_services/db/budgetAllocationRepository.js';
import { getUserTimeZone } from '../../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../config/fintrackConfig.js';

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

// The 1:1 extension row each account type carries, and the table it lives in.
// Four of the eight catalog types have one; bank, cash, investment and
// boundary keep everything on user_accounts and appear here as an absence
// rather than as a null entry, so a lookup that misses means "no extension"
// and never "type not handled".
//
// Written out rather than derived from the catalog, for the reason
// CLOSE_ZERO_BALANCE_TYPES gives above: a type added to account_types must not
// silently acquire a table this operation would then fail to find.
//
// It is also the only source the close interpolates a table name from. The
// value is a frozen literal reached by a key compared against the catalog's
// own names, never a string from the request, which is what makes the
// interpolation below safe.
const CLOSE_EXTENSION_TABLES = Object.freeze({
  income_source: 'income_source_accounts',
  category_budget: 'category_budget_accounts',
  debtor: 'debtor_accounts',
  pocket_saving: 'pocket_saving_accounts',
});
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
    const targetBalance = residualOf(targetBalances, targetAccountId);

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
 * still holds money, then remove the account and keep its identity. It settles
 * nothing, transfers nothing, discards nothing, reverses nothing and writes no
 * transaction of any kind. In his words, "CLOSE solamente elimina la entidad de
 * cuenta y conserva su identidad/historia."
 *
 * The refusal covers bank, cash, investment and debtor. The owner resolves a
 * balance outside CLOSE - through the ordinary transfer screen - and closes
 * afterwards, which leaves him a movement he can read instead of one written
 * on his behalf against an account no view renders.
 *
 * WHAT IT DOES, in the order the owner fixed, all on the caller's client and
 * all inside one transaction: lock the account, derive its balance from the
 * ledger, refuse a nonzero balance on the four types that hold one, release
 * every pocket allocation the account was backing, write a terminating zero on
 * a category budget's month series, upsert the account_registry row with the
 * closure stamp, delete the extension row, delete the user_accounts row.
 *
 * THIS HEADER SAID "WHAT IS NOT HERE YET" UNTIL 2026-09-08 and listed the last
 * four of those. They all landed that day. The statement that marked the row
 * closed instead of deleting it is retired and left commented below - it
 * existed because foreign keys refused the delete, never because marking was
 * the intent.
 *
 * Exported so it can be exercised on a caller's own transaction. The only
 * other way in is deleteAccountService, which opens a connection and commits,
 * so nothing could check what this writes without really closing an account.
 * It takes the client rather than opening one, which is what makes a
 * rolled-back verification possible - see scripts/verifyClose.js.
 *
 * The two probes this line used to name, verifyCloseAccount.js and
 * verifyCloseTransfer.js, are retired: they assert a settlement that no longer
 * happens, and both fail before their first assertion because they import two
 * policy constants the controller no longer exports.
 *
 * @param {object} accountCheck - the target's row, already read with its
 *   account_type_name joined in. The type is what decides whether the
 *   zero-balance refusal applies, so this path never re-queries it.
 */
// 036_cap_close_reason_length.sql's chk_close_reason_length, restated so the
// refusal above can name the number. Changing one without the other makes the
// service refuse what the database accepts, or hand the caller a constraint
// name instead of a field name.
export const CLOSE_REASON_MAX_LENGTH = 255;

// THE MAP IS KEYED BY THE COLUMN'S TYPE, NOT BY THE REQUEST'S, and reading it
// with the wrong one produced a wrong ANSWER rather than an error.
// lockAndDeriveBalances keys on account_id as pg returns it, which is a number;
// the delete route passed the path segment as the string it arrives as, so
// every lookup here returned undefined and parseFloat made it NaN. NaN passes
// every `!== 0` test in this file, so the close entered its reversal branch and
// handed NaN to the writer, whose `!balance` guard reported it to the owner as
// "the balance is already zero" - on an account holding 17.42. The hard delete
// refused the same account for holding NaN.
//
// The coercion here is not the fix; the route is. This is the check that makes
// the same mistake fail by name the next time, from a caller nobody has written
// yet.
const residualOf = (balances, accountId) => {
  const balance = balances.get(Number(accountId));

  if (balance === undefined) {
    throw createError(
      500,
      `No derived balance came back for account ${accountId}. The balance map holds ${balances.size} entry(ies) and none of them is this account.`,
    );
  }

  const residual = parseFloat(balance);

  if (!Number.isFinite(residual)) {
    throw createError(
      500,
      `The derived balance of account ${accountId} is not a number: ${balance}.`,
    );
  }

  return residual;
};

export const processCloseAccount = async (
  dbClient,
  userId,
  targetAccountId,
  accountCheck,
  transactionDate,
  // The owner's stated reason for closing. Mandatory, free text, and it is the
  // schema that makes it so - see the refusal below.
  closeReason,
  // WHETHER THE OWNER ASKED TO REVERSE THE BALANCE FIRST. The one decision the
  // screen offers for a balance that blocks the close, and the only thing the
  // owner chooses about the reversal - not the amount, the destination, the
  // date or the direction, all of which follow from the balance itself.
  //
  // Defaults to false, so every existing caller keeps the refusal it had.
  reverseBalance = false,
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

  // THE REASON IS MANDATORY, and the schema is what makes it so rather than
  // this check. 035 declares chk_close_reason_accompanies_closure as
  // (closed_at IS NULL) = (close_reason IS NULL) AND (close_reason IS NULL OR
  // close_reason ~ '[^[:space:]]'), so a closure stamp without a reason, or
  // with one made only of whitespace, is refused by the database itself.
  //
  // Repeated here for two reasons. The caller gets a 400 naming the field
  // instead of a 500 carrying a constraint name, and the refusal happens
  // before the lock below, so a request that was never going to succeed takes
  // no row lock on its way to being refused - the same reasoning the retired
  // echo parse used.
  //
  // trim() is stricter than the constraint's regex and never looser: every
  // character it strips is one Postgres also treats as space, plus a few it
  // does not, so no string this accepts can fail the CHECK.
  const reason = String(closeReason ?? '').trim();

  if (reason === '') {
    throw createError(
      400,
      'closeReason is required to close an account. The account row is ' +
        'deleted by this operation and the registry entry is what survives ' +
        'it, so the reason is the only record of why the account stopped ' +
        'existing.',
    );
  }

  // AND IT HAS A CEILING, for the same reason and by the same division of
  // labour as the check above: 036 declares chk_close_reason_length as
  // (close_reason IS NULL OR length(close_reason) <= 255), so the database is
  // the enforcement and this is what makes the refusal readable and keeps it
  // ahead of the lock.
  //
  // length() and not a byte count, matching the constraint: the owner types
  // characters, and an accented reason would otherwise get fewer of them for
  // the same visible length.
  //
  // Measured against the TRIMMED reason, which is also what gets stored, so a
  // string this accepts cannot fail the CHECK on the way in.
  if (reason.length > CLOSE_REASON_MAX_LENGTH) {
    throw createError(
      400,
      `closeReason is limited to ${CLOSE_REASON_MAX_LENGTH} characters and ` +
        `carried ${reason.length}. The registry entry is the only record of ` +
        'why the account stopped existing, so the reason is a line of text ' +
        'rather than a document.',
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
  //
  // THE COMPENSATION ACCOUNT JOINS THE LOCK SET WHEN A REVERSAL IS ASKED FOR,
  // and it is resolved before the lock because it has to exist to be locked -
  // checkAndInsertAccount is find-or-create and identifies it structurally by
  // account_type 'boundary', never by name alone. Two concurrent closes of two
  // different accounts both post a leg on it, and without it in the lock set
  // their two derivations of its balance interleave.
  let counterpartAccount = null;

  if (reverseBalance) {
    const { account } = await checkAndInsertAccount(dbClient, userId);
    counterpartAccount = account;
  }

  const lockSet = counterpartAccount
    ? [targetAccountId, counterpartAccount.account_id]
    : [targetAccountId];

  const balances = await lockAndDeriveBalances(dbClient, userId, lockSet);
  let residual = residualOf(balances, targetAccountId);

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

  // THE REVERSAL RUNS BEFORE THE REFUSAL, INSIDE THIS SAME TRANSACTION. Two
  // actions to the owner, one atomic operation to the database: the state
  // "reversed, not closed" must not be reachable, which is the whole reason
  // this is one request rather than two.
  //
  // NOT GATED ON THE TYPE. CLOSE_ZERO_BALANCE_TYPES decides which types are
  // OFFERED the reversal on the screen, because the other three close at any
  // balance and never need neutralising. The owner made that distinction
  // explicitly as a statement about the offer and not a prohibition, so a
  // caller that asks for it on another type gets it rather than a refusal
  // invented here.
  //
  // The residual is reassigned rather than recomputed from a second read. The
  // reversal writes exactly its negation on a locked account, so zero is the
  // arithmetic result; the assertion after the writes is what checks it against
  // the ledger rather than against this line.
  if (reverseBalance && residual !== 0) {
    const currencyCode = await getCurrencyCode(
      dbClient,
      accountCheck.rows[0].currency_id,
    );

    await recordBalanceReversal(dbClient, {
      userId,
      targetAccountId,
      targetAccountName: accountCheck.rows[0].account_name,
      counterpartAccountId: counterpartAccount.account_id,
      counterpartAccountName: counterpartAccount.account_name,
      balance: residual,
      currencyId: accountCheck.rows[0].currency_id,
      currencyCode,
      transactionDate,
    });

    // Both stored columns follow the ledger, the compensation account's
    // included. Its balance means something historically - it is excluded from
    // net worth and from aggregate balances, not from itself.
    await setAccountBalanceFromLedger(dbClient, targetAccountId, userId);
    await setAccountBalanceFromLedger(
      dbClient,
      counterpartAccount.account_id,
      userId,
    );

    // RE-DERIVED RATHER THAN TRUSTED, the same discipline the retired
    // settlement applied and the hard-delete guard still does. If this is not
    // zero the reversal did not do what it was for, and the close must not
    // proceed on the assumption that it did - 500, because nothing the owner
    // sent explains it.
    const postReversalBalances = await lockAndDeriveBalances(
      dbClient,
      userId,
      [targetAccountId],
    );
    residual = residualOf(postReversalBalances, targetAccountId);

    if (residual !== 0) {
      throw createError(
        500,
        `Balance reversal failed to zero account ${targetAccountId} ` +
          `(balance ${residual}). Nothing was closed.`,
      );
    }

    console.log(
      pc.green(
        `CLOSE: account ${targetAccountId} reversed to zero against ${counterpartAccount.account_id}.`,
      ),
    );
  }

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
  // ==========================================================================
  // BLOCK 3, FIRST HALF: what the account is holding on behalf of other things
  // is given back BEFORE the account stops existing. Both steps run on the
  // caller's dbClient, so they commit with the close or roll back with it.
  // ==========================================================================

  // RELEASE WHAT THE ACCOUNT COMMITTED TO POCKETS.
  //
  // A commitment is not money: allocating moves nothing, it only reserves part
  // of an account's balance so the rest reads as unassigned cash. That is why
  // this survives the zero-balance refusal above - an account can sit at zero
  // and still be backing a pocket, because the balance fell after the
  // commitment was made and allocating never checked it again.
  //
  // Enumerated per pocket rather than in one statement, because a release is
  // per (pocket, source account) pair - the running sum of that pair is the
  // figure the pocket module refuses to push below zero, and one total across
  // pockets could not be checked against it. HAVING SUM > 0 leaves out pairs
  // already settled: a zero pair has nothing to give back, and asking the
  // module to release zero would be refused by the amount <> 0 CHECK.
  const pocketHoldings = await dbClient.query(
    `SELECT pa.pocket_id AS "pocketId", SUM(pa.amount)::text AS held
       FROM pocket_allocations pa
      WHERE pa.user_id = $1 AND pa.source_account_id = $2
      GROUP BY pa.pocket_id
     HAVING SUM(pa.amount) > 0`,
    [userId, targetAccountId],
  );

  const releasedPockets = [];

  for (const holding of pocketHoldings.rows) {
    // The module's own release, on this transaction's client. It writes the
    // compensating row through the same statement the release form does, and
    // applies the same guards - the pair may not go below zero, the account
    // must still be undeleted, the pocket must be the owner's.
    //
    // ACCOUNTING_CURRENCY_CODE, not a lookup: the module refuses any source
    // account not kept in it, so an account that can hold a commitment is
    // already in that unit and the conversion is an identity.
    const released = await pocketAllocationService.release(
      userId,
      holding.pocketId,
      {
        sourceAccountId: targetAccountId,
        amount: Number(holding.held),
        currency: ACCOUNTING_CURRENCY_CODE,
      },
      dbClient,
    );

    releasedPockets.push({
      pocketId: holding.pocketId,
      amount: released.amount,
    });
  }

  // THE BUDGET SERIES STOPS AT THIS MONTH.
  //
  // Only a category_budget account has one. The rows live in
  // budget_monthly_allocations keyed by the extension row's account_id, so no
  // other type reaches this and the condition is the type rather than a count.
  //
  // writeAllocation with `to` null is the "stop budgeting" verb the budget
  // module already documents against itself: it deletes every decision after
  // `from` and writes the amount at `from`, leaving the months before it
  // untouched. That is the owner's ruling of 2026-09-08 exactly - past months
  // preserved, a terminating zero on the current month, and no future
  // carry-forward - reached by calling the module rather than by writing a
  // second version of it.
  //
  // The FX metadata is an identity and stating it is not the silence migration
  // 014 was written to end: zero is zero in every currency, so there is no
  // conversion here for a rate to describe. The currency ids are the account's
  // own, so the row reads in the same unit as the decisions before it.
  let budgetTerminatedAt = null;

  if (targetTypeName === 'category_budget') {
    const timeZone = await getUserTimeZone(dbClient, userId);
    const currentMonth = await resolveCurrentMonth(dbClient, timeZone);

    await writeAllocation(dbClient, targetAccountId, 0, currentMonth, null, {
      originalAmount: 0,
      originalCurrencyId: accountCheck.rows[0].currency_id,
      rate: 1,
      source: 'identity',
      fetchedAt: new Date(),
      targetCurrencyId: accountCheck.rows[0].currency_id,
    });

    budgetTerminatedAt = currentMonth;
  }

  // ==========================================================================
  // BLOCK 3, SECOND HALF: the account stops existing and its identity survives.
  // The order is the owner's, stated on 2026-09-08: write/update
  // account_registry, delete the extension row, delete user_accounts. All three
  // run on the caller's dbClient inside the transaction opened above.
  // ==========================================================================

  // READ THE EXTENSION ROW BEFORE ANYTHING DELETES IT. Three of the registry's
  // columns live only here, and 035's own comment says why they cannot be
  // recovered afterwards: budgetCalculationService folds its payload on
  // category_name and ACCOUNTS_QUERY publishes subcategory as its own field, so
  // neither may be reconstructed by parsing account_name.
  //
  // The nature is stamped as the catalog id rather than the name text, because
  // category_nature_types rows are never deleted and the existing LEFT JOIN
  // stays answerable against the id.
  const extensionTable = CLOSE_EXTENSION_TABLES[targetTypeName] ?? null;

  let extensionRow = null;

  if (targetTypeName === 'category_budget') {
    const extensionRead = await dbClient.query(
      `SELECT category_name, subcategory, category_nature_type_id, currency_id
         FROM category_budget_accounts
        WHERE account_id = $1`,
      [targetAccountId],
    );

    extensionRow = extensionRead.rows[0] ?? null;
  }

  // THE RESOLVED CURRENCY, not the raw column, because that is what the stamp
  // has to answer for. ACCOUNTS_QUERY reads
  // COALESCE(cba.currency_id, ua.currency_id) at
  // budgetTransactionRepository.js:125; once both rows are gone that COALESCE
  // has no second operand, so the registry has to already hold the value the
  // expression would have produced. On every other type the extension row
  // carries no currency this reader consults, and the account's own column is
  // the answer.
  const resolvedCurrencyId =
    extensionRow?.currency_id ?? accountCheck.rows[0].currency_id;

  // WRITE OR UPDATE THE REGISTRY ROW. An upsert rather than an UPDATE: the
  // trigger of 035 section 2 writes this row at account creation and the
  // backfill of section 3 covers the accounts that predate the table, but a
  // database where neither has reached this account would leave an UPDATE
  // matching nothing and the closure would vanish with the row it describes.
  //
  // The columns are stamped from the row being destroyed, not from the request.
  // account_created_at takes user_accounts.created_at - the ACCOUNT's creation
  // day, which is why 035 renamed the column away from a bare created_at.
  //
  // closed_by is the account's owner, which is the same userId every guard in
  // this path filtered on.
  const registryStamp = await dbClient.query(
    `INSERT INTO account_registry (
       account_id,
       user_id,
       account_name,
       account_type_id,
       currency_id,
       account_starting_amount,
       account_start_date,
       account_created_at,
       category_name,
       subcategory,
       category_nature_type_id,
       closed_at,
       closed_by,
       close_reason
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             CURRENT_TIMESTAMP, $2, $12)
     ON CONFLICT (account_id) DO UPDATE
       SET account_name = EXCLUDED.account_name,
           account_type_id = EXCLUDED.account_type_id,
           currency_id = EXCLUDED.currency_id,
           account_starting_amount = EXCLUDED.account_starting_amount,
           account_start_date = EXCLUDED.account_start_date,
           account_created_at = EXCLUDED.account_created_at,
           category_name = EXCLUDED.category_name,
           subcategory = EXCLUDED.subcategory,
           category_nature_type_id = EXCLUDED.category_nature_type_id,
           closed_at = EXCLUDED.closed_at,
           closed_by = EXCLUDED.closed_by,
           close_reason = EXCLUDED.close_reason
     RETURNING account_id, closed_at`,
    [
      targetAccountId,
      userId,
      accountCheck.rows[0].account_name,
      accountCheck.rows[0].account_type_id,
      resolvedCurrencyId,
      accountCheck.rows[0].account_starting_amount,
      accountCheck.rows[0].account_start_date,
      accountCheck.rows[0].created_at,
      extensionRow?.category_name ?? null,
      extensionRow?.subcategory ?? null,
      extensionRow?.category_nature_type_id ?? null,
      reason,
    ],
  );

  if (registryStamp.rowCount === 0) {
    throw createError(
      500,
      `Failed to record the closure of account ${targetAccountId}`,
    );
  }

  // DELETE THE EXTENSION ROW EXPLICITLY, although the foreign key would take it
  // anyway: every extension table declares account_id ... ON DELETE CASCADE
  // (002_accounts.sql:124, :142, :167, :193). Stated rather than left to the
  // cascade because the owner ruled the order, because it yields a count this
  // path can report, and because a cascade is a property of the schema that a
  // later migration can change without this file mentioning it.
  //
  // The table name is interpolated. It comes from CLOSE_EXTENSION_TABLES, a
  // frozen literal keyed by the catalog's own type name, and never from the
  // request.
  let extensionRowsDeleted = 0;

  if (extensionTable !== null) {
    const extensionDelete = await dbClient.query(
      `DELETE FROM ${extensionTable} WHERE account_id = $1`,
      [targetAccountId],
    );

    extensionRowsDeleted = extensionDelete.rowCount;
  }

  // DELETE THE ACCOUNT. This is the operation CLOSE is, in the owner's words of
  // 2026-09-08: "CLOSE solamente elimina la entidad de cuenta y conserva su
  // identidad/historia."
  //
  // NOT EXERCISABLE UNTIL 035 IS APPLIED, and that is the honest state rather
  // than a defect here. Four transactions keys, pocket_allocations and
  // budget_monthly_allocations all point into user_accounts with RESTRICT until
  // 035 repoints them at account_registry; before that DDL this statement is
  // refused by the first surviving reference, exactly as it should be.
  //
  // The deleted_at IS NULL predicate is kept from the UPDATE this replaces. The
  // row is already locked and already checked, so it can only fail on a state
  // this path did not create, which is what the 500 says.
  const deleteResult = await dbClient.query(
    `DELETE FROM user_accounts
      WHERE account_id = $1 AND user_id = $2 AND deleted_at IS NULL
      RETURNING account_id`,
    [targetAccountId, userId],
  );

  if (deleteResult.rowCount === 0) {
    throw createError(500, `Failed to close account ${targetAccountId}`);
  }

  // RETIRED 2026-09-08 by the second half of block 3, kept per the standing
  // rule that code is commented and not deleted. CLOSE marked the row while the
  // registry did not exist yet: it set closed_at and deleted_at and left the
  // account in place, because deleting it was refused by the foreign keys 035
  // repoints. The mark is not a step of the close any more - there is no row
  // left to carry it.
  //
  // const markResult = await dbClient.query(
  //   `UPDATE user_accounts
  //       SET closed_at = CURRENT_TIMESTAMP,
  //           deleted_at = CURRENT_TIMESTAMP,
  //           updated_at = CURRENT_TIMESTAMP
  //     WHERE account_id = $1 AND user_id = $2 AND deleted_at IS NULL
  //     RETURNING account_id`,
  //   [targetAccountId, userId],
  // );
  //
  // if (markResult.rowCount === 0) {
  //   throw createError(500, `Failed to close account ${targetAccountId}`);
  // }

  return {
    actionType: USER_ACTION,
    deletionType: DELETION_TYPE_CLOSE,
    // The balance the account carried at the moment it closed. Named
    // closingBalance and not settledResidual because nothing was settled: on
    // the four types that require zero it is 0 by the refusal above, and on
    // the other types it is whatever the account held, reported and left
    // alone.
    closingBalance: residual,
    // What the close gave back before it marked the row. Reported so the close
    // screen can name the pockets that changed rather than leaving the owner to
    // discover it on the pocket board.
    releasedPockets,
    budgetTerminatedAt,
    // The closure record, read back from the row that survives the account.
    // Reported because it is the only thing left to report: the account row is
    // gone by the time this returns.
    closeReason: reason,
    registryClosedAt: registryStamp.rows[0].closed_at,
    extensionRowsDeleted,
    rowCount: deleteResult.rowCount,
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
  // CONDITIONAL CLOSE PARAMETER:
  closeReason, // the owner's stated reason for closing; mandatory for CLOSE by 035's CHECK, ignored by every other deletion type
  reverseBalance = false, // CLOSE only: neutralise the balance against the compensation account first, in this same transaction; ignored by every other deletion type
  // RETIRED 2026-09-08 with the settlement policies. Removed from the signature
  // rather than left in place, because a positional parameter nobody passes
  // shifts every argument after it:
  // policy, // which settlement policy CLOSE applies (CLOSE_POLICY_DISCARD | CLOSE_POLICY_TRANSFER); ignored by every other deletion type
  // destinationAccountId, // where the residual goes under TRANSFER; ignored by DISCARD and by every other deletion type
  // expectedResidual, // the balance the owner was shown and confirmed; required by CLOSE under both policies, ignored by every other deletion type
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
              closeReason,
              reverseBalance,
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
        // What the close did, in the order it did it. The account row is gone,
        // so the message names what replaced it rather than a residual: no
        // residual is settled by this path.
        successMessage =
          `Account ${targetAccountId} closed and removed. Its history stays ` +
          'in the registry under the same account id.';
        // RETIRED 2026-09-08 with the settlement policies. Both branches read
        // fields the close no longer returns, so the message shipped the word
        // undefined where the amount used to be.
        //
        // successMessage = deleteResult.destinationAccountId
        //   ? `Account ${targetAccountId} closed. Residual settled: ${deleteResult.settledResidual}, transferred to "${deleteResult.destinationAccountName}".`
        //   : `Account ${targetAccountId} closed. Residual settled: ${deleteResult.settledResidual}, discarded to the system account.`;
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
            closingBalance: deleteResult.closingBalance,
            closeReason: deleteResult.closeReason,
            registryClosedAt: deleteResult.registryClosedAt,
            releasedPockets: deleteResult.releasedPockets,
            budgetTerminatedAt: deleteResult.budgetTerminatedAt,
            // RETIRED 2026-09-08 with the settlement policies. All four were
            // undefined from the moment the settlement left the service.
            // policy: deleteResult.policy,
            // settledResidual: deleteResult.settledResidual,
            // destinationAccountId: deleteResult.destinationAccountId,
            // destinationAccountName: deleteResult.destinationAccountName,
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
