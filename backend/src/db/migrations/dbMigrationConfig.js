// 📁backend\src\db\migrations\dbMigrationConfig.js
/**
 * Database Configuration Module
 *
 * PURPOSE:
 * - Centralize database connection configuration
 * - Support both individual variables and DATABASE_URI
 * - Provide a single source of truth for all DB scripts
 *
 * USAGE:
 *   import { getDbConfig } from './dbConfig.js';
 *   const config = getDbConfig();
 *   const client = new Client(config);
 */

import pc from 'picocolors';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// 1. Parse connection string using native URL
// ============================================
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

// ============================================
// 2. Get database configuration
// ============================================
export function getDbConfig() {
  const {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
    NODE_ENV,
    DATABASE_URI,
  } = process.env;

  // Parse DATABASE_URI if provided
  let parsed = null;
  if (DATABASE_URI) {
    try {
      parsed = parseConnectionString(DATABASE_URI);
    } catch (err) {
      console.warn(pc.yellow(`⚠️ Failed to parse DATABASE_URI: ${err.message}`));
    }
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

  return config;
}

// ============================================
// 3. Get admin connection (connects to 'postgres' database)
// ============================================
export function getAdminDbConfig() {
  const config = getDbConfig();
  return {
    ...config,
    database: 'postgres',
  };
}

// ============================================
// 4. Check if running in production
// ============================================
export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

// ============================================
// 5. Refuse a destination the operator did not name
// ============================================
/**
 * Guard the destination, not the mode.
 *
 * isProduction above tests NODE_ENV, and NODE_ENV does not select the database:
 * dbEnvironmentConfig.js declares development and production with identical
 * bodies, both reading DATABASE_URI. A run with NODE_ENV unset and a production
 * DATABASE_URI passes every mode check in the codebase and still writes to
 * production, so the mode cannot be what decides.
 *
 * The connection itself is the only honest source. current_database() comes back
 * from the session already opened, so this reads no secret, needs no credential
 * in the code, and prints no connection string - only the database name, which
 * is what the operator has to recognise.
 *
 * Refusing when DB_EXPECTED is unset is deliberate: a guard that defaults to
 * proceeding protects the run nobody was worried about.
 *
 * @param {object} client a connected pg client
 * @param {string} script the npm script being guarded, named in the refusal
 * @returns {Promise<string>} the confirmed database name
 */
export async function assertExpectedDatabase(client, script) {
 const expected = process.env.DB_EXPECTED;

 const {
  rows: [server],
 } = await client.query(
  'SELECT current_database() AS db, inet_server_addr() AS host, inet_server_port() AS port',
 );

 const where = `${server.db} at ${server.host || 'local socket'}:${server.port || '-'}`;

 if (!expected) {
  console.error(
   pc.red(`\n❌ ${script} refuses to run without DB_EXPECTED.\n`) +
    pc.gray(`   This connection reached ${where}.\n`) +
    pc.gray(`   Set DB_EXPECTED to that database name to confirm it is the one you mean.\n`),
  );
  process.exit(1);
 }

 if (expected !== server.db) {
  console.error(
   pc.red(`\n❌ ${script} refuses to run: destination mismatch.\n`) +
    pc.gray(`   DB_EXPECTED names "${expected}" and this connection reached ${where}.\n`),
  );
  process.exit(1);
 }

 console.log(pc.green(`✅ Destination confirmed: ${where}`));
 return server.db;
}