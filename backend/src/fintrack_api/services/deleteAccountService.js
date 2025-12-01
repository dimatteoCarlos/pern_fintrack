//backend/src/fintrack_api/services/deleteAccountService.js

import pc from 'picocolors'
import { pool } from "../../db/configDB.js"
import { createError ,handlePostgresError} from "../../../utils/errorHandling.js"

//Constants from controller
// account deletion methods - not all implemented yet
//only implemented DELETION_TYPE_RTA
import { ADMIN_ACTION, DELETION_TYPE_HARD, DELETION_TYPE_SOFT, DELETION_TYPE_RTA,USER_ACTION } from "../controllers/accountDeleteController.js"

// RTA Utilities
import { checkAndInsertAccount } from '../../../utils/checkAndInsertAccount.js'
import { updateAffectedAccountBalance } from '../../../utils/updateAffectedAccountBalance.js'
import { recordAnnulmentTransaction } from '../../../utils/recordAnnulmentTransaction.js'
//=====================================
// 📋 MESSAGES CONFIGURATION
const messages ={
 notFound:{status:404, messagefn:(id)=>(
  `Account with ID ${id} not found`
  // "Account not found or access denied" 
 )},

 deletionTypeInvalid:{status:400, messagefn:()=>('Invalid or unauthorized deletion type.')},//IT will depnd on the type deletion methods defined. 

 softDeleted:{status:400, messagefn:()=>(`Account is already marked for deletion or could not be found`)},
  
 failedToDeleted:{status:500, messagefn:(id, actionType)=>(
  `Failed to execute  ${actionType} fo account ${id}`
  // 'Operation failed. Please try again later.'
 )},
  
 adminAction:{status:200, messagefn:(id, deletionTypeMethod, action)=>(`Admin ${action}: Executing ${deletionTypeMethod} on account ${id}`)}, //Hard deleting
 
 userAction:{status:200, messagefn:(id, action)=>(`User ${action} User: Executing ${action}  on account ${id}`)}, // Soft Deleting
 
 success:{status:202, messagefn:(id, actionType)=>(`Account ${id} successfully processed for ${actionType}.`)}, 

 rtaSuccess:{status:202, messagefn:(name, id, accountQty)=>(`RTA Annulment and Hard Delete successfully executed for account ${name} (${id}). Total affected accounts adjusted: ${accountQty}.`)},

 rtaUserPermissionDenied:{status:403, messagefn:()=>(`Permission denied. RTA deletion requires administrative privileges.`)},

 noImpactReport:{status:400, messagefn:()=>(`RTA execution requires a valid impactReport in the request body.`)},

}
//========================================
// FETCHING COMMON TRANSACTIONAL IDS (MOVEMENTTYPE, TRANSACTIONTYPE) WITH CACHE
// 🗃️ CACHE MANAGEMENT
let cacheIds = null, cacheTimestamp = null
const CACHE_TimeToLive = 10*60*1000 //10 min
const DEFAULT_IDS = {
  pnlMovementTypeId: 1,      // ID conocido de 'pnl'
  depositTypeId: 1,          // ID conocido de 'deposit'  
  withdrawTypeId: 2          // ID conocido de 'withdraw'
};

