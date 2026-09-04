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
 * Everything is read as of the close of one month. Four aggregates come off the
 * SAME unbounded outer join, each with its own FILTER: the committed total up to
 * that close, the net that moved inside the month, and the month's two gross
 * halves. One join and one pass is the rule this file's header states — two
 * queries with two windows is exactly how a header and a list come to disagree.
 *
 * The bound lives in the FILTER and never in the join condition, so a pocket
 * with nothing committed before the close reads zero instead of disappearing.
 * The pocket population itself is bound on the day the plan was made, so a
 * pocket created in September is absent from a board read at the close of
 * August.
 *
 * Both bounds convert a local month boundary into an instant to meet a
 * TIMESTAMPTZ column, once per operand and in one direction. They cast to
 * ::timestamp and never to ::date: with a date, Postgres picks the overload
 * taking an instant and the window shifts by the zone offset the wrong way
 * (measured at budgetTransactionRepository.js:177-186).
 *
 * @param {import('pg').Pool} pool
 * @param {string} userId - UUID from the token, never from the client
 * @param {string} monthStart - first day of the selected month, YYYY-MM-01
 * @param {string} timeZone - the owner's IANA zone
 * @returns {Promise<object[]>} raw rows
 */
export async function getPocketsForUser(pool, userId, monthStart, timeZone) {
 const { rows } = await pool.query(
  `
  SELECT
   p.pocket_id                             AS "pocketId",
   p.name                                  AS name,
   p.note                                  AS note,
   p.target_amount::text                   AS target,
   to_char(p.created_at AT TIME ZONE $3, 'YYYY-MM-DD') AS "planStart",
   COALESCE(SUM(pa.amount) FILTER (
    WHERE pa.allocation_actual_date < (($2::timestamp + INTERVAL '1 month') AT TIME ZONE $3)
   ), 0)::text                             AS allocated,
   COALESCE(SUM(pa.amount) FILTER (
    WHERE pa.allocation_actual_date >= ($2::timestamp AT TIME ZONE $3)
      AND pa.allocation_actual_date <  (($2::timestamp + INTERVAL '1 month') AT TIME ZONE $3)
   ), 0)::text                             AS "movedInMonth",
   COALESCE(SUM(pa.amount) FILTER (
    WHERE pa.amount > 0
      AND pa.allocation_actual_date >= ($2::timestamp AT TIME ZONE $3)
      AND pa.allocation_actual_date <  (($2::timestamp + INTERVAL '1 month') AT TIME ZONE $3)
   ), 0)::text                             AS "committedInMonth",
   COALESCE(-SUM(pa.amount) FILTER (
    WHERE pa.amount < 0
      AND pa.allocation_actual_date >= ($2::timestamp AT TIME ZONE $3)
      AND pa.allocation_actual_date <  (($2::timestamp + INTERVAL '1 month') AT TIME ZONE $3)
   ), 0)::text                             AS "releasedInMonth",
   to_char(p.desired_date, 'YYYY-MM-DD')   AS "desiredDate",
   COUNT(DISTINCT pa.source_account_id) FILTER (
    WHERE pa.allocation_actual_date < (($2::timestamp + INTERVAL '1 month') AT TIME ZONE $3)
   )::int                                  AS "sourceCount",
   lower(ct.currency_code)                 AS currency
  FROM pockets p
  JOIN currencies ct ON ct.currency_id = p.currency_id
  LEFT JOIN pocket_allocations pa ON pa.pocket_id = p.pocket_id
  WHERE p.user_id = $1
   AND p.created_at < (($2::timestamp + INTERVAL '1 month') AT TIME ZONE $3)
  GROUP BY p.pocket_id, ct.currency_code
  ORDER BY p.desired_date ASC, p.name ASC
  `,
  [userId, monthStart, timeZone],
 );

 return rows;
}

