//backend\src\db\runMigrations.js

/**
 * Migration Runner
 * Executes pending SQL migrations in a controlled, transactional way
 */

import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import pg from 'pg';
import { pool as defaultPool } from '../config/configDB.js';
import {
 assertExpectedDatabase,
 getDbConfig,
 isProduction,
} from './dbMigrationConfig.js';
const MIGRATIONS_DIR = path.join(process.cwd(), 'src/db/migrations/sql_migrations'); //

/**
 * Decide which database this run migrates, and say so out loud.
 *
 * Default: the pool DATABASE_URI builds, carrying its SSL and pool settings.
 * That is what a plain `npm run db:migrate` uses and the only path a production
 * run takes.
 *
 * Override: DB_NAME names another database on the same server, for a rehearsal
 * copy. bootstrapping.js already resolves its CREATE DATABASE target that way
 * and then shells out to this file; until this branch existed it created one
 * database and migrated a different one, with nothing in the output saying so.
 *
 * The override is refused under NODE_ENV=production: a stray DB_NAME there
 * would point a production run at the wrong database and the ledger would
 * record it as done.
 *
 * @returns {{pool: object, target: string}} the pool to migrate and its name
 */
function resolveTarget() {
 const override = process.env.DB_NAME;

 if (!override) {
  return { pool: defaultPool, target: 'the database DATABASE_URI names' };
 }

 if (isProduction()) {
  console.error(
   pc.red('\n❌ DB_NAME override is not allowed when NODE_ENV=production.\n'),
  );
  process.exit(1);
 }

 return { pool: new pg.Pool(getDbConfig()), target: override };
}

async function runMigrations() {
 // Two independent refusals. This one answers "is this a deployed process
 // migrating itself", which keys on the environment variable and not on the
 // destination; assertExpectedDatabase below answers "is this the database you
 // meant", which is the question the mode cannot answer. Refuting one does not
 // retire the other, and neither of them was Carlos's suspension of production
 // runs, which was lifted on 2026-09-08 with no code change.
 if (isProduction()) {
  console.error(pc.red('\n❌ Migrations are not allowed under NODE_ENV=production.\n'));
  process.exit(1);
 }

 const { pool, target } = resolveTarget();
 console.log(pc.cyan(`Migration target: ${target}`));

 const client = await pool.connect();

 // Before the ledger table is created, and therefore before anything is
 // written: the line above announces a target without naming it when DB_NAME is
 // unset, and this is what makes the destination a fact rather than a phrase.
 await assertExpectedDatabase(client, 'db:migrate');

 let exitCode = 0;

 try {
  console.log(pc.cyan('\n\ud83d\ude80 Starting database migrations...\n'));

  // The ledger belongs to no migration, so it is created outside every
  // migration's transaction.
  await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

  const { rows } = await client.query('SELECT filename FROM migrations');
  const executedMigrations = rows.map((r) => r.filename);

  const migrationFiles = fs
   .readdirSync(MIGRATIONS_DIR)
   .filter((f) => f.endsWith('.sql'))
   .sort(); // critical: order matters

  for (const file of migrationFiles) {
   if (executedMigrations.includes(file)) {
    console.log(pc.gray(`\u23ed Skipping ${file}`));
    continue;
   }

   console.log(pc.yellow(`\u25b6 Running ${file}`));

   const filePath = path.join(MIGRATIONS_DIR, file);
   const sql = fs.readFileSync(filePath, 'utf-8');

   // One transaction per file: the schema change and the ledger row that
   // names it commit together, or neither of them survives. A file that
   // opened its own transaction would close this one, which is why no file
   // in sql_migrations carries BEGIN or COMMIT.
   await client.query('BEGIN');

   try {
    await client.query(sql);
    await client.query('INSERT INTO migrations (filename) VALUES ($1)', [
     file,
    ]);
    await client.query('COMMIT');
   } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`${file}: ${error.message}`);
   }

   console.log(pc.green(`\u2714 Completed ${file}\n`));
  }

  console.log(pc.green('\n\u2705 All migrations executed successfully.\n'));
 } catch (error) {
  console.error(pc.red('\n\u274c Migration failed:'), error.message);
  exitCode = 1;
 } finally {
  client.release();
 }

 // The exit code is decided once, after the client is released. Calling
 // process.exit inside the catch skipped this block, which made a real
 // failure exit 0 the moment anyone moved the release out of it.
 await pool.end();
 process.exit(exitCode);
}

runMigrations();