//🎯 GET COMMON TRANSACTION IDs
const getCommonIds = async (clientDb) => {
//'clientDb' should be an active connection (pool or transactional clientDb)
//Check valid cache
if(cacheIds && cacheTimestamp && (Date.now()-cacheTimestamp)<CACHE_TimeToLive){
 console.log('📦 Using cached common IDs')
 return cacheIds
}
console.log('🔄 Fetching common IDs from database...');

try {
const queries = [
 clientDb.query("SELECT movement_type_id FROM movement_types WHERE movement_type_name = 'pnl'"),
 clientDb.query("SELECT transaction_type_id FROM transaction_types WHERE transaction_type_name = 'deposit'"),
 clientDb.query("SELECT transaction_type_id FROM transaction_types WHERE transaction_type_name = 'withdraw'"),
 ];

const [pnlRes, depositRes, withdrawRes] = await Promise.all(queries);

if (pnlRes.rows.length === 0 || depositRes.rows.length === 0 || withdrawRes.rows.length === 0) {
 throw createError(500, 
  'Required transaction/movement types (pnl, deposit, withdraw) not found in DB.'
 // "Service configuration error. Please contact administrator."
 );
}

//Update cache
cacheIds = {
 pnlMovementTypeId:pnlRes.rows[0].movement_type_id,

 depositTypeId: depositRes.rows[0].transaction_type_id,

 withdrawTypeId: withdrawRes.rows[0].transaction_type_id,
 }

cacheTimestamp = Date.now(); 
console.log('✅ Common IDs cached successfully');

 return cacheIds 

}catch (error) {
// 5. if error use default ids
console.error('❌ Failed to fetch common IDs:', error);
// if old cahce exists use it as fallback
if (cacheIds && 
 cacheIds.pnlMovementTypeId && 
 cacheIds.depositTypeId && 
 cacheIds.withdrawTypeId) {
  console.warn('⚠️ Using stale cache due to fetch error');
   return cacheIds;
}
  console.warn('🚨 Using DEFAULT IDs - database may be unavailable');
  return DEFAULT_IDS;
 }
}//END of getCommonIds
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
const processRTAAnnulment = async (dbClient, userId, targetAccountId, impactReport, targetAccountName, transactionDate)=>{
 console.log(pc.yellow(`Executing RTA adjustments for ${impactReport.length} affected accounts...`));
if(impactReport.length>0){
// 1. Fetch Common IDs (Movement/Transaction Types)
const { pnlMovementTypeId, depositTypeId, withdrawTypeId } = await getCommonIds(dbClient);

// 2. Get/Create Slack Account
const slackAccountInfo = await checkAndInsertAccount(dbClient, userId);
const slackAccount = slackAccountInfo.account;

// 3. Calculate all balance changes first (immutable phase)
// 3.a Calculate all balances of affected accounts(immutable phase)
const balanceCalculations = impactReport.map(row => ({
 ...row, newAffectedBalance:row.affectedAccountCurrentBalance + row.affectedAccountNetAdjustmentAmount
}));

//3.b Calculate final balance of slack account
let totalAffectedAccountAdjustement = 0
for (const row of impactReport){
 totalAffectedAccountAdjustement+=row.affectedAccountNetAdjustmentAmount
}

const finalSlackBalance = slackAccount.account_balance - totalAffectedAccountAdjustement

// 4. Process each affected account
for(const calculation of balanceCalculations){
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

// Update affected account balance
 await updateAffectedAccountBalance(dbClient, newAffectedBalance, affectedAccountId);

// Prepare annulment data
const annulmentData = {
 userId,
 affectedAccountId,
 affectedAccountName,
  
 affectedAccountCurrentBalance,
 // affectedAccountCurrentBalance: calculation.affectedAccountCurrentBalance,
 adjustmentAmount:affectedAccountNetAdjustmentAmount,
 newAffectedBalance,
 
 slackAccountId: slackAccount.account_id,
 slackAccountCurrentBalance: slackAccount.account_balance,
 newSlackBalance:finalSlackBalance,

 currencyId:affectedAccountCurrencyId,
 currencyCode:affectedAccountCurrencyCode,

 targetAccountName,
 pnlMovementTypeId,
 depositTypeId,
 withdrawTypeId,
 transactionDate: transactionDate,
}

// Record annulment transaction
await recordAnnulmentTransaction(dbClient, annulmentData);
}

// 5. Update slack account balance 
await updateAffectedAccountBalance(dbClient, finalSlackBalance, slackAccount.account_id);
}else {
  console.log(pc.yellow('RTA: No net financial impact to correct. Proceeding to hard delete.'));
 }

// 6. Execute Hard Delete (CASCADE)
const deleteQuery = 'DELETE FROM user_accounts ua WHERE ua.account_id = $1 AND ua.user_id = $2';
await dbClient.query(deleteQuery, [targetAccountId, userId]);
console.log(pc.red(`Target Account ${targetAccountId} and transactions DELETED (CASCADE).`));

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
}//END of processRTAAnnulment

