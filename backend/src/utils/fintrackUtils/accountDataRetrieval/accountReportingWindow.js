// backend/src/utils/fintrackUtils/accountDataRetrieval/accountReportingWindow.js

/**
 * The months an account has a balance to report, written once for every
 * month-scoped stock read.
 *
 * THE RULE. An account reports across `[account_start_date, closed_at]` and
 * nowhere else. Carlos, 2026-09-17: *"la cuenta cerrada deberia antes de la
 * fecha en que fue cerrada, despues no."* The floor half already existed in two
 * queries; this is the ceiling those two floors imply, and both ends now travel
 * together instead of one being remembered and the other not.
 *
 * WHY A MONTH-RELATIVE BOUND AND NOT `closed_at IS NULL`. Those are different
 * questions and only one of them is answerable by a figure about a past month.
 * `closed_at IS NULL` asks whether the account is in circulation TODAY, so
 * applying it to March removes from March a balance the owner really held in
 * March. The window asks whether the account existed in the month being priced,
 * which is the only question a historical read has any business asking.
 *
 * WHAT IT SUPPRESSES, CONCRETELY. Since CLOSE began keeping the row
 * (`deleteAccountService.js`, 2026-09-19) a closed account is present in every
 * one of these reads for every month, and its balance after closure is 0 -
 * `CLOSE_ZERO_BALANCE_TYPES` refuses to close a bank, cash, investment or
 * debtor account at anything else. In an aggregate that 0 is inert. In a
 * per-account list it is a row of zeros that reads as a live account holding
 * nothing, and in a count it is a counterparty that is still being counted.
 *
 * THE INERTNESS IS NOT A PROPERTY OF THESE QUERIES AND THE PREDICATE GOES IN
 * ANYWAY. It is a property of `CLOSE_ZERO_BALANCE_TYPES`, in another file.
 * `pocket_saving`, `category_budget` and `income_source` are absent from that
 * list and can close carrying a balance, which an aggregate without this window
 * would freeze into every month that follows, forever and silently. None of the
 * eight reads touches those types today. An aggregate that is correct because
 * of a constant in a file it does not import is correct by coincidence.
 *
 * THE THIRD CLAUSE IS THE OTHER EXIT. CLOSE stamps `deleted_at` beside
 * `closed_at` for the duration recorded in `deleteAccountService.js`, so a bare
 * `deleted_at IS NULL` also removes every closed account - which is exactly what
 * this window exists to stop. A row carrying `deleted_at` and NO `closed_at` is
 * the soft delete, a different exit with no month semantics at all, and it stays
 * out for every month. The soft delete is refused today
 * (`SOFT_DELETION_ENABLED`), so the clause is dormant and correct rather than
 * dormant and untested in the wrong direction.
 *
 * WHAT THIS DOES NOT RECOVER. An account closed BEFORE 2026-09-19 has no
 * `user_accounts` row at all and is invisible to every reader that selects from
 * that table, in all of its months, window or no window. Bringing that
 * population back needs the substitute source (`accountIdentity.js`) and a user
 * id in five signatures that have none; it is recorded in
 * `plan-docs/ongoing/PLAN_ACCOUNT_DELETION/PLAN_CLOSED_ACCOUNT_BALANCE.md`. The
 * two populations are permanent, so this limit does not expire on its own.
 */

/**
 * Whether a given month falls inside an account's reporting window.
 *
 * Both comparisons are made on the month, not on the day, so an account closed
 * on the 14th still reports the month it was closed in. That is the mirror of
 * what the floor already does at the other end - an account opened on the 20th
 * reports its opening month whole - and the two have to agree or a one-month
 * account reports either twice or never.
 *
 * `AT TIME ZONE` on each timestamp and none on the month: R42, §4.5, one
 * conversion per operand and in opposite directions. The stamps are TIMESTAMPTZ
 * and become local timestamps to meet a month boundary that is already local.
 *
 * @param {string} [accountAlias] - The alias of `user_accounts` in the caller's query
 * @param {string} [monthSql] - The month being priced: a bind placeholder such as `$2::date`, or a qualified column such as `m.month`
 * @param {string} [timeZonePlaceholder] - The bind placeholder holding the owner's zone, e.g. '$4'
 * @returns {string} - A parenthesised boolean SQL expression, to sit in a WHERE
 */
export function accountReportingWindowSql(
 accountAlias = 'ua',
 monthSql = '$2::date',
 timeZonePlaceholder = '$3',
) {
 // All three are interpolated into SQL, so each is restricted to a shape that
 // cannot carry a value. Same guard, and same reason, as derivedAccountBalanceSql
 // and accountIdentitySelect in this folder.
 if (!/^[a-z_][a-z0-9_]*$/i.test(accountAlias)) {
  throw new Error(
   `accountReportingWindowSql expects a table alias, received: ${accountAlias}`,
  );
 }

 // A bind placeholder with an optional date cast, or a qualified column. The
 // two forms are the two the callers have: a single reference month arrives
 // bound, a series of months arrives from generate_series.
 if (!/^(\$\d+(::date)?|[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)$/i.test(monthSql)) {
  throw new Error(
   `accountReportingWindowSql expects a bind placeholder or a qualified column for the month, received: ${monthSql}`,
  );
 }

 if (!/^\$\d+$/.test(timeZonePlaceholder)) {
  throw new Error(
   `accountReportingWindowSql expects a bind placeholder such as '$3' for the time zone, received: ${timeZonePlaceholder}`,
  );
 }

 return `(
        -- A month before the account's own start month has no balance to
        -- report, not a $0 one: without this floor the same subtraction that
        -- prices a past close manufactures a synthetic $0 row for an account
        -- that did not exist yet.
        ${monthSql} >= date_trunc('month', ${accountAlias}.account_start_date AT TIME ZONE ${timeZonePlaceholder})
        -- And the mirror: a month after the account was closed has no balance
        -- to report either, for the same reason and not a $0 one.
        AND (
          ${accountAlias}.closed_at IS NULL
          OR ${monthSql} <= date_trunc('month', ${accountAlias}.closed_at AT TIME ZONE ${timeZonePlaceholder})
        )
        -- The soft delete is the other exit and has no month: a row stamped
        -- deleted_at without closed_at is out of every month, not out of the
        -- ones after a date. A closed row carries both stamps, which is why
        -- this cannot be a bare deleted_at IS NULL.
        AND (
          ${accountAlias}.deleted_at IS NULL
          OR ${accountAlias}.closed_at IS NOT NULL
        )
      )`;
}

export default accountReportingWindowSql;
