// src/middleware/authMiddleware.js
// getAuthToken,clearAccessTokenFromCookie, verifyJWTToken, handleTokenError, verifyToken,verifyUser, verifyAdmin

import jwt from 'jsonwebtoken';
import { createError } from '../utils/errorHandling.js';
import { pool } from "../db/configDB.js"; // 

// import { getTokenSource } from './authDetectClientType.js';
//constants
// const accessMode ={MOBILE:'mobile', WEB:'web'}

const TOKEN_ERRORS = {
  TokenExpiredError: { message: 'Token expired.', status: 401 },
  JsonWebTokenError: { message: 'Invalid token.', status: 403 },
  NotBeforeError: { message: 'Token not yet active.', status: 403 }
};

//---utils functions
// =================================
// GET AUTHENTICATION TOKEN
// =================================
export const getAuthToken = (req) => {
  //console.log('🔍 ALL HEADERS RECEIVED:', req.headers); // ← DEBUG
  // console.log('🔍 HEADERS keys:', Object.keys(req.headers));
  // console.log('🔍 COOKIES:', req.cookies);

  // Check Authorization header   
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
 if (authHeader && authHeader.startsWith('Bearer ')) {
  const token = authHeader.split(' ')[1];
  console.log('✅ Access Token found  in headers');
  // console.log('✅ Token found in headers:', token);
  return token;
  }
  
// CHECK COOKIE (FOR WEB APP)
  if (req.cookies.accessToken) {
    console.log('✅ Token found in cookies');
    // console.log('✅ Token found in cookies:', req.cookies.accessToken);
    return req.cookies.accessToken;
  }
  
  console.log('❌ No token provided in headers or cookies');
  return null;
};

// =================================
// CLEAR ACCESS COOKIE
// =================================
export const clearAccessTokenFromCookie = (res) => {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/api',
  });
};

// =================================
// VERIFY JWT TOKEN (Función centralizada)
// ==============================
const verifyJWTToken = async (token) => {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Invalid token format');
  }

  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
};
//=================================
//🎯 TOKEN ERROR HANDLING FUNCTION
//=================================
/*
JWT LIB ERROR MESSAGES
TokenExpiredError	Ocurre cuando un token ha pasado su fecha de vencimiento (exp claim)

JsonWebTokenError	Un error genérico que indica un problema con el token, como una firma inválida (el token fue alterado) o un formato incorrecto.

NotBeforeError	Sucede si se intenta usar un token antes de su fecha de validez (nbf claim).
*/
// =================================
// HANDLE TOKEN ERROR (Función centralizada)
// =================================
const handleTokenError = (error, req, res) => {
  const errorConfig = TOKEN_ERRORS[error.name] || { 
    message: 'Invalid token. Please sign in again.', 
    status: 403 
  };

  // Clear cookie if token expired and was in cookies
  if (error.name === 'TokenExpiredError' && req.cookies?.accessToken) {
    clearAccessTokenFromCookie(res);
  }

  console.error('TOKEN VERIFICATION ERROR:', error.name, errorConfig.message);
  return createError(errorConfig.status, errorConfig.message);
};

// ====================================
// MIDDLEWARE OF JWT TOKEN VERIFICATION
// ====================================
export const verifyToken = async (req, res, next) => {
 console.log('verifyToken');

  try {
  const token = getAuthToken(req);

  if (!token) {
    console.error('Error when verifying token');
    return next(
      createError(
        401,
        'Access Unauthenticated. No token provided. Please sign in again'
      )
    );
  }

  const decoded = await verifyJWTToken(token);
// Adjuntar información del usuario al req
    req.user = decoded;
    console.log('Token successfully verified for req.user:');
    next();

  } catch (error) {
   return  next(handleTokenError(error, req, res));
  }
};
// ==========================================
// 🔑 VERIFY USER AND RESOURCE OWNERSHIP
// ==========================================
// Middleware to check authentication and authorization: 
// 1. Authenticate (verifyToken)
// 2. Check if the user is the owner of the targetAccountId OR is an Admin.
//-------------------------------------------
export const verifyUser = (req, res, next) => {
    console.log('VERIFYUSER MIDDLEWARE EXECUTED');
    
    // 1. Execute token verification first
    verifyToken(req, res, async (error) => { // Must be async here
        if (error) return next(error);

        // Check if token verification successfully attached user info
        if (!req.user || !req.user.userId || !req.user.role) {
            return next(createError(401, 'User not authenticated or token data missing.'));
        }

        const { userId: authenticatedUserId, role: userRole } = req.user;
        const targetAccountId = req.params.targetAccountId; // 🎯 Correctly extract the Account ID

        if (!targetAccountId) {
            // This middleware should only run on routes with this param
            return next(createError(500, 'Middleware misconfiguration: targetAccountId parameter is missing.'));
        }

        try {
            // 2. RESOURCE OWNERSHIP CHECK: Query the database to find the account owner
            const ownerQuery = `
                SELECT user_id 
                FROM user_accounts 
                WHERE account_id = $1
            `;
            const result = await pool.query(ownerQuery, [targetAccountId]);

            if (result.rows.length === 0) {
                // If the account doesn't exist, we deny access to prevent information leakage
                console.log(`Access denied: Target Account ${targetAccountId} not found.`);
                return next(createError(404, 'Target account not found.')); 
            }

            const ownerId = result.rows[0].user_id;
            
            console.log(`Authenticated User ID: ${authenticatedUserId}, Account Owner ID: ${ownerId}, Role: ${userRole}`);

            // 3. AUTHORIZATION LOGIC
            const isOwner = authenticatedUserId === ownerId;
            const isAdmin = userRole === 'admin' || userRole === 'super_admin';

            if (isOwner || isAdmin) {
                console.log(`Access granted for ${authenticatedUserId}`);
                
                // IMPORTANT: Attach the ownerId to the request for service validation/logging if needed
                req.ownerId = ownerId; 
                req.authenticatedRole = userRole; // Attach role for easy access in controllers/services

                next();
            } else {
                console.log(`Access denied. User ${authenticatedUserId} is not the owner of ${targetAccountId} and is not an admin.`);
                return next(createError(403, 'Access not authorized. You do not own this resource.'));
            }

        } catch (dbError) {
            console.error('Database Error during resource ownership check:', dbError);
            return next(createError(500, 'Internal server error during authorization check.'));
        }
    });
};

// ===========================
// MIDDLEWARE DE VERIFICACIÓN DE PRIVILEGIOS DE ADMINISTRADOR
// ===========================
export const verifyAdmin = (req, res, next) => {
  console.log('verifyAdmin');
  const { userId, userRole } = req.user; //need to know how the user info was structured on req.user

  // Usar verifyToken primero
  verifyToken(req, res, (error) => {
    if (error) return next(error);

    const { userId, role: userRole } = req.user;

    if (userRole === 'admin' || userRole === 'super_admin') {
      console.log(`Access granted to user ${userId} as ${userRole}`);
      next();
    } else {
      console.log(`Access denied for user ${userId} with role ${userRole}`);
      return next(createError(403, 'Admin privileges required'));
    }
  });
};
