// import express, { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { pool, checkConnection } from './db/configDB.js';
import {
  tblAccountTypes,
  tblCategoryNatureTypes,
  tblCurrencies,
  tblMovementTypes,
  tbltransactionTypes,
  tblUserRoles,
} from './db/populateDB.js';
import pc from 'picocolors';
import { createMainTables } from './db/createTables.js';
import routes from './routes/index.js';
import fintrack_routes from './fintrack_api/routes/index.js';

// import passport from 'passport';
// import './config/passport.js';

dotenv.config();
// interface CustomError extends Error {status?:number}
// type CustomError = Error & { status?: number };
// const app: Express = express();
const app = express();
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
        'http://localhost:3001',
        'http://localhost:8080',
        'http://localhost:1234',
        'http://localhost:5432',
        'http://localhost:5173',
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
//------------------
//response to undefined route request
app.use('*', (req, res) => {
  res.status(404).json({ error: '404', message: 'Rooute link was not found' });
});

//------------------

//Initiate
console.log('Hola Mundo');
//------------------
//Database initialization.  Función para inicializar la base de datos
async function initializeDatabase() {
  try {
    console.log(pc.cyanBright('Verificando existencia de datos en tablas ...'));
    // --
    // Initialize tables with catalogued field attributes
    // await tblCurrencies();
    // await tblUserRoles();
    // await tblAccountTypes();
    // await tblMovementTypes();
    // await tbltransactionTypes();
    // await tblCategoryNatureTypes();
    //--------------------------------------------------
    //truncate tables
    if (false) {
      await Promise.allSettled(
        createMainTables.map(async (item, indx) => {
          try {
            //await pool.query({ text: `TRUNCATE TABLE ${item.tblName} CASCADE` });
            await pool.query({ text: `DROP TABLE ${item.tblName} CASCADE` });
            console.log(indx, item.tblName, 'truncated');
          } catch (error) {
            console.error('error truncating the table', `${item.tblName}`);
          }
        })
      ).then((results) => {
        if (results.status === 'fulfilled') {
          console.log(
            `Table ${createMainTables[indx].tblName} was successfully truncated .`
          );
        } else if (results.status === 'rejected') {
          console.error(
            `Table ${createMainTables[indx].tblName} failed to truncate:`,
            results.reason
          );
        }
      });
    }
    //create tables
    if (false) {
      await Promise.allSettled(
        createMainTables.map(async (item, ind) => {
          try {
            await pool.query(item.table);
            console.log(ind, item.tblName, 'created');
          } catch (error) {
            console.error(
              pc.red(`Error creating table ${item.tblName}:`, error)
            );
          }
        })
      ).then((results) => {
        results.forEach((result, indx) => {
          if (result.status === 'fulfilled') {
            console.log(
              `Table ${createMainTables[indx].tblName} was successfully created .`
            );
          } else if (result.status === 'rejected') {
            console.error(
              `Table ${createMainTables[indx].tblName} failed to create:`,
              result.reason
            );
          }
        });
      });
    }
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
// Server starts here. Inicializar la base de datos y luego iniciar el servidor
await checkConnection();

await initializeDatabase()
  .then(() => {
    // Iniciar el servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(pc.yellowBright(`Server running on port ${PORT}`));
    });
  })
  .catch((error) => {
    console.error(pc.red('Critical error during initialization:', error));
    process.exit(1); // Salir del proceso si hay un error crítico
  });

pool.on('error', (err) => {
  console.error(pc.redBright('Unexpected error on idle client', err));
  // Termina la aplicación si hay un error grave
  // process.exit(-1);
});
//----------------------
//message error handling
// app.use((err: CustomError, req: Request, res: Response, next: NextFunction) => {
app.use((err, req, response, next) => {
  console.error(pc.red('error handled response ', err));
  const errorStatus = err.status || 500;
  const errorMessage = err.message || 'Something went wrong';
  response.status(errorStatus).json({
    message: errorMessage,
    status: errorStatus,
    stack: process.env.NODE_ENV === 'development' ? err.stack : err.stack,
  });
});

process.on('SIGINT', () => {
  console.log(pc.cyan('Shutting down gracefully...'));
  pool.end(() => {
    console.log(pc.greenBright('Database pool closed.'));
    // https://nodejs.org/api/process.html#process_process_exit_code
    process.exit(0);
    // process.exitCode=0;
  });
});
