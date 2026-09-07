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
// at that same migration. The name comparison that used to sit here is gone for
// the reason argued at the profit-and-loss set below: the inclusive type list
// cannot admit the compensation account, so the comparison excluded only an
// owner's own account that happened to carry that name.
//
// cash (account_type_id 7) is IN the set, and this is the half of the merge that
// came from this branch. It was left out while the catalog held the question
// open, and the developer closed it on 2026-09-01 by decision rather than by a
// count: a cash account reads as a bank account wherever a figure is composed, so
// every set naming bank includes it (D45). Money paid into a cash account is
// income exactly as money paid into a bank account is, and the bank balance of
// the header already counts it. The comment main carried here deferred to the
// probe that decision replaced, so it does not survive the merge.
//
// pocket_saving is OUT, and that is the half that came from main. Migration 020
// emptied that type and turned a pocket into a plan committing money that stays
// in the real account, so it contributes no row today — and leaving the name
// written would put income back into this set the moment anyone recreated such an
// account. This branch still listed it and called that inertia rather than a
// decision, deferring the removal to the pocket repointing (D54); main did the
// repointing, so the removal arrives with it and the deferral is spent.
const INCOME_ACCOUNT_IDS_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND act.account_type_name IN ('bank', 'cash', 'investment', 'debtor')
  ORDER BY ua.account_id
`;

// The accounts a realized P/L figure is read over: every account the user owns
// except the system's compensation account.
//
// The set is wider than the domain and that is deliberate. A realised gain or
// loss belongs to an investment position, but the deletion path writes annulment
// rows carrying this movement type onto whatever account the money passed
// through. Measured 2026-09-07: of the rows carrying it, investment holds 3, bank
// holds 5 and all five are annulment, the compensation account holds 12 of which
// 10 are annulment, and category_budget, pocket_saving, income_source and debtor
// hold none. Narrowing the set to the domain would change no published figure
// today and would drop the indirect rows a hard deletion produces the day one
// lands on a type the narrow list forgot.
//
// No account type filter, because PL1 states none. It covers movement_type_id 9
// across all accounts, which is what separates it from Investment.V3 — the same
// movement narrowed to investment accounts. In practice a pnl row only ever
// touches a bank or an investment account and slack, so the broader set returns
// the same rows; it is written broad anyway, because narrowing it here would be
// this module asserting something PL1 does not.
//
// An account's identity is its NAME and its TYPE together, both, at every
// predicate — ruled 2026-09-06. This set is one of the two places in
// this module and its page-level sibling where that changed anything: it had no
// type filter and no join at all, so it gains both. The other one is the
// recent-activity list, which selected the type without ever comparing it.
//
// The four remaining predicates across the two files were left alone on purpose.
// Each restricts the type with an inclusive list — four types here in the
// income set, two in the bank balance, one in the saving goals, and a parameter
// closed by the only three wrappers exported over the by-type helper — and
// 'boundary' is in none of them. Adding the comparison there would read as a
// defence and remove nothing, which costs the next reader the work of checking
// the list to find out.
//
// The join is inner and the comparison is <>. Both were LEFT and IS DISTINCT
// FROM until migration 033 made user_accounts.account_type_id NOT NULL behind a
// RESTRICT foreign key: an account can no longer carry no type, and deleting a
// referenced catalog row is refused rather than blanking the column. The case
// they were written for cannot occur.
//
// Worth recording how this one went stale, because it is the reason a register
// of retirable sites cannot live in a migration header: nobody edited these
// lines. 033 landed on main, this branch merged it hours later for an unrelated
// purpose, and the merge is what made the sentence false. No commit against this
// file marks the moment.
//
// The swap is an equivalence and not a judgement call: account_types
// .account_type_name is itself NOT NULL, so with a matching row guaranteed, <>
// and IS DISTINCT FROM return the same set for every value the column can hold.
//
// The name comparison this set used to carry is gone, and so is the ruling that
// kept it. That ruling held that the compensation account is identified by its
// name and its type together, so neither half could be dropped until the name was
// reserved at account creation. The blocking case it described was an owner's
// account named 'slack' predating the first compensation write and becoming the
// counterparty permanently, at which point a type-only predicate would count the
// system's writes as the owner's money.
//
// That case cannot happen. The resolver requires the type: checkAndInsertAccount
// matches account_name together with LOWER(account_type_name) = ANY(['boundary']),
// so an owner's bank or cash account of that name cannot become the counterparty
// however old it is. Migration 031 typed every compensation account and the
// resolver stopped accepting anything else, which is what falsified the premise.
// A name reservation was never the operative precondition in any case, because
// the type predicate reads no names and no name can make it wrong.
//
// What the name comparison did do, at all five sites that carried it, was drop an
// owner's own account genuinely named 'slack' out of their own figures with no
// error and no notice. So this is not the retirement of a redundant guard, it is
// the removal of a live defect — which is the test this module applies before
// touching a predicate that works.
//
// Measured before removal, 2026-09-07: every account caught by either predicate
// on the development database is one row, named 'slack' and typed 'boundary'.
// Nothing carries that name without that type, so the type predicate loses no
// exclusion; nothing carries that type under another name, so the name comparison
// was not leaking either. The two selected identically, and only one of them is
// right for the wrong input.
//
// The hole this leaves is on the write side and is not compensated for here.
// createBasicAccount resolves the requested type against the catalog and does not
// call assertUserCreatableAccountType, which guards the debtor path only, so
// 'boundary' is still requestable on that route. A user-created account of that
// type would be excluded from these figures as though it were the system's. That
// defect reaches the read sites already using the type predicate exactly as it
// reaches these five, so it belongs at creation and not in a read. Routed
// 2026-09-07; supersedes the precondition agreed with the migration session.
const PNL_ACCOUNT_IDS_QUERY = `
  SELECT ua.account_id
  FROM user_accounts ua
  JOIN account_types act ON act.account_type_id = ua.account_type_id
  WHERE ua.user_id = $1
    AND act.account_type_name <> 'boundary'
  ORDER BY ua.account_id
`;

// The accounts of one type, the compensation account excluded — the set
// Debt, Pocket and Investment are each read over.
//
// The type is what keeps the compensation account out, and it is load-bearing
// beyond this file: the closure settlement's counterparty leg lands on that
// account, so the type predicate is what keeps that leg outside the investment
// reconciliation. The name comparison that used to sit beside it wrongly dropped
// an owner's own investment account named 'slack', and it is gone — the
// profit-and-loss set above carries why.
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
//
// The one set in this file that excludes the compensation account by NO predicate
// of its own, and it is safe by creation order rather than by chance: that account
// is created lazily on the first compensation write, which needs an account to
// compensate against, so it can never hold the minimum. A predicate here would be
// dead for the same reason the four removed on 2026-09-06 were. Measured on
// fintrack_dev: it ties with the owner's first accounts, so the figure is right
// either way. The exception is the reserved-name gap stated above - an owner's own
// account of that name, created first, both becomes the counterparty and
// legitimately opens the window, so there is nothing to exclude.
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
