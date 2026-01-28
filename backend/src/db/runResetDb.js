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

import pg from 'pg';
import pc from 'picocolors';
import dotenv from 'dotenv';

dotenv.config();

const {Client} = pg;

//Read required env vars
const {
DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  NODE_ENV,
}=process.env;

console.log({DB_NAME})

// --------------
// Safety guard
// --------------
if(NODE_ENV === 'production'){
 console.error(pc.red('❌ db:reset is forbidden in production'));
 process.exit(1);
}

if(!DB_NAME){
 console.error(pc.red('❌ DB_NAME is not defined'));
 process.exit(1);
}

// Connect to default postgres database (NOT the target DB)
const adminClient = new Client({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: 'postgres',
});

async function resetDatabase(){
 try{
  console.log(pc.yellow('\n⚠️  Resetting database (DEV ONLY)...\n'));

  await adminClient.connect();

  // Terminate active connections
  await adminClient.query(`
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = $1
   AND pid <> pg_backend_pid();
  `, [DB_NAME]);

  // Drop database
    console.log(pc.red(`🗑 Dropping database: ${DB_NAME}`));
    
    await adminClient.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);

    // Recreate database
    console.log(pc.green(`🆕 Creating database: ${DB_NAME}`));
    await adminClient.query(`CREATE DATABASE "${DB_NAME}"`);

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

resetDatabase();
