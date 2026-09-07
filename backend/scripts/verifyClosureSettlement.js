// backend/scripts/verifyClosureSettlement.js
//
// Checks that a real DISCARD closure settlement is claimed correctly by the
// Investment card's closure-adjustment term, against a real database, without
// leaving a row behind.
//
//   node scripts/verifyClosureSettlement.js
//   node scripts/verifyClosureSettlement.js --residual -500 --zone UTC
//
// Options:
//   --residual <number>  the balance the closing account is left holding.
//                        Defaults to 1234.56. Try a negative value too: the
//                        settlement's direction flips and the source and
//                        destination swap with it.
//   --zone <IANA zone>   the account owner's zone, as the card receives it.
//                        Defaults to America/Caracas.
//
// Run it from `backend/`, not from the repository root: the database
// configuration calls dotenv.config(), which reads .env relative to the working
// directory and throws "Missing DATABASE_URI" from anywhere else.
//
// WHY THIS IS A SCRIPT AND NOT A UNIT TEST
//
// Nothing here is worth asserting against a fake. The subject is the agreement
// between three things that live apart and can drift without anyone noticing:
// the writer's constants, the catalog rows a migration inserted, and a SQL
// predicate in a module owned by someone else. A test with a stub database
// proves the writer builds the object it was written to build, which was never
// in doubt.
//
// WHY IT WRITES AND ROLLS BACK RATHER THAN READING
//
// The closure term reads rows that no code path has ever produced on a
// development database, so reading proves nothing: it returns whatever
// annulment content the term already admits. The only way to learn what a
// settlement does to a published figure is to write one and look, so this opens
// a transaction, calls the real writer, measures, and rolls back. It asserts
// afterwards that the closure row count is what it was.
//
// WHY THE ASSERTIONS ARE ON THE DELTA
//
// The closure term reads non-zero on any database with deletion history, before
// anything here runs. That is the field working as specified, not noise in it:
// it is defined as what account deletions moved on these accounts, and a
// closure recorded before the closure movement type existed is a
// profit-and-loss row carrying the annulment prefix. Its predicate admits both
// deliberately, and those rows do not migrate. So every assertion below
// compares the MOVE and never the value, and the baseline is printed rather
// than assumed to be zero.
//
// WHAT A HAND-BUILT ROW COULD NOT HAVE TESTED
//
// The writer emits a PAIR: the target leg on the account being closed and the
// counterpart on the boundary account. Both carry the closure movement type,
// and only the target leg is inside an investment account set, because the
// boundary account is excluded from every overview set. So the term must move
// by the NEGATION of the residual. A move of zero would mean both legs were
// counted and the boundary exclusion failed - which is why that case is its own
// failing assertion rather than an inference from the first one.

import { pool } from '../src/db/config/configDB.js';
import { getInvestmentFigures } from '../src/fintrack_api/services/overview_services/db/overviewInvestmentRepository.js';
import { recordClosureSettlement } from '../src/utils/fintrackUtils/accountDeletionUtils/recordClosureSettlement.js';
import { checkAndInsertAccount } from '../src/utils/fintrackUtils/accountManagement/checkAndInsertAccount.js';
import { getCurrencyCode } from '../src/utils/currencyLookup.js';
import {
 loadCurrencyCatalog,
 getCurrencyIdSync,
} from '../src/fintrack_api/services/fx_services/currency_catalog/loadCurrencyCatalog.js';
import { ACCOUNTING_CURRENCY_CODE } from '../src/fintrack_api/config/fintrackConfig.js';
import {
 ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID,
 ACCOUNT_CLOSURE_TRANSACTION_TYPE_ID,
} from '../src/utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

const readOption = (flag, fallback) => {
 const index = process.argv.indexOf(flag);
 return index === -1 || index === process.argv.length - 1
  ? fallback
  : process.argv[index + 1];
};

const RESIDUAL = Number(readOption('--residual', 1234.56));
const TIME_ZONE = readOption('--zone', 'America/Caracas');

if (!Number.isFinite(RESIDUAL) || RESIDUAL === 0) {
 console.error('--residual must be a nonzero number');
 process.exit(1);
}

