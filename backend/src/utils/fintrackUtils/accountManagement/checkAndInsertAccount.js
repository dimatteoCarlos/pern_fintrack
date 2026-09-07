//backend/utils/checkAndInsertAccount.js
import pc from 'picocolors';
import { createError, handlePostgresError } from '../../errorHandling.js';
import { pool } from '../../../db/config/configDB.js';

//Checks for the existence of a specific account (e.g., 'slack') by name and type.this check is restricted to bank account types with basic account data.
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
  // 031_add_boundary_account_type.sql. 'bank' stays in the match list because a
  // database whose chain has not reached 031 still holds the old type, and
  // missing it there would create a duplicate with a zero balance instead of
  // finding the account. A caller that passes an explicit type keeps exact
  // matching - this function is shared for other account types too.
  const matchTypes = accountType ? [accountType] : ['bank', 'boundary'];
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
    // that side only ever compares against the fixed literals 'bank' and
    // 'boundary' passed in by this file, never user input.
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
      //-------------------------------------
      const insertResult = await dbClient.query(
        'INSERT INTO user_accounts (user_id,account_name,account_type_id,currency_id,account_starting_amount,account_balance,account_start_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [
          userId,
          accountName,
          accountTypeId, //1, //bank
          1, //usd // Assuming 1 for usd/Default currency, adjust if dynamic currency is needed.
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
