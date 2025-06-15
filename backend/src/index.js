//backend/src/index.js
// import express, { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { pool, checkConnection } from './db/configDB.js';
import useragent from 'express-useragent';
// import '../utils/authUtils/cronJobs.js';

import {
  tableExists,
  tblAccountTypes,
  tblCategoryNatureTypes,
  tblCurrencies,
  tblMovementTypes,
  tbltransactionTypes,
  tblUserRoles,
} from './db/populateDB.js';
import pc from 'picocolors';
import { mainTables, createTables } from './db/createTables.js';
import routes from './routes/index.js';
import fintrack_routes from './fintrack_api/routes/index.js';
// import { verifyToken } from './middlewares/authMiddleware.js';
import { cleanRevokedTokens } from '../utils/authUtils/authFn.js';

// import passport from 'passport';
// import './config/passport.js';

dotenv.config();
const app = express();
app.use(useragent.express());
app.disable('x-powered-by');
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

const PORT = parseInt(process.env.PORT ?? '5000');

//Middlewares
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true })); //
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
  })
);
// app.use(cors('*'));
//allow cross origin sharing request
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use(cookieParser());
// Inicializa el middleware de Passport en la aplicación Express.Operaciones que realiza:
// Prepara el sistema de autenticación para su uso
// Añade los métodos de Passport al objeto req (como req.login(), req.logout())
//Establece las bases para el manejo de estrategias de autenticación
// app.use(passport.initialize());

//------------------
//Middleware route handling or routes configuration
app.use('/api', routes);
app.use('/api/fintrack', fintrack_routes);
// app.use('/api/fintrack', verifyToken, fintrack_routes);
//------------------
//response to undefined route request
app.use('*', (req, res) => {
  res.status(404).json({ error: '404', message: 'Route link was not found' });
});

//---function declration---------------
//Database initialization.  Función para inicializar la base de datos
async function initializeDatabase() {
  try {
    console.log(pc.cyanBright('Verificando existencia de datos en tablas ...'));

    //---------------------
    // Verify initialization status
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
    // Create tables as per status of initialization
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

      //Create all the main tables
      await pool.query('SET CONSTRAINTS ALL DEFERRED');
      await createTables();
      await pool.query('SET CONSTRAINTS ALL IMMEDIATE');
      //Mark as initialized app
      await pool.query(
        `
        INSERT INTO app_initialization (tables_created) VALUES (TRUE)
        ON CONFLICT (id)
        DO UPDATE SET
          tables_created = EXCLUDED.tables_created,
          updated_at = NOW()
        `
      );

      console.log(pc.green('Application initialized successfully'));
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    //----------
    } else {
      console.log(pc.yellow('Application already initialized. Skipping tables creation.'));
    }
    //--------------------------------------------------
    //truncate or drop all tables manually
    if (false) {
      await Promise.allSettled(
        mainTables.map(async (item, indx) => {
          try {
            if (item.tblName == 'users' || item.tblName!=='transactions_') {
              console.log('skip users table');
              return false;
            }
            await pool.query({
              text: `TRUNCATE TABLE ${item.tblName}  RESTART IDENTITY CASCADE`,
            });
            await pool.query({ text: `DROP TABLE ${item.tblName} CASCADE` });
            console.log(indx, item.tblName, 'truncated');
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
    //=====================================
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
    //=========================
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
//---
//=================================================================
// Server starts here.
//=======================
// Inicializar la base de datos y luego iniciar el servidor
//------------------
//Initiate
console.log('Hola Mundo');
await checkConnection();
await initializeDatabase()
  .then(async () => {
    try {
      await cleanRevokedTokens(); // Ahora con await
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
pool.on('error', (err) => {
  console.error(pc.redBright('Unexpected error on idle client', err));
  // Termina la aplicación si hay un error grave
  // process.exit(-1);
});
//----------------------
//message error handling
// app.use((err: CustomError, req: Request, res: Response, next: NextFunction) => {
app.use((err, req, response, next) => {
  console.error(('error handled response ', err));
  const errorStatus = err.status || 500;
  const errorMessage = err.message || 'Something went wrong';
  response.status(errorStatus).json({
    message: errorMessage,
    status: errorStatus,
    stack: process.env.NODE_ENV == 'development' ? err.stack : undefined, //modificado
  });
});
//--------------------------------
process.on('SIGINT', () => {
  console.log(pc.cyan('Shutting down gracefully...'));
  pool.end(() => {
    console.log(pc.greenBright('Database pool closed.'));
    // https://nodejs.org/api/process.html#process_process_exit_code
    process.exit(0);
    // process.exitCode=0;
  });
});
