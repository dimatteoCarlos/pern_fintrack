//backend/src/fintrack_api/controllers/accountDeleteController.js
import pc from 'picocolors';
import { createError } from '../../utils/errorHandling.js';
import { pool } from '../../db/config/configDB.js';

// 📚 SERVICES & UTILITIES
import {
  getAnnulmentImpactReport,
  getPocketAllocationImpact,
  getUnattributedAnnulmentTotal,
  foldNetAdjustmentTotal,
} from '../services/delete_account/getAnnulmentImpactReport.js';

import { getRelatedAccounts } from '../services/delete_account/getRelatedAccounts.js';

import { deleteAccountService } from '../services/delete_account/deleteAccountService.js';

import { getClosePreview } from '../services/delete_account/getClosePreview.js';

import { assessAccountDeletion } from '../services/delete_account/assessAccountDeletion.js';

// ===================================
// ⚙️ DELETION METHOD CONSTANTS
// Constants defined here establish the accepted API contract for deletion types
// ===================================
export const DELETION_TYPE_RTA = 'RTA';
export const DELETION_TYPE_HARD = 'HARD';
export const DELETION_TYPE_SOFT = 'SOFT';
export const DELETION_TYPE_CLOSE = 'CLOSE';

// RETIRED 2026-09-08, kept commented per the standing rule. CLOSE's two
// settlement policies: DISCARD sent the residual to the system's compensation
// account, TRANSFER to an account the owner picked from the eligible ones.
//
// The owner withdrew both from the close operation on 2026-09-08. TRANSFER
// survives as an ordinary Tracker operation - what ended is TRANSFER as the
// internal settlement mechanism of a closure. DISCARD has no successor: an
// account with a balance is now refused, and the owner moves the money out
// through the transfer screen before closing.
//
// Uncommenting these two lines is not enough to bring the policies back. The
// flow that read them is commented in deleteAccountService.js, and three
// imports there - recordClosureSettlement, assertTransferDestinationEligible
// and getCurrencyCode - are commented with it.
// export const CLOSE_POLICY_DISCARD = 'DISCARD';
// export const CLOSE_POLICY_TRANSFER = 'TRANSFER';

export const ADMIN_ACTION = 'ADMIN_ACTION';
export const USER_ACTION = 'USER_ACTION';
// =========================================
// 📊 RTA REPORT HANDLER
// Endpoint: GET /api/fintrack/account/delete/report_of_affected_accounts/:targetAccountId
// =========================================
export const generateImpactReport = async (req, res, next) => {
  // 1. EXTRACT PARAMS
  //userId must have been verified by middleware (req.user)
  const { userId } = req.user;
  //check if the userId exist in the database or verifyUser
  if (!userId) {
    const message = 'User ID is required';
    console.warn(pc.blueBright(message));
    return res.status(400).json({ status: 400, message });
  }

  const targetAccountId = parseInt(req.params.targetAccountId, 10);

  if (!targetAccountId || isNaN(targetAccountId)) {
    return next(
      createError(
        400,
        'Target Account ID is required and must be a valid number.',
      ),
    );
  }

  try {
    console.log(
      pc.magenta(
        `Generating Retrospective Total Annulment impact report for User ${userId.slice(0, 5) + '...'} and Account ${targetAccountId}`,
      ),
    );

    // 2. CALL SERVICE
    // The service handles the SQL logic to calculate the net financial impact.
    // pocketImpact is a separate, additive read (PLAN_ACCOUNT_DELETION.md
    // §5/Q8b via ACCOUNT_DELETION_METHODS.md): pockets this account backs,
    // shown so the owner sees them before confirming, never merged into
    // impactReport - that array's shape is relied on by processRTAAnnulment.
    // unattributed is the third read and is separate for the same reason:
    // the amount whose counterparty an earlier deletion already detached. The
    // report cannot carry it - it has no account to name - and the execution
    // path must not act on it, since that earlier deletion already reversed it.
    // relatedAccounts is the fourth read and the one the close screen renders.
    // It is not a variant of impactReport: that array projects what ANNULLING
    // this account would do to each counterparty, and the owner ruled on
    // 2026-09-08 that CLOSE settles nothing, so every projected figure is zero.
    // This one states what is true either way - which accounts this one has
    // operated with, how often, and when last.
    //
    // IT TRAVELS WITH THE REPORT RATHER THAN ON ITS OWN ROUTE because both are
    // built from TARGET_ACCOUNT_TRANSACTIONS_CTE over the same rows. Two
    // endpoints reading the same population is how one screen ends up naming
    // more counterparties than the other for the same account.
    const [impactReport, pocketImpact, unattributed, relatedAccounts] =
      await Promise.all([
        getAnnulmentImpactReport(pool, userId, targetAccountId),
        getPocketAllocationImpact(pool, userId, targetAccountId),
        getUnattributedAnnulmentTotal(pool, userId, targetAccountId),
        getRelatedAccounts(pool, userId, targetAccountId),
      ]);

    // Folded on the server rather than in the browser, which is where it was
    // being summed: adding money on the client is the thing this codebase does
    // not do, and the client's sum was short by exactly the unattributed
    // amount below, because it added the rows it could see.
    //
    // The fold itself lives beside the report it sums, not here, because the
    // assessment endpoint is a second consumer of it. Two copies of a money
    // fold is how two screens start quoting different totals for one account.
    const totalNetAdjustmentAmount = foldNetAdjustmentTotal(impactReport);

    // 3. SUCCESS RESPONSE
    return res.status(200).json({
      status: 200,
      message: 'RTA Impact Report generated successfully.',
      data: {
        impactReport: impactReport,
        totalNetAdjustmentAmount,
        pocketImpact,
        // The close screen's related-accounts panel. Same population as
        // impactReport, different question asked of it.
        relatedAccounts,
        // Displayed beside the report, never added to it. Zero and zero is the
        // ordinary answer; a nonzero amount is activity of this account that no
        // live account can be credited with, and the screen has to say so
        // rather than let the lines silently fail to add up.
        unattributedAmount: unattributed.amount,
        unattributedTransactionCount: unattributed.transactionCount,
        targetAccountId,
        affectedAccountsCount: impactReport.length,
      },
    });
  } catch (error) {
    // Errors are propagated to Express error middleware
    next(error);
  }
};
// =========================================
// 🎯 CLOSE PREVIEW HANDLER
// Endpoint: GET /api/fintrack/account/delete/close_preview/:targetAccountId
// =========================================
/**
 * What the close screen shows before the owner confirms: the residual the
 * account still holds, and the accounts that may receive it under TRANSFER.
 *
 * Read-only, and the destination list is the same query the write path
 * validates against - so the list the owner is shown and the rule the
 * settlement enforces cannot disagree.
 *
 * WHY THE RESIDUAL TRAVELS WITH THE LIST. The confirmation echoes the residual
 * back and the settlement refuses if it has moved (§4.1 step 3), so the screen
 * needs a figure derived the way the settlement derives it - not the stored
 * account_balance column an account list would give it, which drifts. It also
 * needs the residual whichever policy the owner picks, and the destinations
 * only under TRANSFER, but needs them at the moment the choice is offered.
 *
 * Renamed from listCloseTransferDestinations, and the path with it: the payload
 * now serves the whole screen rather than one dropdown on it. Nothing consumed
 * either name - the endpoint and this change shipped the same day, before any
 * frontend existed - and the previous payload's two fields are both still here.
 */
