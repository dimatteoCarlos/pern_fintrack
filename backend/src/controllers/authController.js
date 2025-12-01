//src/controllers/authcontroller.js
//signUpUser,signInUser,signOutUser,
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
import { setRefreshTokenCookie } from '../../utils/authUtils/cookieConfig.js';
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
  await pool.query('BEGIN');
  try {
// ✅ GET CREDENTIALS
    const { username, user_firstname, user_lastname, email, currency } =
      req.body;
    const currency_code = currency ?? 'usd';
    // console.log(req.body);

// ✅ REQUIRED FIELDS VALIDATION
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
          'All fields are required.'
        )
      );
    }

// ✅ CHECK EXISTENCE OF USER/EMAIL
    const usernameExists = await pool.query(
      'SELECT 1 FROM users WHERE username=$1 FOR UPDATE',
      [username]
    );
    //FOR UPDATE: is used within a transaction, it locks the selected rows, preventing other concurrent transactions from modifying or locking those same rows until the current transaction either commits or rolls back

    if (usernameExists.rowCount > 0) {
      return next(createError(409, 'Username already exists.Try Sign in'));
    }
// ✅ CHECK IF EMAIL EXISTS
    const emailExists = await pool.query(
      'SELECT 1 FROM users WHERE email=$1 FOR UPDATE',
      [email]
    );

    if (emailExists.rowCount > 0) {
      return next(
        createError(409, 'Email already exists. Login with sign in button')
      );
    }

//  ✅ HASH OF PASSWORD
    let hashedPassword = await hashed(req.body.password);
    req.body.password = undefined;

// ✅ USER CREATION
// ✅ Generate user id and get currency id 
    const newUserId = uuidv4();
    //In db tabl. currency_id = 1. currency_code= 'usd'
    const currencyId = !currency ? 1 : await getCurrencyId(currency);
    console.log('🚀 ~ signUpUser ~ currencyId:', currencyId);
    // console.log('hashedPwd:', hashedPassword.length);
    // console.log('testUUID:', newUserId);

    //evalute to adding: google_id, display_name, auth_method, user_contact, user_role_id is 1 by default.

// ✅ -Insert new user into data base
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
    //here user role is assumed, but role should be taken from role id or must be gotten from the data base
    // console.log('check', {newUser})
    const accessToken = createToken(newUser.user_id, newUser.user_role_name || 'user');

    const refreshToken = createRefreshToken(newUser.user_id);

