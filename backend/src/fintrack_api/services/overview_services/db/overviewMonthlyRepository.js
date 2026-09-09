// src/fintrack_api/services/overview_services/db/overviewMonthlyRepository.js

// The monthly figures behind a flow domain's card, one query per domain.
//
// totalAmount, transactionCount, delta and trend are four readings of the same
// six rows, not four queries. §4.2: two figures that must reconcile have to come
// from literally the same formula, and the surest way to guarantee that is for
// them to come from the same statement. Deriving the delta from a second query
// would let the card and the chart disagree about the same month.
//
// Three whole statements rather than one with the filter interpolated. The rule
// is the one overviewTransactionRepository.js:65-68 already states — a whole
// statement can be read and compared, a template with holes cannot — and the
// three differ by more than a WHERE anyway: expense nets two movement types
// through a CASE, income sums one, and pnl carries a description filter. What is
// shared is the reading of the rows, and that is shared for real, below.
//
// Every one of them repeats three rules on purpose, because each has to hold in
// each statement or the figure that statement produces is wrong:
//
//  - generate_series is on the LEFT of the join (D18): a month with no activity
//    publishes a real 0, never null and never a gap. Omitting it would falsify
//    the shape of the series — a flat month and a missing month look nothing
//    alike on a chart, and only one of them is what the data says.
//  - the count carries no filter of its own (D21). The catalog defines the
//    count of every domain as COUNT(*) over the rows of that domain's total, so
//    the filter lives in the join and the count inherits it. Counting a subset
//    made the expense card report 23 while the list under it showed the 26 rows
//    the total was made of — the disagreement §4.2 forbids.
//  - R42, §4.5: exactly one AT TIME ZONE per operand and in opposite
//    directions — the bounds go local month boundary -> instant to meet a
//    TIMESTAMPTZ column, which is the direction generate_series's TIMESTAMP
//    output already selects without a cast. The month labels come back as text
//    because a pg DATE becomes a JS Date at the node process's local midnight
//    and can shift a day in the driver.

import {
 EXPENSE_MOVEMENT_TYPE_ID,
 INCOME_MOVEMENT_TYPE_ID,
 PNL_MOVEMENT_TYPE_ID,
 TRANSFER_MOVEMENT_TYPE_ID,
} from './movementTypes.js';
import { toAmount } from '../../budget_services/core/money.js';
import { RTA_ANNULMENT_TARGET_PREFIX } from '../../../../utils/fintrackUtils/accountDeletionUtils/annulmentRowIdentity.js';

// Expense: the netting is SPENT_QUERY's, verbatim
// (budgetTransactionRepository.js:181-197) and for D20's reason. movement_type_id
// 6 is the reversal transfer that sends money back from a category to a bank,
// and `amount` is already signed per leg — negative on the withdraw side.
// Counting type 1 alone would report a refunded expense as still spent, while
// actualSpent — which nets — reported it as returned, so two figures that are a
// subset of one another would disagree over a refund.
const MONTHLY_EXPENSE_QUERY = `
  SELECT
    m.month::date::text AS month,
    COALESCE(SUM(
      CASE
        WHEN t.movement_type_id = ${EXPENSE_MOVEMENT_TYPE_ID} THEN t.amount
        WHEN t.movement_type_id = ${TRANSFER_MOVEMENT_TYPE_ID} THEN t.amount
        ELSE 0
      END
    ), 0) AS total_amount,
    COUNT(t.transaction_id) AS transaction_count
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  LEFT JOIN transactions t
    ON t.account_id = ANY($1::int[])
   AND t.movement_type_id IN (${EXPENSE_MOVEMENT_TYPE_ID}, ${TRANSFER_MOVEMENT_TYPE_ID})
   AND t.transaction_actual_date >= (m.month AT TIME ZONE $4)
   AND t.transaction_actual_date <  ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  GROUP BY m.month
  ORDER BY m.month
`;

