// backend/src/fintrack_api/services/delete_account/accountAnnulmentService.js

import pc from 'picocolors';
import { derivedAccountBalanceSql } from '../../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';
import { lockAndDeriveBalances } from '../../../utils/fintrackUtils/accountManagement/lockAndDeriveBalances.js';

// The account's opening amount plus its movements. What the stored column was
// supposed to hold and no longer does.
const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'FLOAT');

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

export const getAnnulmentImpactReport = async (
  dbClient,
  userId,
  targetAccountId,
) => {
  console.log(pc.blue('getAnnulmentImpactReport'));
  console.log(
    pc.blue(`Generating RTA impact report for Target ID: ${targetAccountId}`),
  );
  // console.log('type of targetAccountId', typeof targetAccountId)
  //=====================================
  // 1️⃣ SQL: QUERY FOR RTA IMPACT CALCULATION REPORT
  //=====================================
  const reportQuery = `
 WITH TargetAccountTransactions AS
 (
  SELECT
   -- Identify the Affected Account (A) by finding the ID that is NOT the Target ($2)

   CASE
    WHEN (tr.destination_account_id = $2)
     THEN tr.source_account_id
     ELSE tr.destination_account_id
   END AS affected_account_id, 
   tr.amount --target account signed amount

  FROM transactions tr

  WHERE
   tr.user_id =$1
   AND tr.account_id = $2 -- 🔑 CRUCIAL: Filter rows to only the Target's signed entries
   -- IS DISTINCT FROM, not !=: a prior deletion's DETACH step (eraseAccountTail.js)
   -- can leave one side NULL. != against a NULL is NULL, which a WHERE clause
   -- drops - silently discarding a real, non-self row instead of keeping it.
   AND tr.destination_account_id IS DISTINCT FROM tr.source_account_id
   AND tr.status='complete'--no effect so far
 )
   
 SELECT 
  tat.affected_account_id,
-- SUM of the Target's signed amounts is the required PnL adjustment for the Affected Account
  SUM(tat.amount) AS   net_adjustment_amount,
  ua.account_name AS affected_account_name,
-- Derived, not the stored column. This figure is what the owner is shown when
-- deciding whether to delete an account, beside the adjustment that deletion
-- would apply to it. Reading the stored column showed a balance the ledger does
-- not hold, so the two numbers on that screen described different accounts.
  ${DERIVED_BALANCE} AS affected_account_current_balance,
  ua.currency_id,
  ct.currency_code,
  acctype.account_type_name AS affected_account_type_name

 FROM TargetAccountTransactions tat

  -- LEFT, not JOIN: affected_account_id itself can be NULL - a prior
  -- deletion's DETACH step (eraseAccountTail.js) nulls a transaction's
  -- reference to a counterparty account that no longer exists. An INNER
  -- join drops that row - the unattributable amount along with it - before
  -- the owner ever sees it. Carlos's ruling (2026-09-06, option B): surface
  -- it explicitly rather than fold it silently into another account's total.
 LEFT JOIN
  user_accounts ua ON ua.account_id = tat.affected_account_id

  -- LEFT too, and for the same row: with ua absent, ua.currency_id is NULL,
  -- and an INNER join here would drop the same row a second time.
 LEFT JOIN
  currencies ct ON ua.currency_id = ct.currency_id

  -- LEFT, not JOIN: account_type_id is nullable (ON DELETE SET NULL when the
  -- catalog row goes) until migration 033 enforces NOT NULL/RESTRICT. An
  -- INNER join drops the whole row - the account's financial adjustment along
  -- with it - the moment the type is unknown; account_type_name is purely
  -- informational downstream, so a NULL there costs nothing.
  LEFT JOIN
  account_types acctype ON ua.account_type_id = acctype.account_type_id

-- account_id and account_starting_amount replace account_balance here because
-- the derivation above reads those two. The grouping itself does not change:
-- the join pins ua.account_id to tat.affected_account_id, which is already
-- grouped, so every ua column was already one value per group.
 GROUP BY
  tat.affected_account_id,
  ua.account_id, ua.account_starting_amount,
  ua.account_name, ua.currency_id, ct.currency_code,
  acctype.account_type_name

-- HAVING SUM(tat.amount) !=0;
 `;
  const rawReportResults = await dbClient.query(reportQuery, [
    userId,
    targetAccountId,
  ]);

  const reportResult = rawReportResults.rows;

  if (reportResult.length === 0) {
    console.log(
      pc.yellow(
        `No existing transactions or financial impact found for the Target Account ${targetAccountId}.`,
      ),
    );
    return [];
  }

  //=======================================
  // 2️⃣ FORMAT IMPACT REPORT OUTPUT
  //=======================================
  const impactReport = reportResult.map((row) => ({
    affectedAccountId: row.affected_account_id,

    affectedAccountName: row.affected_account_name,

    affectedAccountType: row.affected_account_type_name,

    // No live counterparty (affected_account_id itself NULL) means no live
    // account row either, so the derived-balance subquery has nothing to
    // correlate against and returns SQL NULL. parseFloat(null) is NaN, and
    // this figure reaches a screen - it must stay null, never NaN.
    affectedAccountCurrentBalance:
      row.affected_account_current_balance === null
        ? null
        : parseFloat(row.affected_account_current_balance),

    affectedAccountNetAdjustmentAmount: parseFloat(row.net_adjustment_amount),

    affectedAccountCurrencyId: row.currency_id,
    affectedAccountCurrencyCode: row.currency_code,
  }));

  console.log(
    pc.green(
      `Report generated successfully. Total ${impactReport.length} accounts affected.`,
    ),
  );

  return impactReport;
};

/*
 * Locks the target account, then computes what erasing it would need to
 * reverse. The lock closes the same gap RTA's own execution closed (unit 6,
 * PLAN_ACCOUNT_DELETION.md "Unit 6 started"): once held, no concurrent
 * transaction can add a new row naming the target as source/destination
 * underneath the report computed next. Shared so any deletion type's
 * execution path can get the same guarantee, not only RTA - HARD does not
 * call this yet, since using it there is an open scope question (whether a
 * type that deliberately applies no reversal still needs the lock and a
 * preview of what it is skipping), not a decided change.
 */
export const assessDeletionImpact = async (
  dbClient,
  userId,
  targetAccountId,
) => {
  await lockAndDeriveBalances(dbClient, userId, [targetAccountId]);
  return getAnnulmentImpactReport(dbClient, userId, targetAccountId);
};

/*
 * Every pocket that loses backing if targetAccountId is deleted, named and
 * totalled, so the owner sees it before confirming (POCKET_MODULE_SPEC.md
 * §11.1 Q8b: "the deletion of those allocations is a statement the service
 * makes out loud... after the owner has seen the impact"). Read-only preview -
 * the actual `DELETE FROM pocket_allocations` runs later, inside the
 * deletion transaction, in eraseAccountTail.js.
 */
export const getPocketAllocationImpact = async (
  dbClient,
  userId,
  targetAccountId,
) => {
  const pocketImpactQuery = `
    SELECT
      p.pocket_id,
      p.name AS pocket_name,
      SUM(pa.amount) AS amount_allocated,
      cur.currency_code
    FROM pocket_allocations pa
    JOIN pockets p ON p.pocket_id = pa.pocket_id
    JOIN currencies cur ON cur.currency_id = p.currency_id
    WHERE pa.source_account_id = $1
      AND pa.user_id = $2
    GROUP BY p.pocket_id, p.name, cur.currency_code
    HAVING SUM(pa.amount) != 0
  `;

  const { rows } = await dbClient.query(pocketImpactQuery, [
    targetAccountId,
    userId,
  ]);

  return rows.map((row) => ({
    pocketId: row.pocket_id,
    pocketName: row.pocket_name,
    amountAllocated: parseFloat(row.amount_allocated),
    currencyCode: row.currency_code,
  }));
};
