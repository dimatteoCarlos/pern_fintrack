// backend/src/config/dbEnvironmentConfig.js
// Centralized configuration per environment
import dotenv from 'dotenv';

// Load .env only in non-production environments (Vercel provides env vars)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
 }
//--------
//SSL:Secuere Sockets Layer. TLS: Transport Layer Security. Protocols for secure communication over a computer network.
// TLS verifies WHO is on the other end; encryption alone only hides the traffic.
// Without ca + rejectUnauthorized, a MITM presenting any certificate is accepted.
// Base64 is preferred: it survives every env-var transport without newline mangling.
const caCert = process.env.DB_CA_CERT_B64
  ? Buffer.from(process.env.DB_CA_CERT_B64, 'base64').toString('utf8')
  : process.env.DB_CA_CERT || null;

const sslRequired = process.env.DB_SSL === 'true';

// Fail fast: a security control that silently disables itself is worse than none,
// because it reports success. Mirrors the DATABASE_URI check below.
if (sslRequired && !caCert) {
  throw new Error(
    'DB_SSL=true requires DB_CA_CERT_B64 (or DB_CA_CERT). ' +
    'Refusing to connect without verifying the database certificate.',
  );
}

const ssl_env = sslRequired ? { ca: caCert, rejectUnauthorized: true } : false;
//------
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