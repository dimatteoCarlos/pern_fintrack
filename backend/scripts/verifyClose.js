// backend/scripts/verifyClose.js
//
// Exercises CLOSE against a real database inside one transaction, and rolls it
// back. Nothing it writes survives the run.
//
//   node scripts/verifyClose.js
//   node scripts/verifyClose.js --account 42
//   node scripts/verifyClose.js --expect fintrack_dev
//
// IT REFUSES TO RUN AGAINST ANYTHING BUT A NAMED LOCAL DATABASE. The target is
// decided entirely by DATABASE_URI, and dbEnvironmentConfig.js gives
// `development` and `production` byte-identical bodies - both read that one
// variable - so this script cannot learn what it is connected to from the
// configuration. It asks the server instead, and stops unless all three
// answers hold: the database is the one named with --expect, the server is on
// a loopback address, and the connection is not encrypted. The three together
// are an allowlist; a name check alone is not, because a managed database can
// be called anything.
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
//  - it REVERSES that balance instead, when the caller asks for it: two ledger
//    legs against the compensation account, movement type 11, both carrying
//    reversal_of_account_id, written inside the close's own transaction so
//    "reversed but not closed" is not a reachable state.
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
// IT FABRICATES ITS OWN SUBJECT WHEN THE DATABASE HAS NONE. A closable
// account is one of the six closing types sitting at zero, and a working
// database usually has none: an account at zero is an account nobody uses. A
// probe that skips in that case reports nothing and looks like it passed, so
// this one creates a bank account at zero inside the transaction instead. It
// is thinner evidence - a fabricated account carries no transactions and no
// pocket allocations, so those two assertions hold trivially - and the run
// says so on the line that announces it. Pass --account <id> to close a real
// one.
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
const EXPECTED_DATABASE = readOption('--expect', 'fintrack_dev');
const REASON = 'verifyClose.js probe, rolled back';

const LOOPBACK = new Set(['127.0.0.1', '::1', '0.0.0.0']);

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

// Asked of the server, not of the configuration, and answered before a
// IT DOES NOT SHARE assertExpectedDatabase, THE MIGRATION INTERLOCK, and the
// difference is deliberate. That one classifies the destination by address too
// but leaves a door, DB_REMOTE_OK, because db:migrate legitimately has to
// reach production one day and a guard with no door gets deleted rather than
// satisfied. This probe has no such day: it exists to close an account and
// roll it back, which is never a thing to do anywhere but a local test
// database. So it keeps the third arm the interlock cannot take - it refuses
// an encrypted connection - and offers no way through. Do not unify them.
//
// transaction is opened. host() rather than a cast to text: the inet type
// carries its netmask, so the cast yields '::1/128' and no loopback literal
// would ever match it. A rolled-back probe is still a probe that wrote rows
// and took locks on whatever it reached; the place to stop is before that.
const assertLocalDatabase = async (target) => {
 const { rows } = await target.query(
  `SELECT current_database() AS db_name,
          COALESCE(host(inet_server_addr()), 'unix-socket') AS server_address,
          COALESCE(
            (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()),
            false
          ) AS encrypted`,
 );
 const { db_name, server_address, encrypted } = rows[0];

 const refusals = [];
 if (db_name !== EXPECTED_DATABASE) {
  refusals.push(`connected to "${db_name}", expected "${EXPECTED_DATABASE}"`);
 }
 if (server_address !== 'unix-socket' && !LOOPBACK.has(server_address)) {
  refusals.push(`the server is at ${server_address}, which is not local`);
 }
 if (encrypted) {
  refusals.push('the connection is encrypted, which a local server does not require');
 }

 if (refusals.length > 0) {
  throw new Error(
   `refusing to run: ${refusals.join('; ')}. Nothing was written.`,
  );
 }

 console.log(
  `Database: ${db_name} at ${server_address}, unencrypted. Proceeding.`,
 );
};

const client = await pool.connect();
let rolledBack = false;

