// backend/src/db/migrations/schemaParity.js

/**
 * Schema parity between the two build paths.
 *
 * A database can be built two ways in this project and they are maintained by
 * hand: the migration chain in sql_migrations/, and the boot DDL in
 * run_time_db_init/ that initializeDatabase() runs on every server start.
 * When they drift, a database built by the boot path starts without error and
 * breaks at run time, which is the worst way to find out.
 *
 * This builds one throwaway database by each path, compares them column by
 * column, and reports. It corrects nothing. Local databases only: it refuses
 * to run against a connection string that names production.
 *
 * Run with: npm run db:parity
 */

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import pg from 'pg';
import pc from 'picocolors';
import 'dotenv/config';

const CHAIN_DB = 'fintrack_parity_chain';
const BOOT_DB = 'fintrack_parity_boot';

// Each path keeps its own bookkeeping table. Their absence on the other side is
// expected, not drift.
const ACCEPTED_TABLES = {
 migrations: 'the chain ledger; the boot path has no ledger',
 app_initialization: 'the boot path flag; the chain does not set one',
 account_name_case_backup_013:
  'the name backup migration 013 keeps on purpose; its DROP is commented out',
};

const SELF = fileURLToPath(import.meta.url);

function databaseUri(base, name) {
 return base.replace(/\/[^/?]+(\?|$)/, `/${name}$1`);
}

async function withAdmin(base, fn) {
 const admin = new pg.Client({ connectionString: base });
 await admin.connect();
 try {
  return await fn(admin);
 } finally {
  await admin.end();
 }
}

async function recreate(admin, name) {
 await admin.query(
  `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
  [name],
 );
 await admin.query(`DROP DATABASE IF EXISTS ${name}`);
 await admin.query(`CREATE DATABASE ${name}`);
}

async function drop(admin, name) {
 await admin.query(
  `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
  [name],
 );
 await admin.query(`DROP DATABASE IF EXISTS ${name}`);
}

// Reads the shape of a database as a map of "table.column" to its declaration.
async function readShape(uri) {
 const client = new pg.Client({ connectionString: uri });
 await client.connect();
 const { rows } = await client.query(`
   SELECT c.table_name, c.column_name, c.data_type, c.is_nullable,
          c.numeric_precision, c.numeric_scale, c.character_maximum_length,
          c.column_default
   FROM information_schema.columns c
   JOIN information_schema.tables t
     ON t.table_name = c.table_name AND t.table_schema = c.table_schema
   WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
   ORDER BY c.table_name, c.column_name
 `);
 await client.end();

 const shape = new Map();
 const tables = new Set();
 for (const r of rows) {
  tables.add(r.table_name);
  const size =
   r.character_maximum_length !== null
    ? `(${r.character_maximum_length})`
    : r.numeric_precision !== null
      ? `(${r.numeric_precision},${r.numeric_scale})`
      : '';
  // The default is normalised: a sequence name carries the database name in
  // some server versions, and nextval on a serial is not drift.
  const def = (r.column_default || '')
   .replace(/nextval\('[^']+'::regclass\)/, 'nextval()')
   .trim();
  shape.set(
   `${r.table_name}.${r.column_name}`,
   `${r.data_type}${size} null=${r.is_nullable} default=${def}`,
  );
 }
 return { shape, tables };
}

// Builds the boot-path database in a child process, so the global pool this
// module already holds is not the one that connects to it.
function buildBootPath(uri) {
 return spawnSync(process.execPath, [SELF, '--build-boot'], {
  env: { ...process.env, DATABASE_URI: uri },
  encoding: 'utf-8',
 });
}

function buildChain(uri) {
 return spawnSync(process.execPath, ['src/db/migrations/runMigrations.js'], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URI: uri },
  encoding: 'utf-8',
 });
}

async function main() {
 const base = process.env.DATABASE_URI;
 if (!base) {
  console.error(pc.red('No DATABASE_URI in the environment.'));
  process.exit(1);
 }
 if (/prod|supabase/i.test(base)) {
  console.error(
   pc.red('Refusing to run: the connection string does not name a local database.'),
  );
  process.exit(1);
 }

 const chainUri = databaseUri(base, CHAIN_DB);
 const bootUri = databaseUri(base, BOOT_DB);
 let differences = 0;

 await withAdmin(base, async (admin) => {
  try {
   console.log(pc.cyan('\nBuilding one database by each path...\n'));

   await recreate(admin, CHAIN_DB);
   const chain = buildChain(chainUri);
   if (chain.status !== 0) {
    console.error(pc.red('The migration chain failed:'));
    console.error((chain.stderr || chain.stdout || '').split('\n').slice(-6).join('\n'));
    process.exit(1);
   }
   console.log(pc.green(`✔ chain    -> ${CHAIN_DB}`));

   await recreate(admin, BOOT_DB);
   const boot = buildBootPath(bootUri);
   if (boot.status !== 0) {
    console.error(pc.red('The boot path failed:'));
    console.error((boot.stderr || boot.stdout || '').split('\n').slice(-6).join('\n'));
    process.exit(1);
   }
   console.log(pc.green(`✔ boot DDL -> ${BOOT_DB}\n`));

   const a = await readShape(chainUri);
   const b = await readShape(bootUri);

   // Tables present on one side only.
   for (const [tables, side, other] of [
    [a.tables, 'chain', b.tables],
    [b.tables, 'boot', a.tables],
   ]) {
    for (const t of [...tables].sort()) {
     if (other.has(t)) continue;
     if (ACCEPTED_TABLES[t]) {
      console.log(pc.gray(`  accepted: ${t} only in ${side} — ${ACCEPTED_TABLES[t]}`));
      continue;
     }
     console.log(pc.red(`  TABLE only in ${side}: ${t}`));
     differences += 1;
    }
   }

   // Columns present on one side only, or declared differently.
   const keys = new Set([...a.shape.keys(), ...b.shape.keys()]);
   for (const key of [...keys].sort()) {
    const table = key.split('.')[0];
    if (ACCEPTED_TABLES[table]) continue;
    const inChain = a.shape.get(key);
    const inBoot = b.shape.get(key);
    if (inChain === inBoot) continue;
    if (inChain === undefined) {
     console.log(pc.red(`  COLUMN only in boot:  ${key}`));
    } else if (inBoot === undefined) {
     console.log(pc.red(`  COLUMN only in chain: ${key}`));
    } else {
     console.log(pc.yellow(`  DECLARED DIFFERENTLY: ${key}`));
     console.log(pc.gray(`      chain: ${inChain}`));
     console.log(pc.gray(`      boot:  ${inBoot}`));
    }
    differences += 1;
   }

   console.log(
    differences === 0
     ? pc.green('\n✅ The two paths build the same schema.\n')
     : pc.red(`\n❌ ${differences} difference(s) between the two paths.\n`),
   );
  } finally {
   await drop(admin, CHAIN_DB);
   await drop(admin, BOOT_DB);
  }
 });

 process.exit(differences === 0 ? 0 : 1);
}

// The child branch: build the boot path against the handed-down connection.
if (process.argv.includes('--build-boot')) {
 const { initializeDatabase } = await import('../run_time_db_init/initDatabase.js');
 const { pool } = await import('../config/configDB.js');
 await initializeDatabase();
 await pool.end();
 process.exit(0);
} else {
 await main();
}
