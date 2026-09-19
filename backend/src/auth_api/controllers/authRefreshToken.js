//src/controllers/authRefreshToken.js
//url_refreshToken: 'http://localhost:5000/api/auth/refresh-token';
import jwt from 'jsonwebtoken';
import {
  createToken,
  hashToken,
  rotateRefreshToken,
} from '../../utils/authUtils/authFn.js';
import { createError } from '../../utils/errorHandling.js';

import { setRefreshTokenCookie } from '../../utils/authUtils/cookieConfig.js';

import { pool } from '../../db/config/configDB.js';
import pc from 'picocolors';

// Controller for refreshing the access token using a valid refresh token
export const authRefreshToken = async (req, res, next) => {
  console.log(pc.green('🔄 authRefreshToken called'));

  try {
    //✅ 1. CATCH REFRESH TOKEN
    const refreshTokenFromClient = req.cookies.refreshToken;

    if (!refreshTokenFromClient) {
      return next(createError(401, 'Refresh token is required'));
    }
    // ✅ 2. VERIFY THE SIGNATURE OF THE REFRESH TOKEN
    const decoded = jwt.verify(
      refreshTokenFromClient,
      process.env.JWT_REFRESH_TOKEN_SECRET,
      { issuer: process.env.JWT_ISSUER || 'fintrack app' },
    );
    //
    const userId = decoded?.userId;
    // console.log({ userId });

    if (!userId) {
      return next(createError(403, 'Invalid refresh token signature.'));
    }

    // createRefreshToken signs { type: 'refresh_token' }. The DB row this
    // token is checked against (step 3 below) has no type of its own, so
    // without this check a stolen access token that happened to verify under
    // this secret — it cannot today, the two secrets differ, but nothing
    // here asserted that — would read as a refresh token.
    if (decoded.type !== 'refresh_token') {
      return next(createError(403, 'Wrong token type.'));
    }

    // ✅ 3.CHECK TOKEN IN DATABASE (neither revoked nor expired)
    const refreshTokenResult = await pool.query(
      `SELECT * FROM refresh_tokens
       WHERE token = $1 AND user_id = $2 AND revoked = FALSE AND expiration_date > NOW()`,
      [hashToken(refreshTokenFromClient), userId],
    );

    const storedRefreshToken = refreshTokenResult.rows[0];

    // If no valid refresh token is found in the database, the token is invalid or expired

    if (!storedRefreshToken) {
      return next(createError(401, 'Invalid or expired refresh token'));
    }

    // ✅ 4.GET THE USER INFORMATION FROM THE USERS TABLE
    const userResult = await pool.query(
      `SELECT
   u.user_id, u.username, u.email, u.user_role_id, u.token_version,
   ur.user_role_name
  FROM  users u
  JOIN user_roles ur
  ON u.user_role_id = ur.user_role_id
  WHERE user_id = $1 `,
      [userId],
    );

    const user = userResult.rows[0];

    // console.log('user', userId, 'userResult.rows', userResult.rows, user);

    if (!user) {
      return next(createError(404, 'User not found.'));
    }

    // ✅ GENERATE NEW ACCESS TOKEN
    const newAccessToken = createToken(
      user.user_id,
      user.user_role_name,
      user.token_version,
    );

    // ✅ 6.VERIFY NEED OF ROTATION (at 10% remaining life)
    const currentRefreshTokenExpiry = decoded.exp * 1000;
    const now = Date.now();
    const remainingTime = currentRefreshTokenExpiry - now;
    const totalLifetime = (decoded.exp - decoded.iat) * 1000;

    // console.log('total life time', totalLifetime/1000/60)

    //rotation threshold or remnant life limit
    // totalLifetime is already in milliseconds. Multiplying it by a thousand
    // again put the threshold a thousand lifetimes ahead of a remainder that
    // never exceeds one, so the test below was always true and the token rotated
    // on every refresh, inserting a row per call.
    const limitRemLife = totalLifetime / 10; //threshold of 10% remanent life was arbitrarily set

    let newRefreshToken = refreshTokenFromClient;
    let shouldSetNewCookie = false;

    if (remainingTime < limitRemLife) {
      console.log(pc.yellow('🔄 Rotating refresh token (low remaining life)'));

      // ✅ ROTATE THE TOKEN (revoke old, create a new one)
      newRefreshToken = await rotateRefreshToken(
        refreshTokenFromClient,
        userId,
        req,
      );
      shouldSetNewCookie = true;
    }

    // ✅ 7.SEND RESPONSE
    if (shouldSetNewCookie) {
      // ✅ NEW REFRESH TOKEN IN COOKIE (rotated)
      setRefreshTokenCookie(res, newRefreshToken);
    }

    res.json({
      message: 'Access token refreshed successfully',
      accessToken: newAccessToken,
      expiresIn: 3600, // 1 hour in seconds, matching createToken
    });
    // console.log(pc.green(`✅ Tokens refreshed for user: ${user.username}`));
  } catch (error) {
    console.log(pc.red('❌ authRefreshToken error:'), error.message);

    // ✅ JWT SPECIFIC ERROR HANDLER
    if (error.name === 'TokenExpiredError') {
      return next(
        createError(401, 'Refresh token expired. Please login again.'),
      );
    } else if (error.name === 'JsonWebTokenError') {
      return next(createError(403, 'Invalid refresh token.'));
    }
    // ✅ UNEXPECTED ERROR
    next(createError(500, 'Internal server error during token refresh'));
  }
};
//-----------------------------------
