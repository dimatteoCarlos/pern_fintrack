// backend/scripts/verifyStoredBalance.js
//
// Checks that user_accounts.account_balance still equals what the ledger
// produces for the same account, for every account of every owner.
//
//   node scripts/verifyStoredBalance.js
//   node scripts/verifyStoredBalance.js --all
//
// Options:
//   --all   list every account, not only the ones that disagree
//
// Run it from `backend/`, not from the repository root: the database
// configuration calls dotenv.config(), which reads .env relative to the working
// directory and throws "Missing DATABASE_URI" from anywhere else.
//
// WHY THIS EXISTS
//
// The developer ruled on 2026-09-07 that the column stays — no migration removes
// it — and that it must always hold what the ledger says. That turns the column
// from a value into a cache with an invariant, and an invariant nothing checks
// is a hope. Every write path re-derives the column today, so the reading should
// be clean; the point of the script is that it stays clean after the next write
// path is written, when nobody remembers this rule.
//
// It reads and writes nothing. It is not a test either: what it measures is the
// state of one database, not the behaviour of a function, and the same code can
// be correct while a database still carries values written before the derivation
// existed.
//
// WHY IT REFUSES TO RUN AGAINST PRODUCTION
//
// The standing instruction is that no agent session queries the production
// database. The guard is on the database NAME rather than on the connection
// string, so nothing secret is read, compared or printed.
//
// WHY THE ACCOUNT TYPE IS JOINED ON THE OUTSIDE
//
// user_accounts.account_type_id is declared ON DELETE SET NULL
// (002_accounts.sql, the user_accounts block), so an account can carry no type
// at all. An inner join would drop exactly that account from a check whose whole
// purpose is that no account escapes it. The type is printed for the reader's
// benefit; it is not part of the comparison.

// WHY IT COMPARES AS NUMERIC AND NOT AS FLOAT
//
// The column is DECIMAL(15,2). Asking for the derivation as FLOAT would let a
// float round trip invent a difference of a fraction of a cent, and the script
// would report a drift the ledger does not have. The pg driver hands NUMERIC
// over as a string, which is why both sides are compared in SQL and only the
// verdict comes back to JavaScript.

import { pool } from '../src/db/config/configDB.js';
import { derivedAccountBalanceSql } from '../src/utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

const DERIVED_BALANCE = derivedAccountBalanceSql('ua', 'NUMERIC');

const showAll = process.argv.includes('--all');

// A name that names production, however it is spelled in a given environment.
const PRODUCTION_NAME_PATTERN = /prod/i;

const COMPARISON_QUERY = `
  SELECT
    ua.account_id,
    ua.account_name,
    act.account_type_name,
    ua.account_balance::text AS stored,
    (${DERIVED_BALANCE})::text AS derived,
    (ua.account_balance = ${DERIVED_BALANCE}) AS agrees,
    ua.deleted_at IS NOT NULL AS is_deleted
  FROM user_accounts ua
  LEFT JOIN account_types act ON act.account_type_id = ua.account_type_id
  ORDER BY ua.account_id
`;

const main = async () => {
 const { rows: dbRows } = await pool.query('SELECT current_database() AS name');
 const databaseName = dbRows[0].name;

 if (PRODUCTION_NAME_PATTERN.test(databaseName)) {
  console.error(
   `Refusing to run: the connected database is named "${databaseName}", which reads as production.`,
  );
  console.error(
   'This check is read-only, but the instruction covers reads too. Point DATABASE_URI at a development database.',
  );
  process.exitCode = 2;
  return;
 }

 const { rows } = await pool.query(COMPARISON_QUERY);
 const drifted = rows.filter((row) => row.agrees === false);

 console.log(`database: ${databaseName}`);
 console.log(`accounts checked: ${rows.length}`);
 console.log(`accounts that disagree: ${drifted.length}`);

 const listed = showAll ? rows : drifted;

 for (const row of listed) {
  const mark = row.agrees === false ? 'KO' : 'OK';
  const state = row.is_deleted ? ' [deleted]' : '';
  // A dash, not the word null: the outer join admits an account whose type row
  // was deleted, and the absence is worth seeing rather than reading as a value.
  const typeName = row.account_type_name ?? '-';
  console.log(
   `${mark}  #${row.account_id}  ${row.account_name}  (${typeName})${state}`,
  );
  if (row.agrees === false) {
   console.log(`      stored  ${row.stored}`);
   console.log(`      ledger  ${row.derived}`);
  }
 }

 // A drift is a finding, not a crash: the caller decides what to do about it,
 // and a non-zero code lets a future pipeline decide without parsing this text.
 if (drifted.length > 0) {
  console.log('');
  console.log(
   'Each account above holds a stored balance its own rows do not produce.',
  );
  console.log(
   'setAccountBalanceFromLedger.js rewrites one account from its ledger; the write path that left it behind is what needs finding.',
  );
  process.exitCode = 1;
 }
};

main()
 .catch((error) => {
  console.error(error.message);
  process.exitCode = 2;
 })
 .finally(async () => {
  await pool.end();
 });