// The target leg is the exact negation of the residual: a positive balance is
// discarded, a negative one is forgiven.
const EXPECTED_TARGET_LEG = -RESIDUAL;

const near = (a, b) => Math.abs(a - b) < 0.005;
const money = (n) => Number(n.toFixed(2));

const client = await pool.connect();
let rolledBack = false;

try {
 // The writer resolves the FX target currency through getCurrencyIdSync, which
 // THROWS when the catalog has never been loaded. The server loads it at boot;
 // a script has to load it itself.
 await loadCurrencyCatalog(client);
 const accountingCurrencyId = getCurrencyIdSync(ACCOUNTING_CURRENCY_CODE);
 console.log(
  `accounting currency: ${ACCOUNTING_CURRENCY_CODE} = id ${accountingCurrencyId}`,
 );

 const accounts = await client.query(`
   SELECT ua.account_id, ua.user_id, ua.currency_id, ua.account_name
   FROM user_accounts ua
   JOIN account_types at2 ON at2.account_type_id = ua.account_type_id
   WHERE at2.account_type_name = 'investment'
   ORDER BY ua.account_id
 `);
 if (accounts.rows.length === 0) {
  throw new Error('no investment accounts on this database');
 }
 const accountIds = accounts.rows.map((r) => r.account_id);
 const target = accounts.rows[0];
 console.log(`investment accounts: ${accountIds.join(', ')}`);
 console.log(
  `settlement will close account ${target.account_id} ("${target.account_name}") with a residual of ${RESIDUAL}`,
 );

 const types = await client.query(`
   SELECT
     (SELECT movement_type_id FROM movement_types
       WHERE movement_type_name = 'account-closure') AS movement_id,
     (SELECT transaction_type_id FROM transaction_types
       WHERE transaction_type_name = 'account-closure') AS transaction_id
 `);
 const { movement_id, transaction_id } = types.rows[0];
 if (movement_id === null || transaction_id === null) {
  throw new Error(
   'the account-closure catalog rows are absent from this database - migration 032 has not been applied',
  );
 }
 console.log(
  `the account-closure movement type is id ${movement_id}, its transaction type id ${transaction_id}`,
 );

 // Refused before the write rather than reported after it. A settlement stamped
 // with an id the catalog assigned to something else is MISFILED, not
 // wrong-valued: every figure still adds up, and the rows are in the wrong
 // population with nothing to say so.
 if (
  movement_id !== ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID ||
  transaction_id !== ACCOUNT_CLOSURE_TRANSACTION_TYPE_ID
 ) {
  throw new Error(
   `the catalog and the writer disagree: catalog says ${movement_id}/${transaction_id}, ` +
    `the constants say ${ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID}/${ACCOUNT_CLOSURE_TRANSACTION_TYPE_ID}`,
  );
 }

 await client.query('BEGIN');

 const before = await client.query(
  `SELECT COUNT(*) AS n FROM transactions WHERE movement_type_id = $1`,
  [movement_id],
 );
 console.log(`closure rows before the write: ${before.rows[0].n}`);

 const baseline = await getInvestmentFigures(client, accountIds, TIME_ZONE);
 console.log(
  `baseline closure term: ${baseline.closureAdjustment}` +
   (near(baseline.closureAdjustment, 0)
    ? ' (zero on this database)'
    : ' - not zero; deletion history the term is defined to hold, not noise'),
 );

 // The boundary account, resolved the way the deletion service resolves it.
 // Created here if the user has none; rolled back either way.
 const boundaryInfo = await checkAndInsertAccount(client, target.user_id);
 const boundaryAccountId = boundaryInfo.account.account_id;
 console.log(
  `boundary account ${boundaryAccountId} (${boundaryInfo.exists ? 'existing' : 'created in this transaction'}), ` +
   `${accountIds.includes(boundaryAccountId) ? 'INSIDE' : 'outside'} the investment set`,
 );

 const currencyCode = await getCurrencyCode(client, target.currency_id);

 const written = await recordClosureSettlement(client, {
  userId: target.user_id,
  targetAccountId: target.account_id,
  targetAccountName: target.account_name,
  boundaryAccountId,
  residual: RESIDUAL,
  currencyId: target.currency_id,
  currencyCode,
  transactionDate: new Date(),
 });

 const after = await getInvestmentFigures(client, accountIds, TIME_ZONE);

 // Exhaustiveness control: the same rows the card partitions, summed without
 // any predicate. The two terms have to account for all of it.
 const control = await client.query(
  `SELECT COALESCE(SUM(t.amount), 0)::float AS admitted
     FROM transactions t
    WHERE t.account_id = ANY($1::int[])
      AND t.movement_type_id IN ($2, 9)`,
  [accountIds, movement_id],
 );
 const admitted = money(control.rows[0].admitted);

 // The predicate as it stood before the closure term existed: two sums over
 // profit-and-loss rows alone, split by the annulment prefix. Kept so a revert
 // of either half fails here instead of passing quietly.
 const old = await client.query(
  `SELECT
     COALESCE(SUM(t.amount) FILTER (
       WHERE t.description IS NULL OR t.description NOT LIKE 'ANNULMENT%'), 0)::float AS realised_old,
     COALESCE(SUM(t.amount) FILTER (
       WHERE t.description LIKE 'ANNULMENT%'), 0)::float AS closure_old
     FROM transactions t
    WHERE t.account_id = ANY($1::int[])
      AND t.movement_type_id = 9`,
  [accountIds],
 );

 // Both legs as they were actually persisted, FX columns included.
 const legs = await client.query(
  `SELECT transaction_id, account_id, amount::float, movement_type_id,
          transaction_type_id, currency_id, original_amount::float,
          original_currency_id, exchange_rate::float, exchange_rate_source,
          exchange_rate_target_currency_id, description
     FROM transactions
    WHERE transaction_id = ANY($1::int[])
    ORDER BY account_id`,
  [written.map((r) => r.transaction_id)],
 );

 const results = [];
 const check = (label, ok, detail) => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
 };

 console.log('');
 console.log('with one real settlement pair present, uncommitted:');

 check(
  'the realised term does not move',
  near(after.realizedPnl, baseline.realizedPnl),
  `${baseline.realizedPnl} -> ${after.realizedPnl}`,
 );
 check(
  'the closure term moves by the negation of the residual',
  near(after.closureAdjustment, baseline.closureAdjustment + EXPECTED_TARGET_LEG),
  `${baseline.closureAdjustment} -> ${after.closureAdjustment}, expected move ${EXPECTED_TARGET_LEG}`,
 );
 check(
  'the counterpart leg is not counted: a move of zero would mean it leaked in',
  !near(after.closureAdjustment, baseline.closureAdjustment),
  `moved by ${money(after.closureAdjustment - baseline.closureAdjustment)}`,
 );
 check(
  'the balance moves by the same amount, so the money is real',
  near(after.ledgerBalance, baseline.ledgerBalance + EXPECTED_TARGET_LEG),
  `${baseline.ledgerBalance} -> ${after.ledgerBalance}`,
 );
 check(
  'the identity closes',
  near(
   after.capitalContributed + after.realizedPnl + after.closureAdjustment,
   after.ledgerBalance,
  ),
  `${money(after.capitalContributed + after.realizedPnl + after.closureAdjustment)} vs ${after.ledgerBalance}`,
 );
 check(
  'the partition is exhaustive with the settlement in it',
  near(after.realizedPnl + after.closureAdjustment, admitted),
  `${money(after.realizedPnl + after.closureAdjustment)} vs unfiltered ${admitted}`,
 );

 const oldIdentity =
  after.capitalContributed + old.rows[0].realised_old + old.rows[0].closure_old;
 check(
  'under the pre-change predicate the identity would break by the settlement',
  near(oldIdentity - after.ledgerBalance, -EXPECTED_TARGET_LEG),
  `off by ${money(oldIdentity - after.ledgerBalance)}, target leg was ${EXPECTED_TARGET_LEG}`,
 );

 console.log('');
 console.log('the pair the writer actually persisted:');

 check(
  'the writer emitted exactly two legs',
  legs.rows.length === 2,
  `${legs.rows.length} rows`,
 );
 check(
  'the pair is double entry: the two amounts sum to zero',
  near(
   legs.rows.reduce((sum, r) => sum + r.amount, 0),
   0,
  ),
  legs.rows.map((r) => `acct ${r.account_id}: ${r.amount}`).join(', '),
 );
 check(
  'both legs carry the closure movement type',
  legs.rows.every((r) => r.movement_type_id === movement_id),
  legs.rows.map((r) => r.movement_type_id).join(', '),
 );
 check(
  'both legs carry the closure transaction type, not deposit or withdraw',
  legs.rows.every((r) => r.transaction_type_id === transaction_id),
  legs.rows.map((r) => r.transaction_type_id).join(', '),
 );
 check(
  'exactly one leg is inside the investment set',
  legs.rows.filter((r) => accountIds.includes(r.account_id)).length === 1,
  legs.rows
   .map((r) => `${r.account_id}${accountIds.includes(r.account_id) ? ' in' : ' out'}`)
   .join(', '),
 );
 check(
  'neither leg carries the annulment prefix',
  legs.rows.every(
   (r) => !String(r.description).startsWith('RTA Annulment Target('),
  ),
  'a closure is a retirement, not a correction',
 );

 // FX provenance. Four of the six columns default to a value that happens to
 // be correct for an internal movement, so a row left to the defaults presents
 // as well formed and invites no second look. All six are asserted for that
 // reason, not only the two that were false.
 check(
  'no leg fell into the original-amount default of 0',
  legs.rows.every((r) => near(r.original_amount, r.amount)),
  legs.rows.map((r) => `${r.original_amount} vs ${r.amount}`).join(', '),
 );
 check(
  'no leg fell into the original-currency default of 1 by accident',
  legs.rows.every((r) => r.original_currency_id === r.currency_id),
  legs.rows.map((r) => `${r.original_currency_id} vs ${r.currency_id}`).join(', '),
 );
 check(
  'the rate and source are stated, not inherited',
  legs.rows.every(
   (r) => near(r.exchange_rate, 1.0) && r.exchange_rate_source === 'identity',
  ),
  legs.rows.map((r) => `${r.exchange_rate} ${r.exchange_rate_source}`).join(', '),
 );
 check(
  'the FX target is the configured accounting currency, not the column default',
  legs.rows.every(
   (r) => r.exchange_rate_target_currency_id === accountingCurrencyId,
  ),
  `${legs.rows.map((r) => r.exchange_rate_target_currency_id).join(', ')} vs ${accountingCurrencyId}`,
 );
 // Known and asserted rather than left implicit: both legs take currency_id
 // from the CLOSING account, and neither reads the compensation account's own.
 // Identical whenever both sit in the accounting currency; the assertion exists
 // so a database where they differ makes the disagreement visible.
 check(
  'both legs carry the closing account currency, by design',
  legs.rows.every((r) => r.currency_id === target.currency_id),
  `${legs.rows.map((r) => r.currency_id).join(', ')} vs closing account ${target.currency_id}`,
 );

 await client.query('ROLLBACK');
 rolledBack = true;

 const post = await client.query(
  `SELECT COUNT(*) AS n FROM transactions WHERE movement_type_id = $1`,
  [movement_id],
 );
 console.log('');
 console.log(`closure rows after the rollback: ${post.rows[0].n}`);

 const clean = post.rows[0].n === before.rows[0].n;
 console.log(
  clean
   ? 'nothing persisted: the row set is exactly what it was'
   : 'A ROW PERSISTED - investigate before doing anything else',
 );

 const allPassed = results.every(Boolean) && clean;
 console.log('');
 console.log(
  allPassed
   ? 'the writer emits a pair the closure term claims correctly, one leg only'
   : 'AT LEAST ONE ASSERTION FAILED',
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
   console.error('ROLLBACK FAILED - check the table for a stray closure row');
  }
 }
 client.release();
 await pool.end();
}
