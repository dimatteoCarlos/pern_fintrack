//backend/src/initDatabase.js
// Database initialization logic (tables, constraints, initial data)
// ====================
// 📥 Imports
// ====================
import pc from 'picocolors';

//Database utils and conection
import { pool } from './configDB.js';

import {
  tableExists,
  tblAccountTypes,
  tblCategoryNatureTypes,
  tblCurrencies,
  tblMovementTypes,
  tbltransactionTypes,
  tblUserRoles,
} from './run_time_migrations/populateDB.js';

import {
  mainTables,
  createTables,
} from './run_time_migrations/createTables.js';

// ===========================
// 📊 DATA BASE INITIALIZATION
// ============================
export async function initializeDatabase() {
  try {
    console.log(pc.cyanBright('Verificando existencia de datos en tablas ...'));

    //Verify app_initialization table
    const exists = await tableExists('app_initialization');
    if (!exists) {
      const createQuery = ` CREATE TABLE IF NOT EXISTS app_initialization (
    id SERIAL PRIMARY KEY,
    tables_created BOOLEAN NOT NULL DEFAULT FALSE,
    initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
      await pool.query(createQuery);
    }

    const initCheck = await pool.query(
      `SELECT tables_created FROM app_initialization ORDER BY id DESC LIMIT 1`,
    );

    //------------------------------
    // Create tables if data base is not initialized
    if (initCheck.rows.length === 0 || !initCheck.rows[0].tables_created) {
      console.log(pc.cyan('Initializing app for the first time....'));
      //----------
      //Transaction pg
      await pool.query('BEGIN');
      try {
        // Initialize tables with catalogued field attributes
        await tblAccountTypes();
        await tblCurrencies();
        await tblCategoryNatureTypes();
        await tblUserRoles();
        await tbltransactionTypes();
        await tblMovementTypes();

        //Create the main tables
        await pool.query('SET CONSTRAINTS ALL DEFERRED');
        await createTables();
        await pool.query('SET CONSTRAINTS ALL IMMEDIATE');

        //Mark as initialized
        await pool.query(`
     INSERT INTO app_initialization (tables_created) VALUES (TRUE)
     ON CONFLICT (id) DO UPDATE SET
       tables_created = EXCLUDED.tables_created,
       updated_at = NOW()
     `);
        await pool.query('COMMIT');

        console.log(pc.green('Application initialized successfully'));
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
      //----------
    } else {
      console.log(
        pc.yellow('Application already initialized. Skipping tables creation.'),
      );
    }
    //---------------------------------
    //truncate or drop all tables manually
    //Manual truncate/drop (disabled by flags)
    const tableActions = { isActive: false, allTables: false, isDrop: false };

    if (tableActions.isActive) {
      await Promise.allSettled(
        mainTables.map(async (item, indx) => {
          try {
            if (!tableActions.allTables) {
              if (item.tblName == 'users' || item.tblName == 'refresh_tokens') {
                console.log('skip: users table, refresh_tokens table');
                return false;
              }
            }

            await pool.query({
              text: `TRUNCATE TABLE ${item.tblName} RESTART IDENTITY CASCADE`,
            });
            console.log(indx, item.tblName, 'truncated');

            if (tableActions.isDrop) {
              await pool.query({ text: `DROP TABLE ${item.tblName} CASCADE` });
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
    //=============================
    //Create tables manually
    const createDbFlag = false;
    if (createDbFlag) {
      await Promise.allSettled(
        mainTables.map(async (item, ind) => {
          try {
            await pool.query(item.table);
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
    }
    //=============================
    console.log(pc.greenBright('Base de datos inicializada correctamente.'));
  } catch (error) {
    console.error(
      pc.red('Error durante la inicialización de la base de datos:'),
      error,
    );
    throw error; // Relanzar el error para manejarlo en el nivel superior
  }
}