//========================================
// 🗑️ STANDARD SOFT/HARD DELETE PROCESSING
//========================================
/**
 * 📝 PROCESS STANDARD DELETE
 * Handles soft and hard delete operations
 */
const processStandardDelete = async (dbClient, targetAccountId, deletionType, isAdmin, accountCheck) => {
  let queryText, actionType;

  if (isAdmin && deletionType === DELETION_TYPE_HARD) {
   // Hard delete (admin only)
   actionType = ADMIN_ACTION;
   queryText = 'DELETE FROM user_accounts ua WHERE ua.account_id = $1 AND ua.user_id = $2';
   console.log(pc.red(`Admin HARD DELETE for account ${targetAccountId, userId}`));
  } else if (deletionType === DELETION_TYPE_SOFT) {
    // Soft delete
    if (accountCheck.rows[0].deleted_at !== null) {
      throw createError(400, 'Account already soft deleted');
    }
    actionType = USER_ACTION;
    queryText = 'UPDATE user_accounts ua SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE (ua.account_id = $1 AND AND ua.user_id = $2) AND ua.deleted_at IS NULL';
    console.log(pc.yellow(`User SOFT DELETE for account ${targetAccountId, userId}`));
  } else {
    throw createError(400, 'Invalid or unauthorized deletion type.');
  }

  const result = await dbClient.query(queryText, [targetAccountId]);

  if (result.rowCount === 0) {
    throw createError(500, `Failed to ${deletionType} account ${targetAccountId}`);
  }

// ✅ 
  return {
   actionType,
   deletionType,
   rowCount: result.rowCount
  };
};//END of processStandardDelete

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
 userRole, 
 targetAccountId, 
 deletionType,
 // CONDITIONAL RTA PARAMETERS: 
 impactReport = [], // 🔑 Passed from controller for RTA execution
 targetAccountName = 'Unknown' // RTA execution data
 )=>{
// =========================================
// 🚀 RTA ANNULMENT EXECUTION (ATOMIC TRANSACTION)
// =========================================
// let dbClient;
let isAdmin = userRole ==='admin' || userRole === 'super_admin'|| userRole === 'user'; //override isAdmin
// let isAdmin = true//test

// 1. Initial Validation: Check if the Target Account exists
const accountCheck = await pool.query('SELECT * FROM user_accounts ua WHERE ua.account_id = $1 AND ua.user_id = $2', [targetAccountId, userId]);

if (accountCheck.rows.length === 0) {
 throw createError(messages.notFound.status, messages.notFound.messagefn(targetAccountId));
}
//------------------------------------------
// 🚀 RTA Annulment Flow (Atomic Transaction)
// ------------------------------------------
//validate deletion type
if(deletionType===DELETION_TYPE_RTA){
// 1. TRANSACTION_SETUP - Inicialización y validación 
 if (!isAdmin) {
  throw createError(messages.rtaUserPermissionDenied.status, messages.rtaUserPermissionDenied.messagefn());
}

if (!impactReport || !Array.isArray(impactReport)){
 console.warn(pc.yellow('RTA execution requires a valid impactReport in the request body.'));

 throw createError(messages.noImpactReport.status,messages.noImpactReport.messagefn());
 }

let dbClient;
try {
 const transactionDate = new Date()
// 2. BEGIN_HANDLER - Manejo seguro de BEGIN transaction  
dbClient=await pool.connect()
await dbClient.query('BEGIN')
console.log(pc.red('RTA Transaction BEGIN for Target ID:'), targetAccountId)

// 3. RTA_IMPACT_VALIDATION - Validación de impactReport
console.log(pc.yellow(`RTA: Processing ${impactReport.length} affected accounts`));

// 4.  RTA PROCESS EXECUTION
let rtaResult; 
if (impactReport.length > 0) {
const rtaData = await processRTAAnnulment(
  dbClient, userId, targetAccountId, impactReport, targetAccountName,transactionDate
 );

 rtaResult = {
 adjustedAccounts: rtaData.adjustedAccounts,
 finalSlackBalance: rtaData.finalSlackBalance,
 actionType: 'RTA_ANNULMENT'
};

 } else {
    console.log(pc.yellow('RTA: No financial impact to correct. Proceeding to hard delete.'));
// Ejecutar hard delete directamente
    const deleteQuery = 'DELETE FROM user_accounts ua WHERE ua.account_id = $1';
    await dbClient.query(deleteQuery, [targetAccountId]);

    console.log(pc.red(`Target Account ${targetAccountId} DELETED (CASCADE).`));

    rtaResult = {
     adjustedAccounts: 0,
     finalSlackBalance: 0,
     actionType: 'RTA_ANNULMENT'
    };
   }

   // 5. COMMIT_HANDLER - (ÚNICO PUNTO DE COMMIT)
await dbClient.query('COMMIT');
console.log(pc.green('RTA Transaction COMMIT successful.'));

// 6. RTA_SUCCESS_RESPONSE - Respuesta exitosa estandarizada
return {
  status: messages.rtaSuccess.status,
  message: messages.rtaSuccess.messagefn(targetAccountName, targetAccountId, impactReport.length),
  data: {
   deletedAccountId: targetAccountId,
    action: rtaResult.actionType,
    accountsCorrected: rtaResult.adjustedAccounts,
    deletionType: DELETION_TYPE_RTA,
    finalSlackBalance: rtaResult.finalSlackBalance,
    timestamp: new Date().toISOString() 
  }
};

 } catch (error) {
// 7. ROLLBACK_HANDLER - Manejo de errores con ROLLBACK
 if (dbClient) {
  try {
   await dbClient.query('ROLLBACK');
   console.error(pc.red('RTA Transaction ROLLBACK due to error:'), error.message);

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
 if (!isAdmin && deletionType === DELETION_TYPE_HARD) {
  throw createError(403, 'Hard delete requires administrative privileges');
 }

 if (deletionType !== DELETION_TYPE_SOFT && deletionType !== DELETION_TYPE_HARD) {
  throw createError(messages.deletionTypeInvalid.status, messages.deletionTypeInvalid.messagefn());
 }

 // 11. STANDARD_DELETE_EXECUTION 
  const deleteResult = await processStandardDelete(dbClient, targetAccountId, deletionType, isAdmin, accountCheck);
  await dbClient.query('COMMIT');

// 12. RESPONSE_FORMATTER
 let successMessage;
 if (deletionType === DELETION_TYPE_HARD) {
  successMessage = messages.adminAction.messagefn(targetAccountId, 'HARD_DELETE', 'executed');
 } else {
  successMessage = messages.userAction.messagefn(targetAccountId, 'SOFT_DELETE');
 }

 return {
  status: messages.success.status,
  message: successMessage,
  data: {
   deletedAccountId: targetAccountId,
   action: deleteResult.actionType,
   deletionType: deleteResult.deletionType,
   timestamp: new Date().toISOString(), 
   // accountsCorrected:,
   // finalSlackBalance:
   }
  };
 } catch (error) {
   if (dbClient) {
    await dbClient.query('ROLLBACK');
     }

// 13. ERROR_PROPAGATION - Unified Error handler
   console.error(pc.red('Standard delete failed:'), error);
   
   // Usar mensajes configurados cuando sea posible
   if (error.message?.includes('already soft deleted')) {
      throw createError(messages.softDeleted.status, messages.softDeleted.messagefn());
   }
    if (error.message?.includes('Failed to')) {
     throw createError(messages.failedToDeleted.status, messages.failedToDeleted.messagefn(targetAccountId, deletionType));
   }
   
//  handlePostgresError for db errors
   if (error.code) {
    const { code, message } = handlePostgresError(error);
    throw createError(code, message);
   }
    throw error; // Propagar error original

   }finally {
      if (dbClient) {
       dbClient.release();
      }
    }
 }
};