//backend/src/app.js

// ====================
// 📥 Imports
// ====================
// Express configuration (middlewares, routes, CORS, error handlers)
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import useragent from 'express-useragent';

//API ROUTES AND AUTHENTICACION FUNCTIONS
import routes from './auth_api/routes/index.js';
import { verifyToken } from './auth_api/middlewares/authMiddleware.js';
import fintrack_routes from './fintrack_api/routes/index.js';

//db test
import { pool } from './db/config/configDB.js';

//Get currency catalog function
import { loadCurrencyCatalog } from './fintrack_api/services/fx_services/currency_catalog/loadCurrencyCatalog.js';

// import cronRoutes from './cronjob/cronRoutes.js';

//Environment variables configuration
// ================================
// ⚙️ Express app configuration
// ================================
//app config, global middlewares application, safety, request records and data handling
const app = express();

// Load .env conditionally (Vercel injects env vars automatically)
if (!process.env.VERCEL) {
  dotenv.config();
}

// ============================
// Token secret, checked at load
// ============================
// Every sign, verify and refresh reads process.env.JWT_SECRET. Missing, the
// failure surfaces on the first authenticated request as a 500 whose message
// does not name the cause, and it surfaces again on every serverless cold
// start. The check moves that failure to load time, where the deployment log
// states which variable is absent. The value itself is never printed.
const JWT_SECRET_MIN_LENGTH = 32;

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set. Tokens cannot be signed or verified without it.',
  );
}

if (process.env.JWT_SECRET.length < JWT_SECRET_MIN_LENGTH) {
  console.warn(
    `⚠️ JWT_SECRET is shorter than ${JWT_SECRET_MIN_LENGTH} characters. A short secret can be recovered offline from any token the server has issued.`,
  );
}

// ============================
// Initialize in-memory currency catalog
// ============================
try {
  await loadCurrencyCatalog();
  console.log('✅ Currency catalog loaded successfully');
} catch (err) {
  console.error('❌ Failed to load currency catalog:', err.message);
}

// ============================
// TRUST PROXY only in production (e.g., Render, Vercel)
// ============================
//muchos servicios cloud) usan proxies inversos. Express debe confiar en el proxy para obtener la IP real y el protocolo correcto (HTTP/HTTPS). Se coloca después de const app = express():

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // trust the first proxy
}

//Middlewares initialization
app.use(helmet());
//CORS Configuration for access control
const ACCEPTED_ORIGINS = [
  process.env.CLIENT_URL,
  'http://localhost:5000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://localhost:1234',
  'http://localhost:5432',
  'https://pern-fintrack.vercel.app',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ACCEPTED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      console.error('CORS error: Origin not allowed', origin);

      return callback(
        new Error('Your address is not an allowed origin by CORS'),
        false,
      );
    },
    credentials: true, // Allow to send cookies
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

//----only for testings ----------
// allow cross origin sharing request
// app.use(cors('*'));
// app.use(cors({ origin: true, credentials: true }));
// app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' })); // Encabezado para recursos de origen cruzado
//---------------------------------
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); //Enable cookies analysis
app.use(morgan('dev'));
app.use(useragent.express());

// ==================================
// 🛣️ TESTING API ROUTING WITH VERCEL
// ==================================
// considering backend as root directory in vercel
// --- TESTING PUBLIC ROUTES:--------------
//METRICS
// Global variable to show number of requests
let totalRequests = 0;

// Middleware COUNTER
app.use((req, res, next) => {
  totalRequests++; // Suma 1 con cada petición del frontend
  console.log(`Total request received: ${totalRequests}`);
  next();
});
//-------------------------
//HEALTH
app.get('/api/health', (req, res) => {
  console.log('✅ /api/health invoked');
  // The route is public and unauthenticated, so it answers only that the
  // process is up. The rollout note that used to travel here named which
  // routes were being enabled and which test was in progress, which is a
  // description of the deployment handed to anyone holding the URL.
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    message: 'Testing vercel-serverless',
  });
});
//-------------------------
// DB TEST
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1 as test');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    // The driver's text names the host, the role, the database and whether the
    // connection is encrypted. It belongs in the log, not in the response: this
    // route is public and unauthenticated, so anyone holding the URL reads it.
    console.error('DB test error', error);
    res.status(500).json({
      success: false,
      error: 'Database unreachable',
    });
  }
});

// =====================
// 🛣️ API ROUTING
// =====================
// api main routes and associated controllers
// ----------------------
//MIDDLEWARE ROUTE HANDLING OR ROUTES CONFIGURATION

app.use('/api', routes); //main app routes

// globalLimiter is off this router while rate limiting is revised (REMARKS R23).
// One counter measured a dashboard paint with the same ruler as a password guess,
// so a normal session exhausted it.
app.use('/api/fintrack', verifyToken, fintrack_routes);

// app.use('/api/cronjob', cronRoutes);

// ==================================
//🚩 404 errors handler
// ==================================
// --- 404 handler for undefined routes ---
//not defined (404 Not Found) routes handler
app.all('*', (req, res) => {
  res.status(404).json({ error: '404', message: 'Route link was not found' });
});

// ==================================
//❌ gobal errors handler
// ==================================
app.use((err, req, response, next) => {
  console.error('error handled response ', err);

  const errorStatus = err.status || 500;
  const errorMessage = err.message || 'Something went wrong';

  response.status(errorStatus).json({
    message: errorMessage,
    status: errorStatus,
    // Emitted only when the thrower declared one. An error without a stable
    // identity keeps the exact body it returns today, so nothing already
    // reading this response has to change.
    ...(err.errorCode ? { error: err.errorCode } : {}),
    ...(err.details ? { details: err.details } : {}),
    stack: process.env.NODE_ENV == 'development' ? err.stack : undefined,
  });
});

export default app;
