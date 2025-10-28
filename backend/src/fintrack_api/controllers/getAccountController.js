// backend/src/fintrack_api/controllers/getAccountController.js
//getAllAccountsByType, getAccounts, getAccountById, getAccountsByCategory

import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';
import dotenv from 'dotenv';
import { respondError, respondSuccess } from '../../../utils/responseHelpers.js';
dotenv.config();

const backendColor = 'greenBright';
const errorColor = 'red';

//COMMON FUNCTIONS
const RESPONSE = (res, status, message, data = null) => {
  const backendColor =
    status >= 400 ? 'red' : status >= 300 ? 'yellow' : 'green';
  console.log(pc[backendColor](`[${status}] ${message}`));

  res.status(status).json({ status, message, data });
};
//------
// 🧮 CATEGORY BUDGET METRICS CALCULATOR
const calculateBudgetMetrics = (balanceAccount, budgetAccount)=>{
  const remain = Math.round(parseFloat(budgetAccount) - parseFloat(balanceAccount))
  const statusAlert = remain <=0

  return {remain, statusAlert}
  }
//-------  
// 📊 TRANSACTIONS QUERY
  const getAccountTransactions =async (userId, accountId, startDate, endDate)=>{
// 🗓️ DEFAULT PERIOD: Last 2 months + current month
    const defaultStartDate = startDate || new Date(new Date().getFullYear(), new Date().getMonth-1, 1).toISOString().split('T')[0];

    const defaultEndDate = endDate || 
    new Date(new Date().getFullYear(), new Date().getMonth +1, 0).toISOString().split('T')[0]
  
  // 📝 TRANSACTIONS QUERY 
  const transactionsQuery = {
    text:`
    SELECT tr.*, mt.movement_type_name, trt.transaction_type_name, ct.currency_code
    FROM transactions tr
    JOIN user_accounts ua ON (tr.account_id = ua.account_id AND tr.user_id = ua.user_id)
      JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
      JOIN transaction_types trt ON tr.transaction_type_id = trt.transaction_type_id
      JOIN currencies ct ON tr.currency_id = ct.currency_id
      WHERE tr.user_id = $1
        AND tr.account_id = $2
        AND tr.transaction_actual_date BETWEEN $3 AND $4
      ORDER BY tr.transaction_actual_date DESC, tr.created_at DESC
    `,
    values:[userId, accountId, defaultStartDate, defaultEndDate]
  }
  
 const transactionsResult = await pool.query(transactionsQuery)

// 📈 CALCULATE SUMMARY DATA
const transactions = transactionsResult.rows
const totalTransactions = transactions.length

// 🏦 FIND INITIAL AND FINAL BALANCES
const initialBalance = transactions.length>0
  ?{
   amount:parseFloat(transactions[transactions.length-1].account_balance_after_tr) || 0,
   date: transactions[transactions.length-1].transaction_actual_date,
   currency: transactions[0].currency_code
    }
  :{ amount: 0, date: defaultStartDate, currency: 'usd' };
//---
  const finalBalance = transactions.length > 0
    ? {
      amount: parseFloat(transactions[0].account_balance_after_tr) || 0,
      date: transactions[0].transaction_actual_date,
      currency: transactions[0].currency_code
      }
    : {amount: 0, date: defaultEndDate, currency: 'usd' };

  return {
    totalTransactions,
    summary: {
      initialBalance,
      finalBalance,
      periodStartDate: defaultStartDate,
      periodEndDate: defaultEndDate
      },
      transactions
    };
  };//END OF getAccountTransactions
