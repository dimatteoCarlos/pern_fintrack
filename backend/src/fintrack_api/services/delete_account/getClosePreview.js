// backend/src/fintrack_api/services/delete_account/getClosePreview.js

/**
 * Everything the close screen needs before the owner confirms: how much money
 * the account still holds, and where that money is allowed to go.
 *
 * WHY THE RESIDUAL IS SERVED FROM HERE AND NOT READ OFF AN ACCOUNT LIST. The
 * settlement derives the residual from the ledger inside its own lock, while
 * every account list publishes the stored `account_balance` column. Those two
 * agree on every account measured so far, and mostly by design: on the money
 * paths that call it, setAccountBalanceFromLedger.js rewrites the column from
 * the ledger under the lock, this settlement included. The reason to derive
 * here is not that the column is wrong.
 *
 * It is that a figure shown and a figure decided on are different things. The
 * settlement compares the owner's echo against a value it derives under its own
 * lock, and that comparison exists so it does not have to assume the stored
 * column is in step. Serving the echo from that column would make the check
 * depend on the very thing the check is for.
 *
 * And the assumption is not universally safe: account creation writes the
 * opening ledger row and sets the new account's column from a separately
 * computed figure, refreshing only the counterparty. On a freshly created
 * account the two agree because one path computed both consistently, not
 * because either was derived from the other.
 *
 * It is still not a promise. Between this read and the confirmation a
 * transaction can land, which is exactly what the echo exists to catch: this
 * endpoint says what the balance is now, the settlement refuses if it has moved
 * since. Neither half is sufficient alone.
 *
 * ONE READ, BOTH POLICIES. The screen needs the residual whichever policy the
 * owner ends up choosing, and needs the destinations only under TRANSFER - but
 * it needs them at the moment the choice is offered, not after. Serving both
 * from one call is what lets the screen present the choice already knowing
 * whether there is anywhere to transfer to.
 */

import { createError } from '../../../utils/errorHandling.js';
import { derivedAccountBalanceSql } from '../../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';
// RETIRED 2026-09-08 with the settlement. CLOSE moves nothing out, so there is
// no destination for the owner to pick and no list to offer. The import is kept
// commented rather than deleted: the module it names is still the frozen
// eligibility rule, and a later revert-to-active ruling may need it again.
// import { listTransferDestinations } from './getCloseTransferDestinations.js';

// NUMERIC, then handed over as text: this is the figure the owner is about to
// confirm, and the pg driver's float conversion would round it on the way out.
const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC');

// Both columns are part of the lookup, not a separate check: an account that is
// already closed or deleted has no close screen, and answering with its balance
// would offer the owner a confirmation the settlement is going to refuse.
//
// closed_at is named explicitly even though a closed account also carries
// deleted_at today. The comment above claimed to exclude closed accounts while
// the predicate only tested deleted_at, and it was true by accident - closing
// happened to write that column too. It stops being true at the step where
// closing no longer does, and a preview that served a closed account would hand
// the owner a residual for an account whose residual has already been settled.
const CLOSING_ACCOUNT_QUERY = `
  SELECT
    ua.account_id,
    ua.account_name,
    act.account_type_name,
    cur.currency_code,
    ${DERIVED_BALANCE}::text AS account_balance
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  JOIN currencies cur ON cur.currency_id = ua.currency_id
  WHERE ua.user_id = $1
    AND ua.account_id = $2
    AND ua.deleted_at IS NULL
    AND ua.closed_at IS NULL
`;

