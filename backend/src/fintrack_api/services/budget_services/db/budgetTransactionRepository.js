// src/fintrack_api/services/budget_services/db/budgetTransactionRepository.js

// Database operations for transactions used in budget calculations.
// All functions receive a PostgreSQL connection pool as first argument.
// Reverse Expense logic: movement_type_id = 1 (expense) has positive amount for category_budget,
// movement_type_id = 6 (transfer from category_budget) has negative amount.
// The SUM with CASE handles the sign correctly.
// No join to user_accounts is needed because only filter by account_id.
//
// Amounts are parsed from the NUMERIC string pg returns, never through
// parseFloat first: that would degrade the value to a float before the exact
// arithmetic begins. The public shape stays number.

import { toAmount } from '../core/money.js';

/**
 * Get total net spent for a single account in a period.
 * One single query, no individual transaction fetching.
 * Returns 0 if no transactions found.
 */
export async function getTotalSpentByAccountAndPeriod(pool, accountId, startDate, endDate) {
  const query = `
    SELECT
      COALESCE(SUM(
        CASE
          WHEN movement_type_id = 1 THEN amount
          WHEN movement_type_id = 6 THEN amount
          ELSE 0
        END
      ), 0) AS actual_spent
    FROM transactions
    WHERE account_id = $1
      AND transaction_actual_date >= $2
      AND transaction_actual_date < $3
      AND movement_type_id IN (1, 6)
  `;
  const result = await pool.query(query, [accountId, startDate, endDate]);
  return toAmount(result.rows[0].actual_spent ?? 0);
}

/**
 * Get individual transactions for a single account in a period.
 * Used for debugging, detailed lists, or future features.
 * Returns an array of { date, amount }.
 */
export async function getTransactionsByAccountAndPeriod(pool, accountId, startDate, endDate) {
  const query = `
    SELECT
      transaction_actual_date AS date,
      amount
    FROM transactions
    WHERE account_id = $1
      AND transaction_actual_date >= $2
      AND transaction_actual_date < $3
      AND movement_type_id IN (1, 6)
    ORDER BY transaction_actual_date ASC
  `;
  const result = await pool.query(query, [accountId, startDate, endDate]);
  return result.rows.map(row => ({
    date: row.date,
    amount: toAmount(row.amount ?? 0),
  }));
}

// The month the report is about, and the one after it, both on the account
// owner's calendar and both as text.
//
// Resolved in SQL and never rebuilt in JS. A DATE crossing the driver becomes a
// Date at the node process's local midnight, and serializing that back into a
// ::date cast can land on the neighbouring day — the same class of error §4.5
// describes, arriving through the driver instead of through a query. Text has
// no zone to lose.
//
// next_month is returned rather than derived so both values come from one
// evaluation of CURRENT_TIMESTAMP. Two calls could straddle midnight on the last
// day of a month and report a budget for one month against the spending of
// another.
const MONTH_QUERY = `
  SELECT
    date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE $1)::date::text AS month,
    (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE $1)
      + INTERVAL '1 month')::date::text AS next_month
`;

// Account identity and currency, one row per REQUESTED account.
//
// No join to any budget table. Whether an account is budgeted is the existence
// of an allocation in force (§1.9), which ALLOCATION_QUERY answers; asking it
// here as well would give the service two sources for one fact.
//
// currency_id is COALESCEd across both account tables. It is duplicated:
// user_accounts.currency_id is NOT NULL and is what the account creation path
// actually writes, while category_budget_accounts.currency_id is populated
// since db771a4 and backfilled by migration 011. COALESCE still honours a
// budget currency that deliberately differs from the account's.
//
// The join to category_budget_accounts stays INNER: it is what makes this a
// budget account at all. An id that survives the caller's ownership check but
// has no row there is a data inconsistency, not an unbudgeted account.
//
// subcategory comes from that same join. It has been in the table since the
// schema was written; the export read it off budgetPolicy, which never carried
// it, and shipped the column empty on every file so far.
//
// category_name comes from the same row and is NOT NULL since 002, normalized to
// lowercase by 013. It travels so the caller can group without a second query:
// the grouping is a fold over rows already in memory, not a round trip.
//
// nature comes from the catalog seeded by 005. The join is LEFT because
// category_nature_type_id is nullable: an INNER join would silently drop every
// account whose nature was never set, which is a row missing from a budget
// report, not a row without a tag.
//
// ORDER BY is the server's job, not the client's. Without it the order is
// whatever the planner returns and can differ between two identical requests;
// with it, no component has to sort, which is the client-side arithmetic this
// module exists to remove.
const ACCOUNTS_QUERY = `
  SELECT
    ua.account_id,
    ua.account_name,
    cba.category_name,
    cba.subcategory,
    cnt.category_nature_type_name AS nature,
    COALESCE(cba.currency_id, ua.currency_id) AS currency_id,
    -- The day the account was registered. Shipped raw, exactly as the nine
    -- account list queries in getAccountController already ship it, so the one
    -- client-side predicate that reads it treats both payloads identically.
    -- A tracker form uses it to stop offering a category on a day that category
    -- did not exist yet; the server refuses such a movement either way.
    ua.account_start_date
  FROM user_accounts ua
  JOIN category_budget_accounts cba ON cba.account_id = ua.account_id
  LEFT JOIN category_nature_types cnt
    ON cnt.category_nature_type_id = cba.category_nature_type_id
  WHERE ua.account_id = ANY($1)
  ORDER BY cba.category_name, ua.account_name
`;

