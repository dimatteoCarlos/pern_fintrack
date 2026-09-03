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
const createRateLimitResponse =(errorType, userMessage, windowMs)=>({
success:false,
error:errorType,
message:userMessage,
retryAfter:Math.ceil(windowMs/1000)//in seconds
});

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
    options.windowMs // Use 'options' to safely access config values
    // passwordChangeLimiter.windowMs
    )
   )
  }
 });

// =====================================
// 🔐 AUTHENTICATION RATE LIMITER (for login/register)
// ======================================
// Limits: 5 login attempts per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,// 5 authentication attempts per window
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
    options.windowMs
   ));
  }
});

// =====================================
// 🆕 SIGN-UP RATE LIMITER (account creation)
// =====================================
// Counts successes: a completed sign-up is the request this limit exists to cap.
// authLimiter cannot serve here, it skips them so a correct password costs nothing.
export const signUpLimiter = rateLimit({
 windowMs: 60 * 60 * 1000, // 1 hour
 limit: 5, // 5 accounts per hour per IP
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
