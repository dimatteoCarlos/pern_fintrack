// backend/utils/verifyAccountExistence.js
import pc from 'picocolors';
import { createError, handlePostgresError } from './errorHandling.js';

//this function must be used in a transactional context
// * 🛡️ Checks for the existence of a specific account (e.g., 'slack') by name and type.
export const updateAffectedAccountBalance=async(dbClient, newBalance, accountId, transactionActualDate)=>{

if(!dbClient || !dbClient.query){
throw createError(500, 'updateAffectedAccountBalance requires an active database client (transactional context).');
}

try {
console.log(pc.blue(`Updating balance for affected account ${accountId} to ${newBalance}`));

const updateAffectedAccountBalanceQuery = {
text:`UPDATE user_accounts SET account_balance=$1, updated_at=$2 
WHERE account_id=$3 RETURNING *
`, 
values:[newBalance, transactionActualDate??new Date(), accountId]
}
//Execute using the transactional client
const updateAffectedAccountResult = await dbClient.query(updateAffectedAccountBalanceQuery)

if(updateAffectedAccountResult.rows.length===0){
 throw createError(404, `Account ${accountId} not found for balance update.`)
}

return updateAffectedAccountResult.rows[0]

}catch (error) {
// If the error is already a Business Error (like the 404 error above), issue it.
const messageError = `Error updating balance for account ${accountId}`;
console.error(pc.red(messageError), error);

if (error.status) {
   throw error;
}

//If it's a database error,  map it.
const { code, message } = handlePostgresError(error);

// Throw the standardized error, ensuring propagation for the ROLLBACK.
throw createError(code, message);
    }
 }