//createAccount
//getAccount
//addMoneyToAccount
//deleteAccount / not yet done

import {
  getCurrencyId,
  validateAndNormalizeDate,
} from '../../utils/helpers.js';
import { pool } from '../db/configDB.js';
import {
  createError,
  handlePostgresError,
  handlePostgresErrorEs,
} from '../../utils/errorHandling.js';
import pc from 'picocolors';
import { recordTransaction } from '../../utils/recordTransaction.js';

//endpoint :  http://localhost:5000/api/accounts/?user=userId&account_type=all&limit=0&offset=0

//before calling getAccount user must be verified with verifyUser() authmiddleware; in that case take userId from req.user

//createAccount
//to create an account user_accounts table must exist
//must consider that the type of transactions should be set to deposit or lend. any type of account is acceptable. movement should be investment, budget, debtor, pocket not expense, since it means putting money into the account. by default the destination account is the same new created account.

export const createAccount = async (req, res, next) => {
  console.log(pc.yellowBright('createAccount'));
  console.log('req.query;', req.query);
  const client = await pool.connect(); // Get a client from the pool
  try {
    const { user: userId } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, message: 'User ID is required.' });
    }
    //que pasa si el user es undefined o si no existe en las tablas de user? creo que para llegar aqui, dberia pasarse por verifyUser

    const {
      name: account_name,
      date: account_start_date,
      type: account_type_name,
      amount: account_starting_amount,
      currency: currency_code,
      sourceAccountId,
    } = req.body;

    const accountStartDateNormalized =
      validateAndNormalizeDate(account_start_date);
    console.log(
      '🚀 ~ createAccount ~ accountStartDateNormalized:',
      accountStartDateNormalized
    );

    // console.log(
    //   '🚀 ~ createAccount ~ accountStartDateNormalized:',
    //   accountStartDateNormalized
    // );

    if (
      !account_name ||
      !account_type_name ||
      !currency_code ||
      !account_starting_amount ||
      !accountStartDateNormalized
    ) {
      const message = 'All fields are required';
      console.warn(pc.yellowBright(message));
      return res.status(400).json({ status: 400, message });
    }

    await client.query('BEGIN');
    //search for existent user_accounts by userId and account name
    const accountExistQuery = {
      text: `SELECT * FROM user_accounts WHERE user_id = $1 AND account_name ILIKE $2`,
      values: [userId, `%${account_name}%`],
    };

    const accountExistResult = await pool.query(accountExistQuery);
    const accountExist = accountExistResult.rows.length > 0;

    console.log(
      '🚀 ~ createAccount ~ accountExist:',
      accountExist
      // accountExistResult.rows[0].account_name ?? 'non exists'
    );

    if (accountExist) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 409,
        message: `${accountExistResult.rows.length} account(s) found with a similar name`,
        account_found: [accountExistResult.rows[0].account_name],
      });
    }

    //currency and account type ids handling (since theses are chosen from a select on the browser frontend, existence should be warranted)
    //currency checking
    const currencyIdResult = await pool.query({
      text: `SELECT currency_id FROM currencies WHERE currency_code = $1`,
      values: [currency_code],
    });

    if (currencyIdResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const message = `Currency with code ${currency_code} was not found.`;
      console.warn(pc.yellowBright(message));
      return res.status(404).json({ status: 404, message });
    }

    //-------------------------------------------
    //account type id
    const accountTypeIdResult = await pool.query({
      text: `SELECT account_type_id FROM account_types WHERE account_type_name = $1`,
      values: [account_type_name],
    });

    if (accountTypeIdResult.rows.length === 0) {
      await client.query(`ROLLBACK`);
      const message = `Account type with name ${account_type_name} was not found`;
      console.warn(pc.yellowBright(message));
      next(createError(404, message));
    }

    const currencyId = currencyIdResult.rows[0].currency_id,
      accountTypeId = accountTypeIdResult.rows[0].account_type_id;

    console.log('🚀 ~ createAccount ~ currencyId:', currencyId);
    console.log('🚀 ~ createAccount ~ accountTypeId:', accountTypeId);
    //---------------------
    //update user_accounts by inserting the new account
    //existence of user_accounts must be checked
    const createAccountResult = await pool.query({
      text: `INSERT INTO user_accounts(user_id, account_name,
       account_type_id, currency_id,
       account_starting_amount, account_balance, account_start_date)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      values: [
        userId,
        account_name,
        accountTypeId,
        currencyId,
        account_starting_amount,
        account_starting_amount, //initial account balance is equal to starting amount
        accountStartDateNormalized,
      ],
    });
    console.log(
      '🚀 ~ createAccount ~ createAccountResult:',
      createAccountResult.rows[0]
    );

    //-----------Register trasaction
    //Add initial deposit transaction
    const newAccountInfo = createAccountResult.rows[0];
    const newAccountId = createAccountResult.rows[0].account_id;
    console.log('🚀 ~ createAccount ~ newAccountId:', newAccountId);

    // //createAccount controller transaction
    const transactionOptionCreateAccount = {
      userId,
      description: `${newAccountInfo.account_name}-(Initial Deposit)`,
      movement_type_id: 7, //income, receive
      status: 'complete',
      amount: account_starting_amount,
      currency_id: currencyId,
      source_account_id: sourceAccountId || newAccountId,
      //definir valor de este atributo, sera source of income, cash account, debtor account, category or pocket account, other account
      transaction_type_id: 2, //deposit or lend
      destination_account_id: newAccountId,
      transaction_actual_date: accountStartDateNormalized,
    };

    const createdAccountTransaction = await recordTransaction(
      transactionOptionCreateAccount
    );
    console.log(
      '🚀 ~ createAccount ~ createdAccountTransaction:',
      createdAccountTransaction
    );

    //opcion de crear cuentas en un arreglo y guardarlo en users
    //UPDATE users SET accounts_id = array_cat(accounts, $1), update_dat = CURRENT_TIMESTAMP id=$2 RETURNING *, values:[accounts, userId]

    //transaction confirmed
    await client.query('COMMIT');

    //Successfull answer
    return res.status(200).json({
      message: `${newAccountInfo.account_name} Account created successfully`,
      data: { newAccountInfo, createdAccountTransaction },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      pc.redBright('when creating account:'),
      error.message || 'something went wrong'
    );
    // Handle PostgreSQL error
    const { code, message } = handlePostgresError(error); 

    return next(createError(code, message));
  } finally {
    client.release(); //always release the client back to the pool
  }
};

//*********** */
//getAccount
// get the accounts of entered type,
export const getAccount = async (req, res, next) => {
  console.log(pc.magentaBright('getAccount'));

  try {
    console.log('req.query;', req.query);
    const { user: userId, type } = req.query;

    const { accountId: account_id } = req.params;
    console.log('🚀 ~ getAccount ~ accountId:', account_id, req.params);

    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, message: 'User ID is required.' });
    }

    if (!!account_id) {
      const accountIdResult = await pool.query({
        text: `SELECT * FROM user_accounts WHERE account_id = $1`,
        values: [account_id],
      });
      console.log(
        '🚀 ~ getAccount ~ typeAccountIdResult:',
        accountIdResult.rows
      );

      const accountIdExists = accountIdResult.rows.length > 0;
      console.log('🚀 ~ getAccount ~ typeAccountIdExists:', accountIdExists);

      if (!accountIdExists && !type) {
        const message = `Account with id ${account_id} was not found.`;
        console.warn(pc.magentaBright(message));
        return res.status(404).json({ status: 404, message });
      }

      const foundAccountId = accountIdResult.rows[0];

      console.log('🚀 ~ getAccount ~ AccountId:', foundAccountId);

      //Successfull answer.
      const message = `${foundAccountId.account_name} account was successfully found with id ${account_id} for user ${userId}`;
      console.log(pc.magentaBright(message));

      return res.status(200).json({
        message: `${message}`,
        data: foundAccountId,
      });
    }

    if (type) {
      const typeAccountIdResult = await pool.query({
        text: `SELECT account_type_id FROM account_types WHERE account_type_name = $1`,
        values: [type],
      });
      console.log(
        '🚀 ~ getAccount ~ typeAccountIdResult:',
        typeAccountIdResult.rows
      );

      const typeAccountIdExists = typeAccountIdResult.rows.length > 0;
      console.log(
        '🚀 ~ getAccount ~ typeAccountIdExists:',
        typeAccountIdExists
      );

      if (!typeAccountIdExists) {
        const message = `Account type ${type} was not found.`;
        console.warn(pc.magentaBright(message));
        return res.status(404).json({ status: 404, message });
      }

      const typeAccountId = typeAccountIdResult.rows[0].account_type_id;

      // console.log('🚀 ~ getAccount ~ typeAccountId:', typeAccountId);

      const accountsByTypeResult = await pool.query({
        text: `SELECT * FROM user_accounts WHERE user_id = $1 AND account_type_i=d = $2`,
        values: [userId, typeAccountId],
      });

      const accountsByTypeResultExists = accountsByTypeResult.rows.length > 0;
      /*** */
      if (type && !accountsByTypeResultExists) {
        const message = `No account of ${type} type for the user ${userId} was found.`;
        console.log(pc.magentaBright(message));
        return res.status(404).json({ status: 404, message });
      }

      //Successfull answer. user accounts of user by type
      const message = `${accountsByTypeResult.rows.length} Account(s) successfully found of type ${type} for user ${userId}`;
      console.log(pc.magentaBright(message));

      return res.status(200).json({
        message: `${accountsByTypeResult.rows.length} Account(s) successfully found of type ${type} for user ${userId}`,
        data: accountsByTypeResult.rows,
      });
    } else {
      const userAccountsResult = await pool.query({
        text: `SELECT * FROM user_accounts WHERE user_id = $1`,
        values: [userId],
      });

      const userAccountsResultExists = userAccountsResult.rows.length > 0;

      if (!userAccountsResultExists) {
        const message = `No account was found.`;
        console.warn(pc.magentaBright(message));
        return res.status(404).json({ status: 404, message });
      }

      //Successfull response
      const message = `${userAccountsResult.rows.length} account(s) found`;
      console.warn(pc.magentaBright(message));
      return res.status(200).json({
        message,
        data: userAccountsResult.rows,
      });
    }
  } catch (error) {
    console.error(
      pc.redBright('when getting the accounts:'),
      error.message || 'something went wrong'
    );
    // Handle PostgreSQL error
    const { code, message } = handlePostgresErrorEs(error);
    // Send response to frontend
    return next(createError(code, message));
  }
};

//******** */
//addMoneyToAccount
//endpoint :  http://localhost:5000/api/accounts/add-money/:id?user=userId
// &account_type=all&limit=0&offset=0

export const addMoneyToAccount = async (req, res, next) => {
  console.log(pc.cyanBright('addMoneyToAccount'));

  const client = await pool.connect(); // Get a client from the pool
  console.log(
    'req.query;',
    req.query,
    'req.params:',
    req.params,
    'req.body:',
    req.body
  );

  try {
    const { user: userId } = req.query;
    if (!userId) {
      const message = 'User ID is required.';
      console.warn(pc.cyanBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //que pasa si el user es undefined o si no existe en las tablas de user? creo que para llegar aqui, dberia pasarse por verifyUser

    const { id: accountId } = req.params;

    if (!accountId) {
      const message = 'Account ID is required.';
      console.warn(pc.cyanBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const { amount, currency: currencyCode, sourceAccountId, date } = req.body;

    const transactionActualDate = date
      ? validateAndNormalizeDate(date)
      : new Date();

    //si currency no es introducida podria usarse la que es por defecto

    //QUE PASA SI ACCOUNT ID NO EXISTE PARA ESE USUARIO? desde front end el account id se debe asegurar su existencia?
    if (!amount || !currencyCode) {
      const message = 'All fields are required';
      console.warn(pc.cyanBright(message));
      return res.status(400).json({ status: 400, message });
    }
    if (amount < 0) {
      const message = 'amount must be greater than 0';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }

    // const newAmountToAdd = Number(amount);
    const newAmountToAdd = parseFloat(amount);
    console.log('🚀 ~ addMoneyToAccount ~ newAmountToAdd:', newAmountToAdd);

    //CHECK THE CURRENCY OF THE DEPOSIT WITH  THE CURRENCY OF THE ACCOUNT. TO ADD, THEY MUST BE CORRESPONDENT, AND DECIDE WHAT CURRENCY USE TO SAVE INTO THE DATABASE. IF CONVERSION MUST BE DONE , THEN WHAT exchange rate to use, it has to do with the date of the transaction or will be the updated rate?

    //currency and account type ids handling (since theses are chosen from a select on the browser frontend, existence should be warranted)

    //---check currency existence---------------
    // const currencyIdResult = await pool.query({
    //   text: `SELECT currency_id FROM currencies WHERE currency_code = $1`,
    //   values: [currencyCode],
    // });

    // if (currencyIdResult.rows.length === 0) {
    //   const message = `Currency with code ${currencyCode} was not found.`;
    //   console.warn(pc.yellowBright(message));
    //   return res.status(404).json({ status: 404, message });
    // }

    // const currencyId = currencyIdResult.rows[0].currency_id;

    const currencyId = getCurrencyId(currencyCode);
    console.log('🚀 ~ createAccount ~ currencyId:', currencyId);
    //--------account checking existence
    //account id must be provided by the frontend in the request
    //search for existent OF user_accounts by userId and account name
    // const accountExistQuery = {
    //   text: `SELECT * FROM user_accounts WHERE user_id = $1 AND account_name ILIKE $2`,
    //   values: [userId, `%${account_name}%`],
    // };

    // const accountExistResult = await pool.query(accountExistQuery);
    // const accountExist = accountExistResult.rows.length > 0;

    // // console.warn(
    // //   '🚀 ~ createAccount ~ accountExist:',
    // //   accountExist
    // //   // accountExistResult.rows[0].account_name ?? 'non exists'
    // // );

    // if (accountExist) {
    //   await pool.query('ROLLBACK');
    //   return res.status(409).json({
    //     status: 409,
    //     message: `${accountExistResult.rows.length} account(s) found with a similar name`,
    //     account_found: [accountExistResult.rows[0].account_name],
    //   });
    // }

    // const accountTypeIdResult = await pool.query({
    //   text: `SELECT account_type_id FROM account_types WHERE account_type_name = $1`,
    //   values: [account_type_name],
    // });

    // if (accountTypeIdResult.rows.length === 0) {
    //   await client.query(`ROLLBACK`);
    //   const message = `Account type with name ${account_type_name} was not found`;
    //   console.warn(pc.yellowBright(message));
    //   // return res.status(404).json({
    //   //   status: 404,
    //   //   message,
    //   // });
    //   // Send response to frontend
    //   next(createError(404, message));
    // }

    // accountTypeId = accountTypeIdResult.rows[0].account_type_id;
    // console.log('🚀 ~ createAccount ~ accountTypeId:', accountTypeId);
    //----------------------

    //--------------------------
    await client.query('BEGIN');
    const newAccountBalanceResult = await pool.query({
      text: `UPDATE user_accounts SET account_balance = (account_balance + $1), currency_id = $2, updated_at = CURRENT_TIMESTAMP  WHERE user_id = $3 AND account_id = $4 RETURNING *`,
      values: [newAmountToAdd, currencyId, userId, accountId],
    });

    const accountBalance = newAccountBalanceResult.rows;
    console.log(
      'Updated balance account:',
      accountBalance,
      accountBalance[0].account_balance,
      currencyCode,
      newAmountToAdd
    );

    const accountInfo = accountBalance[0];
    console.log('🚀 ~ addMoneyToAccount ~ accountInfo:', accountInfo);

    if (accountBalance.length > 0) {
      console.log(
        'Updated balance account to:',
        accountInfo.account_balance,
        currencyCode
      );
    } else {
      const message =
        'Balance account was not updated. Check account id number';
      console.warn(pc.red(message));
      await client.query('ROLLBACK');
      return res.status(403).json({ status: 403, message });
    }

    //Add  deposit transaction

    //-----------Register trasaction
    //Add deposit transaction
    const transactionOptionAddMoneyToAccount = {
      userId,
      description: `${accountInfo.account_name}-(Received Deposit)`,
      movement_type_id: 7, //income, receive
      status: 'complete',
      amount: newAmountToAdd,
      currency_id: currencyId,
      source_account_id: sourceAccountId || accountId,
      //definir valor de este atributo, sera source of income, cash account, debtor account, category or pocket account, other account
      transaction_type_id: 2, //deposit or lend
      destination_account_id: accountId,
      transaction_actual_date: transactionActualDate,
    };

    const createdAccountTransaction = await recordTransaction(
      transactionOptionAddMoneyToAccount
    );

    console.log('🚀  ~ createdAccountTransaction:', createdAccountTransaction);

    //transaction confirmed
    await client.query('COMMIT');

    //Successfull answer
    const message = `${accountInfo.account_name} : ${newAmountToAdd} was added to account balance and transaction registered successfully`;
    console.log(pc.cyanBright(message));
    res.status(200).json({
      message,
      data: { accountInfo, transactionOptionAddMoneyToAccount },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      pc.redBright('when creating account:'),
      error.message || 'something went wrong'
    );
    // Handle PostgreSQL error
    const { code, message } = handlePostgresError(error);

    // Send response to frontend
    return next(createError(code, message));
  } finally {
    client.release(); //always release the client back to the pool
  }
};
