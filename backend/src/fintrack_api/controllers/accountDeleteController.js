//backend/src/fintrack_api/controllers/accountDeleteController.js
import pc from 'picocolors';
import { createError } from '../../utils/errorHandling.js';
import { pool } from '../../db/config/configDB.js';

// 📚 SERVICES & UTILITIES
import {
  getAnnulmentImpactReport,
  getPocketAllocationImpact,
  getUnattributedAnnulmentTotal,
} from '../services/delete_account/getAnnulmentImpactReport.js';

import { deleteAccountService } from '../services/delete_account/deleteAccountService.js';

import { listTransferDestinations } from '../services/delete_account/getCloseTransferDestinations.js';

// ===================================
// ⚙️ DELETION METHOD CONSTANTS
// Constants defined here establish the accepted API contract for deletion types
// ===================================
export const DELETION_TYPE_RTA = 'RTA';
export const DELETION_TYPE_HARD = 'HARD';
export const DELETION_TYPE_SOFT = 'SOFT';
export const DELETION_TYPE_CLOSE = 'CLOSE';

// CLOSE's two settlement policies (PLAN_ACCOUNT_DELETION.md §3.1/§4.1 step 4).
// DISCARD sends the residual to the system's compensation account, TRANSFER to
// an account the owner picks from the eligible ones. Both implemented as of
// 2026-09-07; the eligibility rule is frozen in the plan doc and lives in
// getCloseTransferDestinations.js.
export const CLOSE_POLICY_DISCARD = 'DISCARD';
export const CLOSE_POLICY_TRANSFER = 'TRANSFER';

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
    const [impactReport, pocketImpact, unattributed] = await Promise.all([
      getAnnulmentImpactReport(pool, userId, targetAccountId),
      getPocketAllocationImpact(pool, userId, targetAccountId),
      getUnattributedAnnulmentTotal(pool, userId, targetAccountId),
    ]);

    // 3. SUCCESS RESPONSE
    return res.status(200).json({
      status: 200,
      message: 'RTA Impact Report generated successfully.',
      data: {
        impactReport: impactReport,
        pocketImpact,
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
// 🎯 CLOSE TRANSFER DESTINATION HANDLER
// Endpoint: GET /api/fintrack/account/delete/transfer_destinations/:targetAccountId
// =========================================
/**
 * The accounts that may receive the residual when this account is closed under
 * the TRANSFER policy.
 *
 * Read-only, and the same query the write path validates against - so the list
 * the owner is shown and the rule the settlement enforces cannot disagree.
 *
 * An empty array is a legitimate answer, not an error: an owner whose only bank
 * account is the one being closed has nowhere to transfer to and must use
 * DISCARD. The frontend has to render that as its own state rather than as an
 * empty dropdown, which is why the count travels beside the list.
 */
export const listCloseTransferDestinations = async (req, res, next) => {
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
      pc.magenta(
        `Listing CLOSE/TRANSFER destinations for account ${targetAccountId}`,
      ),
    );

    const destinations = await listTransferDestinations(
      pool,
      userId,
      targetAccountId,
    );

    return res.status(200).json({
      status: 200,
      message: 'Eligible transfer destinations retrieved successfully.',
      data: {
        targetAccountId,
        destinations,
        destinationCount: destinations.length,
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

  // CLOSE-only: which settlement policy to apply, and under TRANSFER the
  // account the owner picked to receive the residual. Ignored by every other
  // deletion type.
  //
  // The destination is passed through raw rather than parsed here. The service
  // validates it inside its own transaction, with the row locked, because an
  // eligibility answered in the controller would be answered before the lock
  // and could be stale by the time the settlement writes.
  const policy =
    deletionType === DELETION_TYPE_CLOSE ? req.body.policy : undefined;

  const destinationAccountId =
    deletionType === DELETION_TYPE_CLOSE
      ? req.body.destinationAccountId
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
      policy,
      destinationAccountId,
    );

    // 4. SUCCESS RESPONSE
    // The service returns a fully formatted response object (status, message, data)
    return res.status(serviceResult.status).json(serviceResult);
  } catch (error) {
    // Errors (business or DB) are propagated by the service
    next(error);
  }
};
