// src/middleware/authMiddleware.js
// getAuthToken,clearAccessTokenFromCookie, verifyJWTToken, handleTokenError, verifyToken,verifyUser, verifyAdmin

import jwt from 'jsonwebtoken';
import { createError } from '../utils/errorHandling.js';
import { pool } from "../db/configDB.js"; // 

// import { getTokenSource } from './authDetectClientType.js';
//constants
// const accessMode ={MOBILE:'mobile', WEB:'web'}

// ==========================================
// 📊 ROLE HIERARCHY CONFIGURATION
// ==========================================
const ROLE_LEVELS = {
  'user': 1,
  'admin': 2,
  'super_admin': 3
};

const TOKEN_ERRORS = {
  TokenExpiredError: { message: 'Token expired.', status: 401 },
  JsonWebTokenError: { message: 'Invalid token.', status: 403 },
  NotBeforeError: { message: 'Token not yet active.', status: 403 }
};

//---utils functions
// ==========================================
// 🔍 UTILS: TOKEN EXTRACTION & VERIFICATION
// ==========================================
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
//old sintaxis
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
};
/**
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded;
} catch (err) {
  throw new Error('Invalid token');
}
 */
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
    message: 'Invalid token. Please sign in again.', //Authentication failed
    status: 403 
  };

  // Clear cookie. if token expired and was in cookies
  if (error.name === 'TokenExpiredError' && req.cookies?.accessToken) {
    clearAccessTokenFromCookie(res);
  }

  console.error('TOKEN VERIFICATION ERROR:', error.name, errorConfig.message);
  return createError(errorConfig.status, errorConfig.message);
};

// ====================================
// 🛡️ ATOMIC MIDDLEWARE: AUTHENTICATION
// JWT TOKEN VERIFICATION.
// ====================================
/**
 * verifyToken: Only ensures the user is logged in.
 * Use for: General routes where user identity is needed.
 */
