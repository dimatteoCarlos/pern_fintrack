// closedAccountReads.js
// The switch that decides whether a read sees accounts that have been closed.

import { accountIdentitySource } from './accountIdentity.js';

/**
 * WHAT IS WRONG TODAY. CLOSE deletes the row from `user_accounts`
 * (`deleteAccountService.js`, `DELETE FROM user_accounts`) and keeps the
 * account's history: `transactions.account_id` still holds the closed account's
 * id, because the close writes nothing to `transactions` at all. Every read
 * that reaches a movement through `JOIN user_accounts ua ON tr.account_id =
 * ua.account_id` therefore loses that movement, not just the account. Nine such
 * joins live in `dashboardController.js` and they are what this flag governs.
 *
 * WHY IT IS A FLAG AND NOT A FIX. The replacement source reads
 * `account_registry`, and that table arrives with migration
 * `035_create_account_registry.sql`. Production is at `030`. Switching the nine
 * joins unconditionally would raise `relation "account_registry" does not
 * exist` on every dashboard request in production the moment the code deployed,
 * and deployment does not carry the schema - the two travel separately. So the
 * new source is written now, off, and the flip is a step after that file runs.
 *
 * OFF IS THE CURRENT BEHAVIOUR, EXACTLY. When this reads false every query
 * renders the identical string it renders today, which is what makes the flag
 * safe to ship before the schema is there.
 *
 * HOW IT IS TURNED ON. `INCLUDE_CLOSED_ACCOUNTS=true` in the backend's
 * environment, and only on a database whose migration chain has reached `035`.
 * Anything else is a loud failure on the first dashboard request, not a silent
 * one, because the missing relation is a query error rather than an empty
 * result.
 */
export const INCLUDE_CLOSED_ACCOUNTS =
 String(process.env.INCLUDE_CLOSED_ACCOUNTS ?? '').toLowerCase() === 'true';

/**
 * What a read joins to reach an account: the live table, or live and closed.
 *
 * Substitutes for the table NAME, so the caller's alias and every `ua.`
 * reference after it stay exactly as they are - including a `ua.user_id`
 * predicate, which is why `accountIdentitySource` selects that column.
 *
 * @param {string} [userIdPlaceholder] - The bind placeholder holding the owner's id, e.g. '$1'
 * @returns {string} - `user_accounts`, or a parenthesised subquery
 */
export const accountReadSource = (userIdPlaceholder = '$1') =>
 INCLUDE_CLOSED_ACCOUNTS ? accountIdentitySource(userIdPlaceholder) : 'user_accounts';

/**
 * How a read joins an account's extension table: `pocket_saving_accounts`,
 * `debtor_accounts` and their siblings.
 *
 * CLOSE deletes the extension row along with the account, so under the flag an
 * INNER join here would put back exactly the exclusion the flag removes - the
 * account would be found and then dropped again for having no extension row.
 * The join has to widen with the source or the source widens for nothing.
 *
 * WHAT THE CALLER MUST HANDLE. Every column read from the extension table is
 * NULL for a closed account: a closed pocket has no `target` and no
 * `desired_date`. That is the correct answer - the plan those columns describe
 * ended with the account - and it is a shape the consumer did not previously
 * receive.
 *
 * @returns {string} - `JOIN` or `LEFT JOIN`
 */
export const ACCOUNT_EXTENSION_JOIN = INCLUDE_CLOSED_ACCOUNTS ? 'LEFT JOIN' : 'JOIN';
