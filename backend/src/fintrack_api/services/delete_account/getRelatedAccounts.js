// getRelatedAccounts.js
// The accounts one account has actually operated with, for the close screen.

import pc from 'picocolors';
import { TARGET_ACCOUNT_TRANSACTIONS_CTE } from './getAnnulmentImpactReport.js';

/**
 * 📊 WHO THIS ACCOUNT HAS DEALT WITH, and how much it dealt with each.
 *
 * WHY IT IS NOT THE IMPACT REPORT. `getAnnulmentImpactReport` answers "what
 * would annulling this account do to each of these accounts", and every column
 * it publishes beyond the name - current balance, net adjustment, the balance
 * after - is a projection of that operation. The owner ruled on 2026-09-08 that
 * CLOSE settles nothing and that the balance is neutralised in one operation
 * against the compensation account, so those projections are all zero for every
 * account in this list and a column of zeroes is worse than no column: it reads
 * as a claim that the reversal touches these accounts, and it does not.
 *
 * WHAT REPLACES THEM ANSWERS THE QUESTION THE OWNER ACTUALLY ASKS, which is
 * "why is this account in the list at all". A count of interactions and the date
 * of the last one answer it; a balance never did.
 *
 * ONE LEVEL, AND NOT BY CHOICE - BY CONSTRUCTION. The shared CTE filters
 * `tr.account_id = $2`, so only the target's own rows are read and only its own
 * counterparties can appear. A second level would need a different query, not a
 * flag on this one.
 *
 * WHAT THIS LIST DOES NOT CONTAIN, deliberately. The compensation account
 * appears here only if the target genuinely transacted with it, which a funded
 * opening does. It is never added because the reversal will be posted against
 * it: that is the counterparty of an operation about to happen, not a history,
 * and putting it in a list titled "accounts this account has interacted with"
 * would make one row of that list mean something different from the others.
 * The screen states the boundary separately.
 *
 * THE INNER JOIN IS THE SAME TRADE THE REPORT MAKES. A counterparty deleted
 * before this account has no row to join, so its group disappears from this
 * list. Those interactions are not lost to the owner: they are what
 * `getUnattributedAnnulmentTotal` counts, and the screen can say how many
 * interactions were with accounts that no longer exist.
 *
 * @param {object} dbClient - a pg client or the pool
 * @param {number} userId
 * @param {number} targetAccountId
 * @returns {Promise<Array<{accountId: number, accountName: string,
 *   accountTypeName: string, interactionCount: number,
 *   lastInteractionDate: string}>>} ordered by interaction count, descending
 */
export const getRelatedAccounts = async (dbClient, userId, targetAccountId) => {
 const relatedQuery = `
${TARGET_ACCOUNT_TRANSACTIONS_CTE}
 SELECT
  tat.affected_account_id,
  ua.account_name,
  acctype.account_type_name,
  COUNT(*)::int AS interaction_count,
  MAX(tat.transaction_actual_date) AS last_interaction_date

 FROM TargetAccountTransactions tat

 JOIN
  user_accounts ua ON ua.account_id = tat.affected_account_id

 JOIN
  account_types acctype ON ua.account_type_id = acctype.account_type_id

 GROUP BY
  tat.affected_account_id, ua.account_name, acctype.account_type_name

 -- The account the owner dealt with most, first. The name breaks the tie so the
 -- order is stable across calls; without it two accounts on the same count can
 -- swap places between renders for no reason the owner can see.
 ORDER BY
  interaction_count DESC, ua.account_name ASC
 `;

 const { rows } = await dbClient.query(relatedQuery, [userId, targetAccountId]);

 console.log(
  pc.blue(
   `Target ${targetAccountId} has interacted with ${rows.length} live accounts.`,
  ),
 );

 return rows.map((row) => ({
  accountId: row.affected_account_id,
  accountName: row.account_name,
  accountTypeName: row.account_type_name,
  interactionCount: row.interaction_count,
  lastInteractionDate: row.last_interaction_date,
 }));
};

export default getRelatedAccounts;