export const getCloseAccountPreview = async (req, res, next) => {
  const { userId } = req.user;

  if (!userId) {
    const message = 'User ID is required';
    console.warn(pc.blueBright(message));
    return res.status(400).json({ status: 400, message });
  }

  const targetAccountId = parseInt(req.params.targetAccountId, 10);

  if (!targetAccountId || isNaN(targetAccountId)) {
    return next(
      createError(
        400,
        'Target Account ID is required and must be a valid number.',
      ),
    );
  }

  try {
    console.log(
      pc.magenta(`Building the CLOSE preview for account ${targetAccountId}`),
    );

    const preview = await getClosePreview(pool, userId, targetAccountId);

    return res.status(200).json({
      status: 200,
      message: 'Close preview retrieved successfully.',
      data: {
        targetAccountId,
        ...preview,
      },
    });
  } catch (error) {
    next(error);
  }
};

// =========================================
// 🧭 DELETION ASSESSMENT HANDLER
// Endpoint: GET /api/fintrack/account/delete/assessment/:targetAccountId
// =========================================
/**
 * Every deletion type this account can take, and what each one costs, in one
 * read (PLAN_ACCOUNT_DELETION.md unit 6).
 *
 * The two preview endpoints above each answer for a type the owner has already
 * picked. This answers the question that comes before them, and it is the only
 * place that states the thing neither of them can: the types are not four equal
 * choices. Hard delete refuses a nonzero residual for any caller, and its own
 * refusal names RTA as the way to reach zero.
 *
 * Read-only and unlocked, on purpose - see the service for why a lock taken
 * here would be released before the owner confirms anything and would guarantee
 * nothing. Neither preview endpoint changes; this one is additive, so the
 * screens already reading them keep working unmodified.
 */
