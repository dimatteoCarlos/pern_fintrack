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

// The target's own signed entries against a counterparty that is not itself.
// Shared by the report below and by the unattributed total beside it, so the two
// can never disagree about which rows they are talking about - the report says
// where the money goes and the total says how much of it has nowhere to go, and
// a drift between two copies of this would make those two answers describe
// different sets of rows while still looking consistent.
const TARGET_ACCOUNT_TRANSACTIONS_CTE = `
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
`;

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
${TARGET_ACCOUNT_TRANSACTIONS_CTE}
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

  -- INNER, deliberately: affected_account_id can be NULL, and dropping that
  -- group is the correct arithmetic. A NULL counterparty is the residue of an
  -- earlier deletion's DETACH step (eraseAccountTail.js), and that deletion
  -- already reversed the amount - its annulment row sits on this same account,
  -- against the compensation account, so the two cancel here and the group
  -- arrives already settled. Re-attributing it would settle it twice: the money
  -- would move again, and the report's total would stop agreeing with the
  -- compensation balance the execution path re-derives from the rows it
  -- actually wrote.
  -- What the drop must not be is silent, which it was until
  -- getUnattributedAnnulmentTotal below named it. Correct arithmetic that
  -- disappears from the screen still reads to the owner as money that went
  -- missing between the report and the ledger.
 JOIN
  user_accounts ua ON ua.account_id = tat.affected_account_id

 JOIN
  currencies ct ON ua.currency_id = ct.currency_id

  -- INNER since migration 033: account_type_id is NOT NULL behind an
  -- ON DELETE RESTRICT foreign key, so an account with no type is no longer
  -- representable. This was a LEFT join for as long as it was, and the reason
  -- was that an INNER one would drop the whole row - the account's financial
  -- adjustment along with it - the moment the type went missing.
 JOIN
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

    affectedAccountCurrentBalance: parseFloat(
      row.affected_account_current_balance,
    ),

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
 * 📊 The part of the target's activity that has no live counterparty to be
 * attributed to, named instead of dropped.
 *
 * The report above joins each group to the account it belongs to, so the group
 * whose counterparty was already detached by an earlier deletion does not
 * survive the join. That is the right arithmetic - the earlier deletion already
 * reversed those amounts against the compensation account, so re-attributing
 * them here would settle them a second time - but it left the owner looking at
 * a report whose lines do not add up to the account's activity, with nothing on
 * the screen to say why.
 *
 * RETURNED SEPARATELY, AND THAT IS THE WHOLE DESIGN. It is not another element
 * of the impact report: the execution path iterates that array and writes a
 * settlement pair per entry, so an entry with no account id would be a write
 * aimed at nothing. This is a figure to display beside the report, never one to
 * act on, and keeping it out of the array is what makes that unmistakable
 * rather than a rule someone has to remember.
 *
 * @returns {Promise<{amount: number, transactionCount: number}>} zero and zero
 *   when every counterparty is still live, which is the ordinary case.
 */
export const getUnattributedAnnulmentTotal = async (
  dbClient,
  userId,
  targetAccountId,
) => {
  const unattributedQuery = `
${TARGET_ACCOUNT_TRANSACTIONS_CTE}
 SELECT
  COALESCE(SUM(tat.amount), 0) AS unattributed_amount,
  COUNT(*)::int AS transaction_count

 FROM TargetAccountTransactions tat

 WHERE tat.affected_account_id IS NULL
 `;

  const { rows } = await dbClient.query(unattributedQuery, [
    userId,
    targetAccountId,
  ]);

  const total = {
    amount: parseFloat(rows[0].unattributed_amount),
    transactionCount: rows[0].transaction_count,
  };

  if (total.transactionCount > 0) {
    console.log(
      pc.yellow(
        `Target ${targetAccountId}: ${total.transactionCount} rows totalling ${total.amount} have no live counterparty and are excluded from the impact report.`,
      ),
    );
  }

  return total;
};

/**
 * What the annulment will move in total: the report's own rows, summed.
 *
 * Lives beside the report rather than in the controller that first needed it,
 * because the assessment endpoint became a second consumer and two copies of a
 * money fold is how the impact screen and the assessment screen start quoting
 * different totals for the same account.
 *
 * The unattributed amount is NOT a caller's to add afterwards. It is excluded
 * by construction here: the execution path never acts on it, so a total
 * carrying it would name a figure no operation produces.
 *
 * Rounded to cents because the row amounts are floats. Summing them raw yields
 * the usual trailing artefact, and this figure is displayed rather than
 * compared against anything, so the artefact would reach the screen verbatim.
 *
 * @param {Array<{affectedAccountNetAdjustmentAmount: number}>} impactReport
 * @returns {number} zero for an empty report, which is the ordinary case for an
 *   account that never faced another account.
 */
export const foldNetAdjustmentTotal = (impactReport) =>
 Math.round(
  impactReport.reduce(
   (running, row) => running + row.affectedAccountNetAdjustmentAmount,
   0,
  ) * 100,
 ) / 100;

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
