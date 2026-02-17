//backend/src/index.js
// ====================
// 📥 Imports
// ====================
//Main server modules
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import useragent from 'express-useragent';
import dotenv from 'dotenv';
import pc from 'picocolors';
// import '../utils/authUtils/cronJobs.js';

//Database utils and conection
import { pool, checkConnection } from './db/configDB.js';
import {
  tableExists,
  tblAccountTypes,
  tblCategoryNatureTypes,
  tblCurrencies,
  tblMovementTypes,
  tbltransactionTypes,
  tblUserRoles,
} from './db/old_run_time_migrations/populateDB.js';
import { mainTables, createTables } from './db/old_run_time_migrations/createTables.js';

//API ROUTES AND AUTHENTICACION FUNCTIONS
import routes from './routes/index.js';
import fintrack_routes from './fintrack_api/routes/index.js';
import { cleanRevokedTokens } from './utils/authUtils/authFn.js';
import { verifyToken } from './middlewares/authMiddleware.js';


//Environment variables configuration
dotenv.config();
// const {
  //   DB_USER,
  //   DB_NAME,
  //   DB_PASSWORD,
  //   DB_PORT,
  //   // PORT,
//   JWT_SECRET,
//   NODE_ENV,
// } = process.env;
// console.log(DB_USER, DB_NAME, DB_PASSWORD, DB_PORT, JWT_SECRET, NODE_ENV);

// ==================================
// ⚙️ Express app configuration
// ==================================
//app config, global middlewares application. 
//safety, request records and data handling
const app = express();
const PORT = parseInt(process.env.PORT ?? '5000');

//Middlewares initialization
app.use(useragent.express());
app.disable('x-powered-by');
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

//CORS Configuration for access control
app.use(
  cors({
    origin: (origin, callback) => {
      const ACCEPTED_ORIGINS = [
        'http://localhost:5000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8080',
        'http://localhost:1234',
        'http://localhost:5432',
      ];

      if (!origin || ACCEPTED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      console.error('CORS error: Origin not allowed', origin);

      return callback(
        new Error('Your address is not an accepted origin CORS'),
        false
      );
    },
    credentials: true, // Allow to send cookies
    allowedHeaders: ['Content-Type', 'Authorization'] 
  })
);
//allow cross origin sharing request
// app.use(cors('*'));
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));// Encabezado para recursos de origen cruzado
app.use(cookieParser());//Enable cookies analysis
// =====================
// 🛣️ API ROUTING
// =====================
//api main routes and associated controllers
//----------------------
//MIDDLEWARE ROUTE HANDLING OR ROUTES CONFIGURATION
app.use('/api', routes);//main app routes

app.use('/api/fintrack',
   verifyToken,
   fintrack_routes);
