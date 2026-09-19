// backend/src/utils/authUtils/acceptedOrigins.js
//
// Same pattern as configDB.js: unconditional, so this module reads
// process.env.CLIENT_URL correctly regardless of which other module happens
// to import it first. app.js's own top-level dotenv.config() runs too late
// for this - ES module imports the auth route tree before app.js reaches its
// own body, and this file is reached through that tree via authMiddleware.js.
import 'dotenv/config';
//
// The one list of origins this server trusts with a credentialed request.
// app.js's CORS middleware reads it to decide who a browser may fetch from;
// verifyOriginForCookieAuth (authMiddleware.js) reads the same list to decide
// who may POST to the two endpoints authenticated by an httpOnly cookie
// instead of a header. One list, because a second one drifting from this one
// would trust a browser origin CORS itself would have refused.
//
// The eight localhost origins are a development convenience: with
// credentials: true, any one of them can carry the browser's cookies, so
// listing them in production widens who can send an authenticated
// cross-origin request to every developer machine that happens to run a
// server on one of these ports, not just this app's own dev server.
const LOCALHOST_ORIGINS =
  process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:5000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8080',
        'http://localhost:1234',
        'http://localhost:5432',
      ];

export const ACCEPTED_ORIGINS = [
  process.env.CLIENT_URL,
  ...LOCALHOST_ORIGINS,
  'https://pern-fintrack.vercel.app',
].filter(Boolean);
