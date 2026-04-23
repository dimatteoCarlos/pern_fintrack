// backend/src/config/index.js
// Centralized configuration per environment
import dotenv from 'dotenv';

// Load .env only in non-production environments (Vercel provides env vars)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
 }

const ssl_env=process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

const max_env=parseInt(process.env.DB_POOL_MAX || '2', 10);

const config = {
  development: {
    database: {
      connectionString: process.env.DATABASE_URI,
      ssl:  ssl_env, 
      max:max_env, 
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    },
  },
  production: {
    database: {
      connectionString: process.env.DATABASE_URI,
      ssl: ssl_env, 
      max: max_env, 
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    },
  },
};

const env = process.env.NODE_ENV || 'development';

// Validación (fail-fast)
if (!config[env]) {
  throw new Error(`❌ Invalid NODE_ENV: ${env}`);
}

const activeConfig = config[env];

if (!activeConfig.database.connectionString) {
  throw new Error(`Missing DATABASE_URI for environment: ${env}`);
}

export { activeConfig };