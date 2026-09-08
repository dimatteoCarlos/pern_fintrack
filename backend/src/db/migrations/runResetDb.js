//📁 backend/src/db/runResetDb.js
/**
 * Database Reset Script (DEV ONLY)
 *
 * PURPOSE:
 * - Completely drop and recreate the database
 * - Remove ALL data and ALL schema
 * - Reset migration state to zero
 *
 * THIS SCRIPT:
 * - MUST NEVER run in production
 * - Does NOT run migrations
 * - Does NOT run seeds
 *
 * USAGE:
 * npm run db:reset
 */

//Import dependencies
import pg from 'pg';
import pc from 'picocolors';
import dotenv from 'dotenv';
import { assertExpectedDatabase } from './dbMigrationConfig.js';
// import { getAdminDbConfig, isProduction } from '../dbConfig.js';//opcion 2
// import pkg from 'pg-connection-string'; //opcione 3
// const { parse } = pkg;

dotenv.config();

const {Client} = pg;

//Read required env vars
// =================================
// 1. Read environment variables
// =================================
const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  NODE_ENV,
  DATABASE_URI,
} = process.env;

// --------------
// Safety guard
// --------------
if(NODE_ENV === 'production'){
 console.error(pc.red('❌ db:reset is forbidden in production'));
 process.exit(1);
}

// =================================
// 2. Determine connection parameters
//    Priority: individual variables > DATABASE_URI > defaults
// =================================
// let parsed = null;
// if (DATABASE_URI) {
//   parsed = parse(DATABASE_URI);
// }
//------------------------------
function parseConnectionString(uri) {
  const parsed = new URL(uri);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.slice(1),
  };
}
let parsed ={};
if (DATABASE_URI) {
   parsed = parseConnectionString(DATABASE_URI);
}

const config = {
  host: DB_HOST || parsed?.host || 'localhost',
  port: parseInt(DB_PORT || parsed?.port || '5432', 10),
  user: DB_USER || parsed?.user || 'postgres',
  password: DB_PASSWORD || parsed?.password || '',
  database: DB_NAME || parsed?.database || '',
};

// Validate that we have a database name
if (!config.database) {
  console.error(pc.red('❌ Database name could not be determined (DB_NAME or DATABASE_URI required)'));
  process.exit(1);
}
const targetDbName = config.database;

// =================================
// 3. Connect to 'postgres' admin database
// =================================
const adminClient = new Client({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: 'postgres',
});

// =========================
// 4. Main function
// =========================
/**
 * Confirm the database about to be destroyed, from inside it.
 *
 * The mode guards above test NODE_ENV, and NODE_ENV does not select the
 * database: a run with NODE_ENV unset and a production DATABASE_URI passes both
 * of them and drops production. This is the script where that matters most,
 * because it is the only one whose damage cannot be undone by running something
 * else afterwards.
 *
 * IT CONFIRMS THROUGH A CONNECTION TO THE TARGET, not through the admin
 * connection. adminClient is attached to 'postgres', so current_database() there
 * reports 'postgres' and would confirm a database nobody is dropping. The only
 * honest answer comes from the database itself, which also yields its address
 * and so gets the off-machine refusal for free.
 *
 * A DATABASE THAT DOES NOT EXIST IS NOT CONFIRMED AND NOT REFUSED. There is
 * nothing to destroy, the DROP is a no-op and the CREATE is the whole run.
 * DB_EXPECTED is still required, because a run that names no destination is a
 * run nobody has decided on.
 */
async function confirmTarget() {
 if (!process.env.DB_EXPECTED) {
  console.error(
   pc.red('\n❌ db:reset refuses to run without DB_EXPECTED.\n') +
    pc.gray(`   It would drop and recreate "${targetDbName}".\n`) +
    pc.gray('   Set DB_EXPECTED to that name to confirm it is the one you mean.\n'),
  );
  process.exit(1);
 }

 const { rows } = await adminClient.query(
  'SELECT 1 FROM pg_database WHERE datname = $1',
  [targetDbName],
 );

 if (!rows.length) {
  console.log(
   pc.yellow(`⚠ ${targetDbName} does not exist; nothing to drop.`),
  );

  if (process.env.DB_EXPECTED !== targetDbName) {
   console.error(
    pc.red('\n❌ db:reset refuses to run: destination mismatch.\n') +
     pc.gray(`   DB_EXPECTED names "${process.env.DB_EXPECTED}" and this run would create "${targetDbName}".\n`),
   );
   process.exit(1);
  }
  return;
 }

 const targetClient = new Client({ ...config, database: targetDbName });
 await targetClient.connect();

 try {
  await assertExpectedDatabase(targetClient, 'db:reset');
 } finally {
  // Closed before the terminate below, or this connection is one of the ones
  // it kills and the drop fails on a database still in use.
  await targetClient.end();
 }
}

async function resetDatabase(){
 try{
  console.log(pc.yellow('\n⚠️  Resetting database (DEV ONLY)...\n'));

  await adminClient.connect();

  // Before anything is terminated or dropped.
  await confirmTarget();

  // Terminate active connections to target database
  await adminClient.query(`
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = $1
    AND pid <> pg_backend_pid();
   `, [targetDbName]);

  // Drop database
    console.log(pc.red(`🗑 Dropping database: ${targetDbName}`));
    await adminClient.query(`DROP DATABASE IF EXISTS "${targetDbName}"`);

    // Recreate database
    console.log(pc.green(`🆕 Creating database: ${targetDbName}`));
    await adminClient.query(`CREATE DATABASE "${targetDbName}"`);

    console.log(pc.green('\n✅ Database reset completed successfully\n'));
  } catch (error) {
    console.error(pc.red('\n❌ Database reset failed'));
    console.error(pc.red(error.message));
    process.exit(1);
  } finally {
    await adminClient.end();
    process.exit(0);
  }
}
// ===================================
// 5. Safety guard
// =================================
if (NODE_ENV === 'production') {
  console.error(pc.red('❌ db:reset is forbidden in production'));
  process.exit(1);
}

// =================================
// 6. Execute
// =================================
resetDatabase();
