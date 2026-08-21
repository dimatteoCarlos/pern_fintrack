// backend/src/fintrack_api/services/pocket_services/db/pocketRepository.js

// The board's only read. One row per pocket the caller owns, and the totals are
// folded from those rows in the service — not by a second aggregate query.
//
// That is the shape the two dashboard endpoints got wrong. They ran one query
// for the header and one for the list, each with its own GROUP BY, and the
// header's returned one row PER CURRENCY while the handler read rows[0]: with
// two currencies, one of them silently disappeared from the total. Folding in
// one place makes the header and the list arithmetically incapable of
// disagreeing, and makes the mixed-currency case a decision instead of an
// accident.

/**
 * Every pocket_saving account of one user, with the figures the board reports.
 *
 * Amounts leave as text, not as float. The pg driver hands NUMERIC over as a
 * string precisely so nothing is lost, and money() parses that string exactly;
 * CAST(... AS FLOAT) in SQL throws the precision away before JavaScript ever
 * sees it, which is what the old queries did.
 *
 * Dates leave as YYYY-MM-DD labels on the OWNER's calendar, resolved here by
 * the one AT TIME ZONE the value ever meets. A TIMESTAMPTZ crossing the driver
 * becomes a Date at the node process's local midnight, and a client doing
 * new Date('2026-08-01') reads UTC midnight — which renders as July west of
 * UTC. Neither happens to a label.
 *
 * The account_name <> 'slack' filter is inherited: 'slack' is a magic account
 * name every account-type query in this app excludes. It is not a pocket
 * question and it is not fixed here, but omitting it would put the internal
 * account on the board.
 *
 * @param {import('pg').Pool} pool
 * @param {string} userId - UUID from the token, never from the client
 * @param {string} timeZone - the owner's IANA zone
 * @returns {Promise<object[]>} raw rows, ordered by name
 */
export async function getPocketsForUser(pool, userId, timeZone) {
 const { rows } = await pool.query(
  `
  SELECT
   ua.account_id                              AS "accountId",
   ua.account_name                            AS "accountName",
   psa.note                                   AS note,
   psa.target::text                           AS target,
   ua.account_balance::text                   AS saved,
   to_char(psa.desired_date AT TIME ZONE $2, 'YYYY-MM-DD')       AS "desiredDate",
   psa.desired_date_source                    AS "desiredDateSource",
   to_char(psa.account_start_date AT TIME ZONE $2, 'YYYY-MM-DD') AS "startDate",
   lower(ct.currency_code)                    AS currency
  FROM user_accounts ua
  JOIN account_types act ON ua.account_type_id = act.account_type_id
  JOIN pocket_saving_accounts psa ON ua.account_id = psa.account_id
  JOIN currencies ct ON ua.currency_id = ct.currency_id
  WHERE ua.user_id = $1
   AND act.account_type_name = 'pocket_saving'
   AND ua.account_name <> 'slack'
  ORDER BY ua.account_name ASC
  `,
  [userId, timeZone],
 );

 return rows;
}
