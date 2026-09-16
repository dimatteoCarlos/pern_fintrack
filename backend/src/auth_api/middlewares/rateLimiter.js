//backend/src/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';

// =========================================
// 🎯 KEY GENERATOR (USER-SPECIFIC LIMITING)
// =========================================
// The helper takes the ip STRING. Handed a request it finds no IPv6 inside an
// object and returns the object unchanged, and the store is a Map: a fresh
// request every call means a fresh key every call, so nothing ever accumulates.
const keyGenerator = (req) => {
 const safeIp = ipKeyGenerator(req.ip);
 // Versión que mantiene formato similar al original
 const userId = req.user?.userId;
 return userId ? `${userId}_${safeIp}` : safeIp;
};

// =========================================
// 🎯 HELPER FUNCTION: STANDARD 429 RESPONSE
// =========================================
// retryAfter used to always report the configured window length (e.g. every
// signUpLimiter 429 said "3600 seconds", even to a caller one second away
// from their own reset) - the wrong number by design, not a typo: it read
// like the 1-hour access-token lifetime (authFn.js:70-73's `expiresIn: '1h'`)
// rather than a rate-limit window reasoned about on its own. express-rate-
// limit (standardHeaders: true, set on every limiter below) already computes
// the caller's real reset time and attaches it at req.rateLimit.resetTime -
// this now reports that, falling back to windowMs only if a store ever omits it.
const createRateLimitResponse = (errorType, userMessage, resetTime, windowMs) => {
 const secondsRemaining = resetTime
  ? Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
  : Math.ceil(windowMs / 1000);

 return {
  success: false,
  error: errorType,
  message: userMessage,
  retryAfter: secondsRemaining, // in seconds
 };
};

// =================================
// 🎯 PROFILE UPDATE RATE LIMITER
// =================================
// Limits: 10 attempts per 15 minutes per user is the reference
const PROFILE_WINDOW_MINUTES =2;
const PROFILE_MAX_ATTEMPTS = 5;

export const profileUpdateLimiter = rateLimit({
  windowMs: PROFILE_WINDOW_MINUTES * 60 * 1000, // 5 minutes
  limit: PROFILE_MAX_ATTEMPTS, //Maximum REF 10 attempts per window
// Key generator: use userId if authenticated, otherwise IP
 keyGenerator,
 standardHeaders: true,// Return rate limit info in headers
 legacyHeaders: false, // Disable legacy headers
 skipSuccessfulRequests: false,// Counts all requests

// Custom handler for rate limit exceeded
  handler: (req, res, next, options) => {
    res.status(429).json(
     createRateLimitResponse(
      'RateLimitExceeded',
      `Security: Too many UPDATE attempts. Try again in ${PROFILE_WINDOW_MINUTES} minutes.`,
      req.rateLimit?.resetTime,
      options.windowMs, // Use 'options': windowMs is not attached to the returned middleware
     )
   );
  }
}
);

// =================================
// 🔐 PASSWORD CHANGE RATE LIMITER
// =================================
// Limits: 5 attempts per 15 minutes per user (security-critical) - best practice reference
const WINDOW_MINUTES = 0.5;
const MAX_ATTEMPTS = 5;

export const passwordChangeLimiter = rateLimit(
 {
  windowMs: WINDOW_MINUTES  * 60 * 1000,//ms
  limit: MAX_ATTEMPTS,// 🚨 password change attempts
  keyGenerator,

  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,//Count all (even successes)

  handler:(req, res, next, options)=>{
   res.status(429).json(
    createRateLimitResponse(
    'PasswordChangeRateLimitExceeded',
    `Security: Too many password change attempts. Try again in ${WINDOW_MINUTES} minutes.`,
    req.rateLimit?.resetTime,
    options.windowMs // Use 'options' to safely access config values
    // passwordChangeLimiter.windowMs
    )
   )
  }
 });

// =====================================
// 🔐 AUTHENTICATION RATE LIMITER (for login/register)
// ======================================
// Limits: 5 login attempts per 2 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  limit: 5,// 5 authentication attempts per window
  // Dead: the custom `handler` below overrides express-rate-limit's default
  // handler entirely, so this `message` is never sent - it already disagreed
  // with the real window (said 5 minutes while windowMs was 15) before this
  // change and would have kept disagreeing after it. Left in rather than
  // removed here: a call express-rate-limit's own default-handler behavior
  // makes for it, not this window-length fix.
  message: {
    success: false,
    error: 'AuthRateLimitExceeded',
    message: 'Too many authentication attempts. Please try again in 5 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Do not count successful logins toward the limit - login

// Always use IP for auth endpoints (before user is logged in). Express calls a
// keyGenerator with (req, res), so the helper cannot stand in for one: it would
// read the request itself as an ip.
  keyGenerator: (req) => ipKeyGenerator(req.ip),

  handler: (req, res,  next, options) => {
   res.status(429).json(
   createRateLimitResponse(
    'AuthRateLimitExceeded',
    'Too many login attempts. Please wait before trying again.',
    req.rateLimit?.resetTime,
    options.windowMs
   ));
  }
});

// =====================================
// 🆕 SIGN-UP RATE LIMITER (account creation)
// =====================================
// Counts successes: a completed sign-up is the request this limit exists to cap.
// authLimiter cannot serve here, it skips them so a correct password costs nothing.
// 4/15min is the production figure, set 2026-09-16 - the happy medium between
// the original 1-hour window (which matched authFn.js's access-token
// `expiresIn: '1h'` rather than any reasoned abuse-rate window, see
// createRateLimitResponse's comment above, and forced a legitimate caller to
// wait a full hour after one burst) and an earlier, too-permissive 2-minute
// window (5/2min allows a theoretical 150/hour, easily scripted). 4 accounts
// per 15 minutes caps a single IP at 16/hour - tight enough to blunt scripted
// abuse, short enough that a real signer-upper who fat-fingered a field twice
// is never locked out for more than 15 minutes. Local dev recreates the same
// demo account over and over while iterating
// (docs/VIDEO/promo-30s/data/seed-demo-account.js cleans up and signs it back
// up on every rerun), which trips the production limit inside a single work
// session - not the abuse pattern this exists to stop. Raised only outside
// production; the window itself applies in both.
const SIGN_UP_LIMIT = process.env.NODE_ENV === 'production' ? 4 : 1000;

export const signUpLimiter = rateLimit({
 windowMs: 15 * 60 * 1000, // 15 minutes
 limit: SIGN_UP_LIMIT, // 4 accounts per 15 minutes per IP in production
 standardHeaders: true,
 legacyHeaders: false,
 skipSuccessfulRequests: false,
 // No user exists yet at sign-up, so the shared keyGenerator has no id to use.
 keyGenerator: (req) => ipKeyGenerator(req.ip),
 handler: (req, res, next, options) => {
  res.status(429).json(
   createRateLimitResponse(
    'SignUpRateLimitExceeded',
    'Too many accounts created from this network. Please wait before trying again.',
    req.rateLimit?.resetTime,
    options.windowMs,
   ),
  );
 },
});

// =======================================
// 🔄 GLOBAL API RATE LIMITER (optional safety net)
// =======================================
export const globalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 100, // Maximum 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator, // ← userId + IP
  
  handler: (req, res, next, options) => {
    res.status(429).json(
      createRateLimitResponse(
        'GlobalRateLimitExceeded',
        'Too many requests to our API. Please slow down.',
        req.rateLimit?.resetTime,
        options.windowMs
      )
    );
  }
});

export default {
  profileUpdateLimiter,
  passwordChangeLimiter,
  authLimiter,
  signUpLimiter,
  globalLimiter,
};