//----------------------
//response to undefined route request
//not defined (404 Not Found) routes handler
app.use('*', (req, res) => {
  res.status(404).json({ error: '404', message: 'Route link was not found' });
});
//---FUNCTION DECLARATION------------
// ===========================
// 📊 DATA BASE INITIALIZATION
// ============================
async function initializeDatabase() {
 try {
   console.log(pc.cyanBright('Verificando existencia de datos en tablas ...'));
 //---------------------
 //Verify initialization status
 //verify if app_initialization table exists
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
     `SELECT tables_created FROM app_initialization ORDER BY id DESC LIMIT 1`
   );
   //------------------------------
   // Create tables if data base is not initialized
   if (initCheck.rows.length === 0 || !initCheck.rows[0].tables_created) {
     console.log(pc.cyan('Initializing app for the first time....'));
 //----------
   //Transaction pg
   await pool.query('BEGIN');
   try {
     // Initialize tables with cataloged field attributes
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
     //Mark as initialized app
     await pool.query(`
       INSERT INTO app_initialization (tables_created) VALUES (TRUE)
       ON CONFLICT (id)
       DO UPDATE SET
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
     console.log(pc.yellow('Application already initialized. Skipping tables creation.'));
   }
   //---------------------------------
   //truncate or drop all tables manually
   if (false) {
     await Promise.allSettled(
       mainTables.map(async (item, indx) => {
         try {
           if (item.tblName == 'users' || item.tblName=='refresh_tokens') {
             console.log('skip: users table, refresh_tokens table');
             return false;
           }
           await pool.query({
             text: `TRUNCATE TABLE ${item.tblName} RESTART IDENTITY CASCADE`,
           });
            console.log(indx, item.tblName, 'truncated');

           await pool.query({ text: `DROP TABLE ${item.tblName} CASCADE` });
           console.log(indx, item.tblName, 'drop');

         } catch (error) {
           console.error('error truncating the table', `${item.tblName}`);
         }
       })
     ).then((results) => {
       if (results.status === 'fulfilled') {
         console.log(
           `Table ${mainTables[indx].tblName} was successfully truncated .`
         );
       } else if (results.status === 'rejected') {
         console.error(
           `Table ${mainTables[indx].tblName} failed to truncate:`,
           results.reason
         );
       }
     });
   }
   //=============================
   //create tables manually
   if (false) {
     await Promise.allSettled(
       mainTables.map(async (item, ind) => {
         try {
           await pool.query(item.table);
           console.log(ind, item.tblName, 'verified/created');
         } catch (error) {
           console.error(
             pc.red(`Error creating table ${item.tblName}:`, error)
           );
           throw error;
         }
       })
     ).then((results) => {
       results.forEach((result, indx) => {
         if (result.status === 'fulfilled') {
           console.log(
             `Table ${mainTables[indx].tblName} was successfully created .`
           );
         } else if (result.status === 'rejected') {
           console.error(
             `Table ${mainTables[indx].tblName} failed to create:`,
             result.reason
           );
         }
       });
     });
   }
   //=============================
   //---
   console.log(pc.greenBright('Base de datos inicializada correctamente.'));
 } catch (error) {
   console.error(
     pc.red('Error durante la inicialización de la base de datos:'),
     error
   );
   throw error; // Relanzar el error para manejarlo en el nivel superior
 }
}
//=======================
// Server starting and Event Handlings
//=======================
// Inicializar la base de datos y luego iniciar el servidor // Data Base and Server initialization 
//----------------------
//Initiate db, clear tokens and start server
console.log('Hola Mundo');
//Data base connection
await checkConnection();
await initializeDatabase()
  .then(async () => {
    try {
      await cleanRevokedTokens(); 
      app.listen(PORT, '0.0.0.0', () => {
        console.log(pc.yellowBright(`Server running on port ${PORT}`));
      });
    } catch (error) {
      console.error(pc.red('Error cleaning tokens:', error));
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(pc.red('Critical error during initialization:', error));
    process.exit(1); // Salir del proceso si hay un error crítico
  });
//=======================
//error handler of db connection pool
pool.on('error', (err) => {
  console.error(pc.redBright('Unexpected error on idle client', err));
// Termina la aplicación si hay un error grave  // process.exit(-1);
});
//----------------------
//gobal errors handler for Express 
app.use((err, req, response, next) => {
  console.error(('error handled response ', err));
  const errorStatus = err.status || 500;
  const errorMessage = err.message || 'Something went wrong';
  response.status(errorStatus).json({
    message: errorMessage,
    status: errorStatus,
    stack: process.env.NODE_ENV == 'development' ? err.stack : undefined, 
  });
});
//Handler for safe application termination (Ctrl+C)/Manejador para una terminación segura de la aplicación (Ctrl+C)

process.on('SIGINT', () => {
  console.log(pc.cyan('Shutting down gracefully...'));
  pool.end(() => {
    console.log(pc.greenBright('Database pool closed.'));
  // https://nodejs.org/api/process.html#process_process_exit_code
    process.exit(0);
    // process.exitCode=0;
  });
});
