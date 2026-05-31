//backend/src/db/initDatabase.js
// Database initialization logic (tables, constraints, initial data)
// ====================
// 📥 Imports
// ====================
import pc from 'picocolors';

//Database utils and conection
import { pool } from '../config/configDB.js';

import {
  tableExists,
  tblAccountTypes,
  tblCategoryNatureTypes,
  tblCurrencies,
  tblMovementTypes,
  tbltransactionTypes,
  tblUserRoles,
} from './populateDB.js';

import {
  mainTables,
  createTables,
  addFxAuditColumns,
  recreateExchangeRatesTable,
} from './createTables.js';

// Flag to force recreation of exchange_rates table (cache reset)
// Set environment variable RESET_EXCHANGE_RATES=true to enable, or change to true manually
const FORCE_RECREATE_EXCHANGE_RATES =
  process.env.RESET_EXCHANGE_RATES === 'true' || false;

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
