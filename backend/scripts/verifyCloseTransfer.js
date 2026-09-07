// backend/scripts/verifyCloseTransfer.js
//
// Exercises CLOSE's TRANSFER policy against a real database and rolls back.
//
//   node scripts/verifyCloseTransfer.js
//   node scripts/verifyCloseTransfer.js --zone UTC
//
// Run it from `backend/`: the database configuration calls dotenv.config(),
// which reads .env relative to the working directory.
//
// WHY THIS EXISTS BESIDE THE OTHER TWO
//
// verifyClosureSettlement.js verifies the settlement WRITER. verifyCloseAccount.js
// verifies the engine around it under the DISCARD policy. Neither touches the
// part TRANSFER adds, which is the only part where the two policies differ: the
// counterpart is an account the OWNER named, so the engine has to decide whether
// it may be settled against at all, and it has to decide that on the state it
// holds a lock over rather than on the state the selector showed.
//
// THE PROPERTY THAT SEPARATES THE POLICIES, and the one worth a probe: under
// DISCARD the counterpart is the boundary account, which every published figure
// excludes, so net worth falls by the residual. Under TRANSFER both accounts are
// live, so the pair cancels and net worth cannot move. A defect that sent the
// residual to the boundary account under either policy would still zero the
// target, still mark it closed, and still report success - the owner would
// simply lose the money. That is asserted here directly, over the two accounts
// involved, before and after.
//
// WHAT IT DELIBERATELY DOES NOT COVER
//
// The HTTP layer. The controller reads destinationAccountId out of the body and
// passes it through unparsed on purpose; what it becomes is the engine's to
// decide, and that is what this checks.

import { pool } from '../src/db/config/configDB.js';
import { processCloseAccount } from '../src/fintrack_api/services/delete_account/deleteAccountService.js';
import {
 listTransferDestinations,
 TRANSFER_DESTINATION_ACCOUNT_TYPE,
} from '../src/fintrack_api/services/delete_account/getCloseTransferDestinations.js';
// The deletion types and the two closure policies are declared by the
// controller, which is where the request's vocabulary is defined.
import {
 DELETION_TYPE_CLOSE,
 CLOSE_POLICY_TRANSFER,
} from '../src/fintrack_api/controllers/accountDeleteController.js';
import { getInvestmentFigures } from '../src/fintrack_api/services/overview_services/db/overviewInvestmentRepository.js';
import {
 derivedAccountBalanceSql,
 ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID,
 ACCOUNT_CLOSURE_TRANSACTION_TYPE_ID,
} from '../src/utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';
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

// getInvestmentFigures gained a fourth parameter when feat/overview bound every
// figure on the card to a reference month. It has no default, and an omitted one
// reaches the query as NULL, so the card comes back all zeros rather than
// raising - the card assertions below then compare 0 against 0 and pass while
// measuring nothing. Derived in the zone the query converts with, or the first
// hours of a month in a western zone would name the previous one.
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

const countClosureRows = async (client) => {
 const { rows } = await client.query(
  'SELECT COUNT(*)::int AS n FROM transactions WHERE movement_type_id = $1',
  [ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID],
 );
 return rows[0].n;
};

const countBoundaryAccounts = async (client, userId) => {
 const { rows } = await client.query(
  `SELECT COUNT(*)::int AS n
     FROM user_accounts ua
     JOIN account_types at2 ON at2.account_type_id = ua.account_type_id
    WHERE ua.user_id = $1 AND at2.account_type_name = 'boundary'`,
  [userId],
 );
 return rows[0].n;
};

