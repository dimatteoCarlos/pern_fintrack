// backend/scripts/verifyRelatedAccounts.js
//
// Exercises the close screen's related-accounts read against a real database
// inside one transaction, and rolls it back. Nothing it writes survives.
//
//   node scripts/verifyRelatedAccounts.js
//   node scripts/verifyRelatedAccounts.js --expect fintrack_dev
//
// WHY IT EXISTS. getRelatedAccounts is what the owner reads before deciding
// whether to close an account, and until now nothing exercised it: verifyClose
// drives the engine, which never calls this query. The figures it publishes -
// how many times two accounts met, what they moved net, and now which movement
// types those meetings were - are read as facts about the owner's own history,
// so a wrong one is not a cosmetic defect.
//
// IT MAKES ITS OWN SUBJECT. Three accounts fabricated inside the transaction,
// with movements written by hand, so every assertion below has a known answer
// that does not depend on what the database happens to hold. A probe that
// reads whatever is there can only report; this one can fail.
//
// IT REFUSES TO RUN ANYWHERE BUT A NAMED LOCAL DATABASE, on the same three
// arms verifyClose.js uses: the database is the one named with --expect, the
// server is on a loopback address, and the connection is not encrypted.
//
// Run it from `backend/`: the database configuration calls dotenv.config(),
// which reads .env relative to the working directory.

import { pool } from '../src/db/config/configDB.js';
import { getRelatedAccounts } from '../src/fintrack_api/services/delete_account/getRelatedAccounts.js';

const readOption = (flag, fallback) => {
 const index = process.argv.indexOf(flag);
 return index === -1 || index === process.argv.length - 1
  ? fallback
  : process.argv[index + 1];
};

const EXPECTED_DATABASE = readOption('--expect', 'fintrack_dev');
const LOOPBACK = new Set(['127.0.0.1', '::1', '0.0.0.0']);