// Income: one movement type and no netting. There is no reversal counterpart to
// D20 here — a transfer cannot name income_source as an endpoint
// (getTransferConfig takes its types from the request body, which offers bank,
// pocket, investment and debtor), so no movement_type_id 6 row can ever be an
// undone income.
//
// The leg is selected by the account set the caller passes, not by
// transaction_type_id: income_source accounts are not in that set, so only the
// leg that landed in the user's own account survives the join. That is also why
// the sum comes out positive — the surviving leg is the deposit.
const MONTHLY_INCOME_QUERY = `
  SELECT
    m.month::date::text AS month,
    COALESCE(SUM(t.amount), 0) AS total_amount,
    COUNT(t.transaction_id) AS transaction_count
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  LEFT JOIN transactions t
    ON t.account_id = ANY($1::int[])
   AND t.movement_type_id = ${INCOME_MOVEMENT_TYPE_ID}
   AND t.transaction_actual_date >= (m.month AT TIME ZONE $4)
   AND t.transaction_actual_date <  ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  GROUP BY m.month
  ORDER BY m.month
`;

// PnL: movement_type_id 9, with R212's exclusion. That movement mixes real
// realized P/L with the compensating rows an account deletion writes, and the
// only thing telling them apart is the description prefix.
//
// The account-closure type is not read here. A closure settlement is money
// leaving a closed account, not a result the owner earned, so it stays outside a
// sum of realized P/L however many rows carry that type.
//
// The exclusion does leave this statement out of step with the derived balance,
// which sums every row of an account except its single opening row and so keeps
// a closure settlement. That gap only shows where a balance is compared against
// terms enumerated by type, and the module has one such place — the investment
// reconciliation, which claims the closure type in its own third term. This card
// compares nothing against a balance; it publishes a flow.
//
// The IS NULL branch is load-bearing, not defensive noise: description is
// nullable (003_transactions.sql:21), and `NULL NOT LIKE ...` is NULL, which a
// join treats as no match. Without it a real P/L row that was written without a
// description would be dropped from the total, the count and the chart at once.
//
// The sum comes out signed the way the user means it: on a profit the non-slack
// leg is the deposit and on a loss it is the withdraw, so gains add and losses
// subtract without a CASE.
//
// The account type is joined for one figure, and it answers a question the card
// could not answer before: how much of the month's realised result came from
// investment accounts. This domain reads EVERY account except the internal
// counterparty, so its total mixes two economically different things — a result
// the market produced on a position, and a result recorded against a bank or a
// debtor account. Without the split, an owner comparing this card against the
// investment card finds two figures that agree on some data and diverge on other
// data, with nothing on either card saying why.
//
// It is a SPLIT of the same sum and not a second statement, and that is what
// makes it trustworthy: the FILTER runs over exactly the rows the total already
// summed, so the investment share cannot exceed the total and the two cannot be
// built over different cuts. The remainder is the subtraction, which is why only
// one of the two halves is published.
//
// THE SPLIT IS MADE BY ACCOUNT ID AND NOT BY A JOINED TYPE NAME, which is what
// makes it agree with the investment card rather than merely resemble it: $5 is
// the very set getInvestmentAccountIds returns, so the two cannot be built over
// different readings of what an investment account is. Reading the type through
// a join to user_accounts also lost the split for a CLOSED investment account,
// whose row is gone while its rows are still summed into the total - the share
// would have understated with nothing on the card saying why.
//
// The transactions join is LEFT and has to stay LEFT. The outer source is a
// generated month series, so an inner join below it drops every month with no
// profit-and-loss row, and the series grows the gaps the delta and the chart
// both assume are absent.
const MONTHLY_PNL_QUERY = `
  SELECT
    m.month::date::text AS month,
    COALESCE(SUM(t.amount), 0) AS total_amount,
    COUNT(t.transaction_id) AS transaction_count,
    COALESCE(SUM(t.amount) FILTER (
      WHERE t.account_id = ANY($5::int[])
    ), 0) AS investment_amount
  FROM generate_series($2::date, $3::date, INTERVAL '1 month') AS m(month)
  LEFT JOIN transactions t
    ON t.account_id = ANY($1::int[])
   AND t.movement_type_id = ${PNL_MOVEMENT_TYPE_ID}
   AND (t.description IS NULL OR t.description NOT LIKE '${RTA_ANNULMENT_TARGET_PREFIX}%')
   AND t.transaction_actual_date >= (m.month AT TIME ZONE $4)
   AND t.transaction_actual_date <  ((m.month + INTERVAL '1 month') AT TIME ZONE $4)
  GROUP BY m.month
  ORDER BY m.month
`;

// Income by source, for ONE month — the level-2 distribution of §4.1.
//
// It is the same rows MONTHLY_INCOME_QUERY sums for that month, grouped instead
// of totalled: the same account set selects the leg, the same movement type
// admits the row and the same two bounds cut it. That is what makes the parts
// sum to the card's figure rather than merely resemble it, and it is why this
// statement lives beside the total it splits instead of in a file of its own.
//
// The source is the OTHER leg's account, read off source_account_id. Both legs
// of a movement are written carrying the same source and destination
// (prepareTransactionOption.js), so the deposit leg this set selects names the
// income_source account it came from without the counter leg being fetched.
//
// The join is LEFT and the grouping keeps a NULL source as its own part.
// source_account_id is nullable (003_transactions.sql:49), so an income written
// without one is real money with no attributable origin — dropping it would make
// the parts fail to sum to the card, which is the one thing this statement owes.
// An INNER join would drop it silently, which is the same defect with no way to
// see it.
//
// No ORDER BY. The ranking is the builder's — it breaks ties on the source name
// and a SQL ordering would be a second, weaker ordering that the builder then
// discards.
const INCOME_BY_SOURCE_QUERY = `
  SELECT
    t.source_account_id AS account_id,
    src.account_name AS account_name,
    COALESCE(SUM(t.amount), 0) AS total_amount,
    COUNT(t.transaction_id) AS transaction_count
  FROM transactions t
  LEFT JOIN user_accounts src ON src.account_id = t.source_account_id
  WHERE t.account_id = ANY($1::int[])
    AND t.movement_type_id = ${INCOME_MOVEMENT_TYPE_ID}
    AND t.transaction_actual_date >= ($2::timestamp AT TIME ZONE $3)
    AND t.transaction_actual_date <  (($2::date + INTERVAL '1 month') AT TIME ZONE $3)
  GROUP BY t.source_account_id, src.account_name
`;

// Pocket has no statement here. It used to: a monthly net over the rows of the
// pocket_saving accounts, which migration 020 emptied. A pocket is a plan now
// and its movements are allocation rows, so the snapshot's pocket entry is read
// from the allocation ledger instead (overviewPocketRepository.js).
//
// "Emptied" is a state, not a guarantee, and the difference bounds what any
// predicate here may assume. 020 deletes every transaction touching a legacy
// pocket account and then the accounts themselves, but it deliberately leaves
// both catalog values in place — the account type and the pocket movement type
// are still seeded and still pass every foreign key. So no row carries them
// today and nothing in the schema stops one from being written tomorrow. Every
// account set this module builds by INCLUSION is unaffected; the one built by
// exclusion is the profit-and-loss set, which admits every type but the internal
// counterparty and would therefore admit a legacy pocket account while no hero
// figure counts its balance. Left as it is because that set is defined by what
// it excludes on purpose, and recorded so the asymmetry is a known one.

/**
 * Run one of the monthly statements and read its rows.
 *
 * The three statements differ; the reading of their result does not, and it is
 * shared rather than repeated because it carries a rule of its own — a count is
 * a number and an amount goes through money, in every domain.
 *
 * An empty accountIds still returns the full month list at zero rather than an
 * empty array. A user with no accounts of the domain's kind has a total of 0,
 * which is a real answer; an empty series would make the card render a skeleton
 * forever.
 *
 * @param {object} pool - Database pool
 * @param {string} sql - one of the statements above
 * @param {number[]} accountIds - the set that selects the leg
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number, transactionCount: number}>>}
 */
