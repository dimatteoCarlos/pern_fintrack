//backend/src/middleware/rateLimiter.js
// backend/src/middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

// =========================================
// 🎯 KEY GENERATOR (USER-SPECIFIC LIMITING)
// =========================================
const keyGenerator = (req) => {
  // Prioritize authenticated userId, fallback to IP for unauthenticated
  return req.user?.userId || req.ip;
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
// Limits: 10 attempts per 15 minutes per user
export const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, //Maximum 10 attempts per window
// Key generator: use userId if authenticated, otherwise IP
 keyGenerator,
  // message: { 
  //   success: false, 
  //   error: 'RateLimitExceeded',
  //   message: "Too many update attempts. Please try again in 15 minutes." 
  // },
  standardHeaders: true,// Return rate limit info in headers
  legacyHeaders: false, // Disable legacy headers
  skipSuccessfulRequests: true,// Only Counts failed requests

// Custom handler for rate limit exceeded
  handler: (req, res) => {
    res.status(429).json(
     createRateLimitResponse(
      'ProfileUpdateRateLimitExceeded',
      'Too many profile update attempts. Please try again in 15 minutes',
      profileUpdateLimiter.windowMs,
     )
   );
  }
}
);

// =================================
// 🔐 PASSWORD CHANGE RATE LIMITER
// =================================
// Limits: 5 attempts per 15 minutes per user (security-critical)
export const passwordChangeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,// 🚨 Only 5 password change attempts
  keyGenerator,

  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,//Count all (even successes)

  handler:(req, res)=>{
   res.status(429).json(
    createRateLimitResponse(
    'PasswordChangeRateLimitExceeded',
    'Security: Too many password change attempts. Try again in 15 minutes.',
    passwordChangeLimiter.windowMs
    )
   )
  }
 });

// ==========================================
// 🔐 AUTHENTICATION RATE LIMITER (for login/register)
// ==========================================
// Limits: 5 login attempts per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,// 5 authentication attempts per window
  message: { 
    success: false,
    error: 'AuthRateLimitExceeded',
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
// Always use IP for auth endpoints (before user is logged in)
  keyGenerator: (req) => req.ip, // Track by IP address
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.ip,
  
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