const results = [];
const check = (label, passed, detail = '') => {
 results.push(passed);
 console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const assertLocalDatabase = async (target) => {
 const { rows } = await target.query(
  `SELECT current_database() AS db_name,
          COALESCE(host(inet_server_addr()), 'unix-socket') AS server_address,
          COALESCE(
            (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()),
            false
          ) AS encrypted`,
 );
 const { db_name, server_address, encrypted } = rows[0];

 const refusals = [];
 if (db_name !== EXPECTED_DATABASE) {
  refusals.push(`connected to "${db_name}", expected "${EXPECTED_DATABASE}"`);
 }
 if (server_address !== 'unix-socket' && !LOOPBACK.has(server_address)) {
  refusals.push(`the server is at ${server_address}, which is not local`);
 }
 if (encrypted) {
  refusals.push('the connection is encrypted, which a local server does not require');
 }

 if (refusals.length > 0) {
  throw new Error(`refusing to run: ${refusals.join('; ')}. Nothing was written.`);
 }

 console.log(`Database: ${db_name} at ${server_address}, unencrypted. Proceeding.`);
};

const client = await pool.connect();
let rolledBack = false;

try {
 await assertLocalDatabase(client);

 await client.query('BEGIN');

 const { rows: owners } = await client.query(
  `SELECT user_id FROM user_accounts GROUP BY user_id
    ORDER BY COUNT(*) DESC LIMIT 1`,
 );
 if (owners.length === 0) {
  throw new Error('no user owns an account on this database. Nothing to probe.');
 }
 const userId = owners[0].user_id;

 const { rows: currencies } = await client.query(
  'SELECT MIN(currency_id) AS currency_id FROM currencies',
 );
 const currencyId = currencies[0].currency_id;

 // ------------------------------------------------------------------ subject
 //
 // A target and two counterparties. The names carry the script's own name so a
 // row that somehow outlives the rollback is identifiable on sight.
 const makeAccount = async (name, typeName) => {
  const { rows } = await client.query(
   `INSERT INTO user_accounts(
      user_id, account_name, account_type_id, currency_id,
      account_starting_amount, account_balance, account_start_date, updated_at
    )
    SELECT $1, $2,
           (SELECT account_type_id FROM account_types
             WHERE account_type_name = $3),
           $4, 0, 0, CURRENT_DATE, NOW()
    RETURNING account_id`,
   [userId, name, typeName, currencyId],
  );
  return rows[0].account_id;
 };

 const targetId = await makeAccount('verifyRelatedAccounts.js target', 'bank');
 const shopId = await makeAccount('verifyRelatedAccounts.js shop', 'category_budget');
 const fundId = await makeAccount('verifyRelatedAccounts.js fund', 'investment');

 // A movement recorded against the target, naming a counterparty on the other
 // side. account_id is always the target: the shared CTE reads only the
 // target's own signed rows, so a row owned by the counterparty is invisible
 // to this query by construction.
 const record = async (movementTypeName, amount, counterpartyId, options = {}) => {
  const { sourceIsTarget = true, status = 'complete' } = options;

  await client.query(
   `INSERT INTO transactions(
      user_id, description, amount, movement_type_id, transaction_type_id,
      currency_id, account_id, source_account_id, destination_account_id,
      status, transaction_actual_date
    )
    SELECT $1, 'verifyRelatedAccounts.js probe', $2,
           (SELECT movement_type_id FROM movement_types
             WHERE movement_type_name = $3),
           (SELECT MIN(transaction_type_id) FROM transaction_types),
           $4, $5, $6, $7, $8, NOW()`,
   [
    userId,
    amount,
    movementTypeName,
    currencyId,
    targetId,
    sourceIsTarget ? targetId : counterpartyId,
    sourceIsTarget ? counterpartyId : targetId,
    status,
   ],
  );
 };

 // The shop: two expenses and one transfer, so its breakdown has two entries
 // and they are not in alphabetical order.
 await record('expense', -5.62, shopId);
 await record('expense', -4.38, shopId);
 await record('transfer', -1.0, shopId);

 // The fund: one movement, so its breakdown has one entry and the cell says
 // the movement without repeating the count.
 await record('investment', -25.0, fundId);

 // NEITHER OF THESE MAY REACH THE LIST. The first is the target's own opening
 // row, which names no counterparty on either side; the second is incomplete,
 // and the CTE filters status='complete'.
 await client.query(
  `INSERT INTO transactions(
     user_id, description, amount, movement_type_id, transaction_type_id,
     currency_id, account_id, opening_for_account_id, status
   )
   SELECT $1, 'verifyRelatedAccounts.js opening', 100,
          (SELECT movement_type_id FROM movement_types
            WHERE movement_type_name = 'account-opening'),
          (SELECT MIN(transaction_type_id) FROM transaction_types),
          $2, $3, $3, 'complete'`,
  [userId, currencyId, targetId],
 );
 await record('expense', -99.0, shopId, { status: 'pending' });

 // ------------------------------------------------------------------ reading
 const related = await getRelatedAccounts(client, userId, targetId);
 const byId = new Map(related.map((row) => [row.accountId, row]));
 const shop = byId.get(shopId);
 const fund = byId.get(fundId);

 check(
  'both counterparties appear, and nothing else the target wrote',
  related.length === 2 && shop !== undefined && fund !== undefined,
  `${related.length} row(s)`,
 );

 check(
  'the busiest counterparty leads the list',
  related[0]?.accountId === shopId,
  `first row is account ${related[0]?.accountId}`,
 );

 check(
  'the interaction count excludes the incomplete row',
  shop?.interactionCount === 3,
  `counted ${shop?.interactionCount}`,
 );

 check(
  'the net amount is the target\'s own signed sum',
  Math.abs((shop?.netAmount ?? 0) - -11.0) < 0.005,
  `net ${shop?.netAmount}`,
 );

 // THE BREAKDOWN IS THE SAME ROWS, GROUPED DEEPER. If this ever stops holding,
 // the cell shows a total that its own parts contradict.
 const breakdownTotal = (row) =>
  (row?.movementBreakdown ?? []).reduce((sum, entry) => sum + entry.count, 0);

 check(
  'the breakdown counts sum to the interaction count',
  breakdownTotal(shop) === shop?.interactionCount &&
   breakdownTotal(fund) === fund?.interactionCount,
  `${breakdownTotal(shop)} of ${shop?.interactionCount}, ${breakdownTotal(fund)} of ${fund?.interactionCount}`,
 );

 check(
  'the breakdown names the movement types the rows carry',
  JSON.stringify(shop?.movementBreakdown) ===
   JSON.stringify([
    { movementTypeName: 'expense', count: 2 },
    { movementTypeName: 'transfer', count: 1 },
   ]),
  JSON.stringify(shop?.movementBreakdown),
 );

 check(
  'the most frequent movement type comes first',
  shop?.movementBreakdown?.[0]?.movementTypeName === 'expense',
  `first entry ${shop?.movementBreakdown?.[0]?.movementTypeName}`,
 );

 check(
  'a single-movement counterparty carries one entry',
  fund?.movementBreakdown?.length === 1 &&
   fund.movementBreakdown[0].movementTypeName === 'investment' &&
   fund.movementBreakdown[0].count === 1,
  JSON.stringify(fund?.movementBreakdown),
 );

 // The catalog name, not a label. The dictionary does the naming in the
 // browser, and a server that pre-translated would make the language a
 // property of the response.
 check(
  'the names come back as the catalog holds them',
  related.every((row) =>
   row.movementBreakdown.every(
    (entry) => typeof entry.movementTypeName === 'string' &&
     entry.movementTypeName === entry.movementTypeName.toLowerCase(),
   ),
  ),
 );

 await client.query('ROLLBACK');
 rolledBack = true;
 console.log('rolled back: nothing this run wrote survives');

 const allPassed = results.every(Boolean);
 console.log(
  `\n${
   allPassed
    ? 'The related-accounts list counts, nets and names what the target actually did'
    : 'AT LEAST ONE ASSERTION FAILED'
  }`,
 );
 process.exitCode = allPassed ? 0 : 1;
} catch (error) {
 console.error(`verification failed: ${error.message}`);
 console.error(error.stack);
 process.exitCode = 1;
} finally {
 if (!rolledBack) {
  try {
   await client.query('ROLLBACK');
   console.log('rolled back on the way out');
  } catch {
   console.error('ROLLBACK FAILED - check user_accounts for probe rows');
  }
 }
 client.release();
 await pool.end();
}