// The allocation in force at one month, for N accounts, in one pass (§4.2).
//
// The whole of recurrence is `<= $2 ORDER BY budget_month DESC LIMIT 1`: a row
// rules from its month until a later row replaces it, so the last row at or
// before the month asked for IS the budget (§3.3). DISTINCT ON applies the LIMIT
// per account.
//
// An account with no row at or before the month is absent from the result, not
// zero. The caller resolves that absence to an effective budget of 0 (§3.5); the
// query reports what the table holds and does not invent a row.
const ALLOCATION_QUERY = `
  SELECT DISTINCT ON (account_id)
    account_id,
    budget_amount
  FROM budget_monthly_allocations
  WHERE account_id = ANY($1)
    AND budget_month <= $2
  ORDER BY account_id, budget_month DESC
`;

// Spending is aggregated on its own instead of being LEFT JOINed onto the
// allocations. Joined, an account with N allocation rows produced N rows each
// carrying the FULL period spend, and any sum over those rows multiplied the
// real spending by N. Keeping the aggregate separate makes the fan-out
// impossible rather than merely avoided.
//
// R42, §4.5: the bounds are LOCAL month boundaries and the column is
// TIMESTAMPTZ, so each bound is converted to the instant it names on the OWNER's
// calendar. Compared bare, Postgres resolves them through the SESSION zone,
// and a purchase at 8pm on 31 August in America/Bogota counts against September
// while the budget it is compared to is August's. Both sides of the comparison
// have to live on the same calendar (§1.10).
//
// This is the local-date-to-instant direction: exactly one AT TIME ZONE. The
// opposite direction — an instant to the month it falls in — is what MONTH_QUERY
// does. Two conversions in either direction is the error.
//
// ::timestamp, not ::date, and it is load-bearing. AT TIME ZONE has two forms,
// and with a date Postgres resolves to the one taking a TIMESTAMPTZ, because
// that is the preferred type of the category. The bound is then read as an
// instant in the SESSION zone and converted OUT to local time — the opposite
// direction — so '2026-08-01' AT TIME ZONE 'America/Bogota' yields
// 2026-07-31 19:00 instead of 2026-08-01 05:00+00. Measured: the month shifted
// five hours the wrong way and every boundary transaction landed in the
// neighbouring month, which is R42 again through a different door. Casting to
// TIMESTAMP first picks the form that takes a naive local time and returns the
// instant it names.
const SPENT_QUERY = `
  SELECT
    t.account_id,
    COALESCE(SUM(
      CASE
        WHEN t.movement_type_id = 1 THEN t.amount
        WHEN t.movement_type_id = 6 THEN t.amount
        ELSE 0
      END
    ), 0) AS actual_spent
  FROM transactions t
  WHERE t.account_id = ANY($1)
    AND t.transaction_actual_date >= ($2::timestamp AT TIME ZONE $4)
    AND t.transaction_actual_date <  ($3::timestamp AT TIME ZONE $4)
    AND t.movement_type_id IN (1, 6)
  GROUP BY t.account_id
`;

// The current month and its successor, from ONE evaluation of CURRENT_TIMESTAMP.
// Kept as the default path rather than derived in the caller: two reads of "now"
// could straddle midnight on the last day of a month and compare one month's
// budget against another month's spending.
const resolveCurrentMonths = async (pool, timeZone) => {
 const { rows } = await pool.query(MONTH_QUERY, [timeZone]);
 return { month: rows[0].month, nextMonth: rows[0].next_month };
};