// WHAT THE REVERSAL DOES TO NET WORTH, both figures read here rather than
// computed on the screen.
//
// The reversal moves the whole residual onto the compensation account, whose
// type is `boundary` and therefore outside every list below, so net worth after
// the operation is the same sum with the closing account taken out. The
// subtraction is expressed as a FILTER rather than as `before - residual`
// because that spelling is correct for BOTH cases without a branch: on an
// account whose type does not count towards net worth the filter removes
// nothing and the two figures come back equal, which is the true answer and the
// one the owner most needs to see.
//
// THE MEMBERSHIP RULE IS THE HERO'S, not a new one. makeHeroSection.js:197
// composes netWorth as bankBalance + investmentBalance + debtPosition, and those
// three inputs read the account types named here: bank and cash together
// (overviewPageRepository.js:121-138, D45), investment, and the debtor legs. The
// four types that are absent are absent on purpose - pocket_saving,
// category_budget, income_source and boundary are not holdings, so an account of
// one of those types leaves net worth exactly where it was.
//
// IT IS NOT THE HERO'S FIGURE, though, and the difference is the time
// coordinate. The hero answers at the close of its reference month; this answers
// now, because the close happens now. On the current month the two agree; on a
// past one they do not, and the one that belongs beside a live residual is this
// one.
const NET_WORTH_QUERY = `
  WITH counted AS (
    SELECT
      ua.account_id,
      ${DERIVED_BALANCE} AS balance
    FROM user_accounts ua
    JOIN account_types act ON act.account_type_id = ua.account_type_id
    WHERE ua.user_id = $1
      AND ua.deleted_at IS NULL
      AND ua.closed_at IS NULL
      AND act.account_type_name IN ('bank', 'cash', 'investment', 'debtor')
  )
  SELECT
    COALESCE(SUM(balance), 0)::text AS net_worth_before,
    COALESCE(SUM(balance) FILTER (WHERE account_id <> $2), 0)::text AS net_worth_after,
    EXISTS (SELECT 1 FROM counted WHERE account_id = $2) AS counts_toward_net_worth
  FROM counted
`;

/**
 * @param {object} db - pool; this is a read and takes no lock
 * @param {string} userId
 * @param {number} targetAccountId - the account the owner is about to close
 * @returns {Promise<{targetAccount: object, destinations: Array<object>, destinationCount: number}>}
 */
export const getClosePreview = async (db, userId, targetAccountId) => {
  // Sequential, not parallel, and that is deliberate: the destinations query
  // reads the closing account's currency for itself, so asking for a list
  // belonging to an account that turned out not to exist would be work done to
  // be thrown away, and the refusal below is the more useful answer.
  const { rows } = await db.query(CLOSING_ACCOUNT_QUERY, [
    userId,
    targetAccountId,
  ]);

  if (rows.length === 0) {
    // 404 covers three cases on purpose - no such account, not this owner's,
    // already closed - because distinguishing them would tell a caller whether
    // an account id they do not own exists.
    throw createError(
      404,
      `Account ${targetAccountId} was not found among your open accounts.`,
    );
  }

  const row = rows[0];

  // Second read, and sequential for the same reason the destinations query was:
  // an account that turned out not to exist has no net worth impact worth
  // computing, and the 404 above is the more useful answer.
  const { rows: netWorthRows } = await db.query(NET_WORTH_QUERY, [
    userId,
    targetAccountId,
  ]);
  const netWorthRow = netWorthRows[0];

  // RETIRED 2026-09-08. This query ran on every close preview and on every
  // deletion assessment to build a list CLOSE can no longer act on.
  //
  // const destinations = await listTransferDestinations(
  //   db,
  //   userId,
  //   targetAccountId,
  // );

  return {
    targetAccount: {
      accountId: row.account_id,
      accountName: row.account_name,
      accountTypeName: row.account_type_name,
      currencyCode: row.currency_code,
      // Text, as the driver handed it over.
      //
      // WHAT THIS FIGURE IS FOR CHANGED ON 2026-09-08 and the name did not.
      // It used to be the amount CLOSE would move out, echoed back by the
      // confirmation so a stale figure could be refused. CLOSE settles nothing
      // now: it REFUSES any balance that is not zero. So this is the figure
      // that decides whether the close will be accepted at all, and the screen
      // shows it to explain a refusal rather than to price a transfer.
      residual: row.account_balance,
    },
    // Text all the way out, like the residual beside it and for the same
    // reason: the pg driver's float conversion would round the figure the owner
    // is about to read against the one the engine moves.
    netWorth: {
      before: netWorthRow.net_worth_before,
      after: netWorthRow.net_worth_after,
      countsTowardNetWorth: netWorthRow.counts_toward_net_worth,
    },
    // FROZEN EMPTY 2026-09-08, not removed. Both keys stay in the response so
    // no consumer reads undefined off a shape that used to carry them - the
    // frontend deploys separately from the backend, and a key that disappears
    // fails silently where a key that is empty does not.
    destinations: [],
    destinationCount: 0,
  };
};