//----------
// 🎯 UNIFIED CATEGORY BUDGET DATA FETCHER
// Get complete category_budget account data including transactions
const getCategoryBudgetFullData = async (userId, accountId)=>{
try {
  console.log(pc[backendColor](`Fetching full category_budget data for account: ${accountId}`)); 

// 📋 ACCOUNT BASIC INFO + CATEGORY BUDGET DATA
  const accountQuery ={
    text:`
    SELECT 
      ui.*,
      act.account_type_name,
      ct.currency_code,
      cba.budget,
      cba.category_nature_type_name
    FROM user_accounts ua

    JOIN account_types act ON ua.account_type_id = act.account_type_id

    JOIN currencies ct ON ua.currency_id = ct.currency_id

    JOIN category_budget_accounts cba ON ua.account_id = cba.account_id

    JOIN category_nature cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
    
    WHERE ua.user_id = $1
      AND ua.account_id = $2
      AND act.account_type_name = 'category_budget'
    `,
    values:[userId, accountId]
  }

 const accountResult = await pool.query(accountQuery)

if(accountResult.rows.length ===0){
  throw new Error("Category budget account not found")
}

const accountData = accountResult.rows[0]
const { remain, statusAlert } = calculateBudgetMetrics(
    parseFloat(accountData.account_balance),
    parseFloat(accountData.budget)
  );

// 📊 GET TRANSACTIONS DATA
  const transactionsData = await getAccountTransactions(userId, accountId);

// 🏗️ BUILD COMPLETE RESPONSE OBJECT
  const completeAccountData ={
      accountInfo: {
        ...accountData,
        remain,
        statusAlert
      },
      transactions: transactionsData
    };

  console.log(pc[backendColor]('Category budget full data prepared successfully'));
    return completeAccountData;

 } catch (error) {
  console.error('Error in getCategoryBudgetFullData:', error);
  throw error;
  }
 }//END OF getCategoryBudgetFullData

//**** CONTROLLERS *********
//GET ALL ACCOUNTS INFO BY ACCOUNT TYPE: id, name, type, currency and balance, by user id and account_type but slack account.
//endpoint: http://localhost:5000/api/fintrack/account/type/?type=${bank}&user=${6e0ba475-bf23-4e1b-a125-3a8f0b3d352c}
//type can be: bank, category_budget, income_source, investment, debtor, bank_and_investment

export const getAllAccountsByType = async (req, res, next) => {
  const controllerName = 'getAllAccountsByType';
  console.log(pc[backendColor](controllerName));

  try {
    const { type } = req.query;
    const accountType = type.trim();
    const userId = req.user.userId||(req.body.user ?? req.query.user);
  // console.log(userId, req.user, controllerName);

    if (!accountType || !userId) {
      const message = `User ID and account type are required.Try again!.`;
      console.warn(pc[backendColor](message));
      // return res.status(400).json({ status: 400, message });
      return respondError(res, 400, message);
    }
    if (
      ![
        'bank',
        'category_budget',
        'income_source',
        'investment',
        'pocket_saving',
        'debtor',
        'bank_and_investment',
      ].includes(accountType)
    ) {
      const message = `Account of type ${accountType} is not valid. Try again!.`;
      console.warn(pc[backendColor](message, controllerName));
      return respondError(res, 400, message);
      // return res.status(400).json({ status: 400, message });
      // ERR_RESP(400, message, controllerName);
    }
    //---------------------------------
    const accountTypeQuery = {
      bank: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, CAST(ua.account_balance AS FLOAT), ct.currency_code, act.account_type_id, act.account_type_name,
          CAST(ua.account_starting_amount AS FLOAT),  ua.account_start_date
       FROM user_accounts ua
       JOIN account_types act ON ua.account_type_id = act.account_type_id
       JOIN currencies ct ON ua.currency_id = ct.currency_id
       WHERE ua.user_id = $1
       AND act.account_type_name = $2 AND ua.account_name != $3
       ORDER BY ua.account_name ASC, ua.account_balance DESC
       `,
          values: [userId, accountType, 'slack'],
        },
      },

      category_budget: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, CAST(ua.account_balance AS FLOAT),
   act.account_type_name,
   ct.currency_code, cba.budget, cba.subcategory, cnt.category_nature_type_name,
     ua.account_starting_amount,  ua.account_start_date
   FROM user_accounts ua
   JOIN account_types act ON ua.account_type_id = act.account_type_id
   JOIN currencies ct ON ua.currency_id = ct.currency_id
   JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
   JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
   WHERE ua.user_id =$1
   AND act.account_type_name = $2 AND ua.account_name != $3
   ORDER BY ABS(ua.account_balance) DESC
       `,
          values: [userId, accountType, 'slack'],
        },
      },

      income_source: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, CAST(ua.account_balance AS FLOAT), act.account_type_name, ct.currency_code, 
         CAST(ua.account_starting_amount AS FLOAT), ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  ORDER BY ABS(ua.account_balance) DESC
`,
          values: [userId, accountType, 'slack'],
        },
      },

      investment: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, CAST(ua.account_balance AS FLOAT), act.account_type_name, ct.currency_code, 
           CAST(ua.account_starting_amount AS FLOAT) ,  ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  ORDER BY ABS(ua.account_balance) DESC
      `,
          values: [userId, accountType, 'slack'],
        },
      },

      pocket_saving: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, CAST(ua.account_balance AS FLOAT), act.account_type_name, ct.currency_code, ps.target, ps.desired_date, ps.account_start_date, 
            ua.account_starting_amount,  ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
JOIN pocket_saving_accounts ps ON ua.account_id = ps.account_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  ORDER BY ps.target DESC,  ABS(ua.account_balance) DESC
      `,
          values: [userId, accountType, 'slack'],
        },
      },

      debtor: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, CAST(ua.account_balance AS FLOAT), act.account_type_name, ct.currency_code,
          ps. value as starting_value, ps.debtor_name, ps.debtor_lastname, ps.selected_account_name,  ps.account_start_date, 
            ua.account_starting_amount,  ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
JOIN debtor_accounts ps ON ua.account_id = ps.account_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  ORDER BY  (ua.account_balance) ASC
      `,
          values: [userId, accountType, 'slack'],
        },
      },

      bank_and_investment: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name,
           CAST(ua.account_balance AS FLOAT),
            ct.currency_code, act.account_type_id, act.account_type_name,
          CAST(ua.account_starting_amount AS FLOAT),
            ua.account_start_date
          FROM user_accounts ua
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          WHERE ua.user_id = $1
          AND( act.account_type_name = $2 OR act.account_type_name=$3) AND ua.account_name != $4
        ORDER BY ua.account_type_id ASC, ua.account_name ASC, ua.account_balance DESC
       `,
          values: [userId, 'bank', 'investment', 'slack'],
        },
      },
    };

    const accountListResult = await pool.query(
      accountTypeQuery[accountType].typeQuery
    );

    if (accountListResult.rows.length === 0) {
      const message = `No accounts of type: "${accountType}" found`;
      console.warn(pc[backendColor](message));
      return respondError(res, 404, message);
    }

    const accountList = accountListResult.rows;

    //devolver el nombre de la cuenta, (balance actual), currency_code
    const data = {
      rows: accountList.length,
      accountList: accountListResult.rows,
    };

    const message = `Accounts retrieved successfully for accounts type "${accountType}"`;
    console.log('success:', pc[backendColor](message), controllerName);

    // res.status(200).json({ status: 200, message, data });
    return respondSuccess(res, data, 200, message);
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting accounts by account type'));
      console.error(pc.red(`[${controllerName}] Error:`), error);

      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    }

    // console.error(
    //   pc.red('Error during transfer'),
    //   pc[errorColor]('Unknown error occurred'),
    //   controllerName
    // );
    next(error);
    // next(createError(code, message));
  }
  // Manejo de errores de PostgreSQL - pg sql error handling
  // const { code: sqlCode, message: sqlMsg } = handlePostgresError(error);
};

//***********************************/
// GET ALL THE AVAILABLE ACCOUNTS, ALL TYPES,  BUT SLACK ACOUNT
//endpoint: http://localhost:5000/api/fintrack/account/allAccounts/?user=6e0ba475-bf23-4e1b-a125-3a8f0b3d352c
export const getAccounts = async (req, res, next) => {
  console.log(pc[backendColor]('getAccounts'));

  try {
    // const { user: userId } = req.query;
    const userId = req.user.userId ?? req.body.user ;

    if (!userId) {
      const message = `User ID is required. Try again.`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    const accountTypeQuery = {
      all: {
        typeQuery: {
          text: `SELECT ua.*,  ct.currency_code,  act.account_type_name,
           CAST(ua.account_balance AS FLOAT),
           CAST(ua.account_starting_amount AS FLOAT)   
       FROM user_accounts ua
       JOIN account_types act ON ua.account_type_id = act.account_type_id
       JOIN currencies ct ON ua.currency_id = ct.currency_id
       WHERE ua.user_id = $1
       AND ua.account_name != $2
       ORDER BY ua.account_type_id ASC, ua.account_balance DESC
       `,
          values: [userId, 'slack'],
        },
      },
    };
    //CHECK ACCOUNT TYPE ON DDBB
    //es necesario chequear si el usuario tiene ese tipo de cuentas?
    const accountListResult = await pool.query(
      accountTypeQuery['all'].typeQuery
    );
    if (accountListResult.rows.length === 0) {
      const message = `No accounts available`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }
    const accountList = accountListResult.rows;

    const data = { rows: accountList.length, accountList };

    const message = `Account list successfully completed `;
    console.log('success:', pc[backendColor](message));

    res.status(200).json({ status: 200, message, data });
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting accounts'));

      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Error during getting accounts'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};//END OF getAccounts

//**********************************
//GET ACCOUNT INFO BY ACCOUNT_ID
//endpoint example:
// http://localhost:5000/api/fintrack/account/${accountId}?&user=${user}
export const getAccountById = async (req, res, next) => {
  console.log(pc[backendColor]('getAccountById'));
  const basicAccountTypes = ['bank', 'investment', 'income_source'];
//--------------------------------
// GET ACCOUNT BY ID 
//----------------------------------
 try {
   const userId = req.user.userId||(req.body.user ?? req.query.user);

    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }

    const {accountId } = req.params;

     if (!accountId) {
      const message = `Account ID is required.`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }
//--------------
// 📋 GET ACCOUNT BASIC INFO
   const accountsResult = await pool.query({
     text: `SELECT act.account_type_name , ua.*
        FROM user_accounts ua
        JOIN account_types act ON 
        act.account_type_id = ua.account_type_id
        WHERE ua.account_id= $1`,
      values: [accountId],
    });
    // console.log('result', accountsResult.rows[0])

     if (!accountsResult || accountsResult.rows.length===0) {
      const message = `Account does not exist`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }
//------------------------------------
    //--check account_type_name developer mode
    // console.log('account type', accountsResult.rows[0].account_type_name)

    /*
      const { accountTypeName } = req.body.accountTypeName ?? '';

      const accountTypeMismatch = accountsResult.rows[0].account_type_name !== String(accountTypeName).trim().toLowerCase()

      if (accountTypeMismatch) {
        const message = `Entered account type mismatch.`;
      console.warn(pc[backendColor](message));
      } 

      const account_type_name =
      !req.body.accountTypeName || req.body.accountTypeName == '' 
      //|| accountTypeMismatch
      ? accountsResult.rows[0].account_type_name
      : req.body.accountTypeName.trim().toLowerCase();
*/
//-------------------------------------
   const account_type_name =accountsResult.rows[0].account_type_name
//-------------------------------------
// in case of a failur db?
  if(!['pocket_saving','category_budget', 'bank', 'investment', 'income_source','debtor'].includes(account_type_name))
  {
   const message = `${account_type_name} is not included in the account types fintrack app`
    console.warn(message)
   return RESPONSE(res, 404, message);
    }    
//-------------------------------------
// 🎯 SPECIAL HANDLING FOR CATEGORY_BUDGET - UNIFIED DATA
//   if(account_type_name ==='category_budget'){
//   console.log(pc[backendColor]('Processing category_budget with unified data'))

//   const fullDataCategoryAccount = await getCategoryBudgetFullData(userId, accountId)//include transactions

//   const message = `Category budget account data retrieved successfully`
//   console.log('success:', pc[backendColor](message));     

//   return res.status(200).json({ 
//     status: 200, 
//     message, 
//     data: fullDataCategoryAccount 
//      });
// }

//-------------------------------------
// ✅ HANDLING FOR OTHER ACCOUNT TYPES
//-------------------------------------
// 🏦 PROCESS SPECIFIC ACCOUNT TYPES
//--get account basic and specific info by account id and account type for catgory_budget, debtor or pocket_saving
//--bank account type
 const accountTypeQuery = {
  //category_budget
  category_budget: {
    typeQuery: {
      text: `
      SELECT
       ua.*, act.*, cba.*,
       ct.currency_code,
       cnt.category_nature_type_name

      FROM user_accounts ua

      JOIN account_types act ON ua.account_type_id = act.account_type_id

      JOIN currencies ct ON ua.currency_id = ct.currency_id

      JOIN category_budget_accounts cba ON ua.account_id = cba.account_id

      JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id

      WHERE ua.user_id =$1
        AND act.account_type_name = $2
        AND ua.account_id = $3 AND ua.account_name != $4
      ORDER BY ua.created_at DESC, ua.updated_at DESC 
      `,
      values: [userId, account_type_name, accountId, 'slack'],
    },
  },
  
  //pocket_saving
  pocket_saving: {
    typeQuery: {
      text: `SELECT ua.*, act.account_type_name, ct.currency_code, ps.* 
      FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      JOIN currencies ct ON ua.currency_id = ct.currency_id
      JOIN pocket_saving_accounts ps ON ua.account_id = ps.account_id
        WHERE ua.user_id =$1
        AND ua.account_id = $2
        AND act.account_type_name = $3 AND ua.account_name != $4
