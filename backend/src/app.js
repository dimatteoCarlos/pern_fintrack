//backend/src/app.js

// ====================
// 📥 Imports
// ====================
// Express configuration (middlewares, routes, CORS, error handlers)
import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import cookieParser from 'cookie-parser';
// import useragent from 'express-useragent';
// import dotenv from 'dotenv';

//API ROUTES AND AUTHENTICACION FUNCTIONS
// import { verifyToken } from './middlewares/authMiddleware.js';
// import routes from './routes/index.js';
// import fintrack_routes from './fintrack_api/routes/index.js';

//db test
// import { pool } from './db/config/configDB.js';
// import cronRoutes from './cronjob/cronRoutes.js';

//Environment variables configuration

// ==================================
// ⚙️ Express app configuration
// ==================================
//app config, global middlewares application, safety, request records and data handling
const app = express();
// dotenv.config();

//muchos servicios cloud) usan proxies inversos. Express debe confiar en el proxy para obtener la IP real y el protocolo correcto (HTTP/HTTPS). Se coloca después de const app = express():
// trust proxy only in production (e.g., Render, Vercel)
// if (process.env.NODE_ENV === 'production') {
//   app.set('trust proxy', 1); // trust the first proxy
// }

//Middlewares initialization
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true }));
// app.use(useragent.express());
// app.disable('x-powered-by');
// app.use(helmet());
// app.use(morgan('dev'));
// app.use(cookieParser()); //Enable cookies analysis

//CORS Configuration for access control
// const ACCEPTED_ORIGINS = [
//   'http://localhost:5000',
//   'http://localhost:5173',
//   'http://localhost:5174',
//   'http://localhost:3000',
//   'http://localhost:3001',
//   'http://localhost:8080',
//   'http://localhost:1234',
//   'http://localhost:5432',
//   process.env.CLIENT_URL,
//   'https://vercel.com/cadrs-projects/pern-fintrack-frontend',
// ].filter(Boolean);

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (!origin || ACCEPTED_ORIGINS.includes(origin)) {
//         return callback(null, true);
//       }
//       console.error('CORS error: Origin not allowed', origin);

//       return callback(
//         new Error('Your address is not an allowed origin by CORS'),
//         false,
//       );
//     },
//     credentials: true, // Allow to send cookies
//     allowedHeaders: ['Content-Type', 'Authorization'],
//   }),
// );

// allow cross origin sharing request
// app.use(cors('*'));
// app.use(cors({ origin: true, credentials: true }));
// app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' })); // Encabezado para recursos de origen cruzado

// ==================================
// 🛣️ TESTING API ROUTING WITH VERCEL
// ==================================
// considering backend as root directory in vercel
// ----------------------
//HEALTH
app.get('/api/health', (req, res) => {
  console.log('✅ /api/health invoked');
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    message: 'Testing vercel-serverless',
    step: 'test with importing and exporting app.js'
  });
});
// Testing routes:
// db test
// app.get('/api/db-test', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT 1 as test');
//     res.json({ success: true, data: result.rows });
//   } catch (error) {
//     console.error('DB test error', error);
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });


// =====================
// 🛣️ API ROUTING
// =====================
// api main routes and associated controllers
// ----------------------
//MIDDLEWARE ROUTE HANDLING OR ROUTES CONFIGURATION
// app.use('/api', routes); //main app routes
// app.use('/api/fintrack', verifyToken, fintrack_routes);
// app.use('/api/cronjob', cronRoutes);

// ==================================
//🚩 404 errors handler
// ==================================
// --- 404 handler for undefined routes ---
//not defined (404 Not Found) routes handler
// app.use('*', (req, res) => {
//   res.status(404).json({ error: '404', message: 'Route link was not found' });
// });

// ==================================
//❌ gobal errors handler
// ==================================
// app.use((err, req, response, next) => {
//   console.error(('error handled response ', err));

//   const errorStatus = err.status || 500;
//   const errorMessage = err.message || 'Something went wrong';

//   response.status(errorStatus).json({
//     message: errorMessage,
//     status: errorStatus,
//     stack: process.env.NODE_ENV == 'development' ? err.stack : undefined,
//   });
// });

export default app;
