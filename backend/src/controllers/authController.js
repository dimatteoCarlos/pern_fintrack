//src/controllers/authcontroller.js
import {
  createToken,
  createRefreshToken,
  hashed,
  isRight,
} from '../../utils/authUtils/authFn.js';
import { createError } from '../../utils/errorHandling.js';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/configDB.js';
import pc from 'picocolors';
import { getCurrencyId } from '../fintrack_api/controllers/transactionController.js';
import { sendSuccessResponse } from '../../utils/authUtils/sendSuccessResponse.js';

// src/utils/responseUtils.js

//---
//--sign-up or register
export const signUpUser = async (req, res, next) => {
  console.log('sign-up entered');
  await pool.query('BEGIN');
  try {
    const { username, user_firstname, user_lastname, email, currency } =
      req.body;

    const currency_code = currency ?? 'usd';

    console.log(req.body);

    //-----
    // const isMobile = req.headers['user-agent']?.toLowerCase().includes('mobile')

    //como VALIDAR req.clientDeviceType?
    const clientDevice = req.clientDeviceType; //web | mobile | bot |unknown
    const clientTypeAccess = req.clientTypeAccess; //mobile-app | mobile-browser|tablet-app...
    console.log(
      '🚀 ~ signUpUser ~ clientTypeAccess:',
      clientDevice,
      clientTypeAccess
    );

    //----
    if (
      !(
        username &&
        email &&
        req.body.password &&
        user_firstname &&
        user_lastname
      )
    ) {
      return next(
        createError(
          400,
          'Bad request: username, email, password, first name and lastname, all fields must be provided. If currency was not provided, usd will be the default currency'
        )
      );
    }
    //----
    const usernameExists = await pool.query(
      'SELECT 1 FROM users WHERE username=$1 FOR UPDATE',
      [username]
    );

    if (usernameExists.rowCount > 0) {
      return next(createError(409, 'Username already exists.Try Sign in'));
    }
    //---
    const emailExists = await pool.query(
      'SELECT 1 FROM users WHERE email=$1 FOR UPDATE',
      [email]
    );

    if (emailExists.rowCount > 0) {
      return next(
        createError(409, 'Email already exists. Login with sign in button')
      );
    }
    //---
    let hashedPassword = await hashed(req.body.password);
    req.body.password = undefined;

    const newUserId = uuidv4();
    //currency_id = 1. currency_code= 'usd'
    const currencyId = !currency ? 1 : await getCurrencyId(currency);
    console.log('🚀 ~ signUpUser ~ currencyId:', currencyId);

    // console.log('hashedPwd:', hashedPassword.length);
    // console.log('testUUID:', newUserId);
    //consider adding: google_id, display_name, auth_method, user_contact, user_role_id is 1 by default.

    //---

    const userData = await pool.query({
      text: `INSERT INTO users(user_id, username,email,password_hashed,user_firstname,user_lastname, currency_id, user_role_id) VALUES ($1, $2, $3,$4,$5, $6, $7, $8) RETURNING user_id, username, email, user_firstname, user_lastname, currency_id, user_role_id;`,
      values: [
        newUserId,
        username,
        email,
        hashedPassword,
        user_firstname,
        user_lastname,
        currencyId,
        '1',
      ],
    });
    // console.log('pwd:', userData.rows);
    hashedPassword = undefined;

    const allowedDevices = ['mobile', 'web'];
    if (!allowedDevices.includes(clientDevice)) {
      return next(
        createError(400, `Device ${clientDevice} access not allowed`)
      );
    }

    //--create tokens if devices acces is allowed
    const newUser = userData.rows[0];

    const accessToken = createToken(newUser.user_id, 'user');
    const refreshToken = createRefreshToken(newUser.user_id);
    //Calculate refresh token expiration date
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);
    //Store refresh token in refresh_tokens table
    const insertedRefreshTokenResult = await pool.query(
      `INSERT INTO refresh_tokens(user_id, token, expiration_date, user_agent, ip_address) VALUES($1,$2,$3,$4,$5) RETURNING token_id`,
      [
        newUser.user_id,
        refreshToken,
        refreshTokenExpiry,
        req.headers['user-agent'],
        req.ip,
      ]
    );
    console.log('🚀 ~ signUpUser ~ newUser:', newUser);
    // delete newUser.password; delete newUser.password_hashed; delete newUser.user_role_name

    // Response handling
    if (clientDevice.trim().toLowerCase() === 'mobile') {
      sendSuccessResponse(
        res,
        201,
        `User successfully subscribed. Username: ${newUser.username}, email: ${newUser.email}`,
        { ...newUser, currency: currency_code },
        accessToken,
        refreshToken
      );
    } else {
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000,
      }); //1h
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000,
      }); //8h
      /*maxAge:  7*24* 60 * 60 * 1000, */

      sendSuccessResponse(
        res,
        201,
        `User successfully subscribed via ${clientDevice}. Username: ${newUser.username}, email: ${newUser.email}`,
        { ...newUser, currency: currency_code }
      );
    }
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.log(pc.red('auth error:', error));
    next(createError(500, error.message || 'internal signup user error'));
  }
};

//--login
/* get the req.body info - whith username and or email get the user info from the db  - check if not found - check the hashed pwd with userpwd - compare if !isRight - generate a token with the user info required - get the user info from db - message status - res .cookie('acces_token...*/

