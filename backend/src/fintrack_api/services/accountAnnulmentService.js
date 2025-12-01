// backend/src/fintrack_api/services/accountAnnulmentService.js

import pc from 'picocolors';
import { pool } from "../../db/configDB.js";

//target account: is the account to delete
//affected_account: is the affected account which has interacted with the target account

//calcular el impacto (Flujo Neto a Eliminar - FNE o Financial Impact on affected account by target account) y el ajuste necesario para revertir ese flujo, devolviendo el informe para que el usuario lo revise antes de la confirmación final del borrado.

/*
 * 📊 Generates a report detailing the net financial impact on each and all affected accounts 
 * by transactions involving the Target Account (RTA - Retroactive Total Annulment).
 * * The logic relies on the Double-Entry principle: the sum of all signed amounts 
 * recorded for the Target Account (T) in the 'transactions' table is exactly 
 * the PnL Adjustment needed for the Affected Account (A).
 */

export const getAnnulmentImpactReport = async (userId, targetAccountId)=>{
 console.log(pc.blue('getAnnulmentImpactReport'))
 console.log(pc.blue(`Generating RTA impact report for Target ID: ${targetAccountId}`));

//==========================================
// 1️⃣ SQL: QUERY FOR RTA IMPACT CALCULATION REPORT
//==========================================
const reportQuery =`
 WITH TargetAccountTransactions AS
 (
  SELECT
   -- Identify the Affected Account (A) by finding the ID that is NOT the Target ($2)
   CASE
    WHEN (tr.destination_account_id = $2)
     THEN tr.source_account_id
     ELSE tr.destination_account_id
   END AS affected_acount_id, 
   tr.amount --target account signed amount

  FROM transactions tr

  WHERE
   tr.user_id =$1
   AND tr.account_id = $2 -- 🔑 CRUCIAL: Filter rows to only the Target's signed entries
   AND tr.destination_account_id != tr.source_account_id -- Ignore self affected account
   AND tr.status='complete'--no effect so far 
 )
   
 SELECT 
  tat.affected_account_id,
-- SUM of the Target's signed amounts is the required PnL adjustment for the Affected Account
  SUM(tat.amount) AS net_adjustment_amount,
  ua.account_name AS affected_account_name,
  ua.account_balance AS affected_account_current_balance,
  ua.currency_id,
  ct.currency_code

 FROM TargetAccountTransactions tat

 JOIN 
  user_accounts ua ON ua.account_id = tat.affected_account_id
 
 JOIN
  currencies ct ON ua.currency_id = ct.currency_id

 GROUP BY
  tat.affected_account_id,
  ua.account_name, ua.account_balance, ua.currency_id, ct.currency_code

 HAVING
  SUM(tat.amount) !=0;
 `
const rawReportResults = await pool.query(reportQuery, [userId, targetAccountId])
const reportResult =  rawReportResults.rows

if (reportResult.length===0){
 console.log(pc.yellow(`No existing transactions or financial impact found for the Target Account ${targetAccountId}.`));
return []
}

//=======================================
// 2️⃣ FORMAT IMPACT REPORT OUTPUT
//=======================================
const report = reportResult.map((row)=>({
 affectedAccountId:row.affected_account_id,

 affectedAccountName:row.affected_account_name,

 affectedAccountCurrentBalance:parseFloat(row.affected_account_current_balance),

 affectedAccountNetAdjustmentAmount:parseFloat(row.net_adjustment_amount),

 affectedAccountCurrencyId:row.currency_id,
 affectedAccountCurrencyCode:row.currency_code,

}))

console.log(pc.green(`Report generated successfully. Total ${report.length} accounts affected.`));

return report;

}


