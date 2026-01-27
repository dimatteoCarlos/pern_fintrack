//backend\src\db\runMigrations.js

/**
 * Migration Runner
 * Executes pending SQL migrations in a controlled, transactional way
 */

import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { pool } from './configDB.js';

const MIGRATIONS_DIR = path.join(process.cwd(), 'src/db/migrations');//

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log(pc.cyan('\n🚀 Starting database migrations...\n'));

    await client.query('BEGIN');

    // 1. Ensure migration control table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Get already executed migrations
    const { rows } = await client.query(
      'SELECT filename FROM migrations'
    );
    console.log({rows})
    const executedMigrations = rows.map(r => r.filename);

    // 3. Read migration files
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort(); // critical: order matters

    // 4. Execute pending migrations
    for (const file of migrationFiles) {
      if (executedMigrations.includes(file)) {
        console.log(pc.gray(`⏭ Skipping ${file}`));
        continue;
      }

      console.log(pc.yellow(`▶ Running ${file}`));

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query(sql);

      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [file]
      );

      console.log(pc.green(`✔ Completed ${file}\n`));
    }

    await client.query('COMMIT');
    console.log(pc.green('\n✅ All migrations executed successfully.\n'));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(pc.red('\n❌ Migration failed:'), error.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigrations();