const readMonthlyRows = async (pool, sql, accountIds, from, to, timeZone, extraParams = []) => {
 // extraParams continues the numbering from $5 and is empty for every statement
 // but the profit-and-loss one, which binds the investment set its split is cut
 // by. Appended rather than given a reader of its own: the four leading binds
 // and the row mapping are identical, and a second copy of both is a second
 // place for them to drift.
 const { rows } = await pool.query(sql, [accountIds ?? [], from, to, timeZone, ...extraParams]);

 return rows.map((row) => ({
  month: row.month,
  totalAmount: toAmount(row.total_amount ?? 0),
  // COUNT comes back as a string from the driver on bigint columns; Number is
  // exact here because a month's transaction count cannot leave the safe range.
  transactionCount: Number(row.transaction_count ?? 0),
  // Only the profit-and-loss statement selects this column. Absent where it is
  // not selected rather than defaulted to 0: an income month reporting an
  // investment share of 0 would assert a split that has no meaning for income,
  // and a caller reading the field would have no way to tell the assertion from
  // a real zero.
  ...(row.investment_amount === undefined
   ? {}
   : { investmentAmount: toAmount(row.investment_amount ?? 0) }),
 }));
};

/**
 * The expense of a set of accounts, month by month, over a closed range.
 *
 * Returns one entry per calendar month between `from` and `to` inclusive, with
 * no gaps: a month with no transactions reports 0 and 0.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - category_budget accounts, closed and soft-deleted included (D19)
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number, transactionCount: number}>>}
 */
export async function getMonthlyExpense(pool, accountIds, from, to, timeZone = 'UTC') {
 return readMonthlyRows(pool, MONTHLY_EXPENSE_QUERY, accountIds, from, to, timeZone);
}

/**
 * The income of a set of accounts, month by month, over a closed range.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the user's real money accounts, slack excluded
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{month: string, totalAmount: number, transactionCount: number}>>}
 */
export async function getMonthlyIncome(pool, accountIds, from, to, timeZone = 'UTC') {
 return readMonthlyRows(pool, MONTHLY_INCOME_QUERY, accountIds, from, to, timeZone);
}

/**
 * The realized P/L of a set of accounts, month by month, over a closed range.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - every account of the user except slack
 * @param {string} from - first month of the window, as 'YYYY-MM-01'
 * @param {string} to - last month, inclusive, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @param {number[]} investmentAccountIds - the set investmentAmount is cut by,
 *   the same one getInvestmentAccountIds returns. Empty reports a share of 0,
 *   which is the true answer for an owner with no investment account.
 * @returns {Promise<Array<{month: string, totalAmount: number, transactionCount: number}>>}
 */
export async function getMonthlyPnl(pool, accountIds, from, to, timeZone = 'UTC', investmentAccountIds = []) {
 return readMonthlyRows(pool, MONTHLY_PNL_QUERY, accountIds, from, to, timeZone, [
  investmentAccountIds ?? [],
 ]);
}

/**
 * The income of one month broken down by the source it came from.
 *
 * Returns one entry per source that moved money in the month, unordered — the
 * caller ranks them. An empty array means the month received nothing, which the
 * caller reports as a notice rather than as a distribution over no parts.
 *
 * accountId and accountName are null together on the one part that has no source
 * account. They are two nulls and not one because a consumer rendering a row
 * needs to know both that it cannot link to an account and that it has no name
 * to print.
 *
 * @param {object} pool - Database pool
 * @param {number[]} accountIds - the same set the month's total is summed over
 * @param {string} month - the month to break down, as 'YYYY-MM-01'
 * @param {string} timeZone - IANA zone of the account owner
 * @returns {Promise<Array<{accountId: number|null, accountName: string|null, amount: number, transactionCount: number}>>}
 */
export async function getIncomeBySource(pool, accountIds, month, timeZone = 'UTC') {
 const { rows } = await pool.query(INCOME_BY_SOURCE_QUERY, [
  accountIds ?? [],
  month,
  timeZone,
 ]);

 return rows.map((row) => ({
  accountId: row.account_id ?? null,
  accountName: row.account_name ?? null,
  amount: toAmount(row.total_amount ?? 0),
  transactionCount: Number(row.transaction_count ?? 0),
 }));
}
