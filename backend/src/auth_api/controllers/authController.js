//backend/src/controllers/authController.js
//signUpUser,signInUser,signOutUser,validateSession
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../db/config/configDB.js';
import pc from 'picocolors';

import {
  createToken,
  createRefreshToken,
  hashed,
  isRight,
  getDecoyHash,
} from '../../utils/authUtils/authFn.js';

import { sendSuccessResponse } from '../../utils/authUtils/sendSuccessResponse.js';
import {
  clearAccessTokenCookie,
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '../../utils/authUtils/cookieConfig.js';
import { createError } from '../../utils/errorHandling.js';

import { getCurrencyId } from '../../utils/currencyLookup.js';
import { ACCOUNTING_CURRENCY_CODE } from '../../fintrack_api/config/fintrackConfig.js';

// import { getCurrencyId } from '../../fintrack_api/controllers/transactionController.js';

// The role every new account is born with. The application decides the name; only
// its id is read from the catalog.
const DEFAULT_USER_ROLE = 'user';

//=====================
//FUNCTIONS DECLARATION
//=====================
//=================================
//🎯 TOKEN ERROR HANDLING FUNCTION
//=================================
/*
JWT LIB ERROR MESSAGES
TokenExpiredError	Ocurre cuando un token ha pasado su fecha de vencimiento (exp claim)

JsonWebTokenError	Un error genérico que indica un problema con el token, como una firma inválida (el token fue alterado) o un formato incorrecto.

NotBeforeError	Sucede si se intenta usar un token antes de su fecha de validez (nbf claim).
*/
//===========================
// 🎯 SIGN-UP FOR USER (REGISTER)
//===========================
export const signUpUser = async (req, res, next) => {
  console.log(pc.blueBright('signUpUser'));
  const client = await pool.connect();
  try {
    // ✅ GET CREDENTIALS
    // Read from the middleware's output, not from req.body: signUpSchema is what
    // proves these are present and well formed, and it is where a transform lands.
    const { username, user_firstname, user_lastname, email, currency, timezone } =
      req.validatedData;
    // The configured accounting currency, not a literal: 'usd' and the id 1 were two
    // independent defaults that agreed only because seed 005 pairs them.
    const currency_code = currency ?? ACCOUNTING_CURRENCY_CODE;

    // Normalization is a rule of the write path, not of the request format, so it
    // stays here. The email folds case, the username keeps it — it is a display name.
    const normalizedUsername = username.trim();
    const normalizedEmail = email.toLowerCase();

    //  ✅ HASH OF PASSWORD
    let hashedPassword = await hashed(req.validatedData.password);
    req.validatedData.password = undefined;
    req.body.password = undefined;

    // ✅ USER CREATION
    // ✅ Generate user id and get currency id
    const newUserId = uuidv4();
    // The id is derived from the code the response returns, so the row and the client
    // can never name two different currencies. Resolved before BEGIN — a throw here
    // would reach a catch whose ROLLBACK has no transaction to close.
    let currencyId;
    try {
      currencyId = await getCurrencyId(client, currency_code);
    } catch {
      return next(createError(400, `Currency ${currency_code} is not supported`));
    }

    console.log('🚀 ~ signUpUser ~ currencyId:', currencyId);
    // console.log('hashedPwd:', hashedPassword.length);
    // console.log('testUUID:', newUserId);

    //evalute to adding: google_id, display_name, auth_method, user_contact.

    // The catalog resolves the id: user_role_id is nullable, so a role written blind
    // could land as NULL and sign-in's INNER JOIN would then refuse a valid
    // credential. Read before BEGIN — a missing catalog must not reach the catch,
    // whose ROLLBACK would run with no transaction open.
    const roleResult = await client.query(
      'SELECT user_role_id FROM user_roles WHERE user_role_name = $1',
      [DEFAULT_USER_ROLE],
    );
    if (roleResult.rows.length === 0) {
      return next(createError(500, 'Role catalog is not initialized'));
    }
    const userRoleId = roleResult.rows[0].user_role_id;

    // Opens here: the hash above is CPU work of hundreds of milliseconds, and holding a transaction open across it pins a pooled connection for nothing.
    await client.query('BEGIN');

    // ✅ -Insert new user into data base
    const userData = await client.query({
      text: `
      INSERT INTO users(user_id, username,email,password_hashed,user_firstname,user_lastname, currency_id, user_role_id, timezone) VALUES ($1, $2, $3,$4,$5, $6, $7, $8, COALESCE($9, 'UTC'))
      RETURNING user_id, username, email, user_firstname, user_lastname, currency_id, user_role_id, timezone;`,
      values: [
        newUserId,
        normalizedUsername,
        normalizedEmail,
        hashedPassword,
        user_firstname,
        user_lastname,
        currencyId,
        userRoleId,
        // COALESCE and not the column default: a parameter left out of VALUES is
        // not the same as one bound to null, and null breaks the NOT NULL.
        timezone ?? null,
      ],
    });
    // console.log('pwd:', userData.rows);
    hashedPassword = undefined;
    const newUser = userData.rows[0];

    // ✅ VALIDATION OF ALLOWED ACCESS DEVICE
    // const allowedDevices = ['mobile', 'web'];
    // if (!allowedDevices.includes(clientDevice)) {
    //   return next(
    //     createError(400, `Device ${clientDevice} access not allowed`)
    //   );
    // }
    //-------------------------------------
    // ✅ CREATE JWT TOKENS
    // console.log('check', {newUser})
    // The name the inserted id was resolved from: RETURNING cannot join user_roles,
    // so the row carries the id and never the name.
    const accessToken = createToken(newUser.user_id, DEFAULT_USER_ROLE);

    const refreshToken = createRefreshToken(newUser.user_id);

    // ✅ STORE REFRESH TOKEN IN DB
    //Calculate refresh token expiration date
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    //Store refresh token in refresh_tokens db table
    // const insertedRefreshTokenResult = await client.query(
    await client.query(
      `INSERT INTO refresh_tokens(user_id, token, expiration_date, user_agent, ip_address) VALUES($1,$2,$3,$4,$5) RETURNING token_id`,
      [
        newUser.user_id,
        refreshToken,
        refreshTokenExpiry,
        req.headers['user-agent'],
        req.ip,
      ],
    );
    console.log('🚀 ~ signUpUser ~ newUser:', newUser);

    // ✅ CLEAR SENSITIVE DATA
    req.body.password = undefined;
    // user.password_hashed = undefined;
    // delete newUser.password; delete newUser.password_hashed; delete newUser.user_role_name

    // Commits before the cookie and the body: nothing reaches the client until the user is durable.
    await client.query('COMMIT');

    // ✅ REFRESH TOKEN
    setRefreshTokenCookie(res, refreshToken);

    // ✅ RESPONSE HANDLING
    const userResponseData = {
      user_id: newUser.user_id,
      username: newUser.username,
      email: newUser.email,
      user_firstname: newUser.user_firstname,
      user_lastname: newUser.user_lastname,
      currency: currency_code,
      timezone: newUser.timezone,
      role: DEFAULT_USER_ROLE,
    };

    res.status(201).json({
      message: 'User successfully registered',
      accessToken: accessToken,
      user: userResponseData,
      expiresIn: 3600 * 1 * 1, // 60 minutos
    });
  } catch (error) {
    await client.query('ROLLBACK');

    // 23505 is the unique violation. It is the caller's duplicate, not a server
    // fault, and error.message would publish the index name.
    if (error.code === '23505') {
      // Two names per column: the plain UNIQUE and the case-folded index that
      // migration 025 adds. Either one means the email is taken.
      const emailConstraints = ['users_email_key', 'users_email_lower_key'];
      const duplicate = emailConstraints.includes(error.constraint)
        ? 'Email already exists. Login with sign in button'
        : 'Username already exists.Try Sign in';
      return next(createError(409, duplicate));
    }

    console.log(pc.red('Sign-up error:'), error);
    next(createError(500, error.message || 'internal signup error'));
  } finally {
    client.release();
  }
}; //signUpUser
//===================================
// 🎯 FUNCTION FOR USER SIGN IN (LOG IN SESSION)
//===================================
export const signInUser = async (req, res, next) => {
  console.log(pc.greenBright('signInUser'));
  const client = await pool.connect();
  // Read from the middleware's output: signInSchema is what proves both are present,
  // trims the identity and folds in the email and username keys a client deployed
  // behind this backend may still send.
  const { identity, password } = req.validatedData;

  try {
    await client.query('BEGIN');
    // ✅ GET USER DATA FROM DB
    // An email is the only identity that can carry '@', so the string itself
    // decides the column. The column name is one of two literals here, never
    // the typed value.
    const identityColumn = identity.includes('@') ? 'u.email' : 'u.username';

    const userData = await client
      .query({
        text: `SELECT u.username, u.email, u.password_hashed, u.user_id, u.user_firstname, u.user_lastname, u.user_contact, u.user_role_id, u.timezone,
        ur.user_role_name,
        ct.currency_code as currency
        FROM users u
        JOIN user_roles ur ON u.user_role_id = ur.user_role_id
        JOIN currencies ct ON u.currency_id = ct.currency_id
        -- Folded on both sides: whoever registered a name with a capital still
        -- signs in with it typed any other way.
        WHERE lower(${identityColumn}) = lower($1)`,
        values: [identity],
      })
      .then((res) => res.rows);

    const user = userData[0];

    // ✅ CHECK PASSWORD
    // The hash is compared even when no row came back, and every failure gets
    // the same answer, so neither the message nor the time the attempt took
    // tells an anonymous caller whether that identity is registered.
    const isPasswordCorrect = await isRight(
      password,
      user ? user.password_hashed : await getDecoyHash(),
    );

    if (!user || !isPasswordCorrect) {
      console.warn('not authenticated:', 'invalid credentials');
      return next(createError(401, 'Invalid credentials'));
    }
    // console.log(user.user_id, user.user_role_name)

    // ✅ VALIDATE IF ACCESS DEVICE IS ALLOWED
    //Allowed Acces
    // const allowedDevices = ['mobile', 'web'];
    // if (!allowedDevices.includes(clientDevice)) {
    //   return next(
    //     createError(403, `Device ${clientDevice} access not allowed`)
    //   );
    // }
    //--------------------------------
    // ✅ TOKENS GENERATION
    // Generate JWT tokens with user role
    const accessToken = createToken(user.user_id, user.user_role_name);

    const refreshToken = createRefreshToken(user.user_id);

    // ✅ STORE REFRESH TOKEN IN DB
    // Calculate the expiration date for the refresh token (e.g., 7 days from now)
    // expiration date deben coincidir con los que se crearon
    const refreshTokenExpirationDate = new Date();
    refreshTokenExpirationDate.setDate(
      refreshTokenExpirationDate.getDate() + 7,
    );

    // Store the refresh token in the database
    await client.query(
      'INSERT INTO refresh_tokens (user_id, token, expiration_date, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5) RETURNING token_id',
      [
        user.user_id,
        refreshToken,
        refreshTokenExpirationDate,
        req.headers['user-agent'],
        req.ip,
      ],
    );
    // console.log( accessToken, refreshToken);
    // ✅ CLEAR SENSITIVE DATA
    req.body.password = undefined;
    user.password_hashed = undefined;

    //✅ COOKIE for REFRESH TOKEN
    setRefreshTokenCookie(res, refreshToken);

    // ✅ RESPONSE WITH accessToken
    // const userResponseData  = {
    //   user: { ...user },
    //   userAccessDevice: clientDevice,
    // };

    const userResponseData = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      user_firstname: user.user_firstname,
      user_lastname: user.user_lastname,
      // The column is user_role_name; the contract is `role`, the same name
      // validate-session already returns. Two endpoints, one user, one key.
      role: user.user_role_name,
      currency: user.currency,
      user_contact: user.user_contact,
      timezone: user.timezone,
    };

    // console.log('🚀 ~ signInUser ~ userResponseData:', userResponseData);

    res.status(200).json({
      message: 'Login successful',
      accessToken: accessToken,
      user: userResponseData,
      expiresIn: 3600, // 15 minutos 15 m, 3600 1h
    });

    console.log(
      'User is logged in',
      user.username,
      // email,
      // userData[0].user_id,
      // req.body.password,
      // userData[0].password_hashed,
      // user.role,
      // 'userResponseData:',
      // userResponseData
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.log('Sign-in error:', error);
    next(createError(500, error.message || 'internal sign-in user error'));
  } finally {
    client.release();
  }
};

// =================
// 🎯 SIGN-OUT USER
// =================
// Sign-out with token revocation
export const signOutUser = async (req, res, next) => {
  console.log(pc.yellow('signOutUser'));
  // console.log('req',req.cookies,  )
  const refreshTokenFromClient =
    req.cookies.refreshToken || req.body.refreshToken;
  // console.log({refreshTokenFromClient})
  // const clientDevice = req.clientDeviceType; //web | mobile | bot |unknown

  try {
    let revokeSuccess = false;
    let revokeMessage = `No refresh token provided for revocation`;

    // ✅ REVOKING REFRESH TOKEN
    if (refreshTokenFromClient) {
      try {
        const result = await pool.query(
          `UPDATE refresh_tokens
         SET revoked = TRUE
         WHERE token = $1`,
          [refreshTokenFromClient],
        );
        revokeSuccess = result.rowCount > 0;

        revokeMessage = revokeSuccess
          ? 'Refresh token successfully revoked'
          : 'Refresh token not found for revocation';
        console.log(pc.yellow(revokeMessage));
      } catch (revokeError) {
        console.error('Error revoking token:', revokeError);
        revokeMessage = 'Error during token revocation';
      }
    }
    // ✅ CLEARING OF COOKIES/HEADERS
    clearRefreshTokenCookie(res);
    clearAccessTokenCookie(res); //just in case

    // ✅ RESPONSE HANDLING ()
    if (revokeSuccess) {
      sendSuccessResponse(res, 200, 'Logged out successfully. Token revoked.');
      console.log('Logged out successfully. Token revoked.');
    } else if (refreshTokenFromClient) {
      // ❌ Token exists but revoking failed / Token proporcionado pero revocación falló
      const message =
        'Logged out with issues: ' +
        revokeMessage +
        '. Please login again to ensure security.';

      console.warn(message);

      sendSuccessResponse(res, 200, message);
    } else {
      // ℹ️ No token but completed logout anyway / No había token para revocar, pero logout completado
      const message =
        'Logged out successfully. No active session found to revoke.';
      console.error(message);
      sendSuccessResponse(res, 200, message);
    }
  } catch (error) {
    // ✅ 4. FALLBACK:Clear token cookies /  Asegurar limpieza incluso en errores
    console.error(pc.red('Error during logout:', error));

    // Contingency cleaning / limpieza de emergencia
    clearRefreshTokenCookie(res);
    clearAccessTokenCookie(res);
    const message =
      'Logged out with some technical issues. Please login again to ensure complete security.';
    sendSuccessResponse(res, 200, message);
  }
};

// ========================
// 🎯 VALIDATE USER SESSION
// ========================
// backend/src/controllers/authController.js
export const validateSession = async (req, res, next) => {
  try {
    // userId from verifyToken / El ID viene del middleware verifyToken
    const { userId } = req.user;
    console.log('🚀 ~ validateSession ~ userId:', userId);

    const userDataResult = await pool.query({
      text: `SELECT u.user_id, u.username, u.email, u.user_firstname, u.user_contact, u.user_lastname,
      u.user_contact, u.timezone, ct.currency_code as currency,
      ur.user_role_name as role
      FROM users u
      JOIN currencies ct ON ct.currency_id = u.currency_id
      JOIN user_roles ur ON ur.user_role_id = u.user_role_id
      WHERE u.user_id = $1`,
      values: [userId],
    });

    const userData = userDataResult.rows[0];

    if (!userData) {
      return next(createError(404, 'Session invalid: user not found'));
    }

    console.log(
      `✅ Session validated for user: ${userId} ${userData.user_firstname}`,
    );

    // console.log(`✅ Session validated for user: ${userData.user_firstname}`);

    res.status(200).json({
      message: 'Session validated successfully',
      user: userData, // Este objeto ya tiene user_id, role, currency, etc.
    });
  } catch (error) {
    console.error('❌Error validating session');
    next(createError(500, 'Error validating session'));
  }
};
