// 📁 backend/src/db/migrations/bootstrapping.js
/**
 * Database Bootstrap Script
 *
 * PURPOSE:
 * - Prepare a fresh environment from ZERO
 * - This is INFRASTRUCTURE, not application logic
 *
 * WHAT IT DOES (IN ORDER):
 * 1. Safety check: prevent accidental production execution
 * 2. Ensure target database exists (using Node.js, not psql)
 * 3. Run all pending migrations
 * 4. Run base seeds (catalog data)
 *
 * WHAT IT NEVER DOES:
 * - Create admin users
 * - Touch runtime logic
 * - Run automatically on app start
 *
 * EXECUTION (manual):
 *   npm run db:bootstrap
 */

import pg from 'pg';
import pc from 'picocolors';
import { getAdminDbConfig, getDbConfig, isProduction } from './dbMigrationConfig.js';
import { execSync } from 'child_process';

const { Client } = pg;

// -------------------------------------
// 1️⃣ Safety checks
// -------------------------------------
if (isProduction()) {
  console.error(pc.red('\n❌ Bootstrap is not allowed in production.\n'));
  process.exit(1);
}

// -------------------------------------
// 2️⃣ Main function
// -------------------------------------
async function bootstrap() {
  console.log(pc.green('\n🚀 Starting database bootstrap...\n'));

  // ---------------------------------
  // Step 1: Ensure database exists
  // ---------------------------------
  try {
    const config = getDbConfig();
    const targetDbName = config.database;

    // Connect to 'postgres' admin database
    const adminConfig = getAdminDbConfig();
    const adminClient = new Client(adminConfig);
    await adminClient.connect();

    // Check if database exists
    const result = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDbName]
    );

    if (result.rows.length === 0) {
      console.log(pc.yellow(`📦 Database "${targetDbName}" does not exist. Creating...`));
      await adminClient.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(pc.green(`✅ Database "${targetDbName}" created.`));
    } else {
      console.log(pc.green(`✅ Database "${targetDbName}" already exists.`));
    }

    await adminClient.end();
  } catch (error) {
    console.error(pc.red(`\n❌ Failed to ensure database exists: ${error.message}\n`));
    process.exit(1);
  }

  // ---------------------------------
  // Step 2: Run migrations
  // ---------------------------------
  try {
    console.log(pc.cyan('\n▶ Running migrations'));
    execSync('node src/db/migrations/runMigrations.js', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log(pc.green('✅ Migrations completed'));
  } catch (error) {
    console.error(pc.red('\n❌ Failed to run migrations\n'));
    process.exit(1);
  }

  // ---------------------------------
  // Step 3: Run base seeds
  // ---------------------------------
//   try {
//     console.log(pc.cyan('\n▶ Running base seeds'));
//     execSync('node src/db/migrations/runSeeds.js base', {
//       stdio: 'inherit',
//       cwd: process.cwd(),
//     });
//     console.log(pc.green('✅ Base seeds completed'));
//   } catch (error) {
//     console.error(pc.red('\n❌ Failed to run base seeds\n'));
//     process.exit(1);
//   }

//   console.log(pc.green('\n✅ Database bootstrap completed successfully.\n'));
//   process.exit(0);
}

// -------------------------------------
// 3️⃣ Execute
// -------------------------------------
bootstrap();