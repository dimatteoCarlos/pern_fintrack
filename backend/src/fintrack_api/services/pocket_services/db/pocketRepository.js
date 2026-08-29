// backend/src/fintrack_api/services/pocket_services/db/pocketRepository.js

// The pocket module's reads. One row per pocket the caller owns, and the totals
// are folded from those rows in the service — not by a second aggregate query.
//
// That is the shape the two dashboard endpoints got wrong. They ran one query
// for the header and one for the list, each with its own GROUP BY, and the
// header's returned one row PER CURRENCY while the handler read rows[0]: with
// two currencies, one of them silently disappeared from the total. Folding in
// one place makes the header and the list arithmetically incapable of
// disagreeing, and makes the mixed-currency case a decision instead of an
// accident.
//
// Amounts leave as text, not as float. The pg driver hands NUMERIC over as a
// string precisely so nothing is lost, and money() parses that string exactly;
// CAST(... AS FLOAT) in SQL throws the precision away before JavaScript ever
// sees it, which is what the old queries did.

/**
 * The calendar date of "now" on the owner's clock.
 *
 * Resolved in SQL by the one AT TIME ZONE the value ever meets, never from the
 * node process's local zone and never from the browser's. Every figure that
 * compares against a deadline — overdue, days remaining, the required monthly
 * pace — divides or branches on this, so a day of drift moves all three.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} timeZone - the owner's IANA zone
 * @returns {Promise<string>} YYYY-MM-DD
 */
export async function getCalendarToday(db, timeZone) {
 const { rows } = await db.query(
  `SELECT to_char((CURRENT_TIMESTAMP AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS today`,
  [timeZone],
 );

 return rows[0].today;
}

/**
 * Every pocket of one user, with the figures the board reports.
 *
 * allocated is the sum of the ledger, not a balance. A pocket holds no money:
 * the row states how much of the real accounts is committed to it, which is why
 * nothing here reads user_accounts.account_balance.
 *
 * The LEFT JOIN is what makes a pocket created a minute ago a legitimate row:
 * no allocation yet is allocated 0 and sourceCount 0, not a missing pocket.
 *
 * desired_date is a DATE column, so it needs no zone to render: it was narrowed
 * onto the owner's calendar once, by migration 020, and carries no instant to
 * shift.
 *
 * Ordered by deadline, the board's default sort. Name and remaining are the two
 * other criteria the screen offers and both are served on the row, so no sort
 * costs a query parameter.
 *
 * @param {import('pg').Pool} pool
 * @param {string} userId - UUID from the token, never from the client
 * @returns {Promise<object[]>} raw rows
 */
export async function getPocketsForUser(pool, userId) {
 const { rows } = await pool.query(
  `
  SELECT
   p.pocket_id                             AS "pocketId",
   p.name                                  AS name,
   p.note                                  AS note,
   p.target_amount::text                   AS target,
   COALESCE(SUM(pa.amount), 0)::text       AS allocated,
   to_char(p.desired_date, 'YYYY-MM-DD')   AS "desiredDate",
   COUNT(DISTINCT pa.source_account_id)::int AS "sourceCount",
   lower(ct.currency_code)                 AS currency
  FROM pockets p
  JOIN currencies ct ON ct.currency_id = p.currency_id
  LEFT JOIN pocket_allocations pa ON pa.pocket_id = p.pocket_id
  WHERE p.user_id = $1
  GROUP BY p.pocket_id, ct.currency_code
  ORDER BY p.desired_date ASC, p.name ASC
  `,
  [userId],
 );

 return rows;
}