// ✅ STORE REFRESH TOKEN IN DB
//Calculate refresh token expiration date
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

  //Store refresh token in refresh_tokens db table
  // const insertedRefreshTokenResult = await pool.query(
    await pool.query(
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

// ✅ CLEAR SENSITIVE DATA
    req.body.password = undefined;
// user.password_hashed = undefined;
// delete newUser.password; delete newUser.password_hashed; delete newUser.user_role_name

// ✅ REFRESH TOKEN
setRefreshTokenCookie(res, refreshToken);
// res.cookie('refreshToken', refreshToken, {
//   httpOnly: true,
//   secure: process.env.NODE_ENV === 'production',
//   sameSite: 'Lax', // ✅ Funciona para web y mobile
//   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
//   path: '/api'
// });

// ✅ RESPONSE HANDLING
// const userResponseData  = {
//   user: { ...newUser, currency: currency_code ,
//   user_id: undefined,
//   password_hashed: undefined},
//   userAccessDevice: clientDevice,
// };

const userResponseData = {
userId: newUser.user_id,
username: newUser.username,
email: newUser.email,
user_firstname: newUser.user_firstname,
user_lastname: newUser.user_lastname,
currency: currency_code,
role: newUser.user_role_name || 'user'
}

  res.status(201).json({
    message: 'User successfully registered',
    accessToken: accessToken,
    user: userResponseData,
    expiresIn: 3600*24*24 // 60 minutos
  });

  await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    console.log(pc.red('Sign-up error:'), error);
    next(createError(500, error.message || 'internal signup error'));
  }
};
//===================================
// 🎯 FUNCTION FOR USER SIGN IN (LOG IN SESSION)
//===================================
export const signInUser = async (req, res, next) => {
console.log(pc.greenBright('signInUser'));
const { username, email } = req.body;
// console.log('req.body', req.body);

await pool.query('BEGIN');
  try {
// ✅ VALIDATION
    if (!(username && email && req.body.password)) {
      return next(
        createError(400, 'username, email and password, are required')
      );
    }
// ✅ GET USER DATA FROM DB
    const userData = await pool
      .query({
        text: `SELECT u.username, u.email, u.password_hashed, u.user_id, u.user_firstname, u.user_lastname, u.user_role_id,
        ur.user_role_name,
        ct.currency_code as currency FROM users u

        JOIN user_roles ur ON u.user_role_id = ur.user_role_id
        JOIN currencies ct ON u.currency_id = ct.currency_id
        WHERE (u.username = $1 AND u.email = $2) OR u.username = $1 OR u.email = $2`,
        values: [username, email],
      })
      .then((res) => res.rows);

// console.log('userdata:', userData);

// ✅ USER VALIDATION EXISTENCE IN DB
    if (!userData[0]) {
     return next(createError(404, 'User does not exist. Try sign up.'));
    }
//Validation of multiple users with the same information
    if (userData.length > 1) {
      console.warn(
        'Accounts info:',
        'There are more than one user with the same information'
      );
      return next(
        createError(400, 'Multiple accounts found. Contact administrator.')
      ); //then what to do in this case?
    }
    const user = userData[0];

// ✅ CROSSED-VERIFICATION OF USERNAME/EMAIL
    if (userData.length > 0) {
      if (
        (username === user.username && user.email !== email) ||
        (username !== user.username && user.email === email)
      ) {
        console.warn('username and email do not correspond');
        return next(createError(400, 'username/email mismatch'));
      }
    }

// ✅ CHECK PASSWORD
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
  refreshTokenExpirationDate.setDate(refreshTokenExpirationDate.getDate() + 7);

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
    user_role_name: user.user_role_name,
    currency: user.currency
  };

  res.status(200).json({
  message: 'Login successful',
  accessToken: accessToken,
  user: userResponseData,
  expiresIn: 3600 // 15 minutos 15 m, 3600 1h
  });

  console.log(
    'User is logged in',
      username,
      // email,
      // userData[0].user_id,
      // req.body.password,
      // userData[0].password_hashed,
      // user.role,
      // 'userResponseData:',
      // userResponseData
    );
  await pool.query('COMMIT');
    } catch (error) {
    await pool.query('ROLLBACK');
    console.log('Sign-in error:', error);
    next(createError(500, error.message || 'internal sign-in user error'));
  }
};
// =================================
// 🎯 SIGN-OUT USER 
// =================================
// Sign-out with token revocation
export const signOutUser = async (req, res, next) => {
console.log(pc.yellow('signOutUser'));
// console.log('req',req.cookies,  )
  const refreshTokenFromClient =
req.cookies.refreshToken ||    req.body.refreshToken;
// console.log({refreshTokenFromClient})
// const clientDevice = req.clientDeviceType; //web | mobile | bot |unknown

  try { 
  let revokeSuccess = false
  let revokeMessage = `No refresh token provided for revocation`
  
// ✅ REVOKING REFRESH TOKEN
  if (refreshTokenFromClient) {
   try{
      const result = await pool.query(
        `UPDATE refresh_tokens
         SET revoked = TRUE
         WHERE token = $1`,
        [refreshTokenFromClient]
      );
      revokeSuccess = result.rowCount > 0;
// console message for debugging
      revokeMessage =revokeSuccess? 
       'Refresh token successfully revoked' : 
       'Refresh token not found for revocation';
      console.log(pc.yellow(revokeMessage));

      } catch(revokeError){
      console.error('Error revoking token:', revokeError);
      revokeMessage = 'Error during token revocation';
    }
  }
// ✅ CLEARING OF COOKIES/HEADERS 
    res.clearCookie('accessToken',{path:'/api'});
    res.clearCookie('refreshToken',{path:'/api'});

// ✅ RESPONSE HANDLING ()
    if (revokeSuccess) {
     sendSuccessResponse(res, 200, 'Logged out successfully. Token revoked.');
      console.log('Logged out successfully. Token revoked.')
      } else if (refreshTokenFromClient) {
        // ❌ Token exists but revoking failed / Token proporcionado pero revocación falló
        const message = 'Logged out with issues: ' + revokeMessage + '. Please login again to ensure security.'

        console.warn(message)

        sendSuccessResponse(res, 200, message);
        } else {
          // ℹ️ No token but completed logout anyway / No había token para revocar, pero logout completado
           const message ='Logged out successfully. No active session found to revoke.'
          console.error(message)
          sendSuccessResponse(res, 200,message);
        }
  } catch (error) {
// ✅ 4. FALLBACK: Asegurar limpieza incluso en errores
   console.error(pc.red('Error during logout:', error));
    
// Contingency cleaning / limpieza de emergencia
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    const message ='Logged out with some technical issues. Please login again to ensure complete security.'
    sendSuccessResponse(res, 200, message);
  }
}