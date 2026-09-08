// backend/scripts/readDatabaseState.js
/**
 * Read what a database already has. Two SELECTs and nothing else: no DDL, no
 * DML, no writes anywhere in this file.
 *
 * It exists because the applied state of every database was unknown to the
 * repository until 2026-09-08, and answering it by hand meant typing the same
 * two queries at every step of a deployment. It carries the same destination
 * interlock as db:migrate, so reading production by accident is as hard as
 * writing to it by accident.
 *
 * USAGE:
 *   DB_EXPECTED=fintrack_dev npm run db:state
 */

import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import pg from 'pg';
import { pool as defaultPool } from '../src/db/config/configDB.js';
import {
 assertExpectedDatabase,
 getDbConfig,
} from '../src/db/migrations/dbMigrationConfig.js';

// pg_constraint.confdeltype spelled out: a one-letter code is not a reading.
const ON_DELETE = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };

const MIGRATIONS_DIR = path.join(process.cwd(), 'src/db/migrations/sql_migrations');

/**
 * Same override runMigrations honours, for the same reason: a rehearsal copy
 * lives on the same server under another name, and reading it must not require
 * editing DATABASE_URI. Reading a database before migrating it is the whole
 * point, so the two have to be able to reach the same place.
 */
function resolvePool() {
 return process.env.DB_NAME ? new pg.Pool(getDbConfig()) : defaultPool;
}

/**
 * Compare the ledger against the files on disk. General on purpose: this is the
 * half that stays correct as the chain grows, and it is what surfaces a
 * migration renamed after it ran - the ledger keys on the file name and stores
 * no checksum, so the successor runs again under its new name and the old name
 * stays behind with no file.
 */
async function reportLedger(client) {
 console.log(pc.cyan('\nLedger'));

 let recorded;
 try {
  const { rows } = await client.query(
   'SELECT id, filename, executed_at FROM migrations ORDER BY id',
  );
  recorded = rows;
 } catch (error) {
  console.log(pc.yellow(`  no readable ledger: ${error.message}`));
  console.log(pc.gray('  a database built by the boot path has no migrations table'));
  return;
 }

 const onDisk = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

 const names = new Set(recorded.map((r) => r.filename));
 const pending = onDisk.filter((f) => !names.has(f));
 const orphaned = recorded.filter((r) => !onDisk.includes(r.filename));
 const last = recorded[recorded.length - 1];

 console.log(`  ${recorded.length} rows, ${onDisk.length} files on disk`);
 if (last) {
  console.log(`  last executed: ${last.filename} on ${last.executed_at.toISOString()}`);
 }

 console.log(pending.length ? pc.yellow(`  pending: ${pending.join(', ')}`) : pc.green('  pending: none'));

 if (orphaned.length) {
  console.log(pc.yellow('  recorded with no file on disk:'));
  for (const row of orphaned) {
   console.log(pc.yellow(`    ${row.filename}  ${row.executed_at.toISOString()}`));
  }
 }
}

/**
 * The objects the account closure chain creates. Specific by nature, so it says
 * so: extend it when a migration past 035 adds something worth probing. The
 * point of reading these rather than trusting the ledger is that the ledger
 * records file names, and a file edited after it ran leaves the name behind
 * while the schema moves on.
 */
async function reportObjects(client) {
 console.log(pc.cyan('\nObjects created by 031-035'));

 const {
  rows: [state],
 } = await client.query(
  "SELECT" +
   " (SELECT count(*) FROM account_types WHERE account_type_name = 'boundary') AS m031_boundary," +
   " (SELECT count(*) FROM movement_types WHERE movement_type_name = 'account-closure') AS m032_movement," +
   " (SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public'" +
   "   AND table_name = 'user_accounts' AND column_name = 'account_type_id') AS m033_nullable," +
   " (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'" +
   "   AND table_name = 'user_accounts' AND column_name = 'closed_at') AS m034_closed_at," +
   " to_regclass('public.account_registry') AS m035_registry," +
   " to_regclass('public.budget_monthly_allocations') AS m035_precondition",
 );

 for (const [key, value] of Object.entries(state)) {
  console.log(`  ${key.padEnd(20)} ${value === null ? pc.yellow('absent') : value}`);
 }

 console.log(
  pc.gray(
   '\n  m035_precondition is not a migration. It decides the seventh key of 035:' +
    '\n  absent means budget_monthly_allocations was never created and that ALTER is skipped.',
  ),
 );
}

/**
 * The effect of 035, measured rather than assumed. It answers three questions a
 * ledger row cannot: whether the backfill reached every account, whether any
 * registry row has outlived its account, and where the referencing keys point.
 *
 * The key list is derived from pg_constraint rather than from the migration's
 * own names, so it stays true if a later migration adds or moves one.
 */
async function reportRegistry(client) {
 console.log(pc.cyan('\nAccount registry (035)'));

 const {
  rows: [present],
 } = await client.query("SELECT to_regclass('public.account_registry') AS t");

 if (present.t) {
  await reportBackfill(client);
 } else {
  console.log(pc.yellow('  absent: 035 has not been applied here'));
 }

 const { rows: keys } = await client.query(
  'SELECT c.conname, c.conrelid::regclass::text AS child,' +
   ' c.confrelid::regclass::text AS parent, c.confdeltype AS on_delete' +
   " FROM pg_constraint c WHERE c.contype = 'f'" +
   '  AND c.confrelid::regclass::text IN' +
   "   ('user_accounts', 'account_registry', 'category_budget_accounts')" +
   ' ORDER BY parent, child, conname',
 );

 console.log(pc.cyan('\n  Foreign keys into the account identity'));
 for (const k of keys) {
  const action = ON_DELETE[k.on_delete] || k.on_delete;
  console.log(`    ${k.parent.padEnd(24)} <- ${k.child}.${k.conname}  [${action}]`);
 }
}

/**
 * Backfill parity, split out because it can only be read once the table exists
 * while the key report above is exactly what has to be read before it does.
 */
async function reportBackfill(client) {
 const {
  rows: [counts],
 } = await client.query(
  'SELECT (SELECT count(*) FROM user_accounts) AS accounts,' +
   ' (SELECT count(*) FROM account_registry) AS registry,' +
   ' (SELECT count(*) FROM account_registry r WHERE NOT EXISTS' +
   '   (SELECT 1 FROM user_accounts ua WHERE ua.account_id = r.account_id)) AS closed',
 );

 // count(*) is bigint and node-postgres hands bigint back as a string, so a
 // strict comparison against a number is false for every input.
 const parity = Number(counts.accounts) === Number(counts.registry) - Number(counts.closed);

 console.log(`  user_accounts        ${counts.accounts}`);
 console.log(`  account_registry     ${counts.registry}`);
 console.log(`  stamped, no account  ${counts.closed}`);
 console.log(
  parity
   ? pc.green('  every live account has a registry row')
   : pc.red('  MISMATCH: a live account has no registry row'),
 );
}

async function main() {
 const pool = resolvePool();
 const client = await pool.connect();
 try {
  await assertExpectedDatabase(client, 'db:state');
  await reportLedger(client);
  await reportObjects(client);
  await reportRegistry(client);
 } finally {
  client.release();
  await pool.end();
 }
}

main().catch((error) => {
 console.error(pc.red(`\n${error.message}\n`));
 process.exit(1);
});
