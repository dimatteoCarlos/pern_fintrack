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
  CLOSE_POLICY_DISCARD,
  USER_ACTION,
} from '../../controllers/accountDeleteController.js';

// RTA Utilities
import { checkAndInsertAccount } from '../../../utils/fintrackUtils/accountManagement/checkAndInsertAccount.js';

import { setAccountBalanceFromLedger } from '../../../utils/fintrackUtils/accountManagement/setAccountBalanceFromLedger.js';

import { recordAnnulmentTransaction } from '../../../utils/fintrackUtils/accountDeletionUtils/recordAnnulmentTransaction.js';
import { recordClosureSettlement } from '../../../utils/fintrackUtils/accountDeletionUtils/recordClosureSettlement.js';
import { lockAndDeriveBalances } from '../../../utils/fintrackUtils/accountManagement/lockAndDeriveBalances.js';
import { eraseAccountTail } from '../../../utils/fintrackUtils/accountDeletionUtils/eraseAccountTail.js';
import { assessDeletionImpact } from './getAnnulmentImpactReport.js';
import { getCurrencyCode } from '../../../utils/currencyLookup.js';
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

    // Interim guard (PLAN_ACCOUNT_DELETION.md "HARD/DELETE settlement gap",
    // 2026-09-06). §3.2 requires settling the residual before erasure -
    // "unless those rows already sum to zero, the global ledger stops
    // closing" - and unit 7's settlement engine does not exist yet. Rather
    // than erase a nonzero-balance account unsettled, refuse it. The lock
    // closes the same concurrency gap RTA's own execution closed (unit 6):
    // held here, nothing can change the balance between this check and the
    // erasure below.
    const targetBalances = await lockAndDeriveBalances(dbClient, userId, [
      targetAccountId,
    ]);
    const targetBalance = parseFloat(targetBalances.get(targetAccountId));

    if (targetBalance !== 0) {
      throw createError(
        409,
        `Account ${targetAccountId} has a nonzero balance (${targetBalance}) and cannot be hard-deleted without settlement. Use RTA to reverse its effects first.`,
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
    // Soft delete
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
  const queryText =
    'UPDATE user_accounts ua SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE (ua.account_id = $1 AND ua.user_id = $2) AND ua.deleted_at IS NULL';
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

// Release gate ("Gate, stated per branch, not per person", plan doc, unit
// 5/7 catalog decision): no movement_type_id 10 row could be written until
// overviewInvestmentRepository.js's reconciliation accounted for that type on
// BOTH main and feat/overview.
//
// Cleared 2026-09-07, Carlos, on measurements rather than on this code looking
// ready. Both branches carry the closure-adjustment term - main sums the
// closure movement type together with the historic annulment-prefixed rows,
// feat/overview sums the movement type. The earlier claim here that main had
// no such term at all was true when written and stopped being true when the
// Investment card shipped it.
//
// What the measurement covered, so a later reader knows what it does not: a
// real settlement written through this path on fintrack_dev moves the card's
// closure term by exactly the negation of the residual and leaves the realised
// term alone, the identity closes, and only the target leg is inside the
// published account set - the boundary counterpart stays out. Rolled back both
// times. See scripts/verifyClosureSettlement.js for the writer and
// scripts/verifyCloseAccount.js for this whole path.
const CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED = true;

/**
 * 📝 PROCESS CLOSE ACCOUNT
 * CLOSE, DISCARD policy only (§3.1): settle the residual against the
 * boundary account, assert it is zero, then mark deleted_at - the row and
 * its transactions survive, unlike DELETE/HARD.
 *
 * Exported so it can be exercised on a caller's own transaction. The only
 * other way in is deleteAccountService, which opens a connection and commits,
 * so nothing could check what this writes without really closing an account.
 * It takes the client rather than opening one, which is what makes a
 * rolled-back verification possible - see scripts/verifyCloseAccount.js.
 */
export const processCloseAccount = async (
  dbClient,
  userId,
  targetAccountId,
  policy,
  accountCheck,
  transactionDate,
) => {
  if (!CLOSE_SETTLEMENT_RELEASE_GATE_CLEARED) {
    // 409, not 503: this is not a transient outage a retry will clear - it is
    // a permanent block on the current system state (main's investment card
    // has no closure-adjustment term yet). 503 reads as retryable to generic
    // client/proxy retry logic, which would loop forever on a gate that only
    // a code change lifts (pern-fintrack-cf, 2026-09-06). Same reasoning as
    // the HARD-delete guard above, which uses 409 for the same kind of
    // state-dependent refusal.
    throw createError(
      409,
      'CLOSE is not released yet: the investment card reconciliation on main ' +
        'and feat/overview must account for movement_type_id 10 first (see ' +
        'PLAN_ACCOUNT_DELETION.md, unit 5/7 catalog decision, "Gate, stated ' +
        'per branch"). Coordinate with the Overview branch before clearing ' +
        'this gate.',
    );
  }

  if (accountCheck.rows[0].deleted_at !== null) {
    throw createError(400, 'Account is already closed');
  }

  if (policy !== CLOSE_POLICY_DISCARD) {
    // TRANSFER needs a validated destination account (D2, destination
    // eligibility - unit 9), still open. DISCARD needs no destination, so it
    // ships first.
    throw createError(
      400,
      `CLOSE policy '${policy}' is not available yet. Only DISCARD is implemented; TRANSFER is blocked on destination-eligibility rules (D2).`,
    );
  }

  // Get/create the boundary account - the same compensation counterpart RTA
  // uses, identified structurally by account_type (unit 5).
  const boundaryAccountInfo = await checkAndInsertAccount(dbClient, userId);
  const boundaryAccount = boundaryAccountInfo.account;

  // 1 LOCK + 2 ASSESS: lock target and boundary together, derive both
  // balances from the locked state.
  const balances = await lockAndDeriveBalances(dbClient, userId, [
    targetAccountId,
    boundaryAccount.account_id,
  ]);
  const residual = parseFloat(balances.get(targetAccountId));

  // 4 SETTLE: write the DISCARD pair only if there is something to settle.
  // A target already at zero needs no transaction - a zero-amount row would
  // carry no financial meaning.
  if (residual !== 0) {
    const currencyCode = await getCurrencyCode(
      dbClient,
      accountCheck.rows[0].currency_id,
    );

    await recordClosureSettlement(dbClient, {
      userId,
      targetAccountId,
      targetAccountName: accountCheck.rows[0].account_name,
      boundaryAccountId: boundaryAccount.account_id,
      residual,
      currencyId: accountCheck.rows[0].currency_id,
      currencyCode,
      transactionDate,
    });

    await setAccountBalanceFromLedger(dbClient, targetAccountId, userId);
    await setAccountBalanceFromLedger(
      dbClient,
      boundaryAccount.account_id,
      userId,
    );
  }

  // 5 ASSERT residual(A) = 0 - re-derive rather than trust the arithmetic,
  // the same discipline the HARD-delete guard above applies before its own
  // decision.
  const postSettlementBalances = await lockAndDeriveBalances(
    dbClient,
    userId,
    [targetAccountId],
  );
  const postResidual = parseFloat(postSettlementBalances.get(targetAccountId));
  if (postResidual !== 0) {
    throw createError(
      500,
      `Settlement failed to zero account ${targetAccountId} (residual ${postResidual}).`,
    );
  }

  // 6c MARK: deleted_at = CURRENT_TIMESTAMP. CLOSE keeps the row - the
  // column still means CLOSED, not DELETED, until D6's rename (unit 8).
  const markResult = await dbClient.query(
    'UPDATE user_accounts SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE account_id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING account_id',
    [targetAccountId, userId],
  );

  if (markResult.rowCount === 0) {
    throw createError(500, `Failed to close account ${targetAccountId}`);
  }

  return {
    actionType: USER_ACTION,
    deletionType: DELETION_TYPE_CLOSE,
    settledResidual: residual,
    rowCount: 1,
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
  policy, // which settlement policy CLOSE applies (CLOSE_POLICY_DISCARD | CLOSE_POLICY_TRANSFER); ignored by every other deletion type
) => {
  // =========================================
  // 🚀 RTA ANNULMENT EXECUTION (ATOMIC TRANSACTION)
  // =========================================
  console.log('Executing:', 'RTA ANNULMENT EXECUTION FROM :');
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  console.log('deleteAccountService', userId);

  // 1. Initial Validation: Check if the Target Account exists
  const accountCheck = await pool.query(
    'SELECT * FROM user_accounts ua WHERE ua.account_id = $1 AND ua.user_id = $2',
    [targetAccountId, userId],
  );

  if (accountCheck.rows.length === 0) {
    throw createError(
      messages.notFound.status,
      messages.notFound.messagefn(targetAccountId),
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
              policy,
              accountCheck,
              new Date(),
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
        successMessage = `Account ${targetAccountId} closed. Residual settled: ${deleteResult.settledResidual}.`;
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
            settledResidual: deleteResult.settledResidual,
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
