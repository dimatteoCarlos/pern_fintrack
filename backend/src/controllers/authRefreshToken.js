//src/controllers/authRefreshToken.js

import jwt from 'jsonwebtoken';
import {
  createRefreshToken,
  createToken,
} from '../../utils/authUtils/authFn.js';
import { createError } from '../../utils/errorHandling.js';
import { pool } from '../db/configDB.js';
import pc from 'picocolors';
import { sendSuccessResponse } from '../../utils/authUtils/sendSuccessResponse.js';
// Controller for refreshing the access token using a valid refresh token
export const authRefreshToken = async (req, res, next) => {
  console.log(pc.green('authRefreshToken'));
  //catch refreshtoken sent by client
  const refreshTokenFromClient =
    req.body.refreshToken || req.cookies.refreshToken;

  if (!refreshTokenFromClient) {
    return next(createError(401, 'Refresh token is required'));
  }

  try {
    // Verify the signature of the refresh token
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        refreshTokenFromClient,
        process.env.JWT_REFRESH_TOKEN_SECRET,
        (err, decoded) => {
          if (decoded) {
            resolve(decoded);
          } else {
            reject(err);
          }
        }
      );
    });
    console.log({ decoded });
    // if (!decoded?.userId) return next(createError(403, 'Invalid token'));
    const userId = decoded?.userId;
    console.log({ userId });
    if (!userId) {
      return next(createError(403, 'Invalid refresh token signature.'));
    }
    // Check token in database
    const refreshTokenResult = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND revoked = FALSE AND expiration_date > NOW()',
      [refreshTokenFromClient, userId]
    );
    const storedRefreshToken = refreshTokenResult.rows[0];

    // If no valid refresh token is found in the database, the token is invalid or expired

    if (!storedRefreshToken) {
      return next(createError(401, 'Invalid or expired refresh token.'));
    }
    // Fetch the user information from the users table
    const userResult = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.user_role_id, ur.user_role_name FROM users u JOIN user_roles ur ON u.user_role_id = ur.user_role_id WHERE user_id = $1 `,
      [userId]
    );
    const user = userResult.rows[0];

    console.log('user', userId, 'userResult.rows', userResult.rows, user);

    if (!user) {
      return next(createError(404, 'User not found for this refresh token.'));
    }

    // Generate new access token
    const newAccessToken = createToken(user.user_id, user.user_role_name);

    //new refresh token if less a limit remained life is left
    const currentRefreshTokenExpiry = decoded.exp * 1000;
    const limitRemLife = ((decoded.exp - decoded.iat) * 1000) /4 ; //set arbitrarily
    const now = new Date();
    const remainingTime = currentRefreshTokenExpiry - now;

    let newRefreshToken = refreshTokenFromClient;

    if (remainingTime < limitRemLife) {
      console.log('token a punto de expirar hay que hacer uno nuevo')
      newRefreshToken = createRefreshToken(user.user_id);
      //insert new refresh token in db
      const expirationDate = new Date(now.setDate(now.getDate() + 7));
      console.log('🚀 ~ authRefreshToken ~ expirationDate:', expirationDate);

      await pool.query(
        'INSERT INTO refresh_tokens(user_id, token,  expiration_date, user_agent, ip_address) VALUES($1,$2,$3,$4, $5)',
        [
          user.user_id,
          newRefreshToken,
          expirationDate,
          req.headers['user-agent'],
          req.ip,
        ]
      );

      // Revoke the old refresh token
      await pool.query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1',
        [refreshTokenFromClient]
      );
    }

    console.log(
      pc.yellow(
        `New refresh token generated for user ${user.username || user.email}`
      )
    );
    console.log({ user });

    // Determine client type and send tokens accordingly
    if (req.clientDeviceType === 'mobile') {
      sendSuccessResponse(res, 200, 'Access token refreshed.', {...user,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } else {
      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000, // Access token lifespan
        sameSite: 'strict',
      });
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // Refresh token lifespan
        sameSite: 'strict',
      });
      res.clearCookie('accessToken'); // Clear the old access token cookie

//probar esto
      sendSuccessResponse(res, 200, 'Access token refreshed.');
    }
  } catch (error) {
    console.log(pc.red('auth error:', error));
    next(createError(500, error.message || 'internal refreshToken error'));
  }
};


/*Aquí están los pasos que la aplicación cliente debería seguir:

Detectar el error: Interceptar la respuesta de la API /api/auth/refresh-token y verificar el código de estado (debería ser 401) y el mensaje de error.
Eliminar los tokens almacenados localmente: Borrar cualquier accessToken y refreshToken que estén almacenados en el almacenamiento local (localStorage, AsyncStorage, cookies, etc.). Esto es crucial para evitar intentos futuros de usar tokens inválidos.
Redirigir al usuario a la pantalla de inicio de sesión: Navegar a la página o sección de la aplicación donde el usuario puede ingresar sus credenciales (usuario/correo y contraseña) y autenticarse de nuevo.
Informar al usuario (opcional pero recomendado): Mostrar un mensaje amigable al usuario indicando que su sesión ha expirado y necesita volver a iniciar sesión. Esto mejora la experiencia del usuario al explicar por qué se le está pidiendo que se autentique nuevamente.
¿Por qué es necesario redirigir al login?

Un "Invalid or expired refresh token" significa que la cadena de confianza para mantener la sesión del usuario de forma automática se ha roto. Las razones comunes para esto incluyen:

Expiración del refresh token: Ha pasado el tiempo máximo de validez configurado para el refresh token.
Revocación explícita: El refresh token fue revocado intencionalmente desde el backend (por ejemplo, durante un logout en otro dispositivo o por una acción administrativa).
Problemas de seguridad: Podría haber indicios de un posible compromiso de la cuenta, lo que llevó a la invalidación de los tokens.
En cualquiera de estos casos, intentar generar un nuevo accessToken con un refreshToken inválido no es seguro. La única acción segura es obligar al usuario a autenticarse de nuevo, estableciendo una nueva sesión con nuevos tokens.

En resumen, cuando el frontend recibe un error de "Invalid or expired refresh token.", la acción principal es limpiar cualquier token local y redirigir al usuario a la pantalla de login */
