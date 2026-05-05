//backend/src/db/configDB.js
import pg from 'pg';
import pc from 'picocolors';
import { activeConfig } from './dbEnvironmentConfig.js';
import 'dotenv/config';

// USE DATABASE CONFIGURATION FROM CENTRAL CONFIG
//Log pool configuration (useful for debugging)
// console.log(
 //   pc.cyan(`[DB] Pool will be created with max=${dbConfig.max}`),
 //   pc.green(`ssl=${JSON.stringify(dbConfig.ssl)}`),
 // );
 
 function createPool (){
 const dbConfig = activeConfig.database;
 const pool = new pg.Pool(dbConfig);

// GLOBAL ERROR HANDLER (CRITICAL)
 pool.on('error', (err) => {
   console.error(
     pc.red(
       'Error inesperado en un cliente inactivo de la DB / Unexpected error on idle client:',
     ),
     err,
   );
   // No cerramos el proceso necesariamente, pero lo registramos
 });

 return pool;

}

//Apply singleton global for pool
export const pool = global._pool || (global._pool = createPool());

//function to verify db connection and log results
export async function checkConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    console.log(
      pc.italic(
        pc.yellowBright(
          'Conexión a la base de datos verificada / Database connection verified.',
        ),
      ),
    ); //Data base connection verified
  } catch (error) {
    console.error(error);
    console.error(error.stack);
    console.error(
      pc.red(
        '❌ Error crítico al conectar con la base de datos / Critical error connecting to database:',
        error,
        error.message,
      ),
    ); //Error when connecting to data base.
    // if (isProduction) throw error;
    throw error;
  }
}

