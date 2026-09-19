// backend/scripts/verifyClosedAccountWindow.js
//
// Asserts the reporting window against a real database.
//
//   node scripts/verifyClosedAccountWindow.js
//   node scripts/verifyClosedAccountWindow.js --expect fintrack_dev
//
// READ-ONLY. It issues SELECTs and nothing else, so unlike verifyClose.js it
// opens no transaction and has nothing to roll back. It still refuses a
// non-local database, for the same reason that one does: a probe that reads a
// production database is still a probe holding that database's connections, and
// the place to stop is before the first statement.
//
// WHAT IT ASSERTS. accountReportingWindow.js states that an account reports a
// balance across [account_start_date, closed_at] and nowhere else. The probe
// exercises that through the exported readers rather than by re-issuing their
// SQL, so a change to a statement that breaks the rule fails here instead of
// passing a copy of itself.
//
//  1. a closed account appears in the per-account series for its closing month;
//  2. it does NOT appear for the month after;
//  3. it appears for a month before its closure, IF it existed then;
//  4. the per-account rows of a month still sum to the aggregate for that
//     month - the identity overviewBalanceRepository.js states at its head, and
//     the one thing the restructure of MONTHLY_BALANCE_QUERY could have broken;
//  5. the exported statement lists the account for its closing month and not
//     for the month after - the defect that read closed_at IS NULL;
//  6. the investment identity still holds at a month after a closure, which is
//     what the window could have broken by dropping a row from the balance side
//     while the transaction terms kept theirs.
//
// AND TWO THAT NEED NO CLOSED ACCOUNT, because the window can break a figure
// without one: it bounds every account at its opening month too.
//
//  7. the aggregate series equals the sum of the per-account rows across a whole
//     thirteen-month window, month by month. This is what the restructure of
//     MONTHLY_BALANCE_QUERY put at risk, and one month is not evidence for
//     thirteen - the months before an account opened are the ones where the two
//     shapes could disagree.
//  8. the investment identity holds at every month of that window, for every
//     owner who has an investment account at all.
//
// IT REPORTS WHAT IT COULD NOT TEST. A database with no account closed since
// 2026-09-19 has no subject for 1 to 3 and 5: accounts closed before that date
// have no user_accounts row at all and are outside every one of these reads by
// storage, not by window. The run says so rather than printing passes.

import { pool } from '../src/db/config/configDB.js';
import {
 getMonthlyBalance,
 getMonthlyBalanceByAccount,
} from '../src/fintrack_api/services/overview_services/db/overviewBalanceRepository.js';
import {
 getInvestmentFigures,
} from '../src/fintrack_api/services/overview_services/db/overviewInvestmentRepository.js';
import { getAccountsAndBalances } from '../src/export_api/db/accountsAndBalancesRepository.js';

const readOption = (flag, fallback) => {
 const index = process.argv.indexOf(flag);
 return index === -1 || index === process.argv.length - 1
  ? fallback
  : process.argv[index + 1];
};

const EXPECTED_DATABASE = readOption('--expect', 'fintrack_dev');
const TIME_ZONE = readOption('--zone', 'America/Bogota');

const LOOPBACK = new Set(['127.0.0.1', '::1', '0.0.0.0']);

