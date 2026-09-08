// backend/src/db/migrations/runAlignment.js
/**
 * Runner for supabase/001_production_alignment.sql.
 *
 * It exists because that file had none. Measured 2026-09-08: nothing under
 * backend/src or backend/scripts read its path, executed it, or wrote the
 * ledger row 'supabase/001_production_alignment.sql' that fintrack_prod_rehearsal
 * carries. The file was applied to Supabase on 2026-08-22 by hand and its
 * ledger row was typed by hand, which meant the one step every future
 * production-shaped database needs was the one step the repository could not
 * perform or check.
 *
 * WHAT IT DOES NOT DO. It does not decide when the alignment runs and it does
 * not reach production: NODE_ENV=production is refused outright, and the
 * destination has to be named in DB_EXPECTED and match what the connection
 * reports. Deciding that production is ready is Carlos's, and the migration
 * freeze stands until the deployment process is defined.
 *
 * WHY IT DOES NOT WRAP THE FILE IN A TRANSACTION. The file carries its own
 * BEGIN and COMMIT, unlike the chain migrations, and says so in its header:
 * "Nothing wraps it - runMigrations.js is not what executes it. Do not remove
 * them." A wrapper here would close the file's own transaction on its BEGIN.
 * A statement that fails inside it aborts that transaction, so the trailing
 * COMMIT rolls back and nothing partial survives.
 *
 * IT RUNS ONCE PER DATABASE AND REFUSES A SECOND TIME. The file calls itself
 * idempotent and is, until the chain runs on top of it: step 8 then points three
 * transactions foreign keys back at user_accounts and undoes part of 035 without
 * failing. See the refusal below for the measurement.
 *
 * WHY IT DOES NOT WRITE THE LEDGER ROW. Step 9 of the file writes it, together
 * with the sixteen chain rows the alignment makes true, inside the same
 * transaction as the schema it is claiming. A row written from here would be a
 * second writer for the same fact and could outlive a rollback.
 *
 * USAGE:
 *   DB_NAME=fintrack_prod_rehearsal DB_EXPECTED=fintrack_prod_rehearsal npm run db:align
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

const ALIGNMENT_FILE = path.join(
 process.cwd(),
 'src/db/migrations/supabase/001_production_alignment.sql',
);

const LEDGER_NAME = 'supabase/001_production_alignment.sql';

/**
 * The same override runMigrations honours, for the same reason: a rehearsal
 * copy lives on the same server under another name, and reaching it must not
 * mean editing DATABASE_URI.
 */
function resolveTarget() {
 const override = process.env.DB_NAME;

 if (!override) {
  return { pool: defaultPool, target: 'the database DATABASE_URI names' };
 }

 return { pool: new pg.Pool(getDbConfig()), target: override };
}

async function runAlignment() {
 // Two independent refusals, as in runMigrations. This one answers "is this
 // the production mode", which the freeze asks; assertExpectedDatabase below
 // answers "is this the database you meant", which the mode cannot answer.
 if (isProduction()) {
  console.error(
   pc.red('\n❌ The alignment is not allowed under NODE_ENV=production.\n') +
    pc.gray('   Production runs are frozen until the deployment process is defined.\n'),
  );
  process.exit(1);
 }

 if (!fs.existsSync(ALIGNMENT_FILE)) {
  console.error(pc.red(`\n❌ Not found: ${ALIGNMENT_FILE}\n`));
  process.exit(1);
 }

 const { pool, target } = resolveTarget();
 console.log(pc.cyan(`Alignment target: ${target}`));

 const client = await pool.connect();
 let exitCode = 0;

 try {
  await assertExpectedDatabase(client, 'db:align');

  // The file is idempotent by construction, so a second run is harmless. It is
  // still worth saying, because a database that already carries the row is not
  // the production-shaped copy this script is for. Read through to_regclass
  // first: a production-shaped copy has the table holding no rows, a database
  // the boot path built has no table at all, and the second must not read as a
  // failure before the file has done anything.
  const {
   rows: [{ already }],
  } = await client.query(
   "SELECT CASE WHEN to_regclass('public.migrations') IS NULL THEN NULL" +
    '  ELSE (SELECT max(executed_at) FROM migrations WHERE filename = $1)' +
    ' END AS already',
   [LEDGER_NAME],
  );

  // A REFUSAL RATHER THAN A WARNING, and the file's own header is why it has to
  // be. It claims "Idempotent throughout: every step is guarded, so re-running
  // changes nothing", and that holds only before the chain runs on top. Step 8
  // is an unconditional DROP CONSTRAINT followed by ADD CONSTRAINT pointing the
  // three transactions keys back at user_accounts. Measured 2026-09-08 on
  // fintrack_prod_rehearsal_full: a second run after 035 returned
  // transactions_account_id_fkey, transactions_source_account_id_fkey and
  // transactions_destination_account_id_fkey to user_accounts, undoing three of
  // the seven repoints and leaving the fourth, opening_for_account_id, on
  // account_registry. Nothing failed and nothing said so.
  //
  // The hazard is new. Until this runner existed the file could only be applied
  // by hand, and on the live database step 8 was added five days after the file
  // ran, so it never executed from here. A runner makes the second run easy, so
  // the runner is what has to refuse it.
  if (already) {
   console.error(
    pc.red('\n❌ Refusing: the alignment is already recorded here.\n') +
     pc.gray(`   Applied ${already.toISOString()}.\n`) +
     pc.gray('   Re-running is not safe once the chain has run on top: step 8 points\n') +
     pc.gray('   three transactions foreign keys back at user_accounts, undoing part\n') +
     pc.gray('   of 035 with no error.\n') +
     pc.gray('   To rehearse again, build a new database from the production dump.\n'),
   );
   client.release();
   await pool.end();
   process.exit(1);
  }

  console.log(pc.yellow(`\n▶ Running ${LEDGER_NAME}\n`));

  const sql = fs.readFileSync(ALIGNMENT_FILE, 'utf-8');
  await client.query(sql);

  const { rows: ledger } = await client.query(
   'SELECT count(*)::int AS rows FROM migrations',
  );

  console.log(
   pc.green('\n✅ Alignment applied.\n') +
    pc.gray(`   The ledger now holds ${ledger[0].rows} rows.\n`) +
    pc.gray('   013 is not among them, deliberately, so db:migrate runs it next.\n'),
  );
 } catch (error) {
  console.error(pc.red('\n❌ Alignment failed:'), error.message);
  console.error(
   pc.gray('   The file opens and closes its own transaction, so nothing partial survives.\n'),
  );
  exitCode = 1;
 } finally {
  client.release();
 }

 await pool.end();
 process.exit(exitCode);
}

runAlignment();
