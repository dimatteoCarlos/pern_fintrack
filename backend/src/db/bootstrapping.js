// 📁 backend/src/db/bootstrapping.js

/**
 * Database Bootstrap Script
 *
 * PURPOSE:
 * - Prepare a fresh environment from ZERO
 * - This is INFRASTRUCTURE, not application logic
 *
 * WHAT IT DOES (IN ORDER):
 * 1. Safety check: prevent accidental production execution
 * 2. Ensure target database exists
 * 3. Run all pending migrations
 * 4. Optionally run base seeds (catalog data)
 *
 * WHAT IT NEVER DOES:
 * - Create admin users
 * - Touch runtime logic
 * - Run automatically on app start
 *
 * EXECUTION (manual):
 *   node src/db/bootstrap.js
 */

import pc from 'picocolors';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
// import 'dotenv/config';

dotenv.config();

// -------------------------------------
// 1️⃣ Environment safety checks
// -------------------------------------

if (process.env.NODE_ENV === 'production') {
  console.error(
    pc.red('\n❌ Bootstrap is not allowed in production.\n')
  );
  process.exit(1);
}

// Required env variables
const {
  DB_NAME,
} = process.env;

if (!DB_NAME) {
  console.error(
    pc.red('\n❌ DB_NAME must be defined in .env\n')
  );
  process.exit(1);
}

// Resolve project root (ESM-safe)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

// -------------------------------------
// 2️⃣ Helper: run shell commands safely
// -------------------------------------

function run(command, label) {
  console.log(pc.cyan(`\n▶ ${label}`));
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: projectRoot,
    });
  } catch (error) {
    console.error(pc.red(`\n❌ Failed: ${label}\n`));
    process.exit(1);
  }
}

// -------------------------------------
// 3️⃣ Bootstrap execution
// -------------------------------------

(async function bootstrap() {
  console.log(pc.green('\n🚀 Starting database bootstrap...\n'));

  // ---------------------------------
  // Step 1: Ensure database exists
  // ---------------------------------
  // NOTE:
  // We do NOT drop the database here.
  // Reset is a different, explicit command.
  run(
    `psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | findstr 1 || psql -U postgres -c "CREATE DATABASE ${DB_NAME}"`,
    `Ensuring database "${DB_NAME}" exists`
  );

  // ---------------------------------
  // Step 2: Run migrations
  // ---------------------------------
  run(
    `node src/db/runMigrations.js`,
    'Running migrations'
  );

  // ---------------------------------
  // Step 3: Run base seeds (optional)
  // ---------------------------------
  // Base seeds = static catalogs (currencies, roles, etc.)
  // Safe to run multiple times (idempotent)
  run(
    `node src/db/runSeeds.js base`,
    'Running base seeds'
  );

  console.log(
    pc.green('\n✅ Database bootstrap completed successfully.\n')
  );
})();
