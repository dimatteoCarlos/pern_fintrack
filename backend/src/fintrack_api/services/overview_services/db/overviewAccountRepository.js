// src/fintrack_api/services/overview_services/db/overviewAccountRepository.js

// The account id sets the Overview calculators read over.
//
// This exists for one reason, and it is D19: the id set an expense breakdown is
// computed over is NOT the set accountUtils.getAccountsByType returns. That
// helper answers "which accounts can a new transaction be assigned to", so it
// filters deleted_at IS NULL. This one answers "which accounts did money move
// through in this month", and a category deleted last week still spent money
// while it existed.
//
// Deleting an account is a soft delete (deleteAccountService.js:362-372 marks
// deleted_at and nothing else), so its transactions survive the account. Reading
// the breakdown through the filtered helper would drop that spending from
// categories while totalAmount kept counting it, and the same page would show
// two figures that must reconcile and do not.

import { createError } from '../../../../utils/errorHandling.js';

// Every category_budget account the user has ever had, deleted ones included.
//
// No join to category_budget_accounts. Whether an account still carries its
// budget row is a different question, answered by ACCOUNTS_QUERY inside
// budget_services; joining it here would silently drop an account whose row was
// removed, and that account's spending is exactly what hasUncategorizedExpense
// exists to reveal.
//
// The compensation account needs no exclusion here: it cannot appear in a result
// restricted to budget categories, whatever type it carries. The reason this
// comment used to give — that it is a bank account — died at
// 031, which gave it a structural type of its own.
const EXPENSE_ACCOUNT_IDS_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND act.account_type_name = 'category_budget'
  ORDER BY ua.account_id
`;

// The accounts an income figure is read over: the ones that hold real money.
//
// I1 sums the leg that lands in the user's own account, not the one that leaves
// income_source, and this set is what selects it. Filtering by
// transaction_type_id instead would be a second condition saying the same thing,
// free to drift from the account set the count and the list are built on — the
// disagreement §4.2 forbids, and the reason the catalog's own annotation had the
// direction inverted until it was checked against getIncomeConfig.
//
// The compensation account is excluded and belongs excluded: it is the internal
// counterparty of pnl, income and expense, and no figure calls it the user's
// money. Two predicates do it and the type is the one that carries it — a
// set of five type names cannot admit the structural type 031 gave that account.
// The reason this comment used to give, that it is a bank account by type, died
// at that same migration. What the name comparison still does here is the harm
// described at the profit-and-loss set below.
//
// cash (account_type_id 7) is IN the set. It was left out while the catalog held
// that question open, and the developer closed it on 2026-09-01 by decision
// rather than by a count: a cash account reads as a bank account wherever a
// figure is composed, so every set naming bank includes it (D45). Money paid into
// a cash account is income exactly as money paid into a bank account is, and the
// bank balance of the header already counts it.
//
// pocket_saving is still listed, and that is inertia rather than a decision:
// migration 020 emptied every account of that type, so it contributes no ids.
// Taking it out belongs to the work that repoints the pocket module (D54),
// because the same line is rewritten there and against a different model.
const INCOME_ACCOUNT_IDS_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND act.account_type_name IN ('bank', 'cash', 'investment', 'debtor', 'pocket_saving')
    AND ua.account_name != 'slack'
  ORDER BY ua.account_id
`;

// The accounts a realized P/L figure is read over: every account the user owns
// except slack.
//
// No account type filter, because PL1 states none. It covers movement_type_id 9
// across all accounts, which is what separates it from Investment.V3 — the same
// movement narrowed to investment accounts. In practice a pnl row only ever
// touches a bank or an investment account and slack, so the broader set returns
// the same rows; it is written broad anyway, because narrowing it here would be
// this module asserting something PL1 does not.
//
// Having no type filter makes the name comparison this set's SOLE exclusion of
// the compensation account. The other three restrict by type and would keep that
// account out on the type alone, since 031 gave it one and retyped every existing
// one. Both build paths carry that type — the chain reaches it by
// ordering, and the boot seed writes it directly — so the only
// population below it is a chain deliberately stopped there, which is a
// deployment position rather than a case this file can discover.
//
// The name comparison is not merely the weaker guard. It is actively wrong in one
// case: an owner who genuinely names an account 'slack' has it dropped from their
// own figures, silently, by the same predicate that keeps the system's
// counterparty out. Excluding on type AND name is safe everywhere but fixes
// nothing, because that case is excluded by the name half either way.
//
// What blocks the real fix is creation order, not the chain. The resolver takes
// the oldest account matching the name and the two acceptable types, so if a user
// account of that name predates the first compensation write, it becomes the
// counterparty permanently — and a type-only predicate would then count
// the system's compensation writes as the owner's money. Same name, same type,
// opposite correct answers, and nothing on the read side can tell them apart. So
// the name has to be reserved at account creation first; only then does moving to
// the type predicate alone return that account to its owner. Established with the
// migration session, 2026-09-06.
const PNL_ACCOUNT_IDS_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  WHERE ua.user_id = $1
    AND ua.account_name != 'slack'
  ORDER BY ua.account_id
