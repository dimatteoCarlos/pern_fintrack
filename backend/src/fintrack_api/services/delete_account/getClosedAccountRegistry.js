// backend/src/fintrack_api/services/delete_account/getClosedAccountRegistry.js

/**
 * The list behind the closed-accounts screen: one page of the owner's closures,
 * searched, filtered, sorted and counted.
 *
 * WHY THIS READS account_registry AND NOT user_accounts. The close operation
 * REMOVES the account row - `deleteAccountService` deletes it inside the same
 * transaction that writes the closure stamp - so an account closed by the
 * engine has no `user_accounts` row left to carry a `closed_at`. A list built
 * over that table therefore cannot see a single account this module closes.
 * The closure record lives on `account_registry`, written at creation by
 * 035's trigger and stamped at closure, and that is the only table that
 * survives the operation.
 *
 * WHY EVERY CATALOG JOIN IS A LEFT JOIN. Two of the stamped ids are nullable by
 * design rather than by accident. `account_type_id` is `ON DELETE SET NULL`, and
 * `account_name` itself is null on any row for an account erased before this
 * registry existed - 035 documents that such a row can carry nothing else,
 * because the type and the currency lived on rows that are already gone. An
 * INNER JOIN would silently drop exactly the oldest closures, which is the half
 * of the history a registry exists to keep.
 *
 * THE COMPENSATION ACCOUNT IS NOT FILTERED OUT, and that is deliberate rather
 * than an omission. It has a registry row like every account, but it can never
 * carry a `closed_at`: `deleteAccountService` refuses it with a 403 before it
 * branches on the deletion type, by type and by name. A predicate that can never
 * match is noise in a statement a reader has to trust.
 */

import { createError } from '../../../utils/errorHandling.js';

// The columns a sort may name, and the SQL each one maps to. A whitelist rather
// than an escape: the sort key reaches ORDER BY as an identifier, which no
// placeholder can carry, so the only safe spelling is one the client cannot
// influence beyond choosing from this map.
const SORTABLE_COLUMNS = {
  closed_at: 'ar.closed_at',
  account_name: 'ar.account_name',
  account_type_name: 'act.account_type_name',
  account_created_at: 'ar.account_created_at',
};

const DEFAULT_SORT = 'closed_at';
const DEFAULT_ORDER = 'DESC';

// 20 is what one screen shows without scrolling on a phone; 100 is the ceiling
// so a crafted limit cannot ask for the whole registry in one request.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Coerces one page-shaped query parameter to a positive integer.
 * Anything unparseable falls back rather than raising: a stray `?page=abc` in a
 * shared link should show the first page, not an error screen.
 */
const toPositiveInt = (value, fallback, ceiling = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, ceiling);
};

/**
 * @param {object} db - pool; this is a read and takes no lock
 * @param {string} userId
 * @param {object} query - the request's query string, already parsed by express
 * @param {string} [query.search] - matched against the name, the reason and the
 *   category name; absent or blank means no search
 * @param {string} [query.type] - an account_type_name to restrict to
 * @param {string} [query.sort] - a key of SORTABLE_COLUMNS
 * @param {string} [query.order] - 'asc' or 'desc'
 * @param {string|number} [query.page]
 * @param {string|number} [query.limit]
 * @returns {Promise<object>} one page plus the figures a pager needs
 */