export const verifyToken = async (req, res, next) => {
 console.log('verifyToken');
  try {
  const token = getAuthToken(req);

  if (!token) {
    console.error('Error when verifying token');
    return next(
      createError(
        401,
        'Access Unauthenticated. No token provided. Please sign in.'
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
// 👤 ATOMIC MIDDLEWARE: VERIFY USER OWNERSHIP & HIERARCHY
// ==========================================
// Middleware to check authentication and authorization: 
// 1. Authenticate (verifyToken)
// 2. Authorize. verifyOwnership. Check if the user is the owner of the targetAccountId OR is an Admin.
//-------------------------------------------
export const verifyUser = async (req, res, next) => {

  if (!req.user) {
    const token = getAuthToken(req);
    if (!token) return next(createError(401, 'Authentication required.'));

    try { req.user = await verifyJWTToken(token); } 
    catch (err) { return next(handleTokenError(err, req, res)); }
  }

  const { userId: authId, role: authRole } = req.user;
// const { userId } = req.user;
 console.log("DEBUG: Verificando userId:", authId, 'user role:', authRole);

  const targetAccountId = req.params.targetAccountId || req.params.id;

  if (!targetAccountId) return next(createError(500, 'Developer Error: targetAccountId missing in params.'));

  try {
    const query = `
      SELECT u.user_id, ur.user_role_name FROM user_accounts acc 
      JOIN users u ON acc.user_id = u.user_id
      JOIN user_roles ur ON u.user_role_id=ur.user_role_id
      WHERE acc.account_id = $1`;

    const result = await pool.query(query, [targetAccountId]);

    if (result.rows.length === 0) return next(createError(404, 'The account you are trying to access does not exist.'));

    const { user_id: ownerId, user_role_name: ownerRole } = result.rows[0];

    const isOwner = authId === ownerId;
    const hasAuthority = ROLE_LEVELS[authRole] > ROLE_LEVELS[ownerRole];
    const isSuperAdmin = authRole === 'super_admin';

    if (isOwner || hasAuthority || isSuperAdmin) return next();

    return next(createError(403, 'Unauthorized: You do not have authority over this resource.'));
  } catch (err) {
   console.error("❌ Auth Error Detail:", err.message);
    return next(createError(500, 'Database error during authorization.'));
  }
};

// ===========================
// middleware de verificación de privilegios de administrador
// =================================
// 🔑 ATOMIC MIDDLEWARE: ADMIN ONLY
// =================================
// Solo verifica si es Admin (Asume que verifyToken ya corrió)
export const verifyAdmin = (req, res, next) => {
  const { role } = req.user; 
  if (role === 'admin' || role === 'super_admin') {
    return next();
  }
  return next(createError(403, 'Se requieren privilegios de administrador.'));
};
//---------
// Verifica si es Admin, pero antes verifia que req.user ya existe, de lo contrario, realizar el verify token antes (autosuficiente y seguro)
/**
 * verifyAdmin: Ensures user has at least 'admin' role.
 * Independent: Auto-calls token verification if req.user is missing.
 */
export const verifyTokenAndAdmin = async (req, res, next) => {
  if (!req.user) {
    const token = getAuthToken(req);
    if (!token) return next(createError(401, 'Authentication required.'));
    try { req.user = await verifyJWTToken(token); } 
    catch (err) { return next(handleTokenError(err, req, res)); }
  }

  if (ROLE_LEVELS[req.user.role] >= ROLE_LEVELS['admin']) return next();
  return next(createError(403, 'Admin privileges required for this action.'));
};

// ===========================
// 🛠️ DYNAMIC AUTHORIZATION
// ===========================
/**
 * verifyAuthorization: The all-in-one dynamic middleware.
 * @param {string} requiredRole - 'user' (ownership), 'admin', 'super_admin'
 */
export const verifyAuthorization = (requiredRole = 'user') => {
  return async (req, res, next) => {
    try {
      // 1. Ensure Authentication
      if (!req.user) {
        const token = getAuthToken(req);
        if (!token) return next(createError(401, 'Please sign in to continue.'));
        req.user = await verifyJWTToken(token);
      }

      const { userId: authId, role: authRole } = req.user;

      // 2. Handle 'user' level (Special logic for Ownership + Hierarchy)
      if (requiredRole === 'user') {
        return verifyUser(req, res, next);
      }

      // 3. Handle 'admin' or 'super_admin' levels
      const authPower = ROLE_LEVELS[authRole] || 0;
      const requiredPower = ROLE_LEVELS[requiredRole] || 0;

      if (authPower >= requiredPower) return next();

      return next(createError(403, `Access denied. ${requiredRole} role required.`));
    } catch (error) {
      return next(handleTokenError(error, req, res));
    }
  };
};

/*
javascript
// PUT /api/accounts/123
// Solo el dueño de la cuenta 123 o un Admin puede editarla
router.put('/:targetAccountId', verifyAuthorization('user'), accountController.update);
Use code with caution.

2. Nivel: Solo Administradores (admin)
Úsalo para rutas de gestión donde un usuario común no tiene permiso, pero un admin o super_admin sí.
javascript
// GET /api/admin/all-users
// Solo usuarios con rol 'admin' o 'super_admin' en la DB
router.get('/all-users', verifyAuthorization('admin'), adminController.getAllUsers);
Use code with caution.

3. Nivel: Máxima Seguridad (super_admin)
Úsalo para acciones críticas que incluso un admin normal no debería poder tocar.
javascript
// DELETE /api/admin/system-reset
// Solo el 'super_admin' puede ejecutar esto
router.delete('/system-reset', verifyAuthorization('super_admin'), adminController.resetSystem);
Use code with caution.

¿Cómo funciona por dentro según el argumento?
Si pasas...	El middleware hará:
'user'	1. Valida el Token.
2. Busca quién es el dueño del targetAccountId en la DB.
3. Compara si el que pide es el dueño o alguien con más rango.
'admin'	1. Valida el Token.
2. Mira el rol del usuario en la DB.
3. Solo deja pasar si el rol es igual o mayor a admin.
'super_admin'	1. Valida el Token.
2. Solo deja pasar si el rol es exactamente super_admin.

Ventaja para ti como Desarrollador:
Si el día de mañana creas un nuevo rol en la base de datos llamado 'manager', no tienes que crear un nuevo middleware. Simplemente lo añades a tu objeto ROLE_LEVELS y lo usas así:
verifyAuthorization('manager').
Nota importante: Recuerda que para que funcione el nivel 'user', tu ruta debe tener el parámetro :targetAccountId definido (ejemplo: /api/account/:targetAccountId).

*/