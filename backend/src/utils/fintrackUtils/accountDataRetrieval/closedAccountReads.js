// closedAccountReads.js
// The switch that decides whether a read sees accounts that have been closed.

import { accountIdentitySource } from './accountIdentity.js';

/**
 * WHAT WAS WRONG, AND WHAT IS LEFT OF IT. CLOSE used to delete the row from
 * `user_accounts` while keeping the account's history: `transactions.account_id`
 * still holds the closed account's id, because the close writes nothing to
 * `transactions` at all. Every read that reaches a movement through
 * `JOIN user_accounts ua ON tr.account_id = ua.account_id` therefore lost that
 * movement, not just the account. Nine such joins live in
 * `dashboardController.js` and they are what this flag governs.
 *
 * THE CLOSE NO LONGER DELETES THE ROW. It stamps `closed_at` and `deleted_at`
 * and leaves it in place, so those nine joins reach a closed account's movements
 * with the flag off. What the substitute source still adds is the OTHER
 * population, which no storage change removes: an account erased by the deletion
 * tail, whose `user_accounts` row is deleted for real
 * (`eraseAccountTail.js:124-130`), leaving only its `account_registry` row.
 *
 * WHY IT IS A FLAG AND NOT A FIX. The replacement source reads
 * `account_registry`, which arrives with migration
 * `035_create_account_registry.sql`. Switching the nine joins unconditionally
 * would have raised `relation "account_registry" does not exist` on every
 * dashboard request in a production still behind that file, and deployment does
 * not carry the schema - the two travel separately. Production is at `038`
 * since 2026-09-18, so the precondition holds there now.
 *
 * WHAT THE TWO SETTINGS NOW DIFFER BY. While the close deleted the row, off and
 * on differed by every closed account; that was the whole point of the flag and
 * the reason the header said off was the current behaviour exactly. They now
 * differ only by the erased accounts. The flag has been on since 2026-09-13.
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
 * CLOSE used to delete the extension row along with the account, so under the
 * flag an INNER join here would put back exactly the exclusion the flag removes
 * - the account would be found and then dropped again for having no extension
 * row. The close keeps that row now, so a CLOSED account no longer needs the
 * widening.
 *
 * IT STAYS LEFT FOR THE ERASED ACCOUNT. That one has no `user_accounts` row and
 * no extension row either, and the substitute source still yields it from
 * `account_registry`. An INNER join would drop it again, which is the same
 * defect on a smaller population.
 *
 * WHAT THE CALLER MUST HANDLE. Every column read from the extension table is
 * NULL for an erased account: it has no `target` and no `desired_date` anywhere.
 * That is the correct answer - the row those columns lived in was destroyed -
 * and it is a shape the consumer did not previously receive. A closed account
 * answers with its real values.
 *
 * @returns {string} - `JOIN` or `LEFT JOIN`
 */
export const ACCOUNT_EXTENSION_JOIN = INCLUDE_CLOSED_ACCOUNTS ? 'LEFT JOIN' : 'JOIN';
