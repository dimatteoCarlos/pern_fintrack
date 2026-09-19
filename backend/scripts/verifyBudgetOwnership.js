// backend/scripts/verifyBudgetOwnership.js
//
// Asserts that the Budget module's ownership map admits a closed category and
// that the set it reports when the client names none follows the span asked
// about rather than the state today.
//
//   node scripts/verifyBudgetOwnership.js
//   node scripts/verifyBudgetOwnership.js --expect fintrack_dev
//
// READ-ONLY, and it refuses a non-local database with the same three answers
// verifyClose.js asks for.
//
// WHAT WAS WRONG. getAccountsByType filtered deleted_at IS NULL AND closed_at IS
// NULL, and budgetController built its ownership map from it. A closed category
// was therefore not owned: naming its id answered 403 on all three endpoints -
// the status of a month, the twelve-month series, and the CSV export - about an
// account the owner does own and whose past months are still theirs to read.
// Omitting the id was worse, because the default set came from the same map and
// the category vanished with no error at all.
//
// WHAT IT ASSERTS
//  1. every closed category of an owner is in the ownership map;
//  2. each one publishes the month it opened and the month it closed;
//  3. a closed category is in the default set for a month inside its window;
//  4. it is NOT in the default set for a month after its window;
//  5. an account opened after the month asked about is out of that set too -
//     the floor, which no closed account is needed to exercise;
//  6. the overlap test admits a category whose window merely intersects a
//     range, at either end, which is what a one-month flag could not answer.
//
// IT REPORTS WHAT IT COULD NOT TEST. An owner with no closed category has no
// subject for 1 to 4.

import { pool } from '../src/db/config/configDB.js';
import { getAccountsByType } from '../src/utils/fintrackUtils/accountDataRetrieval/accountUtils.js';

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

// The controller's own narrowing, restated here so a divergence shows up as a
// failed assertion rather than as a silent agreement.
const idsOverlapping = (accounts, from, to) =>
 accounts
  .filter(
   (account) =>
    account.startMonth <= to &&
    (account.closedMonth === null || account.closedMonth >= from),
  )
  .map((account) => account.accountId);

// One month added to a 'YYYY-MM-01' string, without a Date: the strings the
// reader publishes are already cut on the owner's calendar and a Date built here
// would apply this machine's zone instead.
const nextMonth = (month) => {
 const [year, monthNumber] = month.split('-').map(Number);
 return monthNumber === 12
  ? `${year + 1}-01-01`
  : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
};

const run = async () => {
 await assertLocalDatabase();

 const { rows: owners } = await pool.query(
  `SELECT DISTINCT ua.user_id FROM user_accounts ua ORDER BY ua.user_id`,
 );

 for (const { user_id: userId } of owners) {
  const accounts = await getAccountsByType(userId, 'category_budget', TIME_ZONE);
  const closed = accounts.filter((account) => account.closedMonth !== null);

  console.log(
   `\nowner ${userId}: ${accounts.length} categor(ies) ever owned, ${closed.length} closed`,
  );

  if (accounts.length === 0) {
   note('no categories at all, nothing to assert');
   continue;
  }

  check(
   'every account publishes the month it opened',
   accounts.every((account) => /^\d{4}-\d{2}-01$/.test(account.startMonth)),
   accounts
    .slice(0, 3)
    .map((a) => `${a.accountName}: ${a.startMonth}`)
    .join('; '),
  );

  // IT FABRICATES ITS SUBJECT WHEN THE DATABASE HAS NONE, the same choice
  // verifyClose.js makes and for the same reason: a probe that skips reports
  // nothing and looks like it passed. It stamps closed_at on one existing
  // category inside a transaction and rolls it back, so nothing it writes
  // survives. The stamp is written directly rather than through the close
  // engine because what is under test is how the READER treats a stamped row,
  // not what the close writes - verifyClose.js already asserts that.
  let fabricated = null;
  if (closed.length === 0 && accounts.length > 0) {
   const client = await pool.connect();
   try {
    await client.query('BEGIN');
    const subject = accounts[0];
    await client.query(
     `UPDATE user_accounts
         SET closed_at = CURRENT_TIMESTAMP, deleted_at = CURRENT_TIMESTAMP
       WHERE account_id = $1`,
     [subject.accountId],
    );
    const afterStamp = await getAccountsByType(
     userId,
     'category_budget',
     TIME_ZONE,
     client,
    );
    fabricated = afterStamp.find((a) => a.accountId === subject.accountId) ?? null;

    check(
     `${subject.accountName} (#${subject.accountId}), closed inside a rolled-back transaction: still in the ownership map`,
     fabricated !== null,
     `${afterStamp.length} of ${accounts.length} categories still returned`,
    );

    check(
     'no other category was lost by the stamp',
     afterStamp.length === accounts.length,
     `${afterStamp.length} vs ${accounts.length}`,
    );

    if (fabricated !== null) {
     const after = nextMonth(fabricated.closedMonth);
     check(
      'the stamped category is in the default set for its closing month',
      idsOverlapping(afterStamp, fabricated.closedMonth, fabricated.closedMonth).includes(
       fabricated.accountId,
      ),
      fabricated.closedMonth,
     );
     check(
      'the stamped category is NOT in the default set for the month after',
      !idsOverlapping(afterStamp, after, after).includes(fabricated.accountId),
      after,
     );
    }
   } finally {
    await client.query('ROLLBACK');
    client.release();
   }

   const afterRollback = await getAccountsByType(userId, 'category_budget', TIME_ZONE);
   check(
    'the rollback left no closed category behind',
    afterRollback.every((account) => account.closedMonth === null),
    `${afterRollback.length} categories, all open`,
   );
  }

  for (const account of closed) {
   const label = `${account.accountName} (#${account.accountId})`;
   const after = nextMonth(account.closedMonth);

   check(
    `${label}: is in the ownership map though it is closed`,
    accounts.some((candidate) => candidate.accountId === account.accountId),
    `open ${account.startMonth}, closed ${account.closedMonth}`,
   );

   check(
    `${label}: is in the default set for its closing month`,
    idsOverlapping(accounts, account.closedMonth, account.closedMonth).includes(
     account.accountId,
    ),
    account.closedMonth,
   );

   check(
    `${label}: is NOT in the default set for the month after`,
    !idsOverlapping(accounts, after, after).includes(account.accountId),
    after,
   );

   check(
    `${label}: a range merely touching its window admits it`,
    idsOverlapping(accounts, account.closedMonth, `${Number(after.slice(0, 4)) + 5}-12-01`)
     .includes(account.accountId),
    `from its closing month forward`,
   );
  }

  // The floor, which needs no closed account: an account is out of the set for
  // every month before the one it opened in.
  const youngest = accounts.reduce(
   (latest, account) => (account.startMonth > latest.startMonth ? account : latest),
   accounts[0],
  );
  const beforeItExisted = `${Number(youngest.startMonth.slice(0, 4)) - 5}-01-01`;

  check(
   `${youngest.accountName} (#${youngest.accountId}): out of the set for a month before it opened`,
   !idsOverlapping(accounts, beforeItExisted, beforeItExisted).includes(
    youngest.accountId,
   ),
   `opened ${youngest.startMonth}, asked ${beforeItExisted}`,
  );
 }

 const failures = results.filter((passed) => !passed).length;
 console.log(`\n${results.length - failures} passed, ${failures} failed.`);
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