export const signInUser = async (req, res, next) => {
  const { username, email } = req.body;
  const clientDevice = req.clientDeviceType; //web | mobile | bot |unknown
  console.log('signInUser', req.body);
  try {
    //----
    if (!(username && email && req.body.password)) {
      return next(
        createError(400, 'username, email and password, are required')
      );
    }

    const userData = await pool
      .query({
        text: `SELECT u.username, u.email, u.password_hashed, u.user_id , u.user_role_id, ur.user_role_name FROM users u
        JOIN user_roles ur ON u.user_role_id = ur.user_role_id
        WHERE (u.username = $1 AND u.email = $2) OR u.username = $1 OR u.email = $2`,
        values: [username, email],
      })
      .then((res) => res.rows);

    console.log('userdata:', userData);

    if (!userData[0]) {
      // 400 (Bad Request) user exists but invalid.
      return next(createError(400, 'Invalid credentials'));
    }

    if (userData.length > 1) {
      console.warn(
        'Accounts info:',
        'There are more than one user with these information'
      );
      return next(
        createError(400, 'more than one user account found. Address to admin.')
      ); //then what to do in this case?
    }
    const user = userData[0];

    if (userData.length > 0) {
      //cross-verification
      if (
        (username === user.username && user.email !== email) ||
        (username !== user.username && user.email === email)
      ) {
        console.warn('username / email mismatch');
        return next(createError(400, 'username/email mismatch'));
      }
    }

    // console.log(req.body.password, userData[0].password_hashed);
    const isPasswordCorrect = await isRight(
      req.body.password,
      user.password_hashed
    );
    // console.log("🚀 ~ signInUser ~ isPasswordCorrect:", isPasswordCorrect)

    if (!isPasswordCorrect) {
      console.warn('no authenticated:', 'wrong password');
      return next(createError(401, 'Invalid password'));
    }
    // console.log(user.user_id, user.user_role_name)

    // Generate tokens with user role
    const accessToken = createToken(user.user_id, user.user_role_name);
    const refreshToken = createRefreshToken(user.user_id);

    // Calculate the expiration date for the refresh token (e.g., 7 days from now)
    const refreshTokenExpirationDate = new Date();
    refreshTokenExpirationDate.setDate(
      refreshTokenExpirationDate.getDate() + 7
    );

    // Store the refresh token in the database
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expiration_date, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5) RETURNING token_id',
      [
        user.user_id,
        refreshToken,
        refreshTokenExpirationDate,
        req.headers['user-agent'],
        req.ip,
      ]
    );

    // console.log( accessToken, refreshToken);

    req.body.password = undefined;
    user.password_hashed = undefined;
    // console.log('Ejecutando en línea: ' + arguments.callee.caller.toString());
    //Response Handling
    if (clientDevice && clientDevice.trim().toLowerCase() === 'mobile') {
      sendSuccessResponse(
        res,
        200,
        `User ${user.username || user.email} successfully logged in.`,
        { user },
        accessToken,
        refreshToken
      );
    } else if (clientDevice && clientDevice.trim().toLowerCase() === 'web') {
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000,
        sameSite: 'strict',
      });
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV == 'production',
        maxAge: (24 * 60 * 60 * 1000) / 24,
        sameSite: 'strict',
      });
      // sendSuccessResponse(res, 200, 'Login successful', { user });
      return res.status(200).json({
        message: 'successfully logged in',
        username: user.username,
        email: user.email,
        role: user.user_role_name,
        userId: user.user_id,
      });
    } else {
      console.error(pc.red('Login error:'), error);
      throw new Error('no mobile nor web site access');
    }

    console.log(
      'User is logged in',
      username,
      email,
      userData[0].user_id,
      req.body.password,
      userData[0].password_hashed,
      user.role
    );
  } catch (error) {
    console.log('auth error:', error);
    next(createError(500, error.message || 'internal sign-in user error'));
  }
};
//------------------------------------
// Sign-out with token revocation
export const signOutUser = async (req, res, next) => {
  const refreshTokenFromClient =
    req.body.refreshToken || req.cooqies.refreshToken;

  // if (!refreshTokenFromClient) {
  //   return next(createError(400, 'Refresh token is required for logout.'));
  // }

  try {
    //delete the refresh token from the database if provided

    if (refreshTokenFromClient) {
      const result = await pool.query(
        `UPDATE refresh_tokens
         SET revoked = TRUE
         WHERE token = $1`,
        [refreshTokenFromClient]
      );

      if (result.rowCount > 0) {
        console.log(
          pc.yellow(
            `Refresh token "${refreshTokenFromClient.substring(
              0,
              10
            )}..." revoked for logout.`
          )
        );
      } else {
        console.log(
          pc.yellow(
            `Refresh token "${refreshTokenFromClient.substring(
              0,
              10
            )}..." not found on server during logout.`
          )
        );
      }

      // const result = await pool.query(
      //   'DELETE FROM refresh_tokens WHERE token = $1',
      //   [refreshTokenFromClient]
      // );
    }
    // clear the cookies on the client-side (for web)
    if (req.clientDeviceType !== 'mobile') {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
    }
    sendSuccessResponse(res, 200, 'Logged out successfully.');
  } catch (error) {
    console.log(pc.red('auth error:', error));
    next(createError(500, error.message || 'Logout failed'));
  }
};
