// backend/utils/authUtils/authFn.js
//hashed,isRight,createToken,createRefreshToken,cleanRevokedTokens,rotateRefreshToken

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pc from 'picocolors';
import { pool } from '../../db/configDB.js';
dotenv.config();
//------------------------------
const salt = Number(process.env.SALT_ROUNDS);

export const hashed = async (word) => {
  const salted = await bcrypt.genSalt(salt);
  const hashedWord = await bcrypt.hash(word, salted);
  return hashedWord;
};

//---
export const isRight = async (userPwd, hashedPwd) => {
  try {
    const isRightPwd = await bcrypt.compare(userPwd, hashedPwd);
    return isRightPwd;
  } catch (error) {
    process.env.ENV === 'development'
      ? console.error(error, 'error message comparing password')
      : console.error('error:', 'something went error');
  }
};

//--
export const createToken = (id, role) => {
  if (!id) {
    throw new Error('the user id is required to generate the token.');
  }

  if (!role) {
    throw new Error('the user role is required to generate the token.');
  }

  // Verificar que la clave secreta esté configurada
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in environment variables')
  }

const expiresIn = process.env.NODE_ENV === 'development' 
    ? '1h'  // ✅ 5m 5 minutos in development
    : '1h'; // ✅ 30m minutes in production

// Consistencia: expiresIn en el token y maxAge en la cookie deben estar sincronizados
  return jwt.sign(
    { userId: id, type: 'access_token', role,
       iat: Math.floor(Date.now() / 1000)  },
    process.env.JWT_SECRET,
    {
      // expiresIn: process.env.JWT_ACCESS_EXPIRATION || '1h',
       expiresIn,
      issuer: process.env.JWT_ISSUER || 'fintrack app',
      // audience: process.env.JWT_AUDIENCE || 'your-app-users'
    }
  );
};

//--
export const createRefreshToken = (id) => {
  if (!id) {
    throw new Error('the user id is required to generate the token.');
  }

  // Verificar que la clave secreta esté configurada
  if (!process.env.JWT_REFRESH_TOKEN_SECRET) {
    throw new Error(
      'JWT_REFRESH_TOKEN_SECRET is not configured on environment variables.La clave secreta JWT no está configurada en las variables de entorno.'
    );
  }
//refresh token expiration time
  const expiresIn = process.env.NODE_ENV === 'development'
    ? '7d'// ✅ 1 hora en desarrollo
    : '7d'; // ✅ 7 días en producción

  return jwt.sign(
    { userId: id,
       type: 'refresh_token',iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_REFRESH_TOKEN_SECRET,
    {
      expiresIn,
    // expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d', 
     issuer: process.env.JWT_ISSUER || 'fintrack',
      // audience: process.env.JWT_AUDIENCE || 'your-app-users'
    }
  );
};

//------------
export async function cleanRevokedTokens() {
  try {
    await pool.query('SELECT 1');
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - 1*0);
    console.log("🚀 ~ cleanRevokedTokens ~ daysAgo:", daysAgo)

    const result = await pool.query(
      'DELETE FROM refresh_tokens WHERE revoked = TRUE OR (updated_at <= $1 OR expiration_date <= $1)',
      [daysAgo]
    );

    console.log(
      pc.greenBright(
        `Limpieza de tokens revocados al inicio: ${result.rowCount} tokens eliminados.`
      )
    );
  } catch (error) {
    console.error(
      pc.redBright(
        'Error durante la limpieza inicial de tokens revocados:',
        error
      )
    );
  }
}
//-------------------
//table diagnostic
export async function verifyTableStructure() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'refresh_tokens'
    `);
    console.log('Estructura de refresh_tokens:', result.rows);
    return result.rows;
  } catch (error) {
    console.error('Error al verificar estructura:', error);
    throw error;
  }
}
//---
export const rotateRefreshToken = async (oldToken, userId, req) => {
 const client = await pool.connect();
  try {
    await client.query('BEGIN');
//FUNCTIONS DECLARATION
// 1. 📛 REVOKE OLD TOKEN
console.log('aqui deberia estar revocando el refresh token viejo', oldToken)

    const revokeResult = await client.query(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, updated_at = NOW() 
       WHERE token = $1 AND user_id = $2`,
      [oldToken, userId]
    );

    if (revokeResult.rowCount === 0) {
      throw new Error('Old refresh token not found for revocation');
    }

// 🆕 2.CREATE NEW REFRESH TOKEN
    const newRefreshToken = createRefreshToken(userId);

// ✅ 3.EXPIRATION DATE / CALCULAR FECHA DE EXPIRACIÓN (consistent with expiresIn)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7 días

// 3. 💾 SAVE NEW TOKEN TO DB
    await client.query(
      `INSERT INTO refresh_tokens 
       (user_id, token, expiration_date, user_agent, ip_address) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        newRefreshToken,
        expirationDate,
        req.headers['user-agent'],
        req.ip
      ]
    );
    await client.query('COMMIT');
    
console.log('🔄 Refresh token rotated successfully');

    return newRefreshToken;

  } catch (error) {
    await client.query('ROLLBACK');
console.error('❌ Error rotating refresh token:', error);
    throw error;
  } finally {
    client.release();
  }
};

//---
export const revokeAllUserRefreshTokens  = async (userId,clientOrPool=pool) => {

 try {
  const dbClient = clientOrPool ?? pool;
// 📛 REVOKE ALL FRESH TOKENS
  console.log('Entering revocation of all refresh tokens')
 
  const revokeResult = await dbClient.query(
   `UPDATE refresh_tokens 
    SET revoked = TRUE, updated_at = NOW() 
    WHERE revoked = $1 AND user_id = $2`,
    [false, userId]
   );
  
  console.log('revoke all refresh tokens:', revokeResult.rows)
  
 } catch (error) {
// Log and relaunch
    console.error('Error revoking refresh tokens:', error.message);
    throw error;
 }
};


