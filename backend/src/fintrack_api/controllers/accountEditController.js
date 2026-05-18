// backend/src/fintrack_api/controllers/accountEditController.js

import pc from 'picocolors';
import { pool } from '../../db/config/configDB.js';
import { createError, handlePostgresError } from '../../utils/errorHandling.js';
import { capitalize } from '../../utils/helpers.js';

/**
 * 🎯 EDITION LOGIC: PARTIALLY UPDATES AN ACCOUNT
 * This controller will receive a partial payload (only the modified fields
 * Determines which tables to update(user_accounts and the specific table).
 */
// http://localhost:5000/api/fintrack/account/edit/:${accountId}
export const patchAccountById = async (req, res, next) => {
  console.log(pc['yellowBright']('patchAccountById'));

  const client = await pool.connect();

  try {
    const userId = req.user.userId || (req.body.user ?? req.query.user);
    const { accountId } = req.params;
    const payload = req.body;
    console.log('🚀 ~ patchAccountById ~ payload:', payload.account_name);

    if (!userId || !accountId) {
      return res
        .status(400)
        .json({ status: 400, message: 'User ID and Account ID are required.' });
    }

    // 1. Get account type by id
    const accountInfoResult = await client.query({
      text: `SELECT act.account_type_name, ua.account_type_id
   FROM user_accounts ua
   JOIN account_types act ON act.account_type_id = ua.account_type_id
   WHERE ua.account_id = $1 AND
    ua.user_id = $2`,
      values: [accountId, userId],
    });

    if (!accountInfoResult || accountInfoResult.rows.length === 0) {
      const message = 'Account not found or user mismatch.';
      console.warn(pc['red'](message));
      return res.status(404).json({ status: 404, message });
    }

    const { account_type_name } = accountInfoResult.rows[0];

    // 2. Separate fields to update by table
    //fields to update in 'user_accounts' table
    const userAccountFields = {
      account_name: payload.account_name,
      note: payload.note,
    };
    console.log(
      '🚀 ~ patchAccountById ~ userAccountFields:',
      userAccountFields,
    );

    //specific table fields by account type
    // const editableFields ={
    //  category_budget:{
    //   category_name:payload.category_name,
    //   subcategory:payload.subcategory,
    //   nature:payload.nature,
    //   budget:payload.budget,
    // },
    //  pocket_saving:{
    //   target:payload.target,
    //   desired_date:payload.desired_date,
    //   note:payload.note,
    // },
    //  debtor:{
    //   debtor_name:payload.debtor_name,
    //   debtor_lastname:payload.debtor_lastname,
    //   // note:payload.note,
    // },
    //  }

    const specificFields = {};

    // 3. Set editable specific fields per account type
    switch (account_type_name) {
      case 'pocket_saving':
        if (payload.target !== undefined)
          specificFields.target = payload.target;

        if (payload.desired_date !== undefined)
          specificFields.desired_date = payload.desired_date;

        if (payload.note !== undefined) specificFields.note = payload.note;

        console.log('pocket_saving', payload);
        console.log('account pocket', userAccountFields.account_name);

        break;

      case 'category_budget':
        if (payload.budget !== undefined)
          specificFields.budget = payload.budget;
        console.log('budget:', payload['budget']);

        if (payload.category_name !== undefined)
          specificFields.category_name = payload.category_name;

        if (payload.subcategory !== undefined)
          specificFields.subcategory = payload.subcategory;

        // if (payload.nature_type_name !== undefined) specificFields.nature_type_name = payload.nature_type_name;

        userAccountFields.account_name = `${capitalize(payload.category_name)}/${capitalize(payload.subcategory)}/${payload.category_nature_type_name}`;

        if (payload.account_name !== userAccountFields.account_name) {
          console.log(`Check the input account name`);
        }

        // console.log('category', payload)
        // console.log('account', userAccountFields.account_name)

        break;
      //----
      case 'debtor':
        if (payload.debtor_name !== undefined)
          specificFields.debtor_name = payload.debtor_name;

        if (payload.debtor_lastname !== undefined)
          specificFields.debtor_lastname = payload.debtor_lastname;

        userAccountFields.account_name = `${capitalize(payload.debtor_lastname.trim())}, ${capitalize(payload.debtor_name.trim())}`;

        // console.log('debtor', payload)
        // console.log('account', userAccountFields.account_name)

        break;
    }

    //-----------------
    // 4. Fields Updating
    // 4a. Update user_accounts () building dynamic fields (No DB)
    const userAccountSqlParameters = []; //['key=$n', ]
    const userAccountSqlValues = [];
    let sqlParameter = 1;

    //build userAccountSqlParemters
    for (const keyFieldName in userAccountFields) {
      const sqlValue = userAccountFields[keyFieldName];
      if (sqlValue !== undefined) {
        userAccountSqlParameters.push(`${keyFieldName} = $${sqlParameter}`);
        userAccountSqlValues.push(sqlValue);
        sqlParameter++;
      }
    }

    //4.b Validacion: if no changes to update
    if (
      userAccountSqlParameters.length === 0 &&
      Object.keys(specificFields).length === 0
    ) {
      return res.status(400).json({
        status: 400,
        message: 'No fields to update',
      });
    }

    //--------------------------
    //4.b  Start transaction with DB
    await client.query('BEGIN'); //Initiate transaction
    //------------------------
    if (userAccountSqlParameters.length > 0) {
      userAccountSqlValues.push(accountId, userId); // $final = accountId
      const userAccountQuery = `
   UPDATE user_accounts SET 
   ${userAccountSqlParameters.join(', ')},
   updated_at = NOW() 
   WHERE account_id = $${sqlParameter} AND user_id = $${sqlParameter + 1}; 
   `;
      await client.query(userAccountQuery, userAccountSqlValues);
    }

    // 4c. Update specific tables (if field data exist)
    if (Object.keys(specificFields).length > 0) {
      const allowedTables = {
        category_budget: 'category_budget_accounts',
        pocket_saving: 'pocket_saving_accounts',
        debtor: 'debtor_accounts',
      };

      //const tableName = `${account_type_name}_accounts`; //Specific table name pattern

      const tableName = allowedTables[account_type_name];

      const specificUpdateSqlParameters = [];
      const specificSqlValues = [];
      let specificSqlParameters = 1;

      for (const key in specificFields) {
        specificUpdateSqlParameters.push(`${key} = $${specificSqlParameters}`);
        specificSqlValues.push(specificFields[key]);
        specificSqlParameters++;
      }

      specificSqlValues.push(accountId); // $final = accountId
      const specificQuery = `
     UPDATE ${tableName} SET 
     ${specificUpdateSqlParameters.join(', ')}
     WHERE account_id = $${specificSqlParameters}; 
 `;
      await client.query(specificQuery, specificSqlValues);
    }

    await client.query('COMMIT'); // Commit if both updates were successful

    // 5. Deliver updated account to frontend (sync)
    //getAccountById can be implemented here to deliver all acccount info updated as it is returned by getAccountById.
    req.params.accountId = accountId;
    const message = `Account ${accountId} updated successfully!`;
    console.log('success:', pc.greenBright(message));

    res.status(200).json({
      status: 200,
      message,
      data: { account_id: accountId, ...userAccountFields, ...specificFields }, //returns partial updated account info
    });
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback in case of error
    //error handling
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  } finally {
    client.release();
  }
};
