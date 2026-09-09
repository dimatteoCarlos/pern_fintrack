// backend/src/utils/fintrackUtils/accountDataRetrieval/accountIdentity.js

/**
 * One place that answers "which account is this and what is it called", for a
 * reader that must keep working after the account row is gone.
 *
 * CLOSE deletes the `user_accounts` row. What survives is the `account_registry`
 * row under the same `account_id`, which is what every transaction, pocket
 * allocation and budget month keeps pointing at after migration 035 repoints
 * their keys. So a query that reaches an account through `JOIN user_accounts`
 * stops returning the row entirely once that account closes - not a missing
 * name on a row that is still there, but the row itself dropped by the join.
 * This CTE is the substitution for that join.
 *
 * **A CTE rather than a scalar expression, and the difference is not stylistic.**
 * `derivedAccountBalanceSql` in this same folder could be an expression because
 * `user_accounts` was always present and only the column being read was wrong.
 * Here the row's absence IS the problem: `TRANSACTION_ROW_SOURCE` reaches the
 * account with an INNER `JOIN user_accounts ua ON ua.account_id = tr.account_id`,
 * and no expression inside a SELECT runs on a row the FROM already dropped. The
 * substitution has to happen at the source, which is what a CTE joined on
 * `account_id` does - one identical one-line change per query rather than a
 * clause pasted seventeen times into seventeen different shapes.
 *
 * **The registry drives and `user_accounts` is joined onto it, but almost every
 * column still comes from `user_accounts` first.** The row set has to be the
 * registry's, because that is the only side a closed account still appears on.
 * The values cannot be, because of what 035 actually writes: its trigger at
 * `fn_register_account_identity` and its backfill both insert
 * `(account_id, user_id)` and nothing else, so an OPEN account's registry row
 * carries NULL in every identity column. The rest is filled only at closure, by
 * the upsert in `processCloseAccount`. Reading the registry's columns directly
 * would therefore blank the name of every open account in the application -
 * which is why each column below is a COALESCE and not a bare `ar.` reference.
 *
 * **`account_id` and `account_starting_amount` keep their names exactly.**
 * `derivedAccountBalanceSql(alias)` reads precisely those two off whatever alias
 * it is given, so `derivedAccountBalanceSql('ai', 'FLOAT')` works against this
 * CTE with no change to that file and no change to any caller's arithmetic.
 * Renaming either one would mean rewriting every balance in Overview.
 *
 * **A null `account_name` is published as null, deliberately.** It means one
 * thing only: the account was erased before `account_registry` existed, so no
 * name was ever stamped. A fabricated stand-in would travel to the frontend
 * under the same field as a real name with no way for a consumer to tell them
 * apart - the same defect `transactionRowShape.js` documents against itself for
 * `account_balance_after_tr`. The frontend already renders a dash for a withheld
 * figure rather than inventing one. `is_closed` is what lets a caller tell that
 * case from an open account whose name is simply present.
 *
 * PRECONDITION, AND ITS FAILURE IS THE LOUD KIND. `account_registry` does not
 * exist until migration 035 is applied. A query built on this CTE against a
 * database without it fails with `relation "account_registry" does not exist` -
 * which is the good case, and the opposite of the quiet family: a comparison
 * against an absent catalog row excludes nothing and raises nothing. Nobody has
 * to remember this precondition, because the database states it.
 *
 * **`account_created_at` is the account's own creation, not the row's.**
 * `account_registry` names it with the prefix because a bare `created_at` on
 * that table would mean the registry row's insertion time on a live account and
 * the account's on a closed one. Published here under the same prefixed name so
 * the ambiguity does not travel: `OLDEST_ACCOUNT_DATE_QUERY` needs the earliest
 * account a user ever opened, and closing that account must not move the date.
 *
 * WHAT IS DELIBERATELY NOT HERE. The registry also carries `category_name`,
 * `subcategory`, `category_nature_type_id`, `closed_at`, `closed_by` and
 * `close_reason`. They are not in this CTE because no consumer of an account's
 * identity needs them, and a column added on speculation is a column a later
 * reader has to check for meaning. A closure-detail reader should select them
 * from `account_registry` directly rather than widen this.
 */

/**
 * Every account one owner has ever had, open or closed, with its identity
 * resolved from whichever side still holds it.
 *
 * The caller replaces `JOIN user_accounts ua ON ua.account_id = <x>` with
 * `JOIN account_identity ai ON ai.account_id = <x>` and reads `ai.` where it
 * read `ua.`. A caller that must keep excluding closed accounts adds
 * `AND NOT ai.is_closed`, which is the same predicate it used to get for free
 * from the join and now has to state.
 *
 * The user filter reads the registry's own `user_id` rather than a COALESCE:
 * the trigger copies it from the account at creation and it is NOT NULL, so it
 * is present for open and closed accounts alike, and reading one column keeps
 * the filter indexable.
 *
 * @param {string} [userIdPlaceholder] - The bind placeholder holding the owner's id, e.g. '$1'
 * @returns {string} - The CTE body, to follow a `WITH`
 */
export function accountIdentitySelect(userIdPlaceholder = '$1') {
 // Interpolated into SQL, so it is restricted to a bind placeholder and can
 // never carry a value. The values themselves stay bound by the caller. Same
 // guard, and same reason, as accountLedgerCte in derivedBalance.js.
 if (!/^\$\d+$/.test(userIdPlaceholder)) {
  throw new Error(
   `accountIdentitySelect expects a bind placeholder such as '$1', received: ${userIdPlaceholder}`,
  );
 }

 return `
        SELECT
          ar.account_id,
          -- Selected as well as filtered on. A caller that swaps this in for
          -- \`user_accounts ua\` keeps whatever \`ua.user_id\` predicate it already
          -- had, so the swap is one line per query and touches nothing else.
          -- Redundant against the WHERE below, never contradictory: both read
          -- the same column of the same row.
          ar.user_id,
          COALESCE(ua.account_name, ar.account_name) AS account_name,
          COALESCE(ua.account_type_id, ar.account_type_id) AS account_type_id,
          COALESCE(ua.currency_id, ar.currency_id) AS currency_id,
          COALESCE(
            ua.account_starting_amount,
            ar.account_starting_amount
          ) AS account_starting_amount,
          COALESCE(ua.account_start_date, ar.account_start_date) AS account_start_date,
          COALESCE(ua.created_at, ar.account_created_at) AS account_created_at,
          -- The account row is gone, so the account is closed. Derived rather
          -- than read: account_registry.closed_at is stamped by CLOSE, and an
          -- account erased by the deletion tail leaves a registry row with no
          -- stamp at all. Testing the join is the one test that covers both.
          (ua.account_id IS NULL) AS is_closed
        FROM
          account_registry ar
        LEFT JOIN
          user_accounts ua ON ua.account_id = ar.account_id
        WHERE
          ar.user_id = ${userIdPlaceholder}`;
}

/**
 * The same rows as a derived table, to be joined where `user_accounts` was.
 *
 * WHY BOTH SHAPES EXIST. A CTE has to be declared before the SELECT that uses
 * it, so moving a query onto it edits two places: the head of the statement and
 * the join. `dashboardController.js` holds nine such joins inside template
 * literals whose SELECT does not always start on its own line, and editing
 * eighteen points instead of nine is eighteen chances to break a query that
 * works. A derived table substitutes for the table name alone:
 *
 *   JOIN user_accounts ua ON tr.account_id = ua.account_id
 *   JOIN ${accountIdentitySource('$1')} ua ON tr.account_id = ua.account_id
 *
 * Every `ua.` in the rest of the query keeps working, including the
 * `ua.user_id` predicate, because the alias and the column set are the same.
 *
 * Same precondition as the CTE: a database without `account_registry` raises
 * `relation "account_registry" does not exist`. Production is at `030` and the
 * table arrives with `035`, so no caller may reach this before that file runs.
 *
 * @param {string} [userIdPlaceholder] - The bind placeholder holding the owner's id, e.g. '$1'
 * @returns {string} - A parenthesised subquery, to be followed by an alias
 */
export function accountIdentitySource(userIdPlaceholder = '$1') {
 return `(${accountIdentitySelect(userIdPlaceholder)}
      )`;
}

export function accountIdentityCte(userIdPlaceholder = '$1') {
 return `
      account_identity AS (${accountIdentitySelect(userIdPlaceholder)}
      )`;
}

export default accountIdentityCte;
