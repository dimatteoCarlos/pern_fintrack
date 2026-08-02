// backend/src/fintrack_api/controllers/accountEditController.js

import pc from 'picocolors';
import { pool } from '../../db/config/configDB.js';
import { createError, handlePostgresError } from '../../utils/errorHandling.js';
import { capitalize } from '../../utils/helpers.js';

import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { budgetPolicyService } from '../services/budget_services/services/budgetPolicyService.js';
import { ALLOWED_FREQUENCIES } from '../services/budget_services/core/budgetConfig.js';

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
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { accountId } = req.params;
    const payload = req.body;
    console.log('🚀 ~ patchAccountById ~ payload:', payload.account_name);

    if (!accountId) {
     return res.status(400).json({ status: 400, message: 'Account ID is required.' });
    }

    // 1. Get account type by id
    const accountInfoResult = await client.query({
     text: 
      `SELECT act.account_type_name, ua.account_type_id
      FROM user_accounts ua
      JOIN account_types act ON act.account_type_id = ua.account_type_id
      WHERE ua.account_id = $1 AND ua.user_id = $2`,
      
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

    // The budget change is applied after BEGIN, not here: the switch below runs
    // outside the transaction, and the allocation must commit or roll back with
    // the cba.budget write it mirrors.
    let budgetChange = null;

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

      case 'category_budget': {
        if (payload.budget !== undefined) {
          // Same rule as account creation and as CHECK (budget_amount > 0).
          // Before, a 0 or a negative went straight into cba.budget; now it
          // would also reach the allocation and surface as a 500.
          const amount = Number(payload.budget);

          if (!Number.isFinite(amount) || amount <= 0) {
            const message = 'Budget amount must be greater than 0.';
            console.warn(pc['red'](message));
            return res.status(400).json({ status: 400, message });
          }

          const frequencyCode =
            payload.budgetFrequencyCode?.trim().toLowerCase() ?? null;

          if (frequencyCode && !ALLOWED_FREQUENCIES.includes(frequencyCode)) {
            const message = `budgetFrequencyCode must be one of: ${ALLOWED_FREQUENCIES.join(', ')}.`;
            console.warn(pc['red'](message));
            return res.status(400).json({ status: 400, message });
          }

          specificFields.budget = amount;
          budgetChange = { amount, frequencyCode };
        }

        if (payload.category_name !== undefined)
          specificFields.category_name = payload.category_name;

        if (payload.subcategory !== undefined)
          specificFields.subcategory = payload.subcategory;

        // account_name is derived, but the payload is partial by design.
        // Rebuilding it from the payload alone turned a PATCH carrying only
        // budget into "//undefined", with a 200 response. Merging the payload
        // over the stored parts keeps the name correct in both directions: it
        // stays the same when no part changed, and it is recomputed when one
        // did. It also repairs a name corrupted by an earlier partial edit.
        const stored = await client.query({
         text:
          `SELECT cba.category_name, cba.subcategory, cnt.category_nature_type_name
          FROM category_budget_accounts cba
          JOIN category_nature_types cnt
           ON cnt.category_nature_type_id = cba.category_nature_type_id
          WHERE cba.account_id = $1`,

         values: [accountId],
        });

        if (stored.rows.length === 0) {
         console.warn(
          pc['red'](
           `No category_budget_accounts row for account ${accountId}. Leaving account_name untouched.`,
          ),
         );
         break;
        }

        const current = stored.rows[0];
        // The nature is not editable through this controller, so it always
        // comes from the catalog. Taking it from the payload would rename the
        // account to a nature the specific table never stored.
        const categoryName = payload.category_name ?? current.category_name;
        const subcategory = payload.subcategory ?? current.subcategory;

        userAccountFields.account_name = `${capitalize(categoryName)}/${capitalize(subcategory)}/${current.category_nature_type_name}`;

        if (payload.account_name !== userAccountFields.account_name) {
          console.log(`Check the input account name`);
        }

        break;
      }
      //----
      case 'debtor': {
        if (payload.debtor_name !== undefined)
          specificFields.debtor_name = payload.debtor_name;

        if (payload.debtor_lastname !== undefined)
          specificFields.debtor_lastname = payload.debtor_lastname;

        // Same defect as category_budget, with a harder failure: a PATCH
        // without debtor_lastname raised on .trim() of undefined and returned
        // 500. The stored parts fill whatever the payload omits.
        const stored = await client.query({
         text: `SELECT debtor_name, debtor_lastname FROM debtor_accounts WHERE account_id = $1`,
         values: [accountId],
        });

        if (stored.rows.length === 0) {
         console.warn(
          pc['red'](
           `No debtor_accounts row for account ${accountId}. Leaving account_name untouched.`,
          ),
         );
         break;
        }

        const current = stored.rows[0];
        const debtorName = payload.debtor_name ?? current.debtor_name;
        const debtorLastname =
         payload.debtor_lastname ?? current.debtor_lastname;

        userAccountFields.account_name = `${capitalize((debtorLastname ?? '').trim())}, ${capitalize((debtorName ?? '').trim())}`;

        break;
      }
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

    // cba.budget above is the legacy column. No budget endpoint reads it: they
    // all price from budget_policy_allocations. Without this the amount changed
    // on the account screen and nowhere else.
    const budget_policy = budgetChange
      ? await budgetPolicyService.applyAllocationForAccount(
          client,
          userId,
          accountId,
          budgetChange.amount,
          budgetChange.frequencyCode,
        )
      : null;

    await client.query('COMMIT'); // Commit if both updates were successful

    // 5. Deliver updated account to frontend (sync)
    //getAccountById can be implemented here to deliver all acccount info updated as it is returned by getAccountById.
    req.params.accountId = accountId;
    const message = `Account ${accountId} updated successfully!`;
    console.log('success:', pc.greenBright(message));

    res.status(200).json({
      status: 200,
      message,
      data: {
        account_id: accountId,
        ...userAccountFields,
        ...specificFields,
        // Only when a new version was opened. null would read as "the budget
        // was cleared" on a PATCH that never touched it.
        ...(budget_policy ? { budget_policy } : {}),
      }, //returns partial updated account info
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
