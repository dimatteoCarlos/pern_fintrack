//backend/src/index.js
// ========================
// 📥 Imports
// ========================
import pc from 'picocolors';

//Database utils and conection
import { pool, checkConnection } from './db/config/configDB.js';
import { cleanRevokedTokens } from './utils/authUtils/authFn.js';

//import app from separate config file
import app from './app.js';

import { initializeDatabase } from './db/run_time_db_init/initDatabase.js';

const PORT = parseInt(process.env.PORT ?? '5000');

//=======================
// Server starting and Event Handlings
//=======================
// Inicializar la base de datos y luego iniciar el servidor // Data Base and Server initialization
//-----------------------
//Initiate db, clear tokens and start server
console.log(pc.yellowBright('Hola Mundo'));

async function startServer() {
  try {
    console.log(
      pc.yellowBright(
        'HELLO WORLD FROM INDEX.JS.startServer',
        'ESTO NO DEBERIA EJECUTARSE EN SERVERLESS',
      ),
    );
   //Verify Data base connection
    await checkConnection(); //in configDB
    await initializeDatabase();
    await cleanRevokedTokens();

    //=======================
    // Set server & Error handling
    //=======================
    app.listen(PORT, '0.0.0.0', () => {
      console.log(pc.yellowBright(`Server running on port ${PORT}`));
    });
  } catch (error) {
    console.error(pc.red('Critical error during startup:', error));
    process.exit(1);
  }
}
//VERCEL automatically assigns VERCEL variable to '1' when executing inside its environment
if (!process.env.VERCEL) {
  startServer();
}

//==================================
//error handler of db connection pool
pool.on('error', (err) => {
  console.error(pc.redBright('Unexpected error on idle client', err));
});

//Handler for safe application termination (Ctrl+C) / Manejador para una terminación segura de la aplicación (Ctrl+C)

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(pc.cyan('Shutting down gracefully...'));
  pool.end(() => {
    console.log(pc.greenBright('Database pool closed.'));
    //reference: https://nodejs.org/api/process.html#process_process_exit_code
    process.exit(0);
    // process.exitCode=0;
  });
});