// An expected refusal, run inside a savepoint so a rejection cannot leave the
// transaction unusable for the checks that follow.
const expectRejection = async (client, run) => {
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

 // An investment account, so the Investment card can be read over a set that
 // contains the account being closed, and so the destination is of a different
 // type than the target - which is what the eligibility rule requires and what
 // keeps the counterpart leg outside the published set.
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

 const closureRowsBefore = await countClosureRows(client);
 const accountsBefore = await client.query(
  'SELECT COUNT(*)::int AS n FROM user_accounts',
 );
 const boundaryAccountsBefore = await countBoundaryAccounts(client, target.user_id);

 // -------------------------------------------------------- the eligible list
 console.log('');
 console.log('what the selector offers:');

 let offered = await listTransferDestinations(
  client,
  target.user_id,
  target.account_id,
 );

 // If this owner has no eligible bank account, make one. Rolled back with
 // everything else, and finding it in the list afterwards is itself a check
 // that the rule admits what it is supposed to admit.
 let destinationWasCreated = false;
 if (offered.length === 0) {
  const bankType = await client.query(
   `SELECT account_type_id FROM account_types WHERE LOWER(account_type_name) = $1`,
   [TRANSFER_DESTINATION_ACCOUNT_TYPE],
  );
  await client.query(
   `INSERT INTO user_accounts
      (user_id, account_name, account_type_id, currency_id,
       account_starting_amount, account_balance, account_start_date)
    VALUES ($1, $2, $3, $4, 0, 0, $5)`,
   [
    target.user_id,
    'probe transfer destination',
    bankType.rows[0].account_type_id,
    target.currency_id,
    new Date(),
   ],
  );
  destinationWasCreated = true;
  offered = await listTransferDestinations(
   client,
   target.user_id,
   target.account_id,
  );
 }

 check(
  'the owner has somewhere to transfer to',
  offered.length > 0,
  `${offered.length} eligible${destinationWasCreated ? ', one created by this probe' : ''}`,
 );

 // Verified against the rows themselves rather than against the query's own
 // output: asking the same query whether it filtered correctly proves nothing.
 const offeredIds = offered.map((row) => row.accountId);
 const offeredRows = await client.query(
  `SELECT ua.account_id, ua.deleted_at, ua.closed_at, ua.currency_id, at2.account_type_name, ua.user_id
     FROM user_accounts ua
     JOIN account_types at2 ON at2.account_type_id = ua.account_type_id
    WHERE ua.account_id = ANY($1::int[])`,
  [offeredIds],
 );

 check(
  'every account offered belongs to this owner, is open on both columns, is a bank account and shares the closing currency',
  offeredRows.rows.length === offered.length &&
   offeredRows.rows.every(
    (row) =>
     row.user_id === target.user_id &&
     row.deleted_at === null &&
     row.closed_at === null &&
     row.account_type_name === TRANSFER_DESTINATION_ACCOUNT_TYPE &&
     row.currency_id === target.currency_id,
   ),
  `${offered.length} checked against user_accounts`,
 );

 // The destination filter tests closed_at on its own, and this is the assertion
 // that proves it. The account below carries closed_at and NOT deleted_at -
 // the state every closed account will be in once the close path stops writing
 // the second column. Built with both columns set it would be excluded by the
 // old deleted_at predicate too and would prove nothing about the new one.
 const closedBank = await client.query(
  `SELECT account_type_id FROM account_types WHERE LOWER(account_type_name) = $1`,
  [TRANSFER_DESTINATION_ACCOUNT_TYPE],
 );
 const closedDestination = await client.query(
  `INSERT INTO user_accounts
     (user_id, account_name, account_type_id, currency_id,
      account_starting_amount, account_balance, account_start_date, closed_at)
   VALUES ($1, $2, $3, $4, 0, 0, $5, CURRENT_TIMESTAMP)
   RETURNING account_id, deleted_at, closed_at`,
  [
   target.user_id,
   'probe closed destination',
   closedBank.rows[0].account_type_id,
   target.currency_id,
   new Date(),
  ],
 );
 const closedDestinationId = closedDestination.rows[0].account_id;

 check(
  'the probe built the state it meant to: closed, never deleted',
  closedDestination.rows[0].closed_at !== null &&
   closedDestination.rows[0].deleted_at === null,
  'closed_at set, deleted_at null',
 );

 const offeredWithClosed = await listTransferDestinations(
  client,
  target.user_id,
  target.account_id,
 );

 check(
  'a closed bank account of the right currency is not offered as a destination',
  !offeredWithClosed.map((row) => row.accountId).includes(closedDestinationId),
  `account ${closedDestinationId} withheld from ${offeredWithClosed.length} offered`,
 );

 // The settlement has to refuse it too, not merely decline to advertise it, and
 // that assertion lives in the rejections section below - it needs the echoed
 // residual, which is derived there so that every refusal carries a correct one.
 // This account stays alive until then.
 check(
  'the account being closed is not offered as its own destination',
  !offeredIds.includes(target.account_id),
  `${target.account_id} absent from [${offeredIds.join(', ')}]`,
 );
 check(
  'no investment account is offered - the rule names one type',
  investmentIds.every((id) => !offeredIds.includes(id)),
  `${investmentIds.length} investment accounts, none offered`,
 );

 const boundaryRow = await client.query(
  `SELECT ua.account_id FROM user_accounts ua
     JOIN account_types at2 ON at2.account_type_id = ua.account_type_id
    WHERE ua.user_id = $1 AND at2.account_type_name = 'boundary'
    ORDER BY ua.account_id ASC LIMIT 1`,
  [target.user_id],
 );
 const boundaryId = boundaryRow.rows[0] ? boundaryRow.rows[0].account_id : null;
 const boundaryBefore = boundaryId
  ? await derivedBalanceOf(client, boundaryId)
  : null;

 check(
  'the compensation account is not offered - taking money out of the books is the other policy',
  boundaryId === null || !offeredIds.includes(boundaryId),
  boundaryId === null ? 'this owner has none yet' : `boundary ${boundaryId} absent`,
 );

 const destination = offered[0];
 const destinationBefore = await derivedBalanceOf(client, destination.accountId);
 console.log(
  `destination ${destination.accountId} ("${destination.accountName}"), balance ${destinationBefore}`,
 );

 // ---------------------------------------------------------------- rejections
 // The residual is derived here rather than just before the settlement because
 // every refusal below has to carry a CORRECT echo of it. The engine parses the
 // echo before it looks at the destination, so a call omitting both would be
 // refused for the echo and each destination assertion would pass without ever
 // reaching the rule it names. Nothing between here and the run moves this
 // balance: every rejection below is rolled back to its savepoint.
 const residualBefore = await derivedBalanceOf(client, target.account_id);

 console.log('');
 console.log('what the engine refuses:');

 const accountCheck = await accountRow(client, target.account_id, target.user_id);

 // The closed account built above, named directly rather than picked from the
 // list. The selector and the write path share one query precisely so that a
 // destination the screen could not offer cannot be settled against by a caller
 // that names it anyway, and this is the assertion that holds them together.
 const closedDestinationRejected = await expectRejection(client, () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_TRANSFER,
   accountCheck,
   new Date(),
   closedDestinationId,
   residualBefore,
  ),
 );
 check(
  'naming a closed account as the destination is refused with 409',
  closedDestinationRejected.rejected &&
   closedDestinationRejected.status === 409,
  `${closedDestinationRejected.status} ${String(closedDestinationRejected.detail).slice(0, 70)}`,
 );

 await client.query('DELETE FROM user_accounts WHERE account_id = $1', [
  closedDestinationId,
 ]);

 const noDestination = await expectRejection(client, () =>
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
  'TRANSFER without a destination is refused with 400 - the request is malformed, no state would make it valid',
  noDestination.rejected && noDestination.status === 400,
  `${noDestination.status} ${String(noDestination.detail).slice(0, 60)}`,
 );

 const selfDestination = await expectRejection(client, () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_TRANSFER,
   accountCheck,
   new Date(),
   target.account_id,
   residualBefore,
  ),
 );
 check(
  'transferring to the account being closed is refused with 409',
  selfDestination.rejected && selfDestination.status === 409,
  `${selfDestination.status}`,
 );

 const wrongType = await expectRejection(client, () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_TRANSFER,
   accountCheck,
   new Date(),
   // Another of the owner's investment accounts if there is one, otherwise the
   // boundary account. Either is a type the rule does not admit.
   investmentIds.find((id) => id !== target.account_id) ?? boundaryId,
   residualBefore,
  ),
 );
 check(
  'transferring to an account of an inadmissible type is refused with 409',
  wrongType.rejected && wrongType.status === 409,
  `${wrongType.status}`,
 );

 const foreign = await client.query(
  'SELECT account_id FROM user_accounts WHERE user_id <> $1 LIMIT 1',
  [target.user_id],
 );
 if (foreign.rows.length === 1) {
  const foreignDestination = await expectRejection(client, () =>
   processCloseAccount(
    client,
    target.user_id,
    target.account_id,
    CLOSE_POLICY_TRANSFER,
    accountCheck,
    new Date(),
    foreign.rows[0].account_id,
    residualBefore,
   ),
  );
  check(
   "transferring to another owner's account is refused with 409",
   foreignDestination.rejected && foreignDestination.status === 409,
   `account ${foreign.rows[0].account_id}, ${foreignDestination.status}`,
  );
 } else {
  console.log('  SKIP  no other owner on this database to attempt a cross-owner transfer');
 }

 // The echo the owner sends back is checked under both policies, and this is
 // the assertion that says so for TRANSFER: the destination named here is the
 // eligible one the run below uses, so the only thing wrong with the request is
 // the amount. Without it, an echo implemented on the DISCARD branch alone
 // would leave every TRANSFER settling whatever the balance had become.
 const staleEcho = await expectRejection(client, () =>
  processCloseAccount(
   client,
   target.user_id,
   target.account_id,
   CLOSE_POLICY_TRANSFER,
   accountCheck,
   new Date(),
   destination.accountId,
   money(residualBefore + 0.01),
  ),
 );
 check(
  'TRANSFER echoing a residual the account no longer holds is refused with 409, destination or no destination',
  staleEcho.rejected && staleEcho.status === 409,
  `${staleEcho.status} ${String(staleEcho.detail).slice(0, 60)}`,
 );

 // ------------------------------------------------------------- the real run
 const transactionsBefore = await countTransactions(client, target.account_id);
 const cardBefore = await getInvestmentFigures(
  client,
  investmentIds,
  TIME_ZONE,
  REFERENCE_MONTH,
 );
 const closureRowsBeforeRun = await countClosureRows(client);

 const closeResult = await processCloseAccount(
  client,
  target.user_id,
  target.account_id,
  CLOSE_POLICY_TRANSFER,
  accountCheck,
  new Date(),
  destination.accountId,
  residualBefore,
 );

 const residualAfter = await derivedBalanceOf(client, target.account_id);
 const destinationAfter = await derivedBalanceOf(client, destination.accountId);
 const closedRow = await accountRow(client, target.account_id, target.user_id);
 const destinationRow = await accountRow(
  client,
  destination.accountId,
  target.user_id,
 );
 const transactionsAfter = await countTransactions(client, target.account_id);
 const cardAfter = await getInvestmentFigures(
  client,
  investmentIds,
  TIME_ZONE,
  REFERENCE_MONTH,
 );
 const closureRowsAfterRun = await countClosureRows(client);

 console.log('');
 console.log('what the engine reports:');

 check(
  'it reports the CLOSE deletion type and the TRANSFER policy',
  closeResult.deletionType === DELETION_TYPE_CLOSE &&
   closeResult.policy === CLOSE_POLICY_TRANSFER,
  `${closeResult.deletionType} / ${closeResult.policy}`,
 );
 check(
  'it names where the residual went, so the response does not leave the owner to infer it',
  closeResult.destinationAccountId === destination.accountId &&
   closeResult.destinationAccountName === destination.accountName,
  `${closeResult.destinationAccountId} "${closeResult.destinationAccountName}"`,
 );
 check(
  'the residual it reports settling is the one derived from the locked state',
  near(closeResult.settledResidual, residualBefore),
  `${closeResult.settledResidual} vs ${residualBefore} derived independently`,
 );

 console.log('');
 console.log('what it did to the two accounts:');

 check(
  'the closing account is now at zero, re-derived rather than taken from the report',
  near(residualAfter, 0),
  String(residualAfter),
 );
 check(
  'its row survives and is marked closed on both columns, to the same instant',
  closedRow.rows.length === 1 &&
   closedRow.rows[0].closed_at !== null &&
   closedRow.rows[0].deleted_at !== null &&
   Number(closedRow.rows[0].closed_at) === Number(closedRow.rows[0].deleted_at),
  `${closedRow.rows.length} row, closed_at ${closedRow.rows[0] && closedRow.rows[0].closed_at}`,
 );
 check(
  'its transactions survive, plus the settlement leg',
  transactionsAfter === transactionsBefore + 1,
  `${transactionsBefore} -> ${transactionsAfter}`,
 );
 check(
  'the destination received exactly the residual',
  near(destinationAfter, destinationBefore + residualBefore),
  `${destinationBefore} -> ${destinationAfter}, expected move ${money(residualBefore)}`,
 );
 check(
  "the destination's stored balance was rewritten from its ledger, not left stale",
  destinationRow.rows[0] &&
   near(Number(destinationRow.rows[0].account_balance), destinationAfter),
  `stored ${destinationRow.rows[0] && destinationRow.rows[0].account_balance} vs derived ${destinationAfter}`,
 );
 check(
  'the destination stays open - it received money, it was not closed too',
  destinationRow.rows[0] &&
   destinationRow.rows[0].deleted_at === null &&
   destinationRow.rows[0].closed_at === null,
  `deleted_at ${destinationRow.rows[0] && destinationRow.rows[0].deleted_at}, closed_at ${destinationRow.rows[0] && destinationRow.rows[0].closed_at}`,
 );

 // The property that separates TRANSFER from DISCARD. Under DISCARD this sum
 // would fall by the residual, because the counterpart sits on an account no
 // published figure counts.
 check(
  'the two accounts together hold what they held before - TRANSFER moves money, it does not remove it',
  near(residualAfter + destinationAfter, residualBefore + destinationBefore),
  `${money(residualBefore + destinationBefore)} -> ${money(residualAfter + destinationAfter)}`,
 );

 console.log('');
 console.log('what it wrote, and what it left alone:');

 check(
  'it wrote exactly the settlement pair',
  closureRowsAfterRun === closureRowsBeforeRun + 2,
  `${closureRowsBeforeRun} -> ${closureRowsAfterRun} closure rows`,
 );

 const writtenPair = await client.query(
  `SELECT account_id, amount::float AS amount, movement_type_id,
          transaction_type_id, currency_id, description
     FROM transactions
    WHERE account_id = ANY($1::int[])
      AND movement_type_id = $2
    ORDER BY transaction_id DESC
    LIMIT 2`,
  [[target.account_id, destination.accountId], ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID],
 );

 check(
  'both legs carry the closure movement and transaction types, not the transfer type',
  writtenPair.rows.length === 2 &&
   writtenPair.rows.every(
    (row) =>
     row.movement_type_id === ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID &&
     row.transaction_type_id === ACCOUNT_CLOSURE_TRANSACTION_TYPE_ID,
   ),
  `${writtenPair.rows.length} rows`,
 );
 check(
  'both legs carry the closing account currency, which the rule already forced the destination to share',
  writtenPair.rows.every((row) => row.currency_id === target.currency_id) &&
   destinationRow.rows[0].currency_id === target.currency_id,
  `currency ${target.currency_id} on both legs and on both accounts`,
 );
 check(
  'the rows say the money was transferred, not discarded - the policy reached the writer',
  writtenPair.rows.some((row) => row.description.includes('transferred to')) &&
   !writtenPair.rows.some((row) => row.description.includes('discarded')),
  writtenPair.rows[0] ? `"${writtenPair.rows[0].description.slice(0, 72)}..."` : '',
 );

 const boundaryAccountsAfter = await countBoundaryAccounts(client, target.user_id);
 check(
  'no compensation account was created - TRANSFER never touches one',
  boundaryAccountsAfter === boundaryAccountsBefore,
  `${boundaryAccountsBefore} -> ${boundaryAccountsAfter}`,
 );

 if (boundaryId !== null) {
  const boundaryAfter = await derivedBalanceOf(client, boundaryId);
  check(
   'the existing compensation account did not move',
   near(boundaryAfter, boundaryBefore),
   `${boundaryBefore} -> ${boundaryAfter}`,
  );
 }

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
 // The destination is a bank account, so it is outside the set the card reads.
 // The card falls by the residual for the same reason it does under DISCARD -
 // the money left the investment world - even though this time it did not leave
 // the owner.
 check(
  'the card balance falls by the residual, so the destination leg stayed outside the investment set',
  near(cardAfter.ledgerBalance, cardBefore.ledgerBalance - residualBefore),
  `${cardBefore.ledgerBalance} -> ${cardAfter.ledgerBalance}`,
 );

 // ------------------------------------------------------------------ rollback
 await client.query('ROLLBACK');
 rolledBack = true;

 const closureRowsPost = await countClosureRows(client);
 const accountsPost = await client.query(
  'SELECT COUNT(*)::int AS n FROM user_accounts',
 );
 const stillOpen = await accountRow(client, target.account_id, target.user_id);
 const destinationPost = await derivedBalanceOf(client, destination.accountId);

 console.log('');
 console.log('after the rollback:');
 check(
  'no closure row persisted',
  closureRowsPost === closureRowsBefore,
  `${closureRowsBefore} -> ${closureRowsPost}`,
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
 check(
  'the destination holds what it held before the probe',
  destinationWasCreated || near(destinationPost, destinationBefore),
  destinationWasCreated
   ? 'created by this probe, gone with the rollback'
   : `${destinationBefore} -> ${destinationPost}`,
 );

 const allPassed = results.every(Boolean);
 console.log('');
 console.log(
  allPassed
   ? 'TRANSFER validates its destination, moves the residual there, leaves net worth alone, and leaves nothing behind'
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
