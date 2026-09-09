// backend/scripts/verifyBootGuards.js
//
// WHAT THIS EXISTS TO COVER, AND WHY NOTHING ELSE COVERS IT.
// ensureBalanceReversal() in createTables.js:1268 is the boot-path counterpart
// of migration 037. It carries two refusals that only ever fire on a
// PREEXISTING database:
//
//  - movement_types absent: it returns before touching either catalog.
//  - account_registry absent: it skips transactions.reversal_of_account_id and
//    the pairing constraint entirely, rather than pointing the key at some
//    other table so that the column can exist.
//
// db:parity cannot reach either one. It builds both databases from zero, so it
// proves a virgin boot matches a virgin chain and says nothing about a
// database that already has rows and a partial schema - which is the only
// situation these two branches are written for. This script makes that
// situation instead of waiting for it: it removes the table inside a savepoint,
// runs the function against the result, and rolls back.
//
// IT ALSO REFUSES TO PROVE NOTHING. Every probe asserts its own precondition
// first - that the intact database really does carry the column, the
// constraint and the two catalog rows. On a database where 037 never applied,
// dropping a table and finding nothing afterwards would pass while measuring
// nothing at all, so the preconditions fail loudly instead.
//
// WHAT IT DELIBERATELY DOES NOT COVER. Whether the chain and the boot path
// agree on the finished schema - that is db:parity's question and it answers
// it well. This one is only about the two branches parity cannot enter.

import pc from 'picocolors';
import { pool } from '../src/db/config/configDB.js';
import { ensureBalanceReversal } from '../src/db/run_time_db_init/createTables.js';

const readOption = (flag, fallback) => {
 const index = process.argv.indexOf(flag);
 return index === -1 || index === process.argv.length - 1
  ? fallback
  : process.argv[index + 1];
};

const EXPECTED_DATABASE = readOption('--expect', 'fintrack_dev');
const LOOPBACK = new Set(['127.0.0.1', '::1', '0.0.0.0']);

const results = [];

const check = (label, passed, detail = '') => {
 results.push(passed);
 console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

// Copied from verifyClose.js rather than shared, and the duplication is the
// point: this script DROPS TABLES. A guard that stops it reaching anything but
// a local test database has to be readable in the file that does the dropping,
// not one import away in a module someone could later relax for another
// caller. It refuses an encrypted connection and offers no override.
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

const columnCount = async (client) => {
 const { rows } = await client.query(
  `SELECT count(*)::int AS n
     FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'reversal_of_account_id'`,
 );
 return rows[0].n;
};

const constraintCount = async (client, conname) => {
 const { rows } = await client.query(
  `SELECT count(*)::int AS n
     FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public' AND con.conname = $1`,
  [conname],
 );
 return rows[0].n;
};

// The parent the foreign key actually points at, read from the catalog rather
// than assumed from the DDL. This is the question the second guard exists to
// answer: a key on a different parent would still be a valid key.
const foreignKeyParent = async (client) => {
 const { rows } = await client.query(
  `SELECT parent.relname AS parent_table
     FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_class parent ON parent.oid = con.confrelid
     JOIN pg_attribute att
       ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE rel.relname = 'transactions'
      AND con.contype = 'f'
      AND att.attname = 'reversal_of_account_id'`,
 );
 return rows.length === 1 ? rows[0].parent_table : null;
};

const catalogRowCount = async (client, table, column, value) => {
 const { rows } = await client.query(
  `SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`,
  [value],
 );
 return rows[0].n;
};

const client = await pool.connect();
let rolledBack = false;

try {
 await assertLocalDatabase(client);
 await client.query('BEGIN');

 // ------------------------------------------------------- preconditions
 //
 // Asserted rather than assumed. Every probe below measures an ABSENCE after
 // removing something, and an absence proves nothing unless the thing was
 // there first.
 check(
  'the column exists before anything is removed',
  (await columnCount(client)) === 1,
 );
 check(
  'the pairing constraint exists before anything is removed',
  (await constraintCount(client, 'transactions_reversal_pairing_check')) === 1,
 );
 check(
  'the key points at account_registry to begin with',
  (await foreignKeyParent(client)) === 'account_registry',
  (await foreignKeyParent(client)) ?? 'no foreign key',
 );
 check(
  'movement type 11 is seeded',
  (await catalogRowCount(client, 'movement_types', 'movement_type_id', 11)) === 1,
 );
 check(
  'transaction type 7 is seeded',
  (await catalogRowCount(client, 'transaction_types', 'transaction_type_id', 7)) === 1,
 );

 // ------------------------------------------------- the intact database
 //
 // The function runs at every boot, so running it on a database that already
 // has everything is by far its most common case. It must change nothing.
 console.log('');
 console.log(pc.cyan('-- on the intact database'));
 await ensureBalanceReversal(client);
 check(
  'a second run leaves the column alone',
  (await columnCount(client)) === 1,
 );
 check(
  'a second run leaves the pairing constraint alone',
  (await constraintCount(client, 'transactions_reversal_pairing_check')) === 1,
 );
 check(
  'a second run does not duplicate the catalog rows',
  (await catalogRowCount(client, 'movement_types', 'movement_type_id', 11)) === 1 &&
   (await catalogRowCount(client, 'transaction_types', 'transaction_type_id', 7)) === 1,
 );

 // ------------------------------------------ account_registry is absent
 //
 // THE SUBJECT IS MADE, NOT LOOKED FOR. The column has to go with the table:
 // ADD COLUMN IF NOT EXISTS over a column that already exists is a no-op, so
 // leaving it in place would let the guard pass without ever being reached.
 console.log('');
 console.log(pc.cyan('-- with account_registry absent'));
 await client.query('SAVEPOINT no_registry');
 try {
  await client.query('ALTER TABLE transactions DROP COLUMN reversal_of_account_id');
  await client.query('DROP TABLE account_registry CASCADE');

  await ensureBalanceReversal(client);

  check(
   'the column is not created without its parent',
   (await columnCount(client)) === 0,
   `${await columnCount(client)} column(s)`,
  );
  check(
   'the pairing constraint is not created either',
   (await constraintCount(client, 'transactions_reversal_pairing_check')) === 0,
  );
  // The failure this guard exists to prevent: a key that exists and points
  // somewhere else. user_accounts has the same column name and would accept
  // the reference, and the rows it holds are the ones that get deleted.
  check(
   'the key is not repointed at another table',
   (await foreignKeyParent(client)) === null,
   (await foreignKeyParent(client)) ?? 'no foreign key, as required',
  );
  check(
   'the catalog rows still survive the skipped column',
   (await catalogRowCount(client, 'movement_types', 'movement_type_id', 11)) === 1,
  );
 } finally {
  await client.query('ROLLBACK TO SAVEPOINT no_registry');
 }

 // -------------------------------------------- movement_types is absent
 //
 // The early return is measured by its EFFECT, not by the absence of an error.
 // Transaction type 7 is deleted first: if the function ran past the return it
 // would insert both catalog rows, so finding 7 still missing is what proves
 // it stopped before either insert.
 console.log('');
 console.log(pc.cyan('-- with movement_types absent'));
 await client.query('SAVEPOINT no_catalog');
 try {
  await client.query('DELETE FROM transaction_types WHERE transaction_type_id = 7');
  await client.query('DROP TABLE movement_types CASCADE');

  await ensureBalanceReversal(client);

  // No assertion on "it did not throw": a throw aborts this script and reports
  // a failure by itself, so a check that can only pass would be decoration.
  check(
   'it returns before seeding the transaction type',
   (await catalogRowCount(client, 'transaction_types', 'transaction_type_id', 7)) === 0,
   'transaction type 7 was not re-inserted',
  );
 } finally {
  await client.query('ROLLBACK TO SAVEPOINT no_catalog');
 }

 // ------------------------------------------------------ nothing is kept
 await client.query('ROLLBACK');
 rolledBack = true;

 check(
  'the column survived the whole probe',
  (await columnCount(client)) === 1,
 );
 check(
  'transaction type 7 survived the whole probe',
  (await catalogRowCount(client, 'transaction_types', 'transaction_type_id', 7)) === 1,
 );

 const allPassed = results.every(Boolean);
 console.log('');
 console.log(
  allPassed
   ? 'the boot counterpart refuses to build half of 037 when its parent is missing'
   : 'AT LEAST ONE ASSERTION FAILED',
 );
 process.exitCode = allPassed ? 0 : 1;
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
   console.error('ROLLBACK FAILED - check transactions and account_registry');
  }
 }
 client.release();
 await pool.end();
}
