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
 * This builds one throwaway database by each path and compares three things:
 * the columns, the constraints, and the rows of the catalogs both paths seed.
 * It corrects nothing. Local databases only: it refuses to run against a
 * connection string that names production.
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

// The catalogs both paths seed, and the columns whose value has to match. The
// column comparison below cannot see these: a missing row and a name spelled
// differently are data, and the check reported green while account_types held
// six rows on one path and seven on the other.
//
// Table and column names are literals of this file, never input, so they are
// interpolated into the query the same way the rest of this module does it.
const SEEDED_CATALOGS = {
 currencies: ['currency_id', 'currency_code', 'currency_name'],
 user_roles: ['user_role_id', 'user_role_name'],
 account_types: ['account_type_id', 'account_type_name'],
 category_nature_types: ['category_nature_type_id', 'category_nature_type_name'],
 movement_types: ['movement_type_id', 'movement_type_name'],
 transaction_types: ['transaction_type_id', 'transaction_type_name'],
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

// Reads the constraints of a database as a map of rule to its delete/update
// action. The name Postgres generates is not comparable between two databases
// built by different paths; the columns and the referenced table are.
async function readConstraints(uri) {
 const client = new pg.Client({ connectionString: uri });
 await client.connect();
 const { rows } = await client.query(`
   SELECT con.contype::text AS kind,
          rel.relname::text AS tbl,
          (SELECT string_agg(att.attname, ',' ORDER BY att.attname)
             FROM unnest(con.conkey) k
             JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k) AS cols,
          COALESCE(fre.relname::text, '') AS ref_tbl,
          COALESCE((SELECT string_agg(att.attname, ',' ORDER BY att.attname)
             FROM unnest(con.confkey) k
             JOIN pg_attribute att ON att.attrelid = fre.oid AND att.attnum = k), '') AS ref_cols,
          COALESCE(con.confdeltype::text, '') AS on_delete,
          COALESCE(con.confupdtype::text, '') AS on_update
   FROM pg_constraint con
   JOIN pg_class rel ON rel.oid = con.conrelid
   JOIN pg_namespace ns ON ns.oid = rel.relnamespace
   LEFT JOIN pg_class fre ON fre.oid = con.confrelid
   WHERE ns.nspname = 'public' AND con.contype IN ('f','u','p')
   ORDER BY 1, 2, 3
 `);
 await client.end();

 const rules = new Map();
 for (const r of rows) {
  const kind = { f: 'FK', u: 'UNIQUE', p: 'PK' }[r.kind];
  const key =
   kind === 'FK'
    ? `FK ${r.tbl}(${r.cols}) -> ${r.ref_tbl}(${r.ref_cols})`
    : `${kind} ${r.tbl}(${r.cols})`;
  rules.set(key, kind === 'FK' ? `del=${r.on_delete} upd=${r.on_update}` : '');
 }
 return rules;
}

// Reads the seeded catalog rows as a map of table to the list of its rows, each
// row rendered as one string. A table the path never created is left out, which
// the table comparison already reports.
async function readCatalogRows(uri) {
 const client = new pg.Client({ connectionString: uri });
 await client.connect();

 const catalogs = new Map();
 for (const [table, columns] of Object.entries(SEEDED_CATALOGS)) {
  const { rows: exists } = await client.query(
   `SELECT to_regclass($1) IS NOT NULL AS present`,
   [`public.${table}`],
  );
  if (!exists[0].present) continue;

  const { rows } = await client.query(
   `SELECT ${columns.join(', ')} FROM ${table} ORDER BY ${columns[0]}`,
  );
  catalogs.set(
   table,
   rows.map((row) => columns.map((column) => String(row[column])).join(' | ')),
  );
 }

 await client.end();
 return catalogs;
}

// The table a constraint key belongs to, for the accepted-tables filter.
function constraintTable(key) {
 return key.replace(/^\S+ /, '').replace(/\(.*$/, '');
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

   // Constraints present on one side only, or carrying a different action.
   const chainRules = await readConstraints(chainUri);
   const bootRules = await readConstraints(bootUri);

   for (const [rules, side, other] of [
    [chainRules, 'chain', bootRules],
    [bootRules, 'boot ', chainRules],
   ]) {
    for (const [key, action] of rules) {
     if (ACCEPTED_TABLES[constraintTable(key)]) continue;
     if (other.has(key)) continue;
     console.log(pc.red(`  CONSTRAINT only in ${side}: ${key} ${action}`));
     differences += 1;
    }
   }

   for (const [key, action] of chainRules) {
    if (ACCEPTED_TABLES[constraintTable(key)]) continue;
    if (!bootRules.has(key) || bootRules.get(key) === action) continue;
    console.log(pc.yellow(`  ACTION DIFFERS: ${key}`));
    console.log(pc.gray(`      chain: ${action}`));
    console.log(pc.gray(`      boot:  ${bootRules.get(key)}`));
    differences += 1;
   }

   // Seeded catalog rows present on one side only.
   const chainRows = await readCatalogRows(chainUri);
   const bootRows = await readCatalogRows(bootUri);

   for (const table of Object.keys(SEEDED_CATALOGS)) {
    const inChain = chainRows.get(table);
    const inBoot = bootRows.get(table);
    if (!inChain || !inBoot) continue;

    for (const [rows, side, other] of [
     [inChain, 'chain', new Set(inBoot)],
     [inBoot, 'boot ', new Set(inChain)],
    ]) {
     for (const row of rows) {
      if (other.has(row)) continue;
      console.log(pc.red(`  ROW only in ${side}: ${table} -> ${row}`));
      differences += 1;
     }
    }
   }

   console.log(
    differences === 0
     ? pc.green(
        '\n✅ Same columns, same constraints and same seeded rows on both paths.\n',
       )
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
