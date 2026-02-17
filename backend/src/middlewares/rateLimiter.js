//backend/src/middleware/rateLimiter.js
// backend/src/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';

// =========================================
// 🎯 KEY GENERATOR (USER-SPECIFIC LIMITING)
// =========================================
const keyGenerator = (req) => {
  const safeIp = ipKeyGenerator(req);
  
  // Versión que mantiene formato similar al original
  const userId = req.user?.userId;
  
  if (userId) {
    // Formato: "userId_ip" (pero con IP segura)
    return `${userId}_${safeIp}`;
  }
  
  // Para anónimos: solo IP segura
  return safeIp;
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
  max: PROFILE_MAX_ATTEMPTS, //Maximum REF 10 attempts per window
// Key generator: use userId if authenticated, otherwise IP
 keyGenerator,
 standardHeaders: true,// Return rate limit info in headers
 legacyHeaders: false, // Disable legacy headers
 skipSuccessfulRequests: true,// Only Counts failed requests

// Custom handler for rate limit exceeded
  handler: (req, res) => {
    res.status(429).json(
     createRateLimitResponse(
      'RateLimitExceeded',
      `Security: Too many UPDATE attempts. Try again in ${WINDOW_MINUTES} minutes.`,
      profileUpdateLimiter.windowMs,
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
  max: MAX_ATTEMPTS,// 🚨 password change attempts
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
  max: 5,// 5 authentication attempts per window
  message: { 
    success: false,
    error: 'AuthRateLimitExceeded',
    message: 'Too many authentication attempts. Please try again in 5 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
// Always use IP for auth endpoints (before user is logged in)
  keyGenerator: ipKeyGenerator, // Track by IP address
  handler: (req, res) => {
   res.status(429).json(
   createRateLimitResponse(
    'AuthRateLimitExceeded',
    'Too many login attempts. Please wait before trying again.',
    authLimiter.windowMs
   ));
  }
});

// =======================================
// 🔄 GLOBAL API RATE LIMITER (optional safety net)
// =======================================
export const globalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Maximum 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator:ipKeyGenerator,
  
  handler: (req, res) => {
    res.status(429).json(
      createRateLimitResponse(
        'GlobalRateLimitExceeded',
        'Too many requests to our API. Please slow down.',
        globalLimiter.windowMs
      )
    );
  }
});

export default {
  profileUpdateLimiter,
  passwordChangeLimiter,
  authLimiter,
  globalLimiter,
};
