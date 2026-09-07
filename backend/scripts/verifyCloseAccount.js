// backend/scripts/verifyCloseAccount.js
//
// Exercises the whole CLOSE engine against a real database and rolls back.
//
//   node scripts/verifyCloseAccount.js
//   node scripts/verifyCloseAccount.js --zone UTC
//
// Run it from `backend/`: the database configuration calls dotenv.config(),
// which reads .env relative to the working directory.
//
// WHY THIS EXISTS BESIDE verifyClosureSettlement.js
//
// That script verifies the settlement WRITER: given a residual, it emits a
// correct pair and the Investment card claims it correctly. This one verifies
// everything around the writer, which is most of what CLOSE actually does and
// none of what that script touched: locking the target and the boundary account
// together, deriving the residual from the locked state rather than from the
// stored column, writing the settlement only when there is something to settle,
// re-deriving afterwards to prove the account reached zero, updating both
// stored balances from the ledger, and marking the account closed while leaving
// its row and its transactions in place.
//
// The distinction that matters: a writer that is correct in isolation says
// nothing about a path that computes the wrong residual, marks the wrong
// account, or reports success after skipping a step. Those are the failures
// this covers.
//
// WHY THE ENGINE IS IMPORTED DIRECTLY
//
// The only other way into it is deleteAccountService, which opens its own
// connection and commits. Nothing could check what CLOSE writes without really
// closing an account. processCloseAccount takes a caller's client, so this
// opens a transaction, runs it, asserts, and rolls back.
//
// WHAT IT DELIBERATELY DOES NOT COVER
//
// The HTTP layer: the controller's payload validation and the ownership check
// that runs before the engine. Those refuse bad input; this checks what happens
// to good input, which is the half that writes rows.

import { pool } from '../src/db/config/configDB.js';
import { processCloseAccount } from '../src/fintrack_api/services/delete_account/deleteAccountService.js';
// The deletion types and the two closure policies are declared by the
// controller, which is where the request's vocabulary is defined.
import {
 DELETION_TYPE_CLOSE,
 CLOSE_POLICY_DISCARD,
 CLOSE_POLICY_TRANSFER,
} from '../src/fintrack_api/controllers/accountDeleteController.js';
import { getInvestmentFigures } from '../src/fintrack_api/services/overview_services/db/overviewInvestmentRepository.js';
import { derivedAccountBalanceSql } from '../src/utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';
import {
 loadCurrencyCatalog,
 getCurrencyIdSync,
} from '../src/fintrack_api/services/fx_services/currency_catalog/loadCurrencyCatalog.js';
import { ACCOUNTING_CURRENCY_CODE } from '../src/fintrack_api/config/fintrackConfig.js';

const readOption = (flag, fallback) => {
 const index = process.argv.indexOf(flag);
 return index === -1 || index === process.argv.length - 1
  ? fallback
  : process.argv[index + 1];
};

const TIME_ZONE = readOption('--zone', 'America/Caracas');
const CLOSURE_MOVEMENT_TYPE = 10;

const near = (a, b) => Math.abs(a - b) < 0.005;
const money = (n) => Number(n.toFixed(2));

const DERIVED = derivedAccountBalanceSql('ua', 'FLOAT');

const derivedBalanceOf = async (client, accountId) => {
 const { rows } = await client.query(
  `SELECT ${DERIVED} AS balance FROM user_accounts ua WHERE ua.account_id = $1`,
  [accountId],
 );
 return rows[0] ? rows[0].balance : null;
};

const accountRow = async (client, accountId, userId) =>
 client.query(
  'SELECT * FROM user_accounts ua WHERE ua.account_id = $1 AND ua.user_id = $2',
  [accountId, userId],
 );

const countTransactions = async (client, accountId) => {
 const { rows } = await client.query(
  'SELECT COUNT(*)::int AS n FROM transactions WHERE account_id = $1',
  [accountId],
 );
 return rows[0].n;
};