/**
 * The budget of a set of accounts for one month.
 *
 * Returns ONE entry per requested account: an account the caller asked about and
 * did not get back is indistinguishable from one the backend dropped, and the
 * screen has to be able to report a category whose budget is 0 (§3.5).
 *
 * budgetAmount is always a number, 0 when no allocation is in force. An absent
 * decision and a decision of 0 resolve to the same effective budget — the domain
 * has no separate unbudgeted state (§1.9).
 *
 * nextMonthBudget is the same resolution one month later. It is what tells the
 * card that this month is an exception, and comparing the two amounts is
 * deliberate: a terminator repeating the current amount changes nothing anyone
 * would recognise and correctly shows nothing (§7.4).
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - Accounts to read
 * @param {string} timeZone - IANA zone of the account owner
 * @param {object} [months] - { month, nextMonth } as 'YYYY-MM-01'; omitted resolves the current month
 * @returns {Promise<object>} { month, accounts: [...] }
 */
export async function getMonthlyStatusForAccounts(pool, accountIds, timeZone = 'UTC', months) {
 const { month, nextMonth } = months ?? (await resolveCurrentMonths(pool, timeZone));

 if (!accountIds || accountIds.length === 0) {
  return { month, accounts: [] };
 }

 const [accounts, current, next, spent] = await Promise.all([
  pool.query(ACCOUNTS_QUERY, [accountIds]),
  pool.query(ALLOCATION_QUERY, [accountIds, month]),
  pool.query(ALLOCATION_QUERY, [accountIds, nextMonth]),
  pool.query(SPENT_QUERY, [accountIds, month, nextMonth, timeZone]),
 ]);

 const amountsByAccount = (result) =>
  new Map(result.rows.map((row) => [row.account_id, toAmount(row.budget_amount)]));

 const currentByAccount = amountsByAccount(current);
 const nextByAccount = amountsByAccount(next);
 const spentByAccount = new Map(
  spent.rows.map((row) => [row.account_id, toAmount(row.actual_spent ?? 0)]),
 );

 return {
  month,
  accounts: accounts.rows.map((row) => ({
   accountId: row.account_id,
   accountName: row.account_name,
   categoryName: row.category_name,
   subcategory: row.subcategory ?? null,
   // Null when the account has no nature set. It is a tag the row may lack, not
   // a figure, so there is nothing to default it to.
   nature: row.nature ?? null,
   currencyId: row.currency_id,
   accountStartDate: row.account_start_date ?? null,
   // No decision in force resolves to 0, which is the effective budget the
   // domain defines for that case and not a null anything has to branch on.
   budgetAmount: currentByAccount.get(row.account_id) ?? 0,
   nextMonthBudget: nextByAccount.get(row.account_id) ?? 0,
   // 0 is right for spending too: no matching transaction means none was made.
   actualSpent: spentByAccount.get(row.account_id) ?? 0,
  })),
 };
}

/**
 * The current month on the account owner's calendar, as 'YYYY-MM-01'.
 *
 * Exposed for the range endpoints, which need it before any account is read:
 * it is the default upper bound of a series and the ceiling `to` is checked
 * against. Same query as the status path, so "the current month" cannot come
 * to mean two different things in one module.
 *
 * @param {object} pool - Database pool
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<string>} first of the current month, as text
 */
export async function getCurrentMonth(pool, timeZone = 'UTC') {
 const { rows } = await pool.query(MONTH_QUERY, [timeZone]);
 return rows[0].month;
}

// One row per (account, month) over the whole range, with the carry-forward
// already applied (§4.3).
//
// generate_series produces the months; the correlated subquery answers, for each
// one, "what was the budget in force here" with the same
// `<= month ORDER BY budget_month DESC LIMIT 1` that IS recurrence (§3.3). A
// month before the account's first allocation gets NULL, which the caller reads
// as "never budgeted" — the amount is not defaulted to 0 in SQL, because that
// would erase the distinction between a month with no decision and a month the
// user set to zero.
//
// CROSS JOIN over unnest, not one query per account: the export flattens every
// budget account the caller owns, and a query per account would turn one report
// into N round trips. The cost is accounts × months correlated lookups, which is
// what the 60-month span cap in the service bounds.
//
// The months come back as text for the same reason MONTH_QUERY returns text: a
// pg DATE becomes a JS Date at the node process's local midnight, and the day
// can shift on the way through the driver.
const SERIES_QUERY = `
  SELECT
    a.account_id,
    m.month::date::text AS budget_month,
    (SELECT alloc.budget_amount
       FROM budget_monthly_allocations alloc
      WHERE alloc.account_id = a.account_id
        AND alloc.budget_month <= m.month
      ORDER BY alloc.budget_month DESC
      LIMIT 1) AS budget_amount
  FROM unnest($1::int[]) AS a(account_id)
  CROSS JOIN generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  ORDER BY a.account_id, m.month
`;

