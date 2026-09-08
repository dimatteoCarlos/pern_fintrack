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
// It also covers the contract between the close screen and the engine: the
// preview endpoint publishes a residual, the confirmation echoes it back, and
// the settlement refuses if it has moved. Those are two files computing what
// has to be the same number, and this is what checks that they agree - the
// preview's own value is what gets echoed here, unmodified.
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
import { getClosePreview } from '../src/fintrack_api/services/delete_account/getClosePreview.js';
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

// getInvestmentFigures gained a fourth parameter when feat/overview bound every
// figure on the card to a reference month. It has no default, and an omitted one
// reaches the query as NULL: the bounds CTE then yields NULL, every date
// comparison against it is NULL, and the card comes back all zeros instead of
// raising. That is why this is computed rather than left off - the two closure
// assertions below read 0 -> 0 and looked like a settlement that never happened.
//
// The month is derived in the same zone the query converts with. Derived in UTC
// it would name the previous month for the first hours of a month in a western
// zone, and the settlement this probe writes would land outside the window it
// then asks about.
const referenceMonthIn = (timeZone) => {
 const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
 }).formatToParts(new Date());
 const year = parts.find((part) => part.type === 'year').value;
 const month = parts.find((part) => part.type === 'month').value;
 return `${year}-${month}-01`;
};

