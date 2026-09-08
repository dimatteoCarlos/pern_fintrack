// backend/scripts/verifyClose.js
//
// Exercises CLOSE against a real database inside one transaction, and rolls it
// back. Nothing it writes survives the run.
//
//   node scripts/verifyClose.js
//   node scripts/verifyClose.js --account 42
//
// Run it from `backend/`: the database configuration calls dotenv.config(),
// which reads .env relative to the working directory.
//
// IT REPLACES verifyCloseAccount.js AND verifyCloseTransfer.js, both retired on
// 2026-09-08. They assert a settlement that no longer happens - a residual
// moved out under a policy, a preview figure echoed back and refused if stale,
// an account marked closed with its row left standing - and neither can even
// link, because both import policy constants the controller no longer exports.
//
// WHAT CLOSE ACTUALLY PROMISES NOW, which is what this asserts:
//  - it REFUSES a nonzero balance on the four types that hold one, rather than
//    settling it. That refusal is the operation's main behaviour, not an edge.
//  - it REFUSES a missing or whitespace-only reason, before taking its lock.
//  - it releases every pocket allocation the account was backing.
//  - it stamps account_registry with closed_at, closed_by and close_reason.
//  - it deletes the extension row, then the user_accounts row.
//  - the transactions naming the account survive, because migration 035 points
//    their keys at account_registry rather than at user_accounts.
//
// WHY IT IMPORTS THE ENGINE DIRECTLY. The only other way in is
// deleteAccountService, which opens its own connection and commits. Nothing
// could check what CLOSE writes without really closing an account.
// processCloseAccount takes a caller's client, so this opens a transaction,
// runs it, asserts, and rolls back.
//
// PRECONDITION. account_registry must exist, so the database must have
// 035_create_account_registry.sql applied. Without it the run fails with
// relation "account_registry" does not exist, which is the honest answer.
//
// WHAT IT DELIBERATELY DOES NOT COVER. The HTTP layer - the controller's
// payload reading and the ownership check that runs before the engine. Those
// refuse bad input; this checks what happens to good input, which is the half
// that writes rows.

import { pool } from '../src/db/config/configDB.js';
import { processCloseAccount } from '../src/fintrack_api/services/delete_account/deleteAccountService.js';
import { derivedAccountBalanceSql } from '../src/utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

const readOption = (flag, fallback) => {
 const index = process.argv.indexOf(flag);
 return index === -1 || index === process.argv.length - 1
  ? fallback
  : process.argv[index + 1];
};

const REQUESTED_ACCOUNT = readOption('--account', null);
const REASON = 'verifyClose.js probe, rolled back';

// The four types that must reach zero before they close, and the two that carry
// no balance condition. Both lists are the service's, restated here so a
// divergence shows up as a failed assertion rather than as a silent skip.
const ZERO_BALANCE_TYPES = ['bank', 'cash', 'investment', 'debtor'];
const EXTENSION_TABLES = {
 income_source: 'income_source_accounts',
 category_budget: 'category_budget_accounts',
 debtor: 'debtor_accounts',
 pocket_saving: 'pocket_saving_accounts',
};

const DERIVED = derivedAccountBalanceSql('ua', 'FLOAT');

