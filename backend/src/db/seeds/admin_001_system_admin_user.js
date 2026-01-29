//📁 backend/src/db/seeds/001_system_admin_user.js
/**
 * Seed: Initial Admin User
 *
 * PURPOSE:
 * - Create the first admin user
 * - Must be executed MANUALLY
 * - NEVER auto-run in production
 *
 * EXECUTION:
 * SEED_ADMIN=true npm run db:seed
 */

import bcrypt from 'bcrypt';
import pc from 'picocolors';

export default async function seedAdminUser(client) {
// Read required environment variables 
const {
 SYSTEM_ADMIN_EMAIL,
 SYSTEM_ADMIN_PASSWORD,
 } = process.env;

// Safety checks
if (!SYSTEM_ADMIN_EMAIL || !SYSTEM_ADMIN_PASSWORD) {
 throw new Error(
  'SYSTEM_ADMIN_EMAIL and SYSTEM_ADMIN_PASSWORD must be defined in environment variables'
 );
 }

// Check if admin already exists
 const { rowCount } = await client.query(
  'SELECT 1 FROM users WHERE email = $1 ',
  [SYSTEM_ADMIN_EMAIL]
 );

if (rowCount > 0) {
  console.log('ℹ️ System Admin User already exists, skipping system admin seed');
  return;
}

// Hash password using same algorithm as auth flow
const passwordHash = await bcrypt.hash(SYSTEM_ADMIN_PASSWORD, 10);

//Insert admin user
await client.query(
 `
INSERT INTO users (
 user_id,
 username,
 email,
 user_firstname,
 user_lastname,
 password_hashed,
 user_role_id,
 auth_method,
 created_at
)
VALUES (
 gen_random_uuid(),
 'system_admin',
 $1,
 'System',
 'Administrator',
 $2,
 (SELECT user_role_id FROM user_roles WHERE user_role_name = 'system_admin'),
 'password',
 CURRENT_TIMESTAMP
)
`,
 [SYSTEM_ADMIN_EMAIL, passwordHash]
);
 console.log('👑 Admin user created successfully');
}
