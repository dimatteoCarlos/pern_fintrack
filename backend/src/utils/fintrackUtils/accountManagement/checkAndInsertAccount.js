//backend/utils/checkAndInsertAccount.js
import pc from 'picocolors';
import { createError, handlePostgresError } from '../../errorHandling.js';
import { pool } from '../../../db/config/configDB.js';
import { getCurrencyId } from '../../currencyLookup.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../../fintrack_api/config/fintrackConfig.js';

//Checks for the existence of a specific account (e.g., 'slack') by name and type.
//If not found, it inserts it. Handles both transactional client and standalone pool usage.

export const checkAndInsertAccount = async (
  clientOrPool,
  userId,
  accountName = 'slack',
  accountType,
) => {
  //0 initial validation
  if (!userId) throw new Error('User ID is required');
  if (!accountName) throw new Error('Account name is required');

  // When the caller omits accountType, this call identifies the boundary
  // account: the system's compensation counterpart, typed 'boundary' by
  // 031_add_boundary_account_type.sql, which retyped the existing ones in the
  // same transaction. One identity, one type: matching 'bank' as well would
  // accept a user's own bank account named 'slack' as the compensation
  // counterpart, which is the collision this rule exists to prevent. A caller
  // passing an explicit type keeps exact matching - shared for other types too.
  const matchTypes = accountType ? [accountType] : ['boundary'];
  const insertAccountType = accountType || 'boundary';

  // 1. Determine the database client connection:
  const isPool = clientOrPool === pool;
  // 🔑 Optimized check: If the object has a 'connect' method, assume it's the pool.
  // const isPool = typeof clientOrPool.connect === 'function';
  const dbClient = isPool ? await clientOrPool.connect() : clientOrPool;
  const clientAcquired = isPool;

  try {
    // 2. Check existence by User, Account Name, AND Account Type
    // account_name matched exact-case: every caller passes the literal
    // 'slack' (never a variable), and the 26+ read filters that exclude the
    // boundary account from every aggregate compare account_name to 'slack'
    // case-sensitively (031_add_boundary_account_type.sql). A LOWER() match
    // here used to hand back a case-variant like 'Slack' as the compensation
    // account while every read filter counted it as the owner's own -
    // migration 031 measured no such row on fintrack_dev today, but nothing
    // stopped one from being created. account_type_name still folds case:
    // that side only ever compares against the fixed literal 'boundary' or a
    // type name a caller passes, never raw user input.
    // This exact-case match shipped in 031's own commit, which invalidates
    // two passages of that migration's prose from the moment it landed. Its
    // header disclaims this fix as "not this file's to fix", which is wrong
    // outright. Its NOTICE still fires correctly on a case-variant row and
    // still reports two true things - such rows are left untouched, and the
    // read filters do not exclude them - but the reason it states, that this
    // function matches case-insensitively and would return one as the
    // compensation account, and the "reconcile by hand" that follows from
    // it, both died here. An applied migration's text cannot be edited, so
    // the correction lives here rather than there.
    // ORDER BY + LIMIT: a user account named exactly 'slack' is possible too
    // (nothing today reserves the name at creation) and would otherwise match
    // this same query. Oldest account_id wins - the compensation account is
    // always created by this function itself, the first time it's needed, so
    // it predates any later colliding account. Not a full fix: preventing the
    // collision belongs to account creation, out of this module's scope.
    const chekAccountResult = await dbClient.query(
      `SELECT ua.* FROM user_accounts ua
     JOIN account_types act ON ua.account_type_id = act.account_type_id
     WHERE ua.user_id =$1
      AND ua.account_name = $2
      AND LOWER(act.account_type_name) = ANY($3)
      -- Not swept. This is find-or-create, so a row this query fails to see
      -- is not excluded, it is duplicated - and a second row named 'slack'
      -- walks straight into the ORDER BY + LIMIT collision described above.
      AND ua.deleted_at IS NULL
     ORDER BY ua.account_id ASC
     LIMIT 1;
      `,
      [userId, accountName, matchTypes.map((type) => type.toLowerCase())],
    );

    if (chekAccountResult.rows.length > 0) {
      const accountId = chekAccountResult.rows[0].account_id;
      console.log(
        pc.green(
          `checkAndInserAccount: ${accountName} account already exists with id ${accountId}`,
        ),
      );
      return { exists: true, account: chekAccountResult.rows[0] };
    } else {
      // 3. Account Not Found, Proceed to Insert
      //--------------------------
      //Get account_type_id dynamically
      const accountTypeResult = await dbClient.query(
        'SELECT account_type_id FROM account_types WHERE LOWER(account_type_name) = LOWER($1)',
        [insertAccountType],
      );

      if (accountTypeResult.rows.length === 0) {
        throw new Error(`Account type '${insertAccountType}' not found`);
      }

      const accountTypeId = accountTypeResult.rows[0].account_type_id;
      // Resolved from the configured accounting currency, not a literal:
      // every other creation path stores the accounting currency, so a
      // hardcoded id makes this the only account in another one whenever
      // ACCOUNTING_CURRENCY_CODE is set to anything but its usd default.
      const accountingCurrencyId = await getCurrencyId(
        dbClient,
        ACCOUNTING_CURRENCY_CODE,
      );
      //-------------------------------------
      const insertResult = await dbClient.query(
        'INSERT INTO user_accounts (user_id,account_name,account_type_id,currency_id,account_starting_amount,account_balance,account_start_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [
          userId,
          accountName,
          accountTypeId,
          accountingCurrencyId,
          0, // starting_amount
          0, //balance
          new Date(),
        ],
      );
      const newAccountId = insertResult.rows[0].account_id;
      console.log('insertResult', insertResult.rows);

      console.log(
        pc.green(
          `${accountName} account created successfully with ID: ${newAccountId}`,
        ),
      );
      return { exists: false, account: insertResult.rows[0] };
    }
  } catch (error) {
    const messageError = `Error in checkAndInsertAccount: when processing counter account ${accountName}`;

    console.error(messageError, error);
    const { code, message } = handlePostgresError(error);

    if (code && code !== 500) {
      throw createError(code, message);
    }

    throw createError(500, messageError);
  } finally {
    // Release the client ONLY IF it was acquired by this function (it was the pool)
    if (clientAcquired && dbClient && typeof dbClient.release === 'function') {
      dbClient.release();
    }
  }
};
//-----------------------------------