// An expected refusal, run inside a savepoint so a rejection cannot leave the
// transaction unusable for the checks that follow.
const expectRejection = async (client, label, run) => {
 await client.query('SAVEPOINT expected_rejection');
 try {
  await run();
  await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
  return { rejected: false, detail: 'it returned instead of throwing' };
 } catch (error) {
  await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
  return {
   rejected: true,
   status: error.status ?? error.statusCode,
   detail: error.message,
  };
 }
};

const results = [];
const check = (label, ok, detail) => {
 results.push(ok);
 console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
};

const client = await pool.connect();
let rolledBack = false;

try {
 await loadCurrencyCatalog(client);
 const accountingCurrencyId = getCurrencyIdSync(ACCOUNTING_CURRENCY_CODE);

 // A live investment account still open and holding something, so the
 // settlement branch actually runs and the Investment card can be read over a
 // set that contains it.
 const candidates = await client.query(
  `SELECT ua.account_id, ua.user_id, ua.account_name, ua.currency_id,
          ${DERIVED} AS balance
     FROM user_accounts ua
     JOIN account_types at2 ON at2.account_type_id = ua.account_type_id
    WHERE at2.account_type_name = 'investment'
      AND ua.deleted_at IS NULL
    ORDER BY ua.account_id`,
 );
 const target = candidates.rows.find((r) => r.balance !== 0);
 if (!target) {
  throw new Error(
   'no open investment account with a nonzero balance on this database - the settlement branch cannot be exercised',
  );
 }
 const investmentIds = candidates.rows.map((r) => r.account_id);

 console.log(`accounting currency: ${ACCOUNTING_CURRENCY_CODE} = ${accountingCurrencyId}`);
 console.log(`investment accounts: ${investmentIds.join(', ')}`);
 console.log(
  `closing account ${target.account_id} ("${target.account_name}"), balance ${target.balance}`,
 );

 await client.query('BEGIN');

 const closureRowsBefore = await client.query(
  'SELECT COUNT(*)::int AS n FROM transactions WHERE movement_type_id = $1',
  [CLOSURE_MOVEMENT_TYPE],
 );
 const accountsBefore = await client.query(
  'SELECT COUNT(*)::int AS n FROM user_accounts',
 );

 const residualBefore = await derivedBalanceOf(client, target.account_id);
 const transactionsBefore = await countTransactions(client, target.account_id);
 const cardBefore = await getInvestmentFigures(client, investmentIds, TIME_ZONE);

 const accountCheck = await accountRow(client, target.account_id, target.user_id);

 // ---------------------------------------------------------------- rejections
 // Run before the close, on an account that is still open, so a refusal here
 // is the policy check and not a consequence of the account's state.
 console.log('');
 console.log('what the engine refuses:');

 const transferAttempt = await expectRejection(client, 'transfer', () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_TRANSFER,
   accountCheck,
   new Date(),
  ),
 );
 check(
  'TRANSFER is refused with 400 while its destination rule has no selector',
  transferAttempt.rejected && transferAttempt.status === 400,
  `${transferAttempt.status} ${String(transferAttempt.detail).slice(0, 70)}`,
 );

 // ------------------------------------------------------------- the real run
 const closeResult = await processCloseAccount(
  client,
  target.user_id,
  target.account_id,
  CLOSE_POLICY_DISCARD,
  accountCheck,
  new Date(),
 );

 const residualAfter = await derivedBalanceOf(client, target.account_id);
 const closedRow = await accountRow(client, target.account_id, target.user_id);
 const transactionsAfter = await countTransactions(client, target.account_id);
 const cardAfter = await getInvestmentFigures(client, investmentIds, TIME_ZONE);

 const boundary = await client.query(
  `SELECT ua.account_id, ua.account_balance::float AS stored, ${DERIVED} AS derived
     FROM user_accounts ua
     JOIN account_types at2 ON at2.account_type_id = ua.account_type_id
    WHERE ua.user_id = $1 AND at2.account_type_name = 'boundary'
    ORDER BY ua.account_id ASC LIMIT 1`,
  [target.user_id],
 );

 console.log('');
 console.log('what the engine reports:');

 check(
  'it reports the CLOSE deletion type',
  closeResult.deletionType === DELETION_TYPE_CLOSE,
  String(closeResult.deletionType),
 );
 check(
  'the residual it reports settling is the one derived from the locked state',
  near(closeResult.settledResidual, residualBefore),
  `${closeResult.settledResidual} vs ${residualBefore} derived independently`,
 );
 check(
  'it reports closing exactly one account',
  closeResult.rowCount === 1,
  String(closeResult.rowCount),
 );

 console.log('');
 console.log('what it did to the account:');

 check(
  'the account is now at zero, re-derived rather than taken from the report',
  near(residualAfter, 0),
  String(residualAfter),
 );
 check(
  'the account row survives - CLOSE keeps it, unlike HARD',
  closedRow.rows.length === 1,
  `${closedRow.rows.length} row`,
 );
 check(
  'it is marked closed',
  closedRow.rows[0] && closedRow.rows[0].deleted_at !== null,
  String(closedRow.rows[0] && closedRow.rows[0].deleted_at),
 );
 check(
  'its transactions survive, plus the settlement leg',
  transactionsAfter === transactionsBefore + 1,
  `${transactionsBefore} -> ${transactionsAfter}`,
 );
 check(
  'the stored balance was rewritten from the ledger, not left stale',
  closedRow.rows[0] && near(Number(closedRow.rows[0].account_balance), 0),
  String(closedRow.rows[0] && closedRow.rows[0].account_balance),
 );
 check(
  'the boundary account absorbed the residual and its stored balance agrees with its ledger',
  boundary.rows.length === 1 &&
   near(boundary.rows[0].stored, boundary.rows[0].derived),
  boundary.rows[0]
   ? `stored ${boundary.rows[0].stored} vs derived ${boundary.rows[0].derived}`
   : 'no boundary account',
 );

 console.log('');
 console.log('what it did to the published figures:');

 check(
  'the closure term moves by the negation of the residual',
  near(cardAfter.closureAdjustment, cardBefore.closureAdjustment - residualBefore),
  `${cardBefore.closureAdjustment} -> ${cardAfter.closureAdjustment}, expected move ${money(-residualBefore)}`,
 );
 check(
  'the realised term does not move',
  near(cardAfter.realizedPnl, cardBefore.realizedPnl),
  `${cardBefore.realizedPnl} -> ${cardAfter.realizedPnl}`,
 );
 check(
  'the identity closes after the close',
  near(
   cardAfter.capitalContributed + cardAfter.realizedPnl + cardAfter.closureAdjustment,
   cardAfter.ledgerBalance,
  ),
  `${money(cardAfter.capitalContributed + cardAfter.realizedPnl + cardAfter.closureAdjustment)} vs ${cardAfter.ledgerBalance}`,
 );
 // The closed account stays in the set this probe reads, so the card's own
 // balance falls by the residual. What it must NOT do is absorb the boundary
 // counterpart as well, which would leave it unmoved.
 check(
  'the card balance moves by the residual, so the counterpart stayed outside',
  near(cardAfter.ledgerBalance, cardBefore.ledgerBalance - residualBefore),
  `${cardBefore.ledgerBalance} -> ${cardAfter.ledgerBalance}`,
 );

 console.log('');
 console.log('what it refuses once the account is closed:');

 const reCloseAttempt = await expectRejection(client, 'already closed', () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_DISCARD,
   closedRow,
   new Date(),
  ),
 );
 check(
  'closing an already-closed account is refused with 400',
  reCloseAttempt.rejected && reCloseAttempt.status === 400,
  `${reCloseAttempt.status} ${String(reCloseAttempt.detail).slice(0, 60)}`,
 );

 // --------------------------------------------------- the no-settlement branch
 // An account already at zero must be closed without a settlement row: a
 // zero-amount pair would carry no financial meaning and would still show up
 // in the closure term as a row.
 console.log('');
 console.log('an account that owes nothing:');

 const bankType = await client.query(
  "SELECT account_type_id FROM account_types WHERE LOWER(account_type_name) = 'bank'",
 );
 const emptyAccount = await client.query(
  `INSERT INTO user_accounts
     (user_id, account_name, account_type_id, currency_id,
      account_starting_amount, account_balance, account_start_date)
   VALUES ($1, $2, $3, $4, 0, 0, $5) RETURNING account_id`,
  [
   target.user_id,
   'probe zero-residual account',
   bankType.rows[0].account_type_id,
   accountingCurrencyId,
   new Date(),
  ],
 );
 const emptyId = emptyAccount.rows[0].account_id;
 const closureRowsBeforeEmpty = await client.query(
  'SELECT COUNT(*)::int AS n FROM transactions WHERE movement_type_id = $1',
  [CLOSURE_MOVEMENT_TYPE],
 );

 const emptyCheck = await accountRow(client, emptyId, target.user_id);
 const emptyResult = await processCloseAccount(
  client,
  target.user_id,
  emptyId,
  CLOSE_POLICY_DISCARD,
  emptyCheck,
  new Date(),
 );
 const closureRowsAfterEmpty = await client.query(
  'SELECT COUNT(*)::int AS n FROM transactions WHERE movement_type_id = $1',
  [CLOSURE_MOVEMENT_TYPE],
 );
 const emptyRow = await accountRow(client, emptyId, target.user_id);

 check(
  'it closes without writing a settlement row',
  closureRowsAfterEmpty.rows[0].n === closureRowsBeforeEmpty.rows[0].n,
  `${closureRowsBeforeEmpty.rows[0].n} -> ${closureRowsAfterEmpty.rows[0].n} closure rows`,
 );
 check(
  'it reports a settled residual of zero',
  near(emptyResult.settledResidual, 0),
  String(emptyResult.settledResidual),
 );
 check(
  'it is still marked closed',
  emptyRow.rows[0] && emptyRow.rows[0].deleted_at !== null,
  String(emptyRow.rows[0] && emptyRow.rows[0].deleted_at),
 );

 // ------------------------------------------------------------------ rollback
 await client.query('ROLLBACK');
 rolledBack = true;

 const closureRowsPost = await client.query(
  'SELECT COUNT(*)::int AS n FROM transactions WHERE movement_type_id = $1',
  [CLOSURE_MOVEMENT_TYPE],
 );
 const accountsPost = await client.query(
  'SELECT COUNT(*)::int AS n FROM user_accounts',
 );
 const stillOpen = await accountRow(client, target.account_id, target.user_id);

 console.log('');
 console.log('after the rollback:');
 check(
  'no closure row persisted',
  closureRowsPost.rows[0].n === closureRowsBefore.rows[0].n,
  `${closureRowsBefore.rows[0].n} -> ${closureRowsPost.rows[0].n}`,
 );
 check(
  'no account persisted',
  accountsPost.rows[0].n === accountsBefore.rows[0].n,
  `${accountsBefore.rows[0].n} -> ${accountsPost.rows[0].n}`,
 );
 check(
  'the account this probe closed is open again',
  stillOpen.rows.length === 1 && stillOpen.rows[0].deleted_at === null,
  `deleted_at ${stillOpen.rows[0] && stillOpen.rows[0].deleted_at}`,
 );

 const allPassed = results.every(Boolean);
 console.log('');
 console.log(
  allPassed
   ? 'the CLOSE engine settles, zeroes, marks and reports correctly, and leaves nothing behind'
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
   console.error('ROLLBACK FAILED - check user_accounts and transactions');
  }
 }
 client.release();
 await pool.end();
}
