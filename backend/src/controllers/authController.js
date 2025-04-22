//src/controllers/authcontroller.js
import {
  createToken,
  createRefreshToken,
  hashed,
  isRight,
} from '../../utils/authFn.js';
import { createError } from '../../utils/errorHandling.js';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/configDB.js';
import pc from 'picocolors';
import { getCurrencyId } from '../fintrack_api/controllers/transactionController.js';

// src/utils/responseUtils.js
export const sendSuccessResponse = (
  res,
  statusCode,
  message,
  user,
  accessToken,
  refreshToken
) => {
  const responseData = {
    message,
    user: { ...user },
  };
  if (accessToken) {
    responseData.accessToken = accessToken;
  }
  if (refreshToken) {
    responseData.refreshToken = refreshToken;
  }
  return res.status(statusCode).json(responseData);
};
//---
//--sign-up or register
export const signUpUser = async (req, res, next) => {
  console.log('sign-up entered');
  try {
    const { username, user_firstname, user_lastname, email, currency } =
      req.body;
    const currency_code = currency ?? 'usd';
    console.log(req.body);

    //-----
    // const isMobile = req.headers['user-agent']?.toLowerCase().includes('mobile')
    //VALIDAR req.clientDeviceType
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

    const usernameExists = await pool.query(
      'SELECT 1 FROM users WHERE username=$1',
      [username]
    );

    if (usernameExists.rowCount > 0) {
      return next(createError(409, 'Username already exists.Try Sign in'));
    }
    //---
    const emailExists = await pool.query('SELECT 1 FROM users WHERE email=$1', [
      email,
    ]);

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
        '1'
      ],
    });
    // console.log('pwd:', userData.rows);
    hashedPassword = undefined;

    // if (clientDevice !== 'mobile' && clientDevice !== 'web' && clientDevice !== 'unknown') {
    //   return next(
    //     createError(400, `Device ${clientDevice} access not allowed`)
    //   );
    // }
    const allowedDevices = ['mobile', 'web'];
    if (!allowedDevices.includes(clientDevice)) {
      return next(
        createError(400, `Device ${clientDevice} access not allowed`)
      );
    }

    //--create tokens if devices acces is allowed
    const newUser = userData.rows[0];

    console.log('🚀 ~ signUpUser ~ newUser:', newUser);

    const accessToken = createToken(newUser.user_id, 'user');
    const refreshToken = createRefreshToken(newUser.user_id);

    // delete newUser.password; delete newUser.password_hashed; delete newUser.user_role_name

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

      sendSuccessResponse(
        res,
        201,
        `User successfully subscribed via ${clientDevice}. Username: ${newUser.username}, email: ${newUser.email}`,
        { ...newUser, currency: currency_code }
      );
    }
  } catch (error) {
    console.log(pc.red('auth error:', error));
    next(createError(500, error.message || 'internal signup user error'));
  }
};

//--login
/* get the req.body info - whith username and or email get the user info from the db  - check if not found - check the hashed pwd with userpwd - compare if !isRight - generate a token with the user info required - get the user info from db - message status - res .cookie('acces_token...*/

export const signInUser = async (req, res, next) => {
  const { username, email } = req.body;
  const clientDevice = req.clientDeviceType; //web | mobile | bot |unknown
  console.log('signInUser', req.body)
  try {
    //----
    if (!(username && email && req.body.password)) {
      return next(
        createError(
          400,
          'Bad request: username, email, password, all fields must be provided.'
        )
      );
    }

    const userData = (
      await pool.query({
        text: `SELECT u.username, u.email, u.password_hashed, u.user_id , u.user_role_id, ur.user_role_name FROM users u
        JOIN user_roles ur ON u.user_role_id = ur.user_role_id
        WHERE (u.username = $1 AND u.email = $2) OR u.username = $1 OR u.email = $2`,
        values: [username, email],
      })
    ).rows;

    console.log('userdata:', userData)

    if (!userData[0]) {
      // 400 (Bad Request) user exists but invalid.
      return next(createError(400, 'Sorry, user not found. Verify your user account info and try again'));
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
      return next(
        createError(401, 'Unauthorized. Wrong password or user data')
      );
    }
// console.log(user.user_id, user.user_role_name)

    // Generate tokens with user role
    const accessToken = createToken(user.user_id, user.user_role_name);
    const refreshToken = createRefreshToken(user.user_id);

    // console.log( accessToken, refreshToken);

    req.body.password = undefined;

    user.password_hashed = undefined;
    // console.log('Ejecutando en línea: ' + arguments.callee.caller.toString());

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
 
      return res.status(200).json({ 
        message: 'successfully logged in',
        username: user.username,
        email: user.email,
        role: user.user_role_name,
        userId: user.user_id,
      });
    } else {
      throw new Error('no mobile nor web site');
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