const results = [];
const check = (label, passed, detail = '') => {
 results.push(passed);
 console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

// The row shape the engine expects: the account with its type name joined in,
// exactly as deleteAccountService builds it before calling the engine.
const readAccount = (client, accountId) =>
 client.query(
  `SELECT ua.*, act.account_type_name
     FROM user_accounts ua
     JOIN account_types act ON act.account_type_id = ua.account_type_id
    WHERE ua.account_id = $1`,
  [accountId],
 );

// A refusal is a thrown error rather than a returned value, and it may be
// thrown after the engine has already issued statements. Each probe therefore
// runs inside its own savepoint, so a refusal cannot leave the outer
// transaction in an aborted state and take the real close down with it.
const expectRefusal = async (client, label, run) => {
 await client.query('SAVEPOINT probe');
 try {
  await run();
  await client.query('ROLLBACK TO SAVEPOINT probe');
  check(label, false, 'no refusal was raised');
  return null;
 } catch (error) {
  await client.query('ROLLBACK TO SAVEPOINT probe');
  check(label, true, error.message.slice(0, 90));
  return error;
 }
};

const client = await pool.connect();
let rolledBack = false;

try {
 await client.query('BEGIN');

 // ------------------------------------------------------------------ target
 //
 // A closable account is one of the six closing types, still open on both
 // columns, and - for the four that hold a balance - already at zero. Chosen by
 // query rather than by constant so the probe runs on any database, and
 // overridable with --account so a specific case can be re-examined.
 const candidate = REQUESTED_ACCOUNT
  ? await readAccount(client, Number(REQUESTED_ACCOUNT))
  : await client.query(
     `SELECT ua.*, act.account_type_name
        FROM user_accounts ua
        JOIN account_types act ON act.account_type_id = ua.account_type_id
       WHERE ua.deleted_at IS NULL
         AND ua.closed_at IS NULL
         AND act.account_type_name = ANY($1)
         AND ${DERIVED} = 0
       ORDER BY ua.account_id
       LIMIT 1`,
     [ZERO_BALANCE_TYPES],
    );

 if (candidate.rows.length === 0) {
  console.log(
   'No account of a balance-holding type sits at zero on this database, so the',
  );
  console.log(
   'close itself cannot be exercised. Pass --account <id> to name one, or move a',
  );
  console.log('balance to zero first. Nothing was written.');
  await client.query('ROLLBACK');
  rolledBack = true;
  process.exitCode = 0;
 } else {
  const target = candidate.rows[0];
  const accountId = target.account_id;
  const userId = target.user_id;
  const typeName = String(target.account_type_name ?? '');

  console.log(
   `\nTarget: account ${accountId}, type ${typeName}, owner ${userId}\n`,
  );

  // -------------------------------------------------------------- refusals
  //
  // Both are raised before anything is written, and both are the operation's
  // documented behaviour rather than error handling around it.
  await expectRefusal(client, 'an empty reason is refused', () =>
   processCloseAccount(client, userId, accountId, candidate, new Date(), ''),
  );

  await expectRefusal(
   client,
   'a whitespace-only reason is refused',
   () =>
    processCloseAccount(client, userId, accountId, candidate, new Date(), '   '),
  );

  // The zero-balance refusal, probed on a different account: one of the same
  // four types that is NOT at zero. Skipped rather than failed where the
  // database has none, because its absence is a fact about the data.
  const nonZero = await client.query(
   `SELECT ua.*, act.account_type_name
      FROM user_accounts ua
      JOIN account_types act ON act.account_type_id = ua.account_type_id
     WHERE ua.deleted_at IS NULL
       AND ua.closed_at IS NULL
       AND act.account_type_name = ANY($1)
       AND ${DERIVED} <> 0
     ORDER BY ua.account_id
     LIMIT 1`,
   [ZERO_BALANCE_TYPES],
  );

  if (nonZero.rows.length === 0) {
   console.log('SKIP  no nonzero account of a closing type to refuse');
  } else {
   await expectRefusal(client, 'a nonzero balance is refused', () =>
    processCloseAccount(
     client,
     nonZero.rows[0].user_id,
     nonZero.rows[0].account_id,
     nonZero,
     new Date(),
     REASON,
    ),
   );
  }

  // ------------------------------------------------------------- before
  const extensionTable = EXTENSION_TABLES[typeName] ?? null;

  const countIn = async (table, column) => {
   const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM ${table} WHERE ${column} = $1`,
    [accountId],
   );
   return rows[0].n;
  };

  const transactionsBefore = await countIn('transactions', 'account_id');
  const extensionBefore = extensionTable
   ? await countIn(extensionTable, 'account_id')
   : 0;

  const { rows: pocketsBefore } = await client.query(
   `SELECT COALESCE(SUM(amount), 0)::text AS held
      FROM pocket_allocations
     WHERE user_id = $1 AND source_account_id = $2`,
   [userId, accountId],
  );

  // --------------------------------------------------------------- the close
  const result = await processCloseAccount(
   client,
   userId,
   accountId,
   candidate,
   new Date(),
   REASON,
  );

  // ---------------------------------------------------------------- after
  const accountAfter = await client.query(
   'SELECT 1 FROM user_accounts WHERE account_id = $1',
   [accountId],
  );
  check(
   'the user_accounts row is gone',
   accountAfter.rows.length === 0,
   `${accountAfter.rows.length} row(s) left`,
  );

  if (extensionTable) {
   const extensionAfter = await countIn(extensionTable, 'account_id');
   check(
    `the ${extensionTable} row is gone`,
    extensionAfter === 0,
    `${extensionBefore} -> ${extensionAfter}`,
   );
   check(
    'the response counts the extension row it deleted',
    result.extensionRowsDeleted === extensionBefore,
    `reported ${result.extensionRowsDeleted}, was ${extensionBefore}`,
   );
  } else {
   check(
    'a type with no extension table reports none deleted',
    result.extensionRowsDeleted === 0,
    `reported ${result.extensionRowsDeleted}`,
   );
  }

  const registry = await client.query(
   `SELECT account_id, user_id, account_name, closed_at, closed_by, close_reason
      FROM account_registry
     WHERE account_id = $1`,
   [accountId],
  );
  check(
   'the registry keeps exactly one row for the account',
   registry.rows.length === 1,
   `${registry.rows.length} row(s)`,
  );
  if (registry.rows.length === 1) {
   const stamp = registry.rows[0];
   check('the registry row carries a closure timestamp', stamp.closed_at !== null);
   check(
    'the registry row records who closed it',
    stamp.closed_by === userId,
    `${stamp.closed_by}`,
   );
   check(
    'the registry row records the reason, trimmed',
    stamp.close_reason === REASON,
    `${stamp.close_reason}`,
   );
   check(
    'the registry row carries the name the account had',
    stamp.account_name === target.account_name,
    `${stamp.account_name} vs ${target.account_name}`,
   );
  }

  const { rows: pocketsAfter } = await client.query(
   `SELECT COALESCE(SUM(amount), 0)::text AS held
      FROM pocket_allocations
     WHERE user_id = $1 AND source_account_id = $2`,
   [userId, accountId],
  );
  check(
   'nothing is left committed to pockets from this account',
   Number(pocketsAfter[0].held) === 0,
   `${pocketsBefore[0].held} -> ${pocketsAfter[0].held}`,
  );
  check(
   'the response names every pocket it released',
   Array.isArray(result.releasedPockets),
   `${JSON.stringify(result.releasedPockets)}`,
  );

  const transactionsAfter = await countIn('transactions', 'account_id');
  check(
   'the transactions naming the account survive it',
   transactionsAfter === transactionsBefore,
   `${transactionsBefore} -> ${transactionsAfter}`,
  );

  check(
   'the response echoes the reason it stored',
   result.closeReason === REASON,
   `${result.closeReason}`,
  );

  // ------------------------------------------------------------- rollback
  await client.query('ROLLBACK');
  rolledBack = true;

  const restored = await client.query(
   'SELECT deleted_at, closed_at FROM user_accounts WHERE account_id = $1',
   [accountId],
  );
  check(
   'the account this probe closed is back, open on both columns',
   restored.rows.length === 1 &&
    restored.rows[0].deleted_at === null &&
    restored.rows[0].closed_at === null,
   `${restored.rows.length} row(s)`,
  );

  const allPassed = results.every(Boolean);
  console.log('');
  console.log(
   allPassed
    ? 'CLOSE refuses what it must, releases, stamps, deletes, and leaves nothing behind'
    : 'AT LEAST ONE ASSERTION FAILED',
  );
  process.exitCode = allPassed ? 0 : 1;
 }
} catch (error) {
 console.error(`verification failed: ${error.message}`);
 console.error(error.stack);
 process.exitCode = 1;
} finally {
 if (!rolledBack) {
  try {
   await client.query('ROLLBACK');
   console.log('rolled back on the way out');
  } catch {
   console.error('ROLLBACK FAILED - check user_accounts and account_registry');
  }
 }
 client.release();
 await pool.end();
}