`;

// The accounts of one type, the compensation account excluded — the set
// Debt, Pocket and Investment are each read over.
//
// Two predicates and they pull in opposite directions. The type is what keeps the
// compensation account out, and it is load-bearing beyond this file: the closure
// settlement's counterparty leg lands on that account, so the type predicate is
// what keeps that leg outside the investment reconciliation. The name comparison
// is the half that would wrongly drop an owner's own investment account named
// 'slack'. Same statement, one predicate necessary and one harmful; the
// profit-and-loss set above carries the reason neither can be touched yet.
//
// One statement with the type as a bind parameter, not three. A type name is a
// value the catalog already holds, not a piece of SQL structure, so this is not
// the template with holes the module argues against elsewhere: the shape of the
// statement is fixed and only the value moves.
//
// No deleted_at filter, for the same reason the expense set has none and the
// catalog's D1/P1/H1 state none: a soft-deleted account still owns the balance
// it held in the months before it was closed, and the balance series would bend
// at the month of the deletion if those rows vanished. Closing an account writes
// a compensating movement (R212's annulment rows), so a closed account
// contributes 0 to today's figure without being filtered out of yesterday's.
const ACCOUNT_IDS_BY_TYPE_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND act.account_type_name = $2
    AND ua.account_name != 'slack'
  ORDER BY ua.account_id
`;

// The oldest account the user owns, on the owner's calendar.
//
// This is the E3 guard: a delta is only reported when a COMPLETE prior period
// existed to compare against, and the prior month is complete only if the user
// already had an account before it started. Returned as a local date in text,
// so the service compares it against a month boundary without either side ever
// becoming a Date.
//
// NULL when the user has no accounts at all, which the service reads the same
// way as "younger than the prior month": there is nothing to compare to.
const OLDEST_ACCOUNT_DATE_QUERY = `
  SELECT (MIN(ua.created_at) AT TIME ZONE $2)::date::text AS oldest_account_date
  FROM user_accounts ua
  WHERE ua.user_id = $1
`;

/**
 * The category_budget accounts of a user, soft-deleted ones included (D19).
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getExpenseAccountIds(pool, userId) {
 if (!userId) {
  throw createError(400, 'A user id is required to read expense accounts.');
 }

 const { rows } = await pool.query(EXPENSE_ACCOUNT_IDS_QUERY, [userId]);
 return rows.map((row) => row.account_id);
}

/**
 * The real money accounts of a user, slack excluded — the set income is read over.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getIncomeAccountIds(pool, userId) {
 if (!userId) {
  throw createError(400, 'A user id is required to read income accounts.');
 }

 const { rows } = await pool.query(INCOME_ACCOUNT_IDS_QUERY, [userId]);
 return rows.map((row) => row.account_id);
}

/**
 * Every account of a user except slack — the set realized P/L is read over.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getPnlAccountIds(pool, userId) {
 if (!userId) {
  throw createError(400, 'A user id is required to read pnl accounts.');
 }

 const { rows } = await pool.query(PNL_ACCOUNT_IDS_QUERY, [userId]);
 return rows.map((row) => row.account_id);
}

/**
 * The accounts of one type belonging to a user, slack excluded.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token, never from the client body
 * @param {string} accountTypeName - a name from the account_types catalog
 * @returns {Promise<number[]>} account ids, ascending
 */
async function getAccountIdsByType(pool, userId, accountTypeName) {
 if (!userId) {
  throw createError(400, `A user id is required to read ${accountTypeName} accounts.`);
 }

 const { rows } = await pool.query(ACCOUNT_IDS_BY_TYPE_QUERY, [userId, accountTypeName]);
 return rows.map((row) => row.account_id);
}

/**
 * The debtor accounts of a user — the set the net debt position is read over.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getDebtAccountIds(pool, userId) {
 return getAccountIdsByType(pool, userId, 'debtor');
}

/**
 * The pocket_saving accounts of a user — the set the pocket balance is read over.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getPocketAccountIds(pool, userId) {
 return getAccountIdsByType(pool, userId, 'pocket_saving');
}

/**
 * The investment accounts of a user — the set every V figure is read over.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @returns {Promise<number[]>} account ids, ascending
 */
export async function getInvestmentAccountIds(pool, userId) {
 return getAccountIdsByType(pool, userId, 'investment');
}

/**
 * The local date the user's oldest account was created, or null if they have none.
 *
 * @param {object} pool - Database pool
 * @param {string} userId - UUID from the token
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<string|null>} 'YYYY-MM-DD', or null
 */
export async function getOldestAccountDate(pool, userId, timeZone = 'UTC') {
 const { rows } = await pool.query(OLDEST_ACCOUNT_DATE_QUERY, [userId, timeZone]);
 return rows[0]?.oldest_account_date ?? null;
}
