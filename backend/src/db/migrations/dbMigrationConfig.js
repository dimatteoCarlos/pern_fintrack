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