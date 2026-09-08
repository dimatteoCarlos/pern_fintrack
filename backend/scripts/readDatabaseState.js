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
import { pool } from '../src/db/config/configDB.js';
import { assertExpectedDatabase } from '../src/db/migrations/dbMigrationConfig.js';

const MIGRATIONS_DIR = path.join(process.cwd(), 'src/db/migrations/sql_migrations');

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

async function main() {
 const client = await pool.connect();
 try {
  await assertExpectedDatabase(client, 'db:state');
  await reportLedger(client);
  await reportObjects(client);
 } finally {
  client.release();
  await pool.end();
 }
}

main().catch((error) => {
 console.error(pc.red(`\n${error.message}\n`));
 process.exit(1);
});