// Spending grouped by account and by the month it falls in, on the OWNER's
// calendar. Aggregated separately from the allocations for the same reason
// SPENT_QUERY is: joined, an account with N allocation rows would carry the full
// period spend N times.
//
// Both AT TIME ZONE directions appear here, each exactly once and on a different
// operand, which is the only combination that is correct:
//   - the bounds go local boundary -> instant, to be compared against a
//     TIMESTAMPTZ column;
//   - date_trunc goes instant -> local date, to decide which month a
//     transaction belongs to.
// Two conversions in either direction is the error R42 describes.
//
// ::timestamp on the lower bound is load-bearing: with a date, AT TIME ZONE
// resolves to the TIMESTAMPTZ overload and converts the bound OUT to local time
// instead of in. The upper bound needs no cast — `date + interval` is already a
// TIMESTAMP WITHOUT TIME ZONE, so it picks the same overload.
//
// $3 is the LAST month of the range, inclusive as a month. The instant window is
// half-open at the first day of the month after it, matching generate_series,
// which includes its own upper bound.
const SPENT_BY_MONTH_QUERY = `
  SELECT
    t.account_id,
    date_trunc('month', t.transaction_actual_date AT TIME ZONE $4)::date::text AS budget_month,
    COALESCE(SUM(
      CASE
        WHEN t.movement_type_id = 1 THEN t.amount
        WHEN t.movement_type_id = 6 THEN t.amount
        ELSE 0
      END
    ), 0) AS actual_spent
  FROM transactions t
  WHERE t.account_id = ANY($1)
    AND t.transaction_actual_date >= ($2::timestamp AT TIME ZONE $4)
    AND t.transaction_actual_date <  (($3::date + INTERVAL '1 month') AT TIME ZONE $4)
    AND t.movement_type_id IN (1, 6)
  GROUP BY t.account_id, 2
`;

/**
 * The month-by-month budget of a set of accounts over a range.
 *
 * Returns one entry per requested account, each carrying every month between
 * `from` and `to` inclusive — no gaps. A gap would make the caller re-derive the
 * carry-forward, which is the calculation this endpoint exists to centralise.
 *
 * budgetAmount is always a number, 0 when no allocation is in force. Same rule
 * as the status path: the absence of a decision is an effective budget of 0.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - Accounts to read
 * @param {string} from - first month of the range, as 'YYYY-MM-01'
 * @param {string} to - last month of the range, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<object[]>} one entry per account, with its months
 */
export async function getMonthlySeriesForAccounts(pool, accountIds, from, to, timeZone = 'UTC') {
 if (!accountIds || accountIds.length === 0) {
  return [];
 }

 const [accounts, series, spent] = await Promise.all([
  pool.query(ACCOUNTS_QUERY, [accountIds]),
  pool.query(SERIES_QUERY, [accountIds, from, to]),
  pool.query(SPENT_BY_MONTH_QUERY, [accountIds, from, to, timeZone]),
 ]);

 // Keyed by account then by month. A composite string key would work too, but
 // the months of one account are read together and a nested Map says so.
 const spentByAccount = new Map();
 for (const row of spent.rows) {
  if (!spentByAccount.has(row.account_id)) {
   spentByAccount.set(row.account_id, new Map());
  }
  spentByAccount.get(row.account_id).set(row.budget_month, toAmount(row.actual_spent ?? 0));
 }

 const monthsByAccount = new Map();
 for (const row of series.rows) {
  if (!monthsByAccount.has(row.account_id)) {
   monthsByAccount.set(row.account_id, []);
  }
  const spentInMonth = spentByAccount.get(row.account_id)?.get(row.budget_month) ?? 0;
  monthsByAccount.get(row.account_id).push({
   month: row.budget_month,
   // NULL from the subquery means no decision at or before this month, which
   // resolves to an effective budget of 0.
   budgetAmount: row.budget_amount === null ? 0 : toAmount(row.budget_amount),
   actualSpent: spentInMonth,
  });
 }

 return accounts.rows.map((row) => ({
  accountId: row.account_id,
  accountName: row.account_name,
  subcategory: row.subcategory ?? null,
  currencyId: row.currency_id,
  months: monthsByAccount.get(row.account_id) ?? [],
 }));
}
