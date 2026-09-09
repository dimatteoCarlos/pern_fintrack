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
 * THE NET AMOUNT IS HISTORY, NOT A PROJECTION, and that is why it comes back
 * although the report's three money columns did not. `net_adjustment_amount`
 * in the report is the same SUM over the same rows, but it is published there
 * as what annulling this account WOULD apply to the counterparty. Here the
 * figure answers what the two accounts have already moved between them, which
 * is true before any method is picked and stays true after the close. Nothing
 * about it changes when the account is closed.
 *
 * WHAT THE INTERACTIONS WERE, NOT ONLY HOW MANY. A count alone leaves the
 * owner to guess why an account is in the list, and the guess is wrong for the
 * compensation account: it is there because opening a funded account brings the
 * money in from outside the application and that arrival is recorded against
 * it, not because the close is about to post anything. `movementBreakdown`
 * names the movement types behind the count, so the row says what it is.
 *
 * IT IS THE SAME ROWS, GROUPED ONE LEVEL DEEPER. The breakdown counts sum to
 * `interaction_count` by construction - both are counts over
 * TargetAccountTransactions, one grouped by counterparty and the other by
 * counterparty and movement type - so the two figures in the cell can never
 * disagree.
 *
 * ITS SIGN IS READ FROM THE TARGET. The shared CTE selects `tr.amount` off the
 * target's own rows, so a positive total is what the target received net from
 * that counterparty and a negative one is what it sent. The counterparty's own
 * rows are not read at all, so this is not the counterparty's balance movement
 * and must not be labelled as one.
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
 *   accountTypeName: string, interactionCount: number, netAmount: number,
 *   movementBreakdown: Array<{movementTypeName: string, count: number}>,
 *   lastInteractionDate: string}>>} ordered by interaction count, descending
 */
export const getRelatedAccounts = async (dbClient, userId, targetAccountId) => {
 const relatedQuery = `
${TARGET_ACCOUNT_TRANSACTIONS_CTE},

 -- THE SAME ROWS, GROUPED ONE LEVEL DEEPER. Counted here per counterparty AND
 -- movement type, then folded back onto the counterparty by the subquery
 -- below, so the parts always sum to the interaction_count beside them.
 MovementBreakdown AS
 (
  SELECT
   tat.affected_account_id,
   mt.movement_type_name,
   COUNT(*)::int AS movement_count

  FROM TargetAccountTransactions tat

  -- Inner, and safe: transactions.movement_type_id is INTEGER NOT NULL with a
  -- foreign key into movement_types, so every row has exactly one match.
  JOIN
   movement_types mt ON mt.movement_type_id = tat.movement_type_id

  GROUP BY
   tat.affected_account_id, mt.movement_type_name
 )

 SELECT
  tat.affected_account_id,
  ua.account_name,
  acctype.account_type_name,
  COUNT(*)::int AS interaction_count,
  -- The target's own signed amounts, netted per counterparty. FLOAT rather
  -- than NUMERIC to match every other amount this module returns; the column
  -- is rendered to two decimals and never summed again downstream.
  SUM(tat.amount)::float AS net_amount,
  MAX(tat.transaction_actual_date) AS last_interaction_date,

  -- WHICH MOVEMENTS THOSE INTERACTIONS WERE. A correlated aggregate rather
  -- than a second GROUP BY level, because the row this select produces is one
  -- per counterparty and the breakdown is a detail of that row, not a
  -- different grain. json_agg over an empty set returns NULL, which cannot
  -- happen here - a counterparty only exists in this list because it has at
  -- least one row - and is coalesced anyway so the field is always an array.
  COALESCE(
   (
    SELECT json_agg(
     json_build_object(
      'movementTypeName', mb.movement_type_name,
      'count', mb.movement_count
     )
     ORDER BY mb.movement_count DESC, mb.movement_type_name ASC
    )
    FROM MovementBreakdown mb
    WHERE mb.affected_account_id = tat.affected_account_id
   ),
   '[]'::json
  ) AS movement_breakdown

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
  netAmount: row.net_amount,
  movementBreakdown: row.movement_breakdown,
  lastInteractionDate: row.last_interaction_date,
 }));
};

export default getRelatedAccounts;