try {
 await assertLocalDatabase(client);

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

 // The subject is fabricated only when the data has none. Its owner, its type
 // and its currency are all taken from rows that already exist, so no catalog
 // is invented and every foreign key is satisfied by something real.
 let fabricated = false;
 let subject = candidate;

 if (candidate.rows.length === 0 && !REQUESTED_ACCOUNT) {
  const seed = await client.query(
   `SELECT ua.user_id, ua.currency_id
      FROM user_accounts ua
     WHERE ua.deleted_at IS NULL
     ORDER BY ua.account_id
     LIMIT 1`,
  );
  const bankType = await client.query(
   `SELECT account_type_id FROM account_types WHERE account_type_name = 'bank'`,
  );

  if (seed.rows.length === 0 || bankType.rows.length === 0) {
   console.log(
    'This database has no account to take an owner and a currency from, or no',
   );
   console.log('bank account type, so nothing can be fabricated either.');
   await client.query('ROLLBACK');
   rolledBack = true;
   process.exitCode = 0;
  } else {
   const created = await client.query(
    `INSERT INTO user_accounts(
       user_id,
       account_name,
       account_type_id,
       currency_id,
       account_starting_amount,
       account_balance,
       account_start_date,
       updated_at
     ) VALUES ($1, $2, $3, $4, 0, 0, CURRENT_DATE, NOW())
     RETURNING account_id`,
    [
     seed.rows[0].user_id,
     'verifyClose.js probe account',
     bankType.rows[0].account_type_id,
     seed.rows[0].currency_id,
    ],
   );
   subject = await readAccount(client, created.rows[0].account_id);
   fabricated = true;
   console.log(
    'No account of a closing type sits at zero here, so one was fabricated',
   );
   console.log(
    'inside the transaction. It has no transactions and no pocket allocations,',
   );
   console.log('so those two assertions prove less than they would on real data.');
  }
 }

 if (subject.rows.length === 0) {
  console.log('No account to close. Nothing was written.');
  await client.query('ROLLBACK');
  rolledBack = true;
  process.exitCode = 0;
 } else {
  const target = subject.rows[0];
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
   processCloseAccount(client, userId, accountId, subject, new Date(), ''),
  );

  await expectRefusal(
   client,
   'a whitespace-only reason is refused',
   () =>
    processCloseAccount(client, userId, accountId, subject, new Date(), '   '),
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

  // ------------------------------------------------- reverse the balance
  //
  // ON ITS OWN FABRICATED, FUNDED ACCOUNT, ALWAYS, rather than on whatever the
  // database happens to hold. The refusal above skips when no nonzero account
  // of a closing type exists, and a skip on the operation's main new behaviour
  // would read as a pass. This one makes its subject, so it cannot skip.
  //
  // Inside its own savepoint: it closes an account for real, and the outer
  // transaction still has the main close to run.
  await client.query('SAVEPOINT reversal');
  try {
   const funded = await client.query(
    `INSERT INTO user_accounts(
       user_id, account_name, account_type_id, currency_id,
       account_starting_amount, account_balance, account_start_date, updated_at
     )
     SELECT $1, 'verifyClose.js reversal probe',
            (SELECT account_type_id FROM account_types
              WHERE account_type_name = 'bank'),
            $2, 0, 0, CURRENT_DATE, NOW()
     RETURNING account_id`,
    [userId, target.currency_id],
   );
   const fundedId = funded.rows[0].account_id;

   // One ordinary movement, so the account derives to a real balance rather
   // than to its starting amount. 137.50 and not a round number: a figure that
   // survives two decimal places is what catches an amount rounded in transit.
   await client.query(
    `INSERT INTO transactions(
       user_id, description, amount, movement_type_id, transaction_type_id,
       currency_id, account_id, status
     )
     SELECT $1, 'verifyClose.js reversal probe funding', 137.50,
            (SELECT movement_type_id FROM movement_types
              WHERE movement_type_name = 'income'),
            (SELECT MIN(transaction_type_id) FROM transaction_types),
            $2, $3, 'complete'`,
    [userId, target.currency_id, fundedId],
   );

   const fundedSubject = await readAccount(client, fundedId);
   const { rows: derivedRows } = await client.query(
    `SELECT ${DERIVED} AS balance
       FROM user_accounts ua WHERE ua.account_id = $1`,
    [fundedId],
   );
   const fundedBalance = Number(derivedRows[0].balance);

   check(
    'the probe account really holds a balance',
    fundedBalance === 137.5,
    `derived ${fundedBalance}`,
   );

   // The same account refuses without the flag. Proved on THIS account rather
   // than on whatever the database held, so the refusal and the reversal are
   // the same subject and the only difference between them is the flag.
   await expectRefusal(
    client,
    'the same account is refused without the reversal',
    () =>
     processCloseAccount(
      client,
      userId,
      fundedId,
      fundedSubject,
      new Date(),
      REASON,
     ),
   );

   await processCloseAccount(
    client,
    userId,
    fundedId,
    fundedSubject,
    new Date(),
    REASON,
    true,
   );

   const { rows: legs } = await client.query(
    `SELECT account_id, amount::float AS amount, movement_type_id
       FROM transactions
      WHERE reversal_of_account_id = $1
      ORDER BY account_id = $1 DESC`,
    [fundedId],
   );

   check(
    'the reversal writes exactly two legs',
    legs.length === 2,
    `${legs.length} row(s)`,
   );

   check(
    'both legs carry the reversal movement type',
    legs.length === 2 && legs.every((leg) => leg.movement_type_id === 11),
    legs.map((leg) => leg.movement_type_id).join(', '),
   );

   check(
    "the target's leg negates its balance",
    legs.length === 2 && legs[0].account_id === fundedId &&
     legs[0].amount === -fundedBalance,
    legs.length === 2 ? `${legs[0].amount} against ${fundedBalance}` : '',
   );

   check(
    'the two legs sum to zero',
    legs.length === 2 && legs[0].amount + legs[1].amount === 0,
    legs.map((leg) => leg.amount).join(' + '),
   );

   // The counterpart is the compensation account, identified by its type rather
   // than by its name: a user account named 'slack' would match a name test.
   if (legs.length === 2) {
    const { rows: counterpart } = await client.query(
     `SELECT act.account_type_name
        FROM user_accounts ua
        JOIN account_types act ON act.account_type_id = ua.account_type_id
       WHERE ua.account_id = $1`,
     [legs[1].account_id],
    );
    check(
     'the counterpart leg sits on a boundary account',
     counterpart.length === 1 &&
      String(counterpart[0].account_type_name).toLowerCase() === 'boundary',
     counterpart.length === 1 ? counterpart[0].account_type_name : 'no row',
    );
   }

   const gone = await client.query(
    'SELECT 1 FROM user_accounts WHERE account_id = $1',
    [fundedId],
   );
   check(
    'the reversed account is closed in the same transaction',
    gone.rows.length === 0,
    `${gone.rows.length} row(s) left`,
   );

   // THE DATABASE'S OWN HALF, and it is the reason the pairing is a CHECK
   // rather than a convention. A row of the reversal type without the column
   // must be rejected by the database, not by whoever wrote the insert.
   await expectRefusal(
    client,
    'a reversal row without its account is refused by the database',
    () =>
     client.query(
      `INSERT INTO transactions(
         user_id, description, amount, movement_type_id, transaction_type_id,
         currency_id, account_id, status
       )
       SELECT $1, 'verifyClose.js constraint probe', 1.00, 11,
              (SELECT MIN(transaction_type_id) FROM transaction_types),
              $2, $3, 'complete'`,
      [userId, target.currency_id, accountId],
     ),
   );
  } finally {
   await client.query('ROLLBACK TO SAVEPOINT reversal');
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
   subject,
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

  // What the rollback has to restore depends on what was there before it. A
  // real account has to come back open on both columns; a fabricated one was
  // created inside the same transaction and has to be gone, along with the
  // registry row its trigger wrote.
  const restored = await client.query(
   'SELECT deleted_at, closed_at FROM user_accounts WHERE account_id = $1',
   [accountId],
  );
  const registryAfterRollback = await client.query(
   'SELECT 1 FROM account_registry WHERE account_id = $1',
   [accountId],
  );

  if (fabricated) {
   check(
    'the fabricated account left nothing behind in user_accounts',
    restored.rows.length === 0,
    `${restored.rows.length} row(s)`,
   );
   check(
    'the fabricated account left nothing behind in account_registry',
    registryAfterRollback.rows.length === 0,
    `${registryAfterRollback.rows.length} row(s)`,
   );
  } else {
   check(
    'the account this probe closed is back, open on both columns',
    restored.rows.length === 1 &&
     restored.rows[0].deleted_at === null &&
     restored.rows[0].closed_at === null,
    `${restored.rows.length} row(s)`,
   );
  }

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
