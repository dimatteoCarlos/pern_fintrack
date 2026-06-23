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
async function resetDatabase(){
 try{
  console.log(pc.yellow('\n⚠️  Resetting database (DEV ONLY)...\n'));

  await adminClient.connect();

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