`,
      values: [userId, accountId, account_type_name, 'slack'],
    },
  },

  //debtor
  debtor: {
    typeQuery: {
      text: `SELECT ua.*, act.account_type_name, ct.currency_code,
      da.*
      FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      JOIN currencies ct ON ua.currency_id = ct.currency_id
      JOIN debtor_accounts da ON ua.account_id = da.account_id
        WHERE ua.user_id =$1
        AND ua.account_id = $2
        AND act.account_type_name = $3 AND ua.account_name != $4
`,
      values: [userId, accountId, account_type_name, 'slack'],
    },
  },

  //since account basic info works fine for bank, income and investment accounts, theses codes are not needed, unless, specific attributes were added for these accounts types in the future.   
 /*
  bank: {
          typeQuery: {
              text: `SELECT ua.*,  ct.currency_code, act.*
              FROM user_accounts ua
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          WHERE ua.user_id = $1
          AND act.account_type_name = $2
          AND ua.account_id = $3
       `,
          values: [userId, account_type_name, accountId ],
        },
      },
      investment
      investment: {
        typeQuery: {
           text: `SELECT ua.*,  ct.currency_code, act.*
          FROM user_accounts ua
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          WHERE ua.user_id = $1
          AND act.account_type_name = $2
          AND ua.account_id = $3
       `,
          values: [userId, account_type_name, accountId ],
        },
      },
      income_source: {
        typeQuery: {
           text: `SELECT ua.*,  ct.currency_code, act.*
          FROM user_accounts ua
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          WHERE ua.user_id = $1
          AND act.account_type_name = $2
          AND ua.account_id = $3
          `,
          values: [userId, account_type_name, accountId ],
        },
      },
     */
    };
//-------------------------
  //check account type on ddbb
  //es necesario chequear si el usuario tiene ese tipo de cuentas?
/*
    const accountListResult = ['bank','investment','income_source'].includes(account_type_name)

    ? accountsResult
    :
      await pool.query(
      accountTypeQuery[account_type_name].typeQuery
    );
  */
//--CHECK ACCOUNT TYPE IN CONFIG
  let accountListResult 
  //basic accounts
  if (basicAccountTypes.includes(account_type_name)) {
    accountListResult = accountsResult; 

  } else if (accountTypeQuery.hasOwnProperty(account_type_name)) {
  //pocket, debtor, category_budget accounts 
  accountListResult =
   await pool.query(accountTypeQuery[account_type_name].typeQuery);
  
  }else {
    const message = `No query defined for account type "${account_type_name}"`;
    console.warn(pc[backendColor](message));

    return res.status(400).json({ status: 400, message });
  }
//-------------------------
  // console.log("🚀 ~ getAccountById ~ accountListResult:", accountListResult.rows, accountListResult.rows[0], accountListResult.rows[0].account_balance, 
  // accountListResult.rows[0].budget, 
  // )
//-------------------------  
  if (accountListResult.rows.length === 0) {
  const message = `No accounts available for ${account_type_name}`;
  console.warn(pc[backendColor](message));

  return res.status(400).json({ status: 400, message });
  }
//------------------------
const data = { rows: accountListResult.rows.length, accountList:[accountListResult.rows[0] ]};
// console.log("🚀 ~ getAccountById ~ data:", data)

// 🧮 ENRICH CATEGORY ACCOUNT WITH BUDGET CALCULATIONS
//budget remain and status alert for category_budget account type
if(account_type_name.trim().toLowerCase() === 'category_budget'){
const { remain, statusAlert } = calculateBudgetMetrics(
    parseFloat(data.accountList[0].account_balance),
    parseFloat(data.accountList[0].budget)
  );

  data.accountList[0].remain = remain
  data.accountList[0].statusAlert = statusAlert

  // console.log('remain and statusAlert',data.accountList[0].remain, data.accountList[0].statusAlert,'data', data )
} 
//----------------------------
  const message = `Get account successfully!`;
  console.log('success:', pc[backendColor](message));

  res.status(200).json({ status: 200, message, data });

  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting accounts by account ID'));

      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Error during getting accounts by ID'),
        pc[errorColor]('Unknown error occurred')
      );
    }
// Manejo de errores de PostgreSQL / pgsql error handling
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};//End of getAccountById

//*********************************
// 🆕 ENDPOINT: GET CATEGORY BUDGET FULL DATA
export const getCategoryBudgetFullDataEndpoint = async (req, res, next) =>{
  console.log(pc[backendColor]('getCategoryBudgetFullDataEndpoint'))

  try {
    const userId = req.user.userId  || (req.body.user ?? req.query.user);

    if(!userId){
      const message = 'User ID is required'
      console.war(pc.blueBright(message))
      return res.status(400).json({status:400, message})
    }

    const {accountId} = req.params
    if(!accountId){
      const message = `Account ID is required`
      console.warn(pc[backendColor](message))
      return res.status(400).json({status:400, message})
    }

  // 🎯 VERIFY ACCOUNT EXISTS AND IS CATEGORY_BUDGET
    const accountsResult = await pool.query({
     text: `
     SELECT act.account_type_name
     FROM user_accounts ua
     JOIN account_types act ON act.account_type_id = ua.account_type_id
     WHERE ua.account_id = $1 AND ua.user_id = $2`,
     values: [accountId, userId],
    }) 

    if (!accountsResult.rows.length) {
      return res.status(404).json({ status: 404, message: 'Account not found' });
    }

    const account_type_name = accountsResult.rows[0].account_type_name;

    if(account_type_name !== 'category_budget'){
      return res.status(400).json({ 
        status: 400, 
        message: 'This endpoint is only for category_budget accounts' 
      })
    }

  // 🎯 USE EXISTING LOGIC TO GET COMPLETE DATA
   const fullDataCategoryAccount =  await getCategoryBudgetFullData(userId, accountId);
  //---------------------------------
  console.log('full data endpoint', fullDataCategoryAccount) 
  //--------------------------------- 
   const message = `Category budget full data retrieved successfully`
   console.log('success:', pc[backendColor](message))

  return res.status(200).json({ 
    status: 200, 
    message, 
    data: fullDataCategoryAccount 
   }); 
    
  }catch (error) {
   console.error(pc.red('Error in getCategoryBudgetFullDataEndpoint:'), error);

    if (error.message === 'Category budget account not found') {
      return res.status(404).json({ status: 404, message: error.message });
    }
    
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));

  }
}//End of getCategoryBudgetFullDataEndpoint 

//**********************************
//GET ALL ACCOUNTS OF A CATEGORY BY CATEGORY_NAME
//endpoint example: http://localhost:5000/api/fintrack/budget/category/${category_name}?&user=${user}

//example of route:http://localhost:5173/fintrack/budget/category/${category_name}

export const getAccountsByCategory= async (req, res, next) => {
  console.log(pc[backendColor]('getAccountsByCategory'));
  //   console.log(
  //   'body:',
  //   req.body,
  //   'params:',
  //   req.params,
  //   'query:',
  //   req.query,
  //   'path:',
  //   req.path,
  //   'originalUrl:',
  //   req.originalUrl
  // );

 try {
  const userId = req.user.userId ||(req.body.user ?? req.query.user);
  
  if (!userId) {
    const message = 'User ID is required';
    console.warn(pc.blueBright(message));
    return res.status(400).json({ status: 400, message });
  }
  const {categoryName } = req.params;

  if (!categoryName) {
    const message = `Category name is required.`;
    console.warn(pc[backendColor](message));
    return res.status(400).json({ status: 400, message });
    }
  //------------------------------------
  //--GET ACCOUNTS INFO BY CATEGORY NAME
   const accountsResult = await pool.query({
      text: `SELECT ua.*, CAST(ua.account_balance AS FLOAT), CAST(ua.Account_starting_amount AS FLOAT), cba.*,CAST(cba.budget AS FLOAT),
       cur.currency_code,act.account_type_name ,cnt.category_nature_type_name
      FROM user_accounts ua
      JOIN category_budget_accounts cba ON cba.account_id = ua.account_id
      JOIN category_nature_types cnt ON cnt.category_nature_type_id = cba.category_nature_type_id
      JOIN currencies cur ON cur.currency_id = ua.currency_id
      JOIN account_types act ON act.account_type_id= ua.account_type_id

      WHERE cba.category_name = $1 AND ua.user_id = $2
      
      ORDER BY cba.category_name asc, cnt.category_nature_type_id asc`,
      values: [categoryName, userId],
    });

    // console.log('result', accountsResult.rows[0])

    if (!accountsResult || accountsResult.rows.length===0) {
      const message = `No accounts of cateogry ${categoryName} were found`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    // console.log('accounts', accountsResult.rows[0])
 
    const accountListResult = accountsResult
    
    if (accountListResult.rows.length === 0) {
      const message = `No accounts available`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
      }
      
      const accountList = accountListResult.rows;
      //devolver el nombre de la cuenta, (balance actual), currency_code
      
      const data = { rows: accountList.length, accountList };
      
      const message = `${categoryName} account list successfully completed `;
      console.log('success:', pc[backendColor](message));
      
      res.status(200).json({ status: 200, message, data });

  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting accounts by category name'));

      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Error during getting accounts by category name'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};//End of getAccountsByCategory

/*
example response of getAccountByCategory
{
	"status": 200,
	"message": "housing account list successfully completed ",
	"data": {
		"rows": 3,
		"accountList": [
			{
				"account_id": 11,
				"user_id": "397ec169-a453-45ce-bf5f-71b3b820b0ee",
				"account_name": "housing_must",
				"account_type_id": 5,
				"currency_id": null,
				"account_starting_amount": "0.00",
				"account_balance": "133.30",
				"account_start_date": "2025-07-05T17:17:48.123Z",
				"created_at": "2025-07-05T17:17:48.138Z",
				"updated_at": "2025-07-08T17:26:14.073Z",
				"category_name": "housing",
				"category_nature_type_id": 1,
				"subcategory": "cleaning",
				"budget": "500.00",
				"currency_code": "usd",
				"category_nature_type_name": "must"
			},
			{
				"account_id": 20,
				"user_id": "397ec169-a453-45ce-bf5f-71b3b820b0ee",
				"account_name": "housing_need",
				"account_type_id": 5,
				"currency_id": null,
				"account_starting_amount": "0.00",
				"account_balance": "0.00",
				"account_start_date": "2025-07-09T17:35:11.247Z",
				"created_at": "2025-07-09T17:35:11.875Z",
				"updated_at": "2025-07-09T17:35:11.874Z",
				"category_name": "housing",
				"category_nature_type_id": 2,
				"subcategory": "subcategory of housing",
				"budget": "654.00",
				"currency_code": "usd",
				"category_nature_type_name": "need"
			},
			{
				"account_id": 22,
				"user_id": "397ec169-a453-45ce-bf5f-71b3b820b0ee",
				"account_name": "housing_want",
				"account_type_id": 5,
				"currency_id": null,
				"account_starting_amount": "0.00",
				"account_balance": "0.00",
				"account_start_date": "2025-07-09T17:39:16.840Z",
				"created_at": "2025-07-09T17:39:17.557Z",
				"updated_at": "2025-07-09T17:39:17.557Z",
				"category_name": "housing",
				"category_nature_type_id": 4,
				"subcategory": "housing subcategory",
				"budget": "768.00",
				"currency_code": "usd",
				"category_nature_type_name": "want"
			}
		]
	}
}

*/