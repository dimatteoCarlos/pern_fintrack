// backend/src/controllers/userController.js/
//getUserById, updateUserById, changePassword
import { hashed, isRight } from '../utils/authUtils/authFn.js';
import { createError } from '../utils/errorHandling.js';
import { pool } from '../db/configDB.js';
import pc from 'picocolors';


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
// 🎯 UPDATE USER PROFILE CONTROLLER 
export const updateProfile = async (req, res, next) => {
console.log(pc.bgBlueBright('controller:', 
 'updateProfile')
)

// 🎯 GET CLIENT FOR TRANSACTION MANAGEMENT  
 const client = await pool.connect();

 try {
// =====================================
// 🔍 EXTRACT AND VALIDATE BASIC INPUTS
// =====================================
  const { userId } = req.user;
  const updateData = req.validatedData;//req.body //Data Validated by zod.
  
  // ✅ VALIDATE DATA TO UPDATE
  if(!updateData || Object.keys(updateData).length===0){

   return res.status(400).json({
    success:false,
    error:'ValidationError',
    message:'No valid fields provided for update'
   })
  }
    
  // ✅ TRANSACTION
  await client.query('BEGIN');
  //1. Check user existence
  const userCheck = await client.query(
   'SELECT 1 FROM users WHERE user_id =$1', [userId]
  );
  if(userCheck.rowCount===0){
   await client.query('ROLLBACK');
   return next(createError(404,'User not found'));
  }
  //2. Build a dynamic query with just provided fields.
  // Reference: Also, in accountEdtiController the approach used by patchAccountById could be used.
  const updates = [];
  const values =[];
  let paramCount =1;

 //Process just provided fields from validatedData
  //firstname 
  if(updateData.firstname !==undefined){
   updates.push(`user_firstname=$${paramCount}`);
   values.push(updateData.firstname)
   paramCount++;
  }
//lastname 
  if(updateData.lastname !==undefined){
   updates.push(`user_lastname=$${paramCount}`);
   values.push(updateData.lastname)
   paramCount++;
  }
//currency 
  if(updateData.currency !==undefined){
  //verify if currency exists
  const currencyResult = await client.query(
  'SELECT currency_id FROM currencies WHERE currency_code = $1',
   [updateData.currency]
  );
    
  if (currencyResult.rowCount === 0) {
   await client.query('ROLLBACK');
   return next(createError(400, `Currency '${updateData.currency}' is not supported`));
  }
    
   updates.push(`currency_id = $${paramCount}`);
   values.push(currencyResult.rows[0].currency_id);
   paramCount++;
  }
//contact 
  if(updateData.contact !==undefined){
// contact can be null (to delete the contact)
   updates.push(`user_contact=$${paramCount}`);
   values.push(updateData.contact);
   paramCount++;
  }
 
 //If there are no valid fields to update
  if (updates.length === 0) {
    await client.query('ROLLBACK');
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'No valid fields to update'
    });
  }

 // Always update updated_at
  updates.push(`updated_at = CURRENT_TIMESTAMP`);

//2. UPDATE
  values.push(userId);
  const updateQuery = `
   UPDATE users
   SET ${updates.join(', ')}
   WHERE user_id = $${paramCount}
   RETURNING user_id, username, email, user_firstname, user_lastname, user_contact, currency_id
  `;

  const updatedUserResult = await client.query(updateQuery, values);

  //4. Get the complete data for the response
  const fullUserData = await client.query({
   text: `
   SELECT u.user_id, u.username, u.email,
    u.user_firstname, u.user_lastname,
    u.user_contact, c.currency_code as currency, c.currency_name,
    ur.user_role_name as role
   FROM users u
   JOIN currencies c ON c.currency_id = u.currency_id
   JOIN user_roles ur ON ur.user_role_id = u.user_role_id
   WHERE u.user_id = $1`,
    values: [userId] 
  });

  await client.query('COMMIT');
  
  //5. STANDARD RESPONSE
  // return updated user info if dev env
   res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: fullUserData.rows[0],
    });
    
} catch (error) {
    await client.query('ROLLBACK');
    console.error(`[UPDATE PROFILE ERROR] User: ${userId}, IP: ${req.ip}`, error);
    next(createError(500, 'Internal server error'));
  } finally {
    client.release();
  }
};

//=========================
// 🎯 CHANGE USER PASSWORD
//=========================
//PUT http://localhost:5000/api/user/change-password
export const changePassword = async (req, res, next) => {
  console.log(pc.redBright('changePassword'));
  const client = await pool.connect();

  try {
    const { userId } = req.user;
    let { currentPassword, newPassword } = req.validatedData; //Validated by zod
    await client.query('BEGIN');

    if (!newPassword ) {
      return res
        .status(400)
        .json({ status: 400, message: 'NEW PASSWORD WAS NOT RECEIVED' });
    }

    // if (newPassword !== confirmPassword) {
    //   return res
    //     .status(401)
    //     .json({ status: 400, message: 'new passwords do not match' });
    // }

    //1. GET USER AND CURRENT HASH
    const userResult = await client.query(
     `SELECT u.password_hashed 
     FROM users u
     WHERE u.user_id = $1
     `, 
     [userId]
    );

    if(userResult.rowCount === 0){
     await client.query('ROLLBACK');
     return next(createError(404, 'User not found'));
    }
    
    //2. VERIFY CURRENT PASSWORD

    const isMatch = await isRight(
      currentPassword,
      userResult.rows[0].password_hashed
    );
    // console.log({ isMatch });

    if (!isMatch) {
     await client.query('ROLLBACK');
     return res.status(401).json({ 
       success: false,
       error: 'InvalidCredentials',
       message: 'Current password is incorrect'
      });
    }

   //3. HASH NEW PASSWORD
    let newHashedPassword = await hashed(newPassword);
   
   //4. UPDATE PASSWORD
   await client.query({
      text: `UPDATE users SET password_hashed = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = $2`,
      values: [newHashedPassword, userId],
    });
    
    await client.query('COMMMIT');

   //6. SCRUB SENSITIVE VARIABLES
    // delete req.user;
    req.validatedData = undefined;  
    delete userResult.rows;
    (newPassword = undefined),
      (currentPassword = undefined),
      (confirmPassword = undefined),
      (newHashedPassword = undefined);
   
   //7. STANDARD RESPONSE
    res.status(200).json({ status: 200, success:true, message: 'Password changed successfully. Please sign in again with your new password.'});
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('changePassword error:', error);
    //Handling for rate limiting
    if(error.status === 429){
     return next(error);//Passing the error to rate limiter
    }
    next(
      createError(500, error.message || 'internal user password change error')
    )
  } finally {
     client.release();
    };
};