export const getDeletionAssessment = async (req, res, next) => {
  const { userId } = req.user;

  if (!userId) {
    const message = 'User ID is required';
    console.warn(pc.blueBright(message));
    return res.status(400).json({ status: 400, message });
  }

  const targetAccountId = parseInt(req.params.targetAccountId, 10);

  if (!targetAccountId || isNaN(targetAccountId)) {
    return next(
      createError(
        400,
        'Target Account ID is required and must be a valid number.',
      ),
    );
  }

  try {
    console.log(
      pc.magenta(`Assessing deletion options for account ${targetAccountId}`),
    );

    const assessment = await assessAccountDeletion(
      pool,
      userId,
      targetAccountId,
    );

    return res.status(200).json({
      status: 200,
      message: 'Deletion assessment generated successfully.',
      data: {
        targetAccountId,
        ...assessment,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// 💣 DELETE EXECUTION HANDLER
// Endpoint: DELETE /api/fintrack/accounts/:targetAccountId
// =============================================
export const executeAccountDeletion = async (req, res, next) => {
  // 1. EXTRACT PARAMS & AUTH
  const user = req.user;
  const { userId } = user;
  const userRole = req.user.role;
  const targetAccountId = req.params.targetAccountId;

  // Get deletionType from query (for simple deletes) or body (for RTA confirmation)
  const deletionType = req.query.type || req.body.deletionType;

  if (!targetAccountId || !deletionType) {
    return next(
      createError(400, 'Target Account ID and Deletion Type are required.'),
    );
  }

  // 2. RTA SPECIFIC DATA EXTRACTION (From the confirmation body)
  // impactReport is no longer read from the request: the service recomputes
  // it itself inside the transaction (PLAN_ACCOUNT_DELETION.md unit 6), so a
  // stale or tampered client copy can no longer drive the financial
  // adjustment. targetAccountName stays client-supplied - it is only used to
  // build the annulment rows' display text, never a financial figure.
  let targetAccountName = 'Unknown Account';

  if (deletionType === DELETION_TYPE_RTA) {
    targetAccountName = req.body.targetAccountName;
  }

  // RETIRED 2026-09-08. CLOSE took three body fields to drive its settlement:
  // which policy to apply, the account the owner picked to receive the
  // residual, and the residual they were shown so the service could refuse a
  // request whose figure had gone stale. CLOSE settles nothing now, so none of
  // the three has anything to drive.
  //
  // A request that still sends them is not refused - the fields are read by
  // nobody rather than rejected - because the frontend deploys separately from
  // the backend, so there is an interval in which the old screen posts to the
  // new service. Ignoring the fields keeps that interval working; rejecting
  // them would break it.
  //
  // const policy =
  //   deletionType === DELETION_TYPE_CLOSE ? req.body.policy : undefined;
  //
  // const destinationAccountId =
  //   deletionType === DELETION_TYPE_CLOSE
  //     ? req.body.destinationAccountId
  //     : undefined;
  //
  // const expectedResidual =
  //   deletionType === DELETION_TYPE_CLOSE
  //     ? req.body.expectedResidual
  //     : undefined;

  // CLOSE's one remaining body field, and the only one the service still reads.
  // Gated on the deletion type for the same reason the three retired reads
  // above were: every other type ignores it, and an undefined argument says
  // that more plainly than an empty string would.
  //
  // Without this read the service received undefined and refused every CLOSE
  // with the 400 it raises when the reason is blank - the parameter was added
  // to the service signature and never passed from here.
  const closeReason =
    deletionType === DELETION_TYPE_CLOSE ? req.body.closeReason : undefined;

  // CLOSE's second body field, added 2026-09-08. Whether the owner asked to
  // neutralise the balance against the compensation account before the close,
  // which is the one action the screen offers for a balance that blocks it.
  //
  // COMPARED TO true RATHER THAN COERCED. A JSON body can carry the string
  // "false", and `Boolean("false")` is true - a request explicitly declining
  // the reversal would then perform it. Only the boolean true and the string
  // "true" ask for it; anything else, absent included, does not.
  //
  // Gated on the deletion type like the reason above: no other deletion method
  // reads it, and an undefined argument says that more plainly than false does.
  const reverseBalance =
    deletionType === DELETION_TYPE_CLOSE
      ? req.body.reverseBalance === true || req.body.reverseBalance === 'true'
      : undefined;

  try {
    console.log(
      pc.magenta(
        `Attempting ${deletionType} deletion for Account ID: ${targetAccountId}`,
      ),
    );

    // 3. CALL DELETION SERVICE
    // The service is responsible for handling all complex transaction logic (BEGIN/COMMIT/ROLLBACK)
    // and data integrity for RTA, or executing the standard delete.
    console.log({
      userId,
      targetAccountId,
      userRole,
      deletionType,
      targetAccountName,
    });

    const serviceResult = await deleteAccountService(
      userId,
      targetAccountId,
      userRole,
      deletionType,
      targetAccountName,
      closeReason,
      reverseBalance,
      // policy,
      // destinationAccountId,
      // expectedResidual,
    );

    // 4. SUCCESS RESPONSE
    // The service returns a fully formatted response object (status, message, data)
    return res.status(serviceResult.status).json(serviceResult);
  } catch (error) {
    // Errors (business or DB) are propagated by the service
    next(error);
  }
};