const REFERENCE_MONTH = referenceMonthIn(TIME_ZONE);

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
 const cardBefore = await getInvestmentFigures(
  client,
  investmentIds,
  TIME_ZONE,
  REFERENCE_MONTH,
 );

 const accountCheck = await accountRow(client, target.account_id, target.user_id);

 // ---------------------------------------------------------------- rejections
 // Run before the close, on an account that is still open, so a refusal here
 // is the policy check and not a consequence of the account's state.
 console.log('');
 console.log('what the engine refuses:');

 // TRANSFER shipped 2026-09-07 and is no longer refused outright. What it still
 // refuses is a request that names no destination, which is what this call is:
 // the seventh argument is absent. The rest of that policy - the eligibility
 // rule and the settlement itself - is covered by verifyCloseTransfer.js.
 //
 // The eighth argument carries a correct residual on purpose. The engine parses
 // the echo before it looks at the destination, so a call missing both would be
 // refused for the echo and this assertion would pass while proving nothing
 // about destinations - two different refusals wearing the same status code.
 const transferAttempt = await expectRejection(client, 'transfer', () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_TRANSFER,
   accountCheck,
   new Date(),
   undefined,
   residualBefore,
  ),
 );
 check(
  'TRANSFER without a destination is refused with 400',
  transferAttempt.rejected && transferAttempt.status === 400,
  `${transferAttempt.status} ${String(transferAttempt.detail).slice(0, 70)}`,
 );

 // ------------------------------------------------------------- the echo
 // What the owner confirms is an amount, not an abstract operation, so the
 // amount travels back with the confirmation and the engine refuses if it no
 // longer describes the account (PLAN_ACCOUNT_DELETION.md §4.1 step 3).
 //
 // The two refusals are deliberately different codes. A request carrying no
 // amount at all is malformed - no state of the database would make it valid,
 // so 400. A request carrying an amount that was right when it was sent and is
 // wrong now is a request the state moved underneath, so 409, the same code an
 // ineligible destination answers.
 const missingEcho = await expectRejection(client, 'no echo', () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_DISCARD,
   accountCheck,
   new Date(),
   undefined,
   undefined,
  ),
 );
 check(
  'CLOSE without an echoed residual is refused with 400',
  missingEcho.rejected && missingEcho.status === 400,
  `${missingEcho.status} ${String(missingEcho.detail).slice(0, 70)}`,
 );

 const staleEcho = await expectRejection(client, 'stale echo', () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_DISCARD,
   accountCheck,
   new Date(),
   undefined,
   money(residualBefore + 1),
  ),
 );
 check(
  'CLOSE echoing a residual the account no longer holds is refused with 409',
  staleEcho.rejected && staleEcho.status === 409,
  `${staleEcho.status} ${String(staleEcho.detail).slice(0, 70)}`,
 );

 // A cent apart, not a unit: the comparison is made in cents because both
 // sides describe a DECIMAL(15,2) and arrive as floats, and a check that only
 // caught whole-unit drift would let the rounding it exists to survive hide a
 // real disagreement.
 const centOffEcho = await expectRejection(client, 'cent off', () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_DISCARD,
   accountCheck,
   new Date(),
   undefined,
   money(residualBefore + 0.01),
  ),
 );
 check(
  'an echo one cent off is refused too, so the tolerance is not a unit',
  centOffEcho.rejected && centOffEcho.status === 409,
  `${centOffEcho.status} ${String(centOffEcho.detail).slice(0, 70)}`,
 );

 // ------------------------------------------------------- the two halves meet
 // The echo is only worth anything if the figure the owner is shown is the
 // figure the settlement will derive. Those are two different queries in two
 // different files, and nothing but this checks that they agree: a preview
 // serving the stored account_balance column instead of the derived residual
 // would look right on the screen and be refused by the engine for a
 // disagreement the owner neither caused nor can fix.
 console.log('');
 console.log('what the close screen is served:');

 const preview = await getClosePreview(client, target.user_id, target.account_id);

 check(
  'the preview names the account the owner asked about',
  preview.targetAccount.accountId === target.account_id,
  `${preview.targetAccount.accountId} "${preview.targetAccount.accountName}"`,
 );
 check(
  'the residual it publishes is the one derived here, not the stored balance column',
  near(Number(preview.targetAccount.residual), residualBefore),
  `preview ${preview.targetAccount.residual} vs ${residualBefore} derived independently`,
 );
 check(
  'it carries the destinations and their count together, so the screen can offer the choice',
  Array.isArray(preview.destinations) &&
   preview.destinationCount === preview.destinations.length,
  `${preview.destinationCount} eligible`,
 );

 // ------------------------------------------------------------- the real run
 // The echo sent back is the preview's own value, unmodified and still the
 // string the driver produced - which is what a frontend echoing what it
 // received will send. Using the script's own float here instead would test
 // the engine against itself and skip the conversion the real path makes.
 const closeResult = await processCloseAccount(
  client,
  target.user_id,
  target.account_id,
  CLOSE_POLICY_DISCARD,
  accountCheck,
  new Date(),
  undefined,
  preview.targetAccount.residual,
 );

 const residualAfter = await derivedBalanceOf(client, target.account_id);
 const closedRow = await accountRow(client, target.account_id, target.user_id);
 const transactionsAfter = await countTransactions(client, target.account_id);
 const cardAfter = await getInvestmentFigures(
  client,
  investmentIds,
  TIME_ZONE,
  REFERENCE_MONTH,
 );

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
 // Stated as its own assertion rather than left implicit in the call having
 // returned: three refusals above prove the echo can say no, and nothing there
 // proves it ever says yes. A comparison wrong in the accepting direction
 // refuses every close there is and passes all three.
 check(
  'an echo matching the derived residual is accepted',
  near(closeResult.settledResidual, residualBefore),
  `echoed ${residualBefore}, settled ${closeResult.settledResidual}`,
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
  'it is marked closed on closed_at, the column that means this',
  closedRow.rows[0] && closedRow.rows[0].closed_at !== null,
  String(closedRow.rows[0] && closedRow.rows[0].closed_at),
 );
 // The dual-write, asserted as one fact rather than two: closed_at is what
 // CLOSE means, deleted_at is written beside it only until every reader has
 // been swept. Dropping the second write early is the failure this catches -
 // it would put closed accounts back in circulation wherever the sweep has not
 // reached, and nothing else here would notice.
 check(
  'deleted_at is written too, and to the same instant - the sweep has not happened yet',
  closedRow.rows[0] &&
   closedRow.rows[0].deleted_at !== null &&
   Number(closedRow.rows[0].deleted_at) === Number(closedRow.rows[0].closed_at),
  `closed_at ${closedRow.rows[0] && closedRow.rows[0].closed_at}, deleted_at ${closedRow.rows[0] && closedRow.rows[0].deleted_at}`,
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

 // Echoing the residual the account actually holds now, which is zero: the
 // refusal has to come from the account being closed, not from an echo that
 // happens to be stale as well.
 const reCloseAttempt = await expectRejection(client, 'already closed', () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_DISCARD,
   closedRow,
   new Date(),
   undefined,
   0,
  ),
 );
 check(
  'closing an already-closed account is refused with 400',
  reCloseAttempt.rejected && reCloseAttempt.status === 400,
  `${reCloseAttempt.status} ${String(reCloseAttempt.detail).slice(0, 60)}`,
 );

 // The preview refuses it too, and refuses it as 404 rather than as its own
 // code: a closed account has no close screen, and answering with a balance
 // would offer the owner a confirmation the engine is going to reject anyway.
 // The same 404 covers an account that does not exist and one belonging to
 // someone else, so that the endpoint cannot be used to learn which.
 const previewOfClosed = await getClosePreview(
  client,
  target.user_id,
  target.account_id,
 ).then(
  (value) => ({ refused: false, value }),
  (error) => ({ refused: true, status: error.status ?? error.statusCode }),
 );
 check(
  'the preview refuses a closed account with 404, so no close screen can be opened on it',
  previewOfClosed.refused && previewOfClosed.status === 404,
  String(previewOfClosed.status),
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
 // Zero is an echo like any other and has to be sent: the engine requires the
 // amount, and an account holding nothing is exactly where a check written as
 // a truthiness test rather than a comparison would silently wave the request
 // through.
 const emptyResult = await processCloseAccount(
  client,
  target.user_id,
  emptyId,
  CLOSE_POLICY_DISCARD,
  emptyCheck,
  new Date(),
  undefined,
  0,
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
  'it is still marked closed, on both columns',
  emptyRow.rows[0] &&
   emptyRow.rows[0].closed_at !== null &&
   emptyRow.rows[0].deleted_at !== null,
  `closed_at ${emptyRow.rows[0] && emptyRow.rows[0].closed_at}`,
 );

 // ------------------------------------------- the two states are now distinct
 // What migration 034 was for. Before it, one column carried both states, so
 // this account - soft deleted and never closed - was refused by CLOSE with
 // "already closed", a message describing a state it was not in. The refusal
 // is asserted on its text, not just its status: both cases answer 400, so a
 // check on the code alone would pass with the two messages swapped.
 console.log('');
 console.log('a soft-deleted account is not a closed one:');

 const softDeleted = await client.query(
  `INSERT INTO user_accounts
     (user_id, account_name, account_type_id, currency_id,
      account_starting_amount, account_balance, account_start_date, deleted_at)
   VALUES ($1, $2, $3, $4, 0, 0, $5, CURRENT_TIMESTAMP) RETURNING account_id, deleted_at, closed_at`,
  [
   target.user_id,
   'probe soft-deleted account',
   bankType.rows[0].account_type_id,
   accountingCurrencyId,
   new Date(),
  ],
 );
 const softDeletedId = softDeleted.rows[0].account_id;

 check(
  'the probe built the state it meant to: deleted, never closed',
  softDeleted.rows[0].deleted_at !== null && softDeleted.rows[0].closed_at === null,
  `deleted_at set, closed_at ${softDeleted.rows[0].closed_at}`,
 );

 const softCheck = await accountRow(client, softDeletedId, target.user_id);
 const closeSoftDeleted = await expectRejection(client, 'soft deleted', () =>
  processCloseAccount(
   client,
   target.user_id,
   softDeletedId,
   CLOSE_POLICY_DISCARD,
   softCheck,
   new Date(),
   undefined,
   0,
  ),
 );
 check(
  'CLOSE refuses it as deleted, not as already closed',
  closeSoftDeleted.rejected &&
   closeSoftDeleted.status === 400 &&
   /was deleted/.test(String(closeSoftDeleted.detail)) &&
   !/already closed/.test(String(closeSoftDeleted.detail)),
  `${closeSoftDeleted.status} ${String(closeSoftDeleted.detail).slice(0, 60)}`,
 );

 // And the same distinction from the other side: the account CLOSE closed
 // above carries both columns, so the message has to come from closed_at
 // winning the order, not from deleted_at happening to be set.
 check(
  'the closed account is still refused as closed, with both columns set',
  reCloseAttempt.rejected && /already closed/.test(String(reCloseAttempt.detail)),
  String(reCloseAttempt.detail).slice(0, 60),
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
  'the account this probe closed is open again, on both columns',
  stillOpen.rows.length === 1 &&
   stillOpen.rows[0].deleted_at === null &&
   stillOpen.rows[0].closed_at === null,
  `deleted_at ${stillOpen.rows[0] && stillOpen.rows[0].deleted_at}, closed_at ${stillOpen.rows[0] && stillOpen.rows[0].closed_at}`,
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