/**
 * One pocket of one user, in the same shape a board row has.
 *
 * The user_id is part of the WHERE rather than checked afterwards, so a pocket
 * belonging to someone else is simply not found. The caller answers 403 for an
 * empty result and never distinguishes "does not exist" from "not yours":
 * answering 404 for one and 403 for the other lets a caller walk the id space
 * and learn which pockets are other users'.
 *
 * planStart is the day the plan was made, on the owner's calendar. The status
 * builder divides the target over the months from it to the deadline, so the
 * zone has to be the owner's for the detail screen to agree with the board. The
 * three write paths that call this only prove ownership and never build a
 * status; they leave the zone unset and the default keeps the read valid.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} userId - UUID from the token
 * @param {number} pocketId
 * @param {string} [timeZone] - the owner's IANA zone; only planStart reads it
 * @returns {Promise<object|null>} the raw row, or null when there is none
 */
export async function getPocketForUser(db, userId, pocketId, timeZone = 'UTC') {
 const { rows } = await db.query(
  `
  SELECT
   p.pocket_id                             AS "pocketId",
   p.name                                  AS name,
   p.note                                  AS note,
   p.target_amount::text                   AS target,
   to_char(p.created_at AT TIME ZONE $3, 'YYYY-MM-DD') AS "planStart",
   COALESCE(SUM(pa.amount), 0)::text       AS allocated,
   to_char(p.desired_date, 'YYYY-MM-DD')   AS "desiredDate",
   COUNT(DISTINCT pa.source_account_id)::int AS "sourceCount",
   lower(ct.currency_code)                 AS currency
  FROM pockets p
  JOIN currencies ct ON ct.currency_id = p.currency_id
  LEFT JOIN pocket_allocations pa ON pa.pocket_id = p.pocket_id
  WHERE p.user_id = $1
   AND p.pocket_id = $2
  GROUP BY p.pocket_id, ct.currency_code
  `,
  [userId, pocketId, timeZone],
 );

 return rows[0] ?? null;
}

/**
 * Every allocation and release of one pocket, newest decision first.
 *
 * This is the pocket's history, and it is the whole of it: a pocket has no
 * transactions, because no allocation ever moved money. Ordered and printed on
 * allocation_actual_date, when the decision was taken, never on created_at, when
 * the row happened to be written — a set-aside agreed on Friday and typed on
 * Monday belongs to Friday.
 *
 * The three FX fields travel with the row rather than being fetched when the
 * detail modal opens, the same way the transaction detail modal owns no request.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} userId - UUID from the token
 * @param {number} pocketId
 * @param {string} timeZone - the owner's IANA zone
 * @returns {Promise<object[]>} raw rows
 */
export async function getPocketHistory(db, userId, pocketId, timeZone) {
 const { rows } = await db.query(
  `
  SELECT
   pa.allocation_id::text        AS "allocationId",
   pa.amount::text               AS amount,
   to_char(pa.allocation_actual_date AT TIME ZONE $3, 'YYYY-MM-DD') AS "allocationDate",
   to_char(pa.allocation_actual_date AT TIME ZONE $3, 'HH24:MI')     AS "allocationTime",
   pa.source_account_id          AS "sourceAccountId",
   ua.account_name               AS "sourceAccountName",
   pa.original_amount::text      AS "originalAmount",
   lower(oc.currency_code)       AS "originalCurrency",
   pa.exchange_rate::text        AS "exchangeRate",
   pa.exchange_rate_source       AS "exchangeRateSource",
   pa.exchange_rate_timestamp    AS "exchangeRateTimestamp"
  FROM pocket_allocations pa
  JOIN user_accounts ua ON ua.account_id = pa.source_account_id
  JOIN currencies oc ON oc.currency_id = pa.original_currency_id
  WHERE pa.user_id = $1
   AND pa.pocket_id = $2
  ORDER BY pa.allocation_actual_date DESC, pa.allocation_id DESC
  `,
  [userId, pocketId, timeZone],
 );

 return rows;
}

/**
 * Write a new pocket and answer with its id.
 *
 * The pocket lands with no money and no source account: allocating is a separate
 * decision the screen offers next. target_amount is already in the accounting
 * currency; the six origin columns record what was typed and the rate that
 * produced it, so the conversion can be shown and re-checked afterwards.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} db
 * @param {string} userId - UUID from the token
 * @param {object} pocket - amounts already converted and normalized
 * @returns {Promise<number>} the new pocket_id
 */
export async function insertPocket(db, userId, pocket) {
 const { rows } = await db.query(
  `
  INSERT INTO pockets (
   user_id, name, note, target_amount, currency_id, desired_date,
   original_target, original_currency_id, exchange_rate, exchange_rate_source,
   exchange_rate_timestamp, exchange_rate_target_currency_id
  )
  VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12)
  RETURNING pocket_id AS "pocketId"
  `,
  [
   userId,
   pocket.name,
   pocket.note,
   pocket.targetAmount,
   pocket.currencyId,
   pocket.desiredDate,
   pocket.originalTarget,
   pocket.originalCurrencyId,
   pocket.exchangeRate,
   pocket.exchangeRateSource,
   pocket.exchangeRateTimestamp,
   pocket.exchangeRateTargetCurrencyId,
  ],
 );

 return rows[0].pocketId;
}

/**
 * Overwrite the plan of one pocket.
 *
 * A target and a date are the current statement of a plan and are overwritten;
 * an allocation is a decision about money and is appended. That line decides
 * every column here: no history table, no revision row, no valid-from.
 *
 * COALESCE per column, with an explicit "was this key sent" flag beside each
 * amount that can legitimately arrive as null. Without the flag, clearing a note
 * and leaving it alone are the same request.
 *
 * The five FX columns move together with the target or not at all: a rate left
 * behind by a previous target would claim to have produced the new one.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} db
 * @param {string} userId - UUID from the token
 * @param {number} pocketId
 * @param {object} fields - undefined for every value the caller did not send
 * @returns {Promise<boolean>} whether a row was updated
 */
export async function updatePocket(db, userId, pocketId, fields) {
 const hasTarget = fields.targetAmount !== undefined;

 const { rowCount } = await db.query(
  `
  UPDATE pockets
     SET name          = COALESCE($3, name),
         note          = CASE WHEN $4::boolean THEN $5 ELSE note END,
         target_amount = COALESCE($6, target_amount),
         desired_date  = COALESCE($7::date, desired_date),
         original_target                  = COALESCE($8, original_target),
         original_currency_id             = COALESCE($9, original_currency_id),
         exchange_rate                    = COALESCE($10, exchange_rate),
         exchange_rate_source             = COALESCE($11, exchange_rate_source),
         exchange_rate_timestamp          = COALESCE($12, exchange_rate_timestamp),
         updated_at    = now()
   WHERE pocket_id = $1
     AND user_id = $2
  `,
  [
   pocketId,
   userId,
   fields.name ?? null,
   fields.noteWasSent,
   fields.note ?? null,
   hasTarget ? fields.targetAmount : null,
   fields.desiredDate ?? null,
   hasTarget ? fields.originalTarget : null,
   hasTarget ? fields.originalCurrencyId : null,
   hasTarget ? fields.exchangeRate : null,
   hasTarget ? fields.exchangeRateSource : null,
   hasTarget ? fields.exchangeRateTimestamp : null,
  ],
 );

 return rowCount > 0;
}

/**
 * Delete one pocket and, by cascade, its ledger.
 *
 * Refused at no net. An allocation never moved money, so deleting the ledger
 * destroys no financial fact: the cash simply stops being committed and returns
 * to each source account's unassigned cash. No balance is written and no
 * transaction is recorded, because none was ever wrong.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} db
 * @param {string} userId - UUID from the token
 * @param {number} pocketId
 * @returns {Promise<boolean>} whether a row was deleted
 */
export async function deletePocket(db, userId, pocketId) {
 const { rowCount } = await db.query(
  `DELETE FROM pockets WHERE pocket_id = $1 AND user_id = $2`,
  [pocketId, userId],
 );

 return rowCount > 0;
}