export const getClosedAccountRegistry = async (db, userId, query = {}) => {
  if (!userId) {
    throw createError(400, 'A user is required to list closed accounts.');
  }

  const sortKey = Object.prototype.hasOwnProperty.call(
    SORTABLE_COLUMNS,
    query.sort,
  )
    ? query.sort
    : DEFAULT_SORT;

  const sortDirection =
    String(query.order ?? '').toLowerCase() === 'asc' ? 'ASC' : DEFAULT_ORDER;

  const limit = toPositiveInt(query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const page = toPositiveInt(query.page, 1);
  const offset = (page - 1) * limit;

  // Built rather than written out, because search and type are each optional and
  // a statement carrying an always-true placeholder for an absent filter is
  // harder to read than one that does not carry the clause at all.
  const conditions = ['ar.user_id = $1', 'ar.closed_at IS NOT NULL'];
  const values = [userId];

  const searchTerm = String(query.search ?? '').trim();
  if (searchTerm.length > 0) {
    // ILIKE with the wildcards added here, not by the caller: a search box is a
    // substring search, and letting the client send its own pattern makes a
    // leading '%' the caller's choice rather than the endpoint's contract.
    values.push(`%${searchTerm}%`);
    conditions.push(
      `(ar.account_name ILIKE $${values.length}
        OR ar.close_reason ILIKE $${values.length}
        OR ar.category_name ILIKE $${values.length})`,
    );
  }

  const typeFilter = String(query.type ?? '').trim();
  if (typeFilter.length > 0) {
    values.push(typeFilter.toLowerCase());
    conditions.push(`LOWER(act.account_type_name) = $${values.length}`);
  }

  // COUNT(*) OVER() rather than a second statement: the total and the page have
  // to agree, and two statements against a table another session can write to
  // between them do not have to. It costs one window pass over the filtered set,
  // which is the set the page came from anyway.
  const listQuery = `
    SELECT
      ar.account_id,
      ar.account_name,
      act.account_type_name,
      cur.currency_code,
      ar.account_starting_amount::text AS account_starting_amount,
      ar.account_start_date,
      ar.account_created_at,
      ar.category_name,
      ar.subcategory,
      cnt.category_nature_type_name,
      ar.closed_at,
      ar.close_reason,
      COUNT(*) OVER() AS total_rows
    FROM account_registry ar
    LEFT JOIN account_types act
      ON act.account_type_id = ar.account_type_id
    LEFT JOIN currencies cur
      ON cur.currency_id = ar.currency_id
    LEFT JOIN category_nature_types cnt
      ON cnt.category_nature_type_id = ar.category_nature_type_id
    WHERE ${conditions.join('\n      AND ')}
    -- account_id breaks every tie, so two closures stamped in the same
    -- transaction cannot swap places between one page and the next. Without it a
    -- pager over equal sort keys can show the same row twice and skip another.
    ORDER BY ${SORTABLE_COLUMNS[sortKey]} ${sortDirection} NULLS LAST, ar.account_id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

  const { rows } = await db.query(listQuery, [...values, limit, offset]);

  // The window function rides on every row, so an empty page carries no total.
  // Zero is the right answer there: the filter matched nothing.
  const total = rows.length > 0 ? Number(rows[0].total_rows) : 0;

  // Named one field at a time rather than spread, for two reasons. total_rows
  // is dropped - it is the same number on every row, and a list whose items each
  // carry the list's own length invites a reader to treat it as a per-row
  // figure. And the keys come out camelCase, which is the shape every other
  // service in this module publishes; a list that answered snake_case would make
  // the close screen and the closed-account screen speak two conventions about
  // the same account.
  const accountList = rows.map((row) => ({
    accountId: row.account_id,
    accountName: row.account_name,
    accountTypeName: row.account_type_name,
    currencyCode: row.currency_code,
    accountStartingAmount: row.account_starting_amount,
    accountStartDate: row.account_start_date,
    accountCreatedAt: row.account_created_at,
    categoryName: row.category_name,
    subcategory: row.subcategory,
    categoryNatureTypeName: row.category_nature_type_name,
    closedAt: row.closed_at,
    closeReason: row.close_reason,
  }));

  return {
    rows: accountList.length,
    total,
    page,
    limit,
    // Ceil, so a final partial page counts. Zero results give zero pages rather
    // than one empty one, which is what lets a pager hide itself.
    pageCount: Math.ceil(total / limit),
    sort: sortKey,
    order: sortDirection.toLowerCase(),
    search: searchTerm,
    type: typeFilter,
    accountList,
  };
};

// The keys a client may send as `sort`, exported so the screen's dropdown and
// this whitelist cannot drift into offering an option the query rejects.
export const CLOSED_ACCOUNT_SORT_KEYS = Object.keys(SORTABLE_COLUMNS);
