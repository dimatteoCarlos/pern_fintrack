//backend/src/db/initDatabase.js
// Database initialization logic (tables, constraints, initial data)
// ====================
// 📥 Imports
// ====================
import pc from 'picocolors';

//Database utils and conection
import { pool } from '../config/configDB.js';

import {
  resyncCatalogSequences,
  tableExists,
  tblAccountTypes,
  tblCategoryNatureTypes,
  tblCurrencies,
  tblMovementTypes,
  tbltransactionTypes,
  tblUserRoles,
} from './populateDB.js';

import { MONTHS_PER_PERIOD } from '../../fintrack_api/services/budget_services/core/budgetConfig.js';

import { assertLocalDestination } from '../migrations/dbMigrationConfig.js';

import {
  mainTables,
  createTables,
  addFxAuditColumns,
  ensureBudgetTables,
  ensureDailyExchangeRatesTable,
  ensureExchangeRateQueryCoverageTable,
  ensurePocketTables,
  ensureBudgetAllocationBackfill,
  ensureAccountClosureCatalog,
  ensureAccountTypeRequired,
  ensureAccountClosedAt,
  ensureTransactionOpeningFor,
  ensureAccountRegistry,
  ensureBalanceReversal,
  ensureTransactionStatusCheck,
  ensureCategoryBudgetCurrency,
  ensureCategoryBudgetFxColumns,
  recreateExchangeRatesTable,
} from './createTables.js';

// Flag to force recreation of exchange_rates table (cache reset)
// Set environment variable RESET_EXCHANGE_RATES=true to enable, or change to true manually
const FORCE_RECREATE_EXCHANGE_RATES =
  process.env.RESET_EXCHANGE_RATES === 'true' || false;

/**
 * Fail fast if the seeded frequency catalog and MONTHS_PER_PERIOD disagree.
 *
 * NO LONGER CALLED. The budget stopped reading a frequency when it moved to one
 * row per calendar month, so nothing prices a code any more.
 *
 * The table it reads no longer exists either. Migration 010 created
 * budget_frequency_types, budget_policies and budget_policy_allocations until
 * commit 3b72371f rewrote that file in place on 2026-08-12 to create
 * budget_monthly_allocations instead. A database that ran 010 before that date
 * keeps all three forever, because the ledger records 010 as applied and the
 * runner only executes what the ledger does not name; the production copy taken
 * on 2026-08-21 holds none of them.
 *
 * So there is no migration to wait for. Removing this guard is ordinary
 * cleanup, together with MONTHS_PER_PERIOD in budgetConfig.js, whose only
 * importer is this file.
 *
 * @param {object} client - Database client (pool or transaction)
 */
async function assertBudgetFrequenciesMatchConfig(client) {
 const { rows } = await client.query(
  'SELECT budget_frequency_code FROM budget_frequency_types',
 );
 const seeded = new Set(rows.map((r) => r.budget_frequency_code));
 const known = Object.keys(MONTHS_PER_PERIOD);

 const missing = known.filter((code) => !seeded.has(code));
 const unexpected = [...seeded].filter((code) => !known.includes(code));

 if (missing.length > 0 || unexpected.length > 0) {
  throw new Error(
   `budget_frequency_types is out of sync with MONTHS_PER_PERIOD. ` +
    `Missing from catalog: [${missing}]. Not in config: [${unexpected}].`,
  );
 }

 console.log(
  pc.green(`Budget frequency catalog matches config (${seeded.size} codes).`),
 );
}

// ===========================
// 📊 DATA BASE INITIALIZATION
// ============================
// NOT ON THE DEPLOYED REQUEST PATH. vercel.json builds and routes to
// backend/index.js, which imports src/app.js and nothing else. The only caller
// that boots a server is src/index.js, and it guards startServer() with
// `if (!process.env.VERCEL)`; the other two callers are the standalone init-db
// script and the parity harness. So every ensure* below serves local
// development and attended runs, and a deployed instance never executes one.
// Production receives a schema change exclusively through the migration chain.
export async function initializeDatabase() {
  const client = await pool.connect();

  try {
    // Every ensure* below applies DDL to whatever DATABASE_URI names, and .env
    // has named production during a migration more than once. db:migrate has
    // refused an off-machine destination since 2026-09-08 and this path did
    // not, so the two DDL paths now ask the same question. DB_REMOTE_OK is the
    // way through when a remote destination is meant.
    await assertLocalDestination(client, 'initializeDatabase');

    console.log(pc.cyanBright('Verificando existencia de datos en tablas ...'));

    //Verify app_initialization table
    const exists = await tableExists(client, 'app_initialization');
    if (!exists) {
      const createQuery = ` CREATE TABLE IF NOT EXISTS app_initialization (
       id SERIAL PRIMARY KEY,
       tables_created BOOLEAN NOT NULL DEFAULT FALSE,
       initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
      await client.query(createQuery);
    }

    const initCheck = await client.query(
      `SELECT tables_created FROM app_initialization ORDER BY id DESC LIMIT 1`,
    );

    //------------------------------
    // Create tables if data base is not initialized
    if (initCheck.rows.length === 0 || !initCheck.rows[0].tables_created) {
      console.log(pc.cyan('Initializing app for the first time....'));
      //----------
      //Transaction pg
      await client.query('BEGIN');
      try {
        // Initialize tables with catalog field attributes
        await tblAccountTypes(client);
        await tblCurrencies(client);
        await tblCategoryNatureTypes(client);
        await tblUserRoles(client);
        await tbltransactionTypes(client);
        await tblMovementTypes(client);

        //Create the main tables
        await client.query('SET CONSTRAINTS ALL DEFERRED');
        await createTables(client);
        await client.query('SET CONSTRAINTS ALL IMMEDIATE');

        //Mark as initialized
        await client.query(`
         INSERT INTO app_initialization (tables_created) VALUES (TRUE)
         ON CONFLICT (id)
         DO UPDATE SET
         tables_created = EXCLUDED.tables_created,
         updated_at = NOW()
     `);
        //UPDATE app_initialization
        // SET tables_created = TRUE, updated_at = NOW();
        await client.query('COMMIT');

        console.log(pc.green('Application initialized successfully'));
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } else {
      console.log(
        pc.yellow('Application already initialized. Skipping tables creation.'),
      );
    }

    // =======================================
    // Currency catalog (idempotent, runs on every boot)
    // =======================================
    // Same reason as every ensure* call below: the first-time block above is
    // skipped whenever app_initialization.tables_created is TRUE, so a currency
    // added to the catalog only there reached a virgin database and nothing
    // else. The call inside that block stays, because createTables() declares
    // foreign keys against currencies and needs the rows already present.
    //
    // Safe to repeat: the seeder returns early once the table holds every row
    // it writes, and each INSERT carries ON CONFLICT (currency_id) DO NOTHING.
    // It only ever adds a missing row; renaming an existing one belongs to the
    // migration chain, which is where 028_align_currency_names.sql did it.
    //
    // It does NOT reach production, for the reasons spelled out at the
    // historical rate store below. There the catalog row arrives through
    // 030_add_jpy_currency.sql and the runner.
    await tblCurrencies(client);

    // =======================================
    // [FX Migrations execute / Migraciones FX (siempre se ejecutan, son idempotentes)
    // =======================================
    await addFxAuditColumns(client);

    // =======================================
    // Historical rate store (idempotent, runs on every boot)
    // =======================================
    // Runtime counterpart of migration 021. Pure CREATE ... IF NOT EXISTS.
    //
    // WHAT THIS PATH REACHES, and it is not the Vercel deployment. Two
    // independent reasons: index.js:51 guards startServer behind
    // !process.env.VERCEL, and the serverless entrypoint backend/index.js
    // imports src/app.js alone, so this file is never even loaded there.
    //
    // What every ensure* call in this block covers is therefore local
    // development and any host that boots src/index.js — never production.
    // Production takes its schema from the migration runner alone, and a table
    // added only here would never arrive. For this one that is migration 021,
    // and the runner has to be pointed at that database.
    //
    // Before the FORCE_RECREATE_EXCHANGE_RATES block further down on purpose,
    // and unaffected by it: that flag resets the current-rate cache, and the
    // rate history must survive a cache reset. They are separate tables so
    // that the flag cannot reach this one.
    await ensureDailyExchangeRatesTable(client);

    // Immediately after the store it describes, and for the same reasons: it
    // references currencies, and a cache reset must not reach it. Coverage is
    // the record of which day ranges were actually requested of a provider,
    // which is what tells a real absence from a period never downloaded.
    await ensureExchangeRateQueryCoverageTable(client);

    // =======================================
    // Budget domain (idempotent, runs on every boot)
    // =======================================
    // Must run outside the initialization block above. That block is skipped
    // whenever app_initialization.tables_created is TRUE, which is the case on
    // every database that already existed before the budget module — production
    // included. Leaving this inside createTables() meant the tables were only
    // ever created on a virgin database, and the seeder below then aborted the
    // boot with "budget_frequency_types does not exist".
    // Pure CREATE ... IF NOT EXISTS, so it is safe on every boot, exactly like
    // addFxAuditColumns above.
    await ensureBudgetTables(client);

    // =======================================
    // Pocket domain (idempotent, runs on every boot)
    // =======================================
    // Same reason as the budget call above: a table created only inside the
    // first-time block never reaches a database that already exists. Pure
    // CREATE ... IF NOT EXISTS, so it is safe on every boot.
    //
    // It does NOT reach production: see the historical rate store call above,
    // which carries the reason for every ensure* call in this file.
    //
    // The data steps of 020 — copying pocket accounts into pockets, restoring
    // the funding balances and deleting the accounts — are NOT mirrored here.
    // They delete financial rows and report what they acted on, which belongs to
    // an attended migration run, not to a boot.
    await ensurePocketTables(client);

    // Runtime counterpart of migration 032, which had none. Unlike the calls
    // below it also seeds catalog rows, because the movement type seeder runs
    // only inside the first-time branch above and never reaches a database
    // that already exists.
    await ensureAccountClosureCatalog(client);

    // Runtime counterpart of migration 033. After the catalog seed above, not
    // before: the foreign key it re-adds points at account_types.
    await ensureAccountTypeRequired(client);

    // Runtime counterpart of migration 034. Order against the call above does
    // not matter - it adds a column and touches no catalog - but it stays here
    // so both user_accounts schema steps read as one block.
    await ensureAccountClosedAt(client);

    // Runtime counterpart of migration 022. Before the call below, not after:
    // that one repoints transactions.opening_for_account_id at the registry and
    // skips the key when the column is absent, so a database getting the column
    // here would otherwise wait a whole boot for its key.
    await ensureTransactionOpeningFor(client);

    // Runtime counterpart of migrations 035 and 036. The position is a
    // dependency and not a preference: it repoints keys on transactions,
    // debtor_accounts, pocket_allocations and budget_monthly_allocations, and
    // the last two are created by ensurePocketTables() and ensureBudgetTables()
    // above. Called before either of them it would find no table to alter and
    // leave the registry half wired.
    await ensureAccountRegistry(client);

    // Runtime counterpart of migration 037. After the call above and not
    // before: transactions.reversal_of_account_id references
    // account_registry(account_id), and that table is created by that call on
    // this path. Called first it would find no parent and skip the column,
    // leaving a database whose catalogs accept movement type 11 and whose
    // transactions table cannot name what a type 11 row reversed.
    await ensureBalanceReversal(client);

    // Runtime counterpart of migration 038. The position carries no
    // dependency: it needs the transactions table and nothing else, and that
    // table exists on both branches by here. It follows the call above so the
    // two counterparts that alter transactions stay in migration order.
    await ensureTransactionStatusCheck(client);

    // Runtime counterpart of migration 011, for the databases this file does
    // reach: a local or self-hosted one that has never had the runner pointed
    // at it. Production is not among them.
    await ensureCategoryBudgetCurrency(client);

    // Runtime counterpart of migration 014. After the call above, not before:
    // its backfill reads currency_id, which is what that call guarantees.
    await ensureCategoryBudgetFxColumns(client);

    // Runtime counterpart of migration 012, for the same reason as the two
    // calls above: a database that never saw the runner would keep its legacy
    // budgets unmigrated.
    await ensureBudgetAllocationBackfill(client);

    // Same reason as the two calls above: it must run outside the first-time
    // block, because the databases with stale sequences are precisely the ones
    // that skip it.
    await resyncCatalogSequences(client);

    // Recreate exchange_rates if flag is set
    if (FORCE_RECREATE_EXCHANGE_RATES) {
      await recreateExchangeRatesTable(client);
    }
    //------------------------------------
    //TRUNCATE OR DROP ALL TABLES MANUALLY
    //Manual truncate/drop (disabled by flags)
    const tableActions = { isTruncate: false, allTables: false, isDrop: false };

    if (tableActions.isTruncate) {
      await Promise.allSettled(
        mainTables.map(async (item, indx) => {
          try {
            if (!tableActions.allTables) {
              if (item.tblName == 'users' || item.tblName == 'refresh_tokens') {
                console.log('skip: users table, refresh_tokens table');
                return false;
              }
            }

            await client.query({
              text: `TRUNCATE TABLE ${item.tblName} RESTART IDENTITY CASCADE`,
            });
            console.log(indx, item.tblName, 'truncated');

            if (tableActions.isDrop) {
              await client.query({
                text: `DROP TABLE ${item.tblName} CASCADE`,
              });
              console.log(indx, item.tblName, 'drop');
            }
          } catch (error) {
            console.error('error truncating the table', `${item.tblName}`);
          }
        }),
      ).then((results) => {
        if (results.status === 'fulfilled') {
          console.log(
            `Table ${mainTables[indx].tblName} was successfully truncated .`,
          );
        } else if (results.status === 'rejected') {
          console.error(
            `Table ${mainTables[indx].tblName} failed to truncate:`,
            results.reason,
          );
        }
      });
    }
    //====================================
    //CREATE TABLES MANUALLY
    const createTableDbFlag = false;
    if (createTableDbFlag) {
      await Promise.allSettled(
        mainTables.map(async (item, ind) => {
          try {
            await client.query(item.table);
            console.log(ind, item.tblName, 'verified/created');
          } catch (error) {
            console.error(
              pc.red(`Error creating table ${item.tblName}:`, error),
            );
            throw error;
          }
        }),
      ).then((results) => {
        results.forEach((result, indx) => {
          if (result.status === 'fulfilled') {
            console.log(
              `Table ${mainTables[indx].tblName} was successfully created .`,
            );
          } else if (result.status === 'rejected') {
            console.error(
              `Table ${mainTables[indx].tblName} failed to create:`,
              result.reason,
            );
          }
        });
      });

      // Add FX columns into transactions / Asegurar columnas FX en trasactions (idempotente)
      // await addFxAuditColumns(client);

      // Add exchange_rates / Asegurar exchange_rates
      // await recreateExchangeRatesTable(client);
    }
    //=============================
    console.log(pc.greenBright('Base de datos inicializada correctamente.'));
  } catch (error) {
    console.error(
      pc.red('Error durante la inicialización de la base de datos:'),
      error,
    );
    throw error; // Relanzar el error para manejarlo en el nivel superior
  } finally {
    client.release();
  }
}