const results = [];
const check = (label, passed, detail = '') => {
 results.push(passed);
 console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

const note = (label, detail = '') => {
 console.log(`----  ${label}${detail ? `  (${detail})` : ''}`);
};

// Same three answers verifyClose.js asks for, and asked of the server rather
// than of the configuration for the same reason: dbEnvironmentConfig.js gives
// development and production identical bodies, so the configuration cannot say
// where the connection went.
const assertLocalDatabase = async () => {
 const { rows } = await pool.query(
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
  console.error('REFUSED. This probe only runs against a local test database.');
  refusals.forEach((line) => console.error(`  - ${line}`));
  process.exit(1);
 }

 console.log(`Connected to ${db_name} at ${server_address}, unencrypted.`);
};

// The month a timestamp falls in, on the owner's calendar, as 'YYYY-MM-01'.
// Computed by the server and not by JavaScript: the window compares month
// boundaries after AT TIME ZONE, and a Date built here would apply the machine's
// zone instead of the owner's.
const monthOf = async (timestampSql, params, offsetMonths = 0) => {
 const { rows } = await pool.query(
  `SELECT to_char(
            date_trunc('month', ${timestampSql} AT TIME ZONE $${params.length + 1})
              + ($${params.length + 2} || ' months')::interval,
            'YYYY-MM-01'
          ) AS month`,
  [...params, TIME_ZONE, String(offsetMonths)],
 );
 return rows[0].month;
};

// Every account closed by the path that keeps the row, with its type and owner.
// The other population - closed before 2026-09-19, no row - cannot be read from
// user_accounts at all, which is exactly what this probe cannot cover.
const readClosedAccounts = async () => {
 const { rows } = await pool.query(
  `SELECT ua.account_id,
          ua.user_id,
          ua.account_name,
          act.account_type_name,
          ua.closed_at,
          ua.account_start_date
     FROM user_accounts ua
     JOIN account_types act ON act.account_type_id = ua.account_type_id
    WHERE ua.closed_at IS NOT NULL
    ORDER BY ua.closed_at DESC`,
 );
 return rows;
};

// The accounts of one owner and one type, closed ones included - the same set
// ACCOUNT_IDS_BY_TYPE_QUERY builds for the domain cards, restated here because
// that one runs through the identity CTE and this probe needs the id array the
// readers take.
const readAccountIdsByType = async (userId, typeName) => {
 const { rows } = await pool.query(
  `SELECT ua.account_id
     FROM user_accounts ua
     JOIN account_types act ON act.account_type_id = ua.account_type_id
    WHERE ua.user_id = $1
      AND act.account_type_name = $2
    ORDER BY ua.account_id`,
  [userId, typeName],
 );
 return rows.map((row) => row.account_id);
};

const round = (value) => Math.round(Number(value) * 100) / 100;

const run = async () => {
 await assertLocalDatabase();

 const closedAccounts = await readClosedAccounts();
 console.log(`\n${closedAccounts.length} account(s) closed with the row kept.\n`);

 if (closedAccounts.length === 0) {
  note(
   'no subject for the window assertions',
   'close an account through the application first',
  );
 }

 for (const account of closedAccounts) {
  const label = `${account.account_name} (#${account.account_id}, ${account.account_type_name})`;

  const closingMonth = await monthOf('$1::timestamptz', [account.closed_at], 0);
  const monthAfter = await monthOf('$1::timestamptz', [account.closed_at], 1);
  const startMonth = await monthOf('$1::timestamptz', [account.account_start_date], 0);

  console.log(`\n${label} — opened ${startMonth}, closed ${closingMonth}`);

  const series = await getMonthlyBalanceByAccount(
   pool,
   [account.account_id],
   startMonth,
   monthAfter,
   TIME_ZONE,
  );
  const monthsReported = series.map((row) => row.month);

  check(
   'reports its closing month',
   monthsReported.includes(closingMonth),
   `months: ${monthsReported.join(', ') || 'none'}`,
  );

  check(
   'reports nothing for the month after it closed',
   !monthsReported.includes(monthAfter),
   `looked for ${monthAfter}`,
  );

  check(
   'reports its opening month',
   monthsReported.includes(startMonth),
   `looked for ${startMonth}`,
  );

  // The identity of overviewBalanceRepository.js's head: the per-account rows
  // of a month sum to the aggregate for that month. Asserted at the month AFTER
  // the closure, which is where the restructure could have broken it - the
  // account is inside the aggregate's id array and outside its window.
  const ids = await readAccountIdsByType(account.user_id, account.account_type_name);
  const aggregate = await getMonthlyBalance(pool, ids, monthAfter, monthAfter, TIME_ZONE);
  const perAccount = await getMonthlyBalanceByAccount(
   pool,
   ids,
   monthAfter,
   monthAfter,
   TIME_ZONE,
  );
  const summed = perAccount.reduce((total, row) => total + row.balance, 0);

  check(
   'the per-account rows sum to the aggregate, at the month after the closure',
   round(summed) === round(aggregate[0]?.totalAmount ?? 0),
   `rows ${round(summed)} vs aggregate ${round(aggregate[0]?.totalAmount ?? 0)}`,
  );

  // The exported statement, the one read that carried closed_at IS NULL.
  const statementAtClosing = await getAccountsAndBalances(
   pool,
   account.user_id,
   closingMonth,
   TIME_ZONE,
  );
  const statementAfter = await getAccountsAndBalances(
   pool,
   account.user_id,
   monthAfter,
   TIME_ZONE,
  );

  const inStatement = (rows) => rows.some((row) => row.accountId === account.account_id);

  // Four types only: the statement is scoped to bank, cash, investment and
  // debtor, so an account of another type is legitimately in neither list.
  const STATEMENT_TYPES = ['bank', 'cash', 'investment', 'debtor'];
  if (STATEMENT_TYPES.includes(account.account_type_name)) {
   check(
    'the exported statement lists it for its closing month',
    inStatement(statementAtClosing),
    `${statementAtClosing.length} account(s) in that statement`,
   );
   check(
    'the exported statement does not list it for the month after',
    !inStatement(statementAfter),
    `${statementAfter.length} account(s) in that statement`,
   );
  } else {
   note(
    'the exported statement does not cover this type',
    account.account_type_name,
   );
  }

  // The investment card publishes capitalContributed + realizedPnl +
  // closureAdjustment = ledgerBalance. The window drops the closed account from
  // the balance side after its closure and leaves the transaction terms alone,
  // so the identity holds only if that account's terms already sum to zero.
  if (account.account_type_name === 'investment') {
   const figures = await getInvestmentFigures(pool, ids, TIME_ZONE, monthAfter);
   const stated =
    figures.capitalContributed + figures.realizedPnl + figures.closureAdjustment;
   check(
    'the investment identity holds at the month after the closure',
    round(stated) === round(figures.ledgerBalance),
    `terms ${round(stated)} vs balance ${round(figures.ledgerBalance)}`,
   );
  }
 }

 // Assertions 7 and 8, which need no closed account. A thirteen-month window
 // ending at the current month, per owner, over the two account sets the two
 // restructured statements read.
 const { rows: owners } = await pool.query(
  `SELECT DISTINCT ua.user_id FROM user_accounts ua ORDER BY ua.user_id`,
 );
 const firstMonth = await monthOf('now()', [], -12);
 const currentMonth = await monthOf('now()', [], 0);

 console.log(`\nAcross ${firstMonth} to ${currentMonth}, ${owners.length} owner(s):`);

 for (const { user_id: userId } of owners) {
  for (const typeName of ['debtor', 'investment']) {
   const ids = await readAccountIdsByType(userId, typeName);
   if (ids.length === 0) {
    continue;
   }

   const aggregate = await getMonthlyBalance(pool, ids, firstMonth, currentMonth, TIME_ZONE);
   const perAccount = await getMonthlyBalanceByAccount(
    pool,
    ids,
    firstMonth,
    currentMonth,
    TIME_ZONE,
   );

   const summedByMonth = new Map();
   for (const row of perAccount) {
    summedByMonth.set(row.month, (summedByMonth.get(row.month) ?? 0) + row.balance);
   }

   const disagreeing = aggregate.filter(
    (row) => round(summedByMonth.get(row.month) ?? 0) !== round(row.totalAmount),
   );

   check(
    `owner ${userId}, ${typeName}: the two statements agree in all ${aggregate.length} months`,
    disagreeing.length === 0,
    disagreeing.length === 0
     ? `${ids.length} account(s)`
     : disagreeing
        .slice(0, 3)
        .map(
         (row) =>
          `${row.month}: rows ${round(summedByMonth.get(row.month) ?? 0)} vs aggregate ${round(row.totalAmount)}`,
        )
        .join('; '),
   );

   if (typeName !== 'investment') {
    continue;
   }

   const broken = [];
   for (const row of aggregate) {
    const figures = await getInvestmentFigures(pool, ids, TIME_ZONE, row.month);
    const stated =
     figures.capitalContributed + figures.realizedPnl + figures.closureAdjustment;
    if (round(stated) !== round(figures.ledgerBalance)) {
     broken.push(`${row.month}: ${round(stated)} vs ${round(figures.ledgerBalance)}`);
    }
   }

   check(
    `owner ${userId}: the investment identity holds in all ${aggregate.length} months`,
    broken.length === 0,
    broken.slice(0, 3).join('; '),
   );
  }
 }

 const failures = results.filter((passed) => !passed).length;
 console.log(
  `\n${results.length - failures} passed, ${failures} failed. ${closedAccounts.length} closed account(s) carried assertions 1 to 6.`,
 );
 return failures;
};

run()
 .then(async (failures) => {
  await pool.end();
  process.exit(failures > 0 ? 1 : 0);
 })
 .catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
 });
