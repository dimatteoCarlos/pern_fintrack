//backend/src/fintrack_api/controllers/accountDeleteController.js
import pc from 'picocolors'
import { createError } from '../../../utils/errorHandling.js';

// 📚 SERVICES & UTILITIES
import { getAnnulmentImpactReport } from '../services/accountAnnulmentService.js';
import { deleteAccountService } from '../services/deleteAccountService.js'
// ===================================
// ⚙️ DELETION METHOD CONSTANTS
// Constants defined here establish the accepted API contract for deletion types
// ===================================
export const DELETION_TYPE_RTA='RTA'
export const DELETION_TYPE_HARD='HARD'
export const DELETION_TYPE_SOFT='SOFT'

export const ADMIN_ACTION='ADMIN_ACTION'
export const USER_ACTION='USER_CTION'
// =========================================
// 📊 RTA REPORT HANDLER
// Endpoint: GET /api/fintrack/account/delete/report_of_affected_accounts/:targetAccountId
// =========================================
export const generateImpactReport = async(req, res, next)=>{
// 1. EXTRACT PARAMS
//userId must have been verified by middleware (req.user)
const {userId } = req.user;
//check if the userId exist in the database or verifyUser
if (!userId) {
 const message = 'User ID is required';
 console.warn(pc.blueBright(message));
 return res.status(400).json({ status: 400, message });
  }

const targetAccountId = req.params.targetAccountId;
if (!targetAccountId) {
 return next(createError(400, 'Target Account ID is required.'));
 } 

try {
 console.log(pc.magenta(`Generating Retrospective Total target Annulment impact report for User ${userId} and Account ${targetAccountId}`));

// 2. CALL SERVICE
// The service handles the SQL logic to calculate the net financial impact
const impactReport = await getAnnulmentImpactReport(userId, targetAccountId);

// 3. SUCCESS RESPONSE
return res.status(200).json({
 status: 200,
 message: 'RTA Impact Report generated successfully.',
 data: {
  report: impactReport,
  targetAccountId,
  affectedAccountsCount: impactReport.length,
  },
 });
} catch (error) {
// Errors are propagated to Express error middleware
 next(error);
 }
}
// ============================================
// 💣 DELETE EXECUTION HANDLER
// Endpoint: DELETE /api/fintrack/accounts/:targetAccountId
// =============================================
export const executeAccountDeletion = async (req, res, next) => {
// 1. EXTRACT PARAMS & AUTH
 const userId = req.user;
 const userRole = req.user.role; 
 const targetAccountId = req.params.targetAccountId;

// Get deletionType from query (for simple deletes) or body (for RTA confirmation)
 const deletionType = req.query.type || req.body.deletionType;

 if (!targetAccountId || !deletionType) {
  return next(createError(400, 'Target Account ID and Deletion Type are required.'));
   }

// 2. RTA SPECIFIC DATA EXTRACTION (From the confirmation body)
let impactReport = [];
let targetAccountName = 'Unknown Account';

if (deletionType === DELETION_TYPE_RTA) {
 impactReport = req.body.impactReport;
 targetAccountName = req.body.targetAccountName;

 // Validation check for RTA data integrity
 if (!impactReport || !Array.isArray(impactReport)) {
  return next(createError(400, 'RTA deletion requires a valid impactReport array in the body.'));
   }
  }

try {
 console.log(pc.magenta(`Attempting ${deletionType} deletion for Account ID: ${targetAccountId}`));

// 3. CALL DELETION SERVICE
// The service is responsible for handling all complex transaction logic (BEGIN/COMMIT/ROLLBACK) 
// and data integrity for RTA, or executing the standard delete.
const serviceResult = await deleteAccountService(
 userId,
 targetAccountId,
 userRole,
 deletionType,
 impactReport,
 targetAccountName
 );

// 4. SUCCESS RESPONSE
// The service returns a fully formatted response object (status, message, data)
return res.status(serviceResult.status).json(serviceResult);

 } catch (error) {
// Errors (business or DB) are propagated by the service
next(error);
 }

}
