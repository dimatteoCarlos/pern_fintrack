// backend\src\fintrack_api\controllers\accountCategoryCreationcontroller.js
//
import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';
import { determineTransactionType, formatDate } from '../../utils/helpers.js';
import { recordTransaction } from '../../utils/recordTransaction.js';
import { checkAndInsertAccount } from '../../utils/checkAndInsertAccount.js';
import { verifyAccountExistence } from '../../utils/verifyAccountExistence.js';
import { updateAccountBalance } from '../../utils/updateAccountBalance.js';
import { insertAccount } from '../../utils/insertAccount.js';
import { getTransactionTypeId } from '../../utils/getTransactionTypeId.js';
import { determineSourceAndDestinationAccounts } from '../../utils/determineSourceAndDestinationAccounts.js';
import { prepareTransactionOption } from '../../utils/prepareTransactionOption.js';
//import { validateAndNormalizeDate } from '../../utils/helpers.js';
//-----------------
//endpoint: POST: http://localhost:5000/api/fintrack/account/new_account/category_budget?user=6e0ba475-bf23-4e1b-a125-3a8f0b3d352c
//rules
//basic_account_data:
// userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount,
//account type: category_budget.
//movement_type_name:'account-opening', movement_type_id: 8, transaction_type_name:deposit

