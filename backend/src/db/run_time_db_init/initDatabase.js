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

import {
  mainTables,
  createTables,
  addFxAuditColumns,
  ensureBudgetTables,
  ensureBudgetAllocationBackfill,
  ensureCategoryBudgetCurrency,
  recreateExchangeRatesTable,
} from './createTables.js';

// Flag to force recreation of exchange_rates table (cache reset)
// Set environment variable RESET_EXCHANGE_RATES=true to enable, or change to true manually
const FORCE_RECREATE_EXCHANGE_RATES =
  process.env.RESET_EXCHANGE_RATES === 'true' || false;

/**
 * Fail fast if the seeded frequency catalog and MONTHS_PER_PERIOD disagree.
 *
 * NO LONGER CALLED. budget_frequency_types was removed with the monthly
 * allocation model; this guard is kept, uncalled, until the deletion block that
 * closes the budget module (PLAN_BUDGET_V1 §9.4).
 *
 * A frequency code is a lookup key, not a label. A code seeded in the catalog
 * but absent from the map makes getNumberOfPeriods return undefined, and the
 * arithmetic downstream yields NaN with no error raised. A code in the map with
 * no catalog row breaks the foreign key on budget_policy_allocations. Both
 * directions are checked because either one produces silent wrong numbers or a
 * 500, not a clean failure.
 *
 * Compared against MONTHS_PER_PERIOD, not the allowed-allocation list. Whether
 * a code is currently OFFERED to users is a product decision (REMARKS R15) and
 * boot has no business asserting it; whether a stored code can be priced is an
 * invariant, and that is what this protects.
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
export async function initializeDatabase() {
  const client = await pool.connect();

  try {
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
    // [FX Migrations execute / Migraciones FX (siempre se ejecutan, son idempotentes)
    // =======================================
    await addFxAuditColumns(client);

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

    // Runtime counterpart of migration 011: production is built by this path,
    // not by the migration runner, so the constraint has to be applied here too.
    await ensureCategoryBudgetCurrency(client);

    // Runtime counterpart of migration 012, for the same reason as the two
    // calls above: production is built by this path, so a database that never
    // saw the runner would keep its legacy budgets unmigrated.
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
