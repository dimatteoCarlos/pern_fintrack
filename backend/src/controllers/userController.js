// backend/src/controllers/userController.js/
//getUserById, updateUserById, changePassword
import { hashed, isRight } from '../utils/authUtils/authFn.js';
import { createError } from '../utils/errorHandling.js';
import { pool } from '../db/configDB.js';

//getUserById
//GET http://localhost:5000/api/user/f7c5abf9-89e5-4891-bfb8-6dfe3022f226
export const getUserById = async (req, res, next) => {
  const { userId, userRole } = req.user;

  // const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  console.log('getUserbyid', 'userId:', userId);

  try {
    const userDataResult = await pool.query({
    text: `SELECT u.user_id, u.username,
    u.email,
    u.user_firstname,
    u.user_lastname,
    u.user_contact,
    currencies.currency_name,
    currencies.currency_code as currency,
    user_roles.user_role_name as user_role
    FROM users u
    JOIN currencies ON currencies.currency_id = u.currency_id
    JOIN user_roles ON user_roles.user_role_id = u.user_role_id
    WHERE u.user_id = $1
    `,
      values: [userId],
    });

    const userData = userDataResult.rows[0];
    // console.log('🚀 ~ getUserById ~ userDataResult:', userData);

    if (!userData) {
      return next(createError(404, 'user not found'));
    }

    // //consulta de info cuentas del user

    const userAccountsResult = await pool.query({
      text: `SELECT  account_id
             FROM user_accounts
            WHERE user_id = $1
            ORDER BY account_id ASC
    `,
      values: [userId],
    });

    // userAccountsId, //{account_id: number}[]
    const userAccountsId = userAccountsResult.rows;
    // console.log('🚀 ~ getUserById ~ userAccountsId:', userAccountsId);

    res.status(200).json({
      message: 'user data available ',
      user: userData,
      userAccountsId,
      role: userRole,
    });
  } catch (error) {
    console.log('auth error:', error);
    next(error);
    // next(createError(500, error.message || 'internal getUserById user error'));
  }
};

//updateUserById
//PUT http://localhost:5000/api/user/f7c5abf9-89e5-4891-bfb8-6dfe3022f226
export const updateUserById = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { firstname, lastname, currency, contact } = req.body;

    const userResult = await pool.query({
      text: `
        SELECT 1
         FROM users  WHERE user_id = $1
         LIMIT 1
    `,
      values: [userId],
    });
    const userExists = userResult.rows.length > 0;

    if (!userExists) {
      return next(createError(404, 'user not found'));
    }

    const currencyIdResult = await pool.query({
      text: `SELECT currency_id FROM currencies WHERE currency_code = $1 LIMIT 1`,
      values: [currency],
    });

    const newCurrencyIdExist = currencyIdResult.rows.length > 0;

    if (!newCurrencyIdExist) {
      return next(createError(404, `currency ${currency} is not registered`));
    }
    // console.log(currencyIdResult.rows[0]);

    const updatedUser = await pool.query({
      text: `UPDATE users SET user_firstname=$1, user_lastname=$2, currency_id=$3, user_contact=$4, updated_at = CURRENT_TIMESTAMP  WHERE user_id = $5 RETURNING * `,
      values: [
        firstname,
        lastname,
        currencyIdResult.rows[0].currency_id,
        contact,
        userId,
      ],
    });

    return res.status(200).json({
      status: 200,
      message: 'user information updated successfully',
    });
  } catch (error) {
    console.error(error);
    next(
      createError(500, error.message || 'internal updateUserById user error')
    );
  }
};
//--------
//changePassword
//PUT http://localhost:5000/api/user/change-password
export const changePassword = async (req, res, next) => {
  console.log('changePassword');
  try {
    const { userId } = req.user;
    let { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res
        .status(400)
        .json({ status: 400, message: 'all fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res
        .status(401)
        .json({ status: 400, message: 'new passwords do not match' });
    }

    const userExistsResult = await pool.query({
      text: `
    SELECT EXISTS (SELECT 1 FROM users WHERE user_id = $1)
     `,
      values: [userId],
    });
    const userExists = userExistsResult.rows[0].exists;

    if (!userExists) {
      return next(createError(404, 'user not found'));
    }

    const userInfo = await pool.query({
      text: `SELECT password_hashed FROM users WHERE user_id = $1`,
      values: [userId],
    });

    const isMatch = await isRight(
      currentPassword,
      userInfo?.rows[0].password_hashed
    );
    // console.log({ isMatch });

    if (!isMatch) {
      return res
        .status(401)
        .json({ status: 401, message: 'Invalid current password' });
    }

    let hashedPassword = await hashed(newPassword);

    await pool.query({
      text: `UPDATE users SET password_hashed = $1 WHERE user_id = $2`,
      values: [hashedPassword, userId],
    });

    //cleanse passwords variables

    delete req.user;
    delete userInfo.rows;
    (newPassword = undefined),
      (currentPassword = undefined),
      (confirmPassword = undefined),
      (hashedPassword = undefined);

    res
      .status(200)
      .json({ status: 200, message: 'password succssfully changed' });
  } catch (error) {
    console.error(error);
    next(
      createError(500, error.message || 'internal user password change error')
    );
  }
};

//---
