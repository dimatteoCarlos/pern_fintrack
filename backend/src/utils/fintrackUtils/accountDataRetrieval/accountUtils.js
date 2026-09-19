// backend/src/utils/fintrackUtils/accountDataRetrieval/accountUtils.js
//
// Account utilities – reusable functions for account-related operations.
// Used across modules (Budget, Overview, Reports).
//
// Consolidated from accountUtilsV2.js. A query that asks whether money may
// move through an account, or whether the owner should see it, filters both
// stamps - deleted_at IS NULL AND closed_at IS NULL - so neither a deleted nor
// a closed account counts as owned.
//
// Three queries here do not, and each states its reason on the line: resolving
// the owner of a row is identity, not circulation, the compensation account has
// to be found in whatever state it is in, and getAccountsByType answers an
// ownership question, which a closed account is still the answer to.

import { pool } from '../../../db/config/configDB.js';
import { createError } from '../../errorHandling.js';

/**
 * Get account type ID from account type name.
 * @param {Object} clientOrPool - Database client or pool. Falls back to the shared pool.
 * @param {string} accountTypeName - e.g. 'category_budget'.
 * @returns {Promise<number>} account_type_id
 */
export async function getAccountTypeId(clientOrPool, accountTypeName) {
  const db = clientOrPool || pool;
  const query = 'SELECT account_type_id FROM account_types WHERE account_type_name = $1';
  const result = await db.query(query, [accountTypeName]);
  if (result.rows.length === 0) {
    throw createError(404, `Account type not found: ${accountTypeName}`);
  }
  return result.rows[0].account_type_id;
}

/**
 * Get user ID from account ID.
 * @param {Object} clientOrPool - Database client or pool.
 * @param {number} accountId
 * @returns {Promise<string>} user_id (UUID)
 */
export async function getUserIdFromAccount(clientOrPool, accountId) {
  const db = clientOrPool || pool;
  const query = `
    SELECT user_id
    FROM user_accounts
    WHERE account_id = $1
      -- Not swept with the rest: this answers who owns a row, not whether
      -- money may move through it, so no closed_at test belongs here. The
      -- deleted_at test does not follow from that reason either; flagged
      -- pending the deletion-type ruling, not changed under the freeze.
      AND deleted_at IS NULL
  `;
  const result = await db.query(query, [accountId]);
  if (result.rows.length === 0) {
    throw createError(404, `Account not found: ${accountId}`);
  }
  return result.rows[0].user_id;
}

/**
 * Excludes the internal compensation account from a result set, by what the
 * account IS rather than by what it is called. Appended to a WHERE whose
 * query has already joined account_types as `act`.
 *
 * The name filter beside it at each call site stays until 'slack' is
 * reserved at account creation: after 031 an account of that name typed
 * 'bank' can still be captured as the compensation account, and no type
 * predicate can see it. The pre-031 typing is a second, weaker reason and
 * expires on its own.
 *
 * One definition rather than one per controller: the predicate's whole
 * purpose is that it cannot differ between the queries that publish a
 * user's money, and it was already duplicated verbatim in two of them.
 */
/**
 * The account types a request may ask for. This is the creation-side
 * counterpart of NOT_BOUNDARY_ACCOUNT above: one keeps the compensation
 * account out of what is published, this keeps it out of what is created.
 *
 * Written out rather than read from account_types, because the catalog says
 * what CAN exist and this says what a user MAY ask for. 031 added 'boundary'
 * to the catalog, and every controller that resolves a type by querying the
 * catalog accepted it from that moment on, with nothing to notice.
 */
export const USER_CREATABLE_ACCOUNT_TYPES = Object.freeze([
  'bank',
  'cash',
  'investment',
  'debtor',
  'pocket_saving',
  'category_budget',
  'income_source',
]);

/**
 * Returns the normalised type name, or throws a 400 naming the field it came
 * from. Throws rather than returning a boolean because every call site would
 * otherwise write the same throw, and two of them wrote it one line after the
 * dereference that made it unreachable.
 *
 * Case-insensitive, matching the comparison the debtor controller already
 * makes on the source account type; the catalog names are all lowercase.
 */
export const assertUserCreatableAccountType = (accountTypeName, field) => {
  const name = String(accountTypeName ?? '')
    .trim()
    .toLowerCase();

  if (!USER_CREATABLE_ACCOUNT_TYPES.includes(name)) {
    throw createError(
      400,
      `Account type "${name}" is not available on ${field}.`,
    );
  }

  return name;
};

export const NOT_BOUNDARY_ACCOUNT =
 "AND act.account_type_name IS DISTINCT FROM 'boundary'";

// Both stamps, never one: they coincide only while CLOSE writes them together,
// and a deleted_at test alone would put a closed account back in every list the
// day that stops. Expects the account table aliased `ua`.
export const LIVE_ACCOUNT =
 'AND ua.deleted_at IS NULL AND ua.closed_at IS NULL';

/**
 * Get the 'slack' compensation account ID for a user.
 * @param {Object} clientOrPool - Database client or pool.
 * @param {string} userId - User UUID.
 * @returns {Promise<number>} account_id
 */
export async function getSlackAccountId(clientOrPool, userId) {
  const db = clientOrPool || pool;
  // Name AND type, both: the compensation account is the one named 'slack'
  // typed 'boundary'. Matching 'bank' as well would hand back a user's own bank
  // account of that name as the system's counterpart.
  const query = `
    SELECT ua.account_id
    FROM user_accounts ua
    JOIN account_types act ON ua.account_type_id = act.account_type_id
    WHERE ua.user_id = $1
      AND ua.account_name = 'slack'
      AND act.account_type_name = 'boundary'
      -- Not swept: no path can close this row. The boundary type is not
      -- user-creatable and CLOSE only transfers to bank, so closed_at is
      -- never set on it - and a test that finds nothing here does not fail,
      -- it creates a second compensation account.
      AND ua.deleted_at IS NULL
  `;
  const result = await db.query(query, [userId]);
  if (result.rows.length === 0) {
    throw createError(
      404,
      'The required compensation account "slack" was not found for this user. Please create it first.',
    );
  }
  return result.rows[0].account_id;
}

/**
 * Every account of a given type the user HAS EVER HAD, with subcategory, nature
 * and currency, each flagged with whether it existed in a given month.
 *
 * TWO ANSWERS FROM ONE READ, BECAUSE THE CALLER ASKS TWO QUESTIONS. The Budget
 * controller uses this both to prove ownership of an id the client named and to
 * build the set it reports when the client names none. Those are different
 * questions about the same accounts: owning a category does not stop when it is
 * closed, so the ownership answer must include a closed one; the reported set is
 * about a month, so it must include a category that existed in that month and no
 * other. Until 2026-09-19 this query answered only the first and answered it
 * with the second's filter, which made every closed category a 403 on its own
 * history.
 *
 * THE ROW SET IS OWNERSHIP; THE TWO ENDS OF EACH ACCOUNT'S OWN WINDOW TRAVEL
 * BESIDE IT. Nothing here is a fixed span: `startMonth` is read from that
 * account's `account_start_date` and `closedMonth` from its `closed_at`, so an
 * account open for one month publishes the same month twice and an account open
 * for nine years publishes ends nine years apart.
 *
 * `deleted_at IS NULL OR closed_at IS NOT NULL` stays in the WHERE because it
 * depends on no month: the soft delete is a different exit and is out of every
 * one of them. It cannot be a bare `deleted_at IS NULL`, because CLOSE stamps
 * that column beside closed_at and a bare test on it would put back exactly the
 * defect above.
 *
 * THE ENDS AND NOT A BOOLEAN, because the callers ask about different spans: a
 * status is about one month and an export about a range, and a flag computed at
 * one month cannot answer whether an account's window intersects a range. They
 * come back as 'YYYY-MM-01' text cut on the OWNER's calendar, so the caller
 * compares strings — lexicographic order on that format is chronological order —
 * and no time zone arithmetic happens in JavaScript.
 *
 * `closedMonth` is null for an account still open, which the callers read as no
 * upper bound rather than as a missing value.
 *
 * `nature` is a catalog value, not a column on category_budget_accounts. The
 * join is LEFT because category_nature_type_id is nullable: an inner join would
 * silently drop accounts with no nature from the ownership check, turning a
 * missing label into a 403 on an account the caller does own.
 *
 * @param {string} userId - User UUID.
 * @param {string} accountType - e.g. 'category_budget'.
 * @param {string} [timeZone] - IANA zone of the account owner, the calendar the month boundaries are cut on.
 * @param {Object} [clientOrPool] - Database client or pool. The same fallback getAccountTypeId above takes, and for the same reason: a probe that closes an account inside a transaction has to read it on that transaction's client or it reads the committed world instead.
 * @returns {Promise<Array<{accountId: number, accountName: string, subcategory: string|null, nature: string|null, currency: string, startMonth: string, closedMonth: string|null, currentMonth: string}>>}
 */
export async function getAccountsByType(userId, accountType, timeZone = 'UTC', clientOrPool = pool) {
  // currentMonth is the same value on every row and is carried here rather than
  // resolved by the caller, for the reason budgetController states at its head:
  // the current month is the server's to decide, never the device's clock.
  const query = `
    SELECT
      ua.account_id,
      ua.account_name,
      cba.subcategory,
      cnt.category_nature_type_name AS nature,
      cur.currency_code AS currency,
      to_char(date_trunc('month', ua.account_start_date AT TIME ZONE $3), 'YYYY-MM-01') AS start_month,
      CASE
        WHEN ua.closed_at IS NULL THEN NULL
        ELSE to_char(date_trunc('month', ua.closed_at AT TIME ZONE $3), 'YYYY-MM-01')
      END AS closed_month,
      to_char(date_trunc('month', now() AT TIME ZONE $3), 'YYYY-MM-01') AS current_month
    FROM user_accounts ua
    JOIN account_types act ON ua.account_type_id = act.account_type_id
    JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
    JOIN currencies cur ON ua.currency_id = cur.currency_id
    LEFT JOIN category_nature_types cnt
      ON cnt.category_nature_type_id = cba.category_nature_type_id
    WHERE ua.user_id = $1
      AND act.account_type_name = $2
      AND ua.account_name != 'slack'
      AND act.account_type_name IS DISTINCT FROM 'boundary'
      AND (ua.deleted_at IS NULL OR ua.closed_at IS NOT NULL)
    ORDER BY ua.account_name ASC
  `;
  const result = await clientOrPool.query(query, [userId, accountType, timeZone]);
  return result.rows.map((row) => ({
    accountId: row.account_id,
    accountName: row.account_name,
    subcategory: row.subcategory || null,
    nature: row.nature || null,
    currency: row.currency,
    startMonth: row.start_month,
    closedMonth: row.closed_month,
    currentMonth: row.current_month,
  }));
}