export const createCategoryBudgetAccount = async (req, res, next) => {
  console.log(pc.blueBright('createCategoryBudgetAccount'));
  // console.log(req.body, req.params, req.query);
  const client = await pool.connect();
  //----------------------------------------
  try {
    const {userId}=req.user
    // console.log(req);

    if (!userId) {
      const message = 'User ID is required';
      console.warn('message:', message);
      return res.status(400).json({ status: 400, message });
    }
    const { currency, date, amount, transactionActualDate } = req.body;
    const currency_code = currency ? currency : 'usd';
    const account_start_date = !!date && date !== '' ? date : new Date();
    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : transactionActualDate;
    //category_budget account
    //data from budget new category form
    const {
      nature: nature_type_name_req,
      subcategory,
      name: category_name,
      budget,
      sourceAccountId,
    } = req.body;
//BUILD ACCOUNT NAME FOR CATEGORY BUDGET
    const account_type_name = 'category_budget';
    const account_name =
      account_type_name === 'category_budget'
        ? req.body.name + '/' + req.body.subcategory + '/' + req.body.nature
        : req.body.name;

    const category_nature_budget = budget ? parseFloat(budget) : 0.0;

    if (budget < 0) {
      const message = 'Budget amount must be >= 0. Tray again!';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const account_starting_amount = amount ? parseFloat(amount) : 0.0;
    //initial amount received (expense from other accounts).It's not necessary according to frontend fintrack
    //----------------------------------
    //currency and account_type data, are defined and validated by frontend
    if (!account_type_name || !currency_code || !account_name) {
      const message =
        'Currency_code, account name and account type name fields are required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //----------------------------------
    //get all account types and then get the account type id requested
    const accountTypeQuery = `SELECT * FROM account_types`;
    const accountTypeResult = await pool.query(accountTypeQuery);
    const accountTypeArr = accountTypeResult.rows;
    const accountTypeIdReqObj = accountTypeArr.filter(
      (type) => type.account_type_name == account_type_name.trim()
    )[0];
    const accountTypeIdReq = accountTypeIdReqObj.account_type_id;
    //----CATEGORY BUDGET ACCOUNT ------
    //----------------------------------
    //verify account existence in user_accounts by userId and account name
    const accountExist = await verifyAccountExistence(
      client, 
      userId,
      account_name,
      account_type_name
    );
    console.log('🚀 ~ CATEGORY BUDGET ~ accountExist:', accountExist);
    //----------------------------------
    //get currency id from currency_code requested
    const currencyQuery = `SELECT * FROM currencies`;
    const currencyResult = await pool.query(currencyQuery);
    const currencyArr = currencyResult?.rows;
    const currencyIdReq = currencyArr.filter(
      (currency) => currency.currency_code === currency_code
    )[0].currency_id;
    // console.log('🚀 ~ createAccount ~ currencyIdReq:', currencyIdReq);
    //---------------------------------------
    //----- CHECK CATEGORY_BUDGET+ SUBCATEGORY + NATURE, ACCOUNT EXISTENCE ----------------
    // check existence of category AND subcategory and nature,name existence
    const categoryAndSubcategoryAndNatureQuery = {
      text: `SELECT cba.* FROM category_budget_accounts cba
    JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id

    WHERE cba.category_name = $1 AND cnt.category_nature_type_name=$2
    AND cba.subcategory=$3
    `,
      values: [category_name, nature_type_name_req, subcategory.trim()],
    };
    const categoryAndSubcategoryAndNatureExistsResult = await pool.query(
      categoryAndSubcategoryAndNatureQuery
    );
    const categoryAndSubcategoryAndNatureExists =
      categoryAndSubcategoryAndNatureExistsResult.rows.length > 0;

    if (categoryAndSubcategoryAndNatureExists) {
      const message = `Can not create a new account since, category ${category_name} with subcategory ${subcategory} and nature ${nature_type_name_req} account already exists. Try again`;
      console.warn('🚀 ~ createAccount ~ message:', message);
      throw new Error(message);
    }
    //---------------------------------------
    const category_nature_type_id_reqResult = await pool.query({
      text: `SELECT category_nature_type_id FROM category_nature_types WHERE category_nature_type_name = $1`,
      values: [nature_type_name_req],
    });
    const category_nature_type_id_req =
      category_nature_type_id_reqResult.rows[0].category_nature_type_id;
    //-----------------------------

    //---------------------------------------
    //----- CHECK CATEGORY_BUDGET + NATURE ACCOUNT EXISTENCE ----------------
    // check existence of category and nature existence
    // const categoryAndNatureQuery = {
    //   text: `SELECT cba.* FROM category_budget_accounts cba
    // JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
    // WHERE cba.category_name = $1 AND cnt.category_nature_type_name=$2`,
    //   values: [category_name, nature_type_name_req],
    // };
    // const categoryAndNatureExistsResult = await pool.query(
    //   categoryAndNatureQuery
    // );
    // const categoryAndNatureExists =
    //   categoryAndNatureExistsResult.rows.length > 0;

    // if (categoryAndNatureExists) {
    //   await client.query('ROLLBACK');
    //   const message = `Can not create a new account since, category ${category_name} with nature ${nature_type_name_req} account already exists. Try again`;
    //   console.warn('🚀 ~ createAccount ~ message:', message);
    //   throw new Error(message);
    // }
   
    //--------------------------------------
    //----- INSERT NEW CATEGORY_BUDGET BASIC ACCOUNT into user_accounts table --------
    //initial amount spent in the balance (expense from other accounts) could be considered
    //CHECK WEATHER IT CAN BE SPENT WHEN NO BUDGET HAS BEEN ASSIGNED TO THE ACCOUNT. IT SHOULD NOT BE.
    //CUANDO SE ASIGNA UN BUDGET, ?SE RESERVA ALGUN DINERO EN ALGUNA OTRA CUENTA?
    const transactionAmount = account_starting_amount;
    const account_balance = transactionAmount;

   //TRANSACTION BEGIN
    await client.query('BEGIN');
    const { account_basic_data } = await insertAccount(
      client,
      userId,
      account_name,
      accountTypeIdReq,
      currencyIdReq,
      account_starting_amount,
      account_balance,
      account_start_date ?? transaction_actual_date
      
    );
    const account_id = account_basic_data.account_id;
    //--------
    //INSERT CATEGORY_BUDGET_SUBCATEGORY_NATURE ACCOUNT into category_budget_accounts table
    const category_budget_accountQuery = {
      text: `INSERT INTO category_budget_accounts(account_id, category_name,category_nature_type_id,subcategory,budget,account_start_date ) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      values: [
        account_id,
        category_name,
        category_nature_type_id_req,
        subcategory,
        category_nature_budget,
        account_start_date,
      ],
    };
    const category_budget_accountResult = await client.query(
      category_budget_accountQuery
    );
    const category_budget_account = {
      ...category_budget_accountResult.rows[0],
      nature_type_name: nature_type_name_req,
      currency_code,
    };
    //--------------------
    //DETERMINE THE TRANSACTION TYPE FOR NEW CATEGORY_BUDGET ACCOUNT AND FOR COUNTER ACCOUNT (SLACK)
    const transactionTypeDescriptionObj = determineTransactionType(
      transactionAmount,
      account_type_name
    );

    const { transactionType, counterTransactionType } =
      transactionTypeDescriptionObj;

    //get the transaction type id's
    const transactionTypeDescriptionIds = await getTransactionTypeId(
      client, 
      transactionTypeDescriptionObj.transactionType,
      transactionTypeDescriptionObj.counterTransactionType
    );

    const { transaction_type_id, countertransaction_type_id } =
      transactionTypeDescriptionIds;

    const transactionDescription = `Transaction: ${transactionType}. Account: ${account_name} (${account_type_name}). Initial-(${transactionType}). Amount: ${transactionAmount} ${currency_code}.  Date:${formatDate(transaction_actual_date)}`;

    //------ CATEGORY_BUDGET NEW ACCOUNT INFO ----
    const newAccountInfo = {
      user_id: userId,
      description: transactionDescription,
      transaction_type_id,
      transaction_type_name: transactionType,
      amount: parseFloat(transactionAmount),
      currency_id: currencyIdReq,
      account_id: account_basic_data.account_id,
      transaction_actual_date,
      currency_code,
      account_name,
      account_type_name,
      account_type_id: account_basic_data.account_type_id,
      account_balance: parseFloat(account_balance),
    };
    //------- UPDATE COUNTER ACCOUNT BALANCE (SLACK ACCOUNT)------
    //check whether slack account exists if not create it with start amount and balance = 0
    //slack account or counter account (bridge account), is like a compensation account which serves to check the equilibrium on cash flow like a counter transaction operation
    const counterAccountInfo = await checkAndInsertAccount(client, userId, 'slack');

    const newCounterAccountBalance =
      counterAccountInfo.account.account_balance - transactionAmount;

    const counterAccountTransactionAmount = -transactionAmount;

    const counterTransactionDescription = `Transaction: ${counterTransactionType}. Account: ${counterAccountInfo.account.account_name} (bank), number: ${counterAccountInfo.account.account_id}. Amount:${currency_code} ${counterAccountTransactionAmount}. Account reference: ${account_name}). Date:${formatDate(transaction_actual_date)}`;
    //-----------------------------
    //----SLACK COUNTER ACCOUNT INFO ------
    const slackCounterAccountInfo = {
      user_id: userId,
      description: counterTransactionDescription,
      transaction_type_id: countertransaction_type_id,
      transaction_type_name: counterTransactionType,
      amount: parseFloat(counterAccountTransactionAmount),
      currency_id: currencyIdReq,
      account_id: counterAccountInfo.account.account_id,
      transaction_actual_date,
      currency_code,
      account_name: counterAccountInfo.account.account_name,
      account_type_name: 'bank',
      account_type_id: counterAccountInfo.account.account_type_id,
      account_balance: parseFloat(newCounterAccountBalance),
    };

    //-- UPDATE BALANCE OF COUNTER ACCOUNT INTO user_accounts table
    const updatedCounterAccountInfo = await updateAccountBalance(
      client,
      newCounterAccountBalance,
      slackCounterAccountInfo.account_id,
      transaction_actual_date
    );

    console.log(
      '🚀 ~ createBasicAccount ~ updatedCounterAccountInfo:',
      updatedCounterAccountInfo
    );

    //--- determine which account serves as a SOURCE OR DESTINATION account
    //category_budget_account should always be a destination account
    const { destination_account_id, source_account_id, isAccountOpening } =
      determineSourceAndDestinationAccounts(newAccountInfo, counterAccountInfo);

    //--------REGISTER NEW ACCOUNT TRANSACTION -------
    //Add deposit transaction
    //movement_type_name:account-opening, movement_type_id: 8,  transaction_type_name:deposit/account-opening, transaction_type_id: 2/5
    //----------------------------------
    //--- RECORD TRANSACTION INTO transactions table ----
    //-------------------------------
    //--------Rules to register  a transaction
    //movement_type_name:account-opening, movement_type_id: 8,  transaction_type_name:account-opening/deposit, transaction_type_id: 5/2 although it could accept withdraw but is not recommended

    const movement_type_id = 8; //account opening
    const movement_type_name = 'account opening';

    //--------REGISTER NEW ACCOUNT TRANSACTION -------
    const transactionOption = prepareTransactionOption(
      newAccountInfo,
      source_account_id,
      destination_account_id,
      movement_type_id
    );
    const recordTransactionInfo = await recordTransaction(client, transactionOption);

    //--------REGISTER COUNTER ACCOUNT (SLACK) TRANSACTION ------
    const counterTransactionOption = prepareTransactionOption(
      slackCounterAccountInfo,
      source_account_id,
      destination_account_id,
      movement_type_id
    );
    const counterTransactionInfo = !isAccountOpening
      ? await recordTransaction(client, counterTransactionOption)
      : {};

    await client.query('COMMIT');
    //-----------------------------
    //SUCCESS MESSAGE RESPONSE
    const message = `${account_name} account of type ${account_type_name} with number ${account_id} was successfully created `;
    console.log('🚀 ~ createAccount ~ message:', pc.cyanBright(message));

    //---deliver user_id only once
    delete account_basic_data.user_id;
    delete category_budget_account.user_id;
    delete category_budget_account.user_id;
    delete recordTransactionInfo.user_id;
    delete counterTransactionInfo.user_id;
    delete transactionOption.userId;
    delete counterTransactionOption.userId;

    //-------------------------
    return res.status(201).json({
      status: 201,
      movement_type_id,
      movement_type_name,
      data: {
        user_id: userId,
        account_basic_data: {
          ...account_basic_data,
          account_type_name,
          nature_type_name: nature_type_name_req,
          currency_code,
        },
        new_category_budget_account: category_budget_account,

        new_account_data: {
          account_name: newAccountInfo.account_name,
          transaction_data: transactionOption,
          transaction_info: recordTransactionInfo,
          transaction_type_name: newAccountInfo.transaction_type_name,
        },
        counter_account_data: {
          account_name: counterTransactionInfo.account_name,
          transaction_data: counterTransactionOption,
          transaction_info: counterTransactionInfo,
          transaction_type_name: counterTransactionInfo.transaction_type_name,
        },
      },
      message,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    const { code, message } = handlePostgresError(error); //handle pg errors
    console.error(
      pc.red('Error creating category budget account:'),
      message || 'something went wrong'
    );
    return next(createError(code, message));
  } finally {
    client.release();
  }
};
//--------------------------
