// backend\src\db\runSeeds.js

/**
 * Seed Runner
 * Executes database seeds in a controlled and explicit way
 * Seeds are NEVER part of runtime
 * Responsibilities:
 * 1. Classify seed files
 * 2. Authorize execution via env flags
 * 3. Execute allowed seeds inside a transaction
 * 4. Report real execution results
 * 5 execution:
 * npm run db:seed:admin/base
 */

/*
eliminar del .env: 
SEED_ADMIN=true   ❌
SEED_BASE=true    ❌
{
{
  "scripts": {
    "db:seed:base": "node src/db/runSeeds.js base",
    "db:seed:admin": "node src/db/runSeeds.js admin"
  }
}
``}
*/
import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { pool } from './configDB.js';
import { pathToFileURL } from 'url';
//----------------------------
// Absolute path to seeds directory
const SEEDS_DIR = path.join(process.cwd(), 'src/db/seeds');
// -----------------------------
// 1️⃣ Read execution intent
// -----------------------------
const seedType = process.argv[2]; // 'base' | 'admin'

if (!['base', 'admin'].includes(seedType)) {
  console.error(
    pc.red('\n❌ You must specify which seeds to run: base | admin\n')
  );
  console.log(pc.gray('Examples:'));
  console.log(pc.gray('  npm run db:seed:base'));
  console.log(pc.gray('  npm run db:seed:admin\n'));
  process.exit(1);
}

async function runSeeds() {
  const client = await pool.connect();
  let executedCount = 0;
  try {
   console.log(pc.cyan(`\n🌱 Running "${seedType}" seeds...\n`));
   
// Start transaction
await client.query('BEGIN'); 
// -----------------------------
// 2️⃣ Load only requested seeds
// -----------------------------
// Read all files from seeds directory
const seedFiles = fs
 .readdirSync(SEEDS_DIR)//Reads seedsDir content and delivers an array with the filenames
 .filter(f => f.endsWith('.js'))
 .filter(f => f.startsWith(`${seedType}_`))
 .sort();//execution order matters

console.log(pc.cyan(`🌱 Running ${seedFiles.length} seed(s)...`));

if (seedFiles.length === 0) {
 console.log(
  pc.yellow(`⚠️ No ${seedType} seeds found`)
 );
 await client.query('ROLLBACK');
 // process.exit(0);
 return;
  }

for (const file of seedFiles) {
const filePath = path.join(SEEDS_DIR, file);
// -----------------------------
// 3️⃣ ▶ Execute seed
// -----------------------------
 console.log(pc.yellow(`▶ Running ${file}`));

// ⚠️ Windows-safe ESM import
// Dynamic import of seed module
// const seedModule = await import(pathToFileURL(filePath).href);

const fileUrl = pathToFileURL(filePath).href;
const seedModule = await import(fileUrl)
// Each seed MUST export a default async function
// Run the exported function
if (typeof seedModule.default === 'function') {
  await seedModule.default(client);
  executedCount++;
  console.log(pc.green(`✔ Completed ${file}\n`));
 }else {
console.error(pc.red(`❌ ${file} is missing a default export function.`));}
}
// Commit only if everything succeeded
await client.query('COMMIT');

// -----------------------------
// 4️⃣ Final report (truthful)
// -----------------------------
console.log(pc.green(`✅ Seeds completed. Executed: ${executedCount}\n`
  )
 );
} catch (error) {
// Rollback on any failure
await client.query('ROLLBACK');

console.error(
pc.red('\n❌ Seed execution failed. Transaction rolled back.')
);
console.error(pc.red(error.message));
process.exit(1);

} finally {
client.release();
process.exit(0);
 }
}

runSeeds();

