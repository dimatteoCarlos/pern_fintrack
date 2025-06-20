// ==============================
// Module: getTransactionsForAccountById
// Path: /fintrack/controllers/getTransactionsForAccountById.js
// Purpose: Handles transactions by account id queries for the account detail
// Depends on:
// ==============================

import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';
// import dotenv from 'dotenv';
// dotenv.config();

export const getTransactionsForAccountById = async (req, res, next)=>{
  const backendColor = 'greenBright';
  const errorColor = 'red';
  const controllerName = 'getTransactionsForAccountById';
  console.log(pc[backendColor](controllerName));

  // --- Helper Functions ---
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };

  const queryFn = async (text, values) => {
    try {
      const result = await pool.query(text, values);
      return result.rows;
    } catch (error) {
      console.error(
        'Database query error occurred',
        process.env.NODE_ENV === 'development' ? console.log(error.stack) : ''
      );
      throw error;
    }
  };
  // --- End Helper Functions ---
  //controller module 
  try {
  const userId = req.body.user || req.query.user;
    if (!userId) {
      const message = 'User ID is required.'
      console.warn(pc[backendColor](message));
      return RESPONSE(res, 400, message)
      }

     const {accountId } = req.params;
      if (!accountId) {
      const message = `Account ID is required.`;
      console.warn(pc[backendColor](message));
      return RESPONSE(res, 400, message);
    }
    //======================================================
    //check the user id and the account id relation
    const ACCOUNT_USER_QUERY ={
      text:`SELECT 1 FROM user_accounts ua WHERE account_id = $1 AND user_id =$2 LIMIT 1`,
      values: [accountId, userId]
    }
    
    const userIdaccountIdResult = await queryFn(ACCOUNT_USER_QUERY.text, ACCOUNT_USER_QUERY.values)
    // console.log(userIdaccountIdResult.length)

    if (userIdaccountIdResult.length === 0) {
      const message = 'The specified account does not belong to the user.';
      console.warn(pc[backendColor](message));
      return RESPONSE(res, 403, message);//access forbidden
    }
    //----------------------------------------------------------
    //date period
    const today = new Date()
    today.setDate(today.getDate())
    const _daysAgo = new Date(today)
    _daysAgo.setDate(today.getDate()-31)//mejorar determine the number of days in the month
    const daysAgoDate=_daysAgo.toISOString().split('T')[0]
    
    const {start, end } = req.query;
    const startDate = new Date(start || daysAgoDate)
    const endDate = new Date(end || today.toISOString().split('T')[0])

    //----------------------------------------------------------------
    //--main query for transactions by account_id and user_id getting account_balance_after_tr
    //--rule: there must exist at least one transaction (account-opening). It should not be possible for an account to exist without a single recorded transaction

    const TRANSACTIONS_BY_ACCOUNT_QUERY = {
      text:`
      SELECT 
        tr.*, mt.movement_type_name, cr.currency_code, ua.account_name, CAST(ua.account_starting_amount AS FLOAT), ua.account_start_date
      FROM 
        transactions tr
      JOIN
        movement_types mt ON tr.movement_type_id = mt.movement_type_id  
      JOIN
        currencies cr  ON tr.currency_id = cr.currency_id          
      JOIN
        user_accounts ua ON tr.account_id = ua.account_id          
      JOIN
        transaction_types trt ON tr.transaction_type_id= trt.transaction_type_id
      WHERE
        tr.account_id = $1 AND ua.user_id = $2 AND (tr.transaction_actual_date BETWEEN $3 AND $4 OR
       tr.created_at BETWEEN $3 AND $4)
       ORDER BY 
       tr.transaction_actual_date DESC , tr.created_at DESC 
       ` ,
       values:[accountId, userId, startDate, endDate]
    }

    const transactions = await queryFn(TRANSACTIONS_BY_ACCOUNT_QUERY.text, TRANSACTIONS_BY_ACCOUNT_QUERY.values)
    // console.log('transactions',transactions)

//get the initial and final balances in the period start - end dates

//get the initial balance before the first transaction in the period
const ACCOUNT_BALANCE_BEFORE_PERIOD_QUERY={
  text:`SELECT CAST(tr.account_balance_after_tr AS FLOAT) as account_balance_after_tr,cu.currency_code, ua.account_starting_amount, tr.transaction_actual_date, tr.created_at
  FROM transactions tr
  JOIN user_accounts ua ON tr.account_id = ua.account_id
  JOIN currencies cu ON ua.currency_id =  cu.currency_id 
  WHERE tr.account_id = $1
    AND ua.user_id = $2
    AND (tr.transaction_actual_date < $3 OR tr.created_at < $3)
  ORDER BY 
  tr.transaction_actual_date DESC  ,
  tr.created_at DESC
  LIMIT 1  
  `,
  values:[accountId, userId
     , startDate

  ]
}

const initialBalanceResult= await queryFn(ACCOUNT_BALANCE_BEFORE_PERIOD_QUERY.text,ACCOUNT_BALANCE_BEFORE_PERIOD_QUERY.values)
console.log('initialBalanceResult',initialBalanceResult, startDate, endDate )

//since transactions are ordered by transaction date DESCENDENT, THE first element in the array is the last transaction

const firstTransaction = transactions[transactions.length-1]
// console.log(transactions[firstTransaction].account_starting_amount)

const lastTransaction = transactions[0]
console.log('first', firstTransaction.account_starting_amount,'last', lastTransaction)

let initialBalance = {amount:0, currency:'usd',date:new Date()}
if(initialBalanceResult.length>0){
  initialBalance = {amount:parseFloat(initialBalanceResult[0].account_balance_after_tr), currency:initialBalanceResult[0].currency_code, date:initialBalanceResult[0].transaction_actual_date || initialBalanceResult[0].created_at}
}
else{
//if no transaction before period, get the account's opening balance
initialBalance= {amount:parseFloat(firstTransaction.account_starting_amount),date:firstTransaction.account_start_date, currency:firstTransaction.currency_code}
}
console.log("🚀 ~ getTransactionsForAccountById ~ initialBalance:", initialBalance)

const finalBalance ={amount: parseFloat(lastTransaction.account_balance_after_tr), currency:lastTransaction.currency_code, date:lastTransaction.transaction_actual_date
}

  console.log('starting account amount', {initialBalance} , {finalBalance}, {lastTransaction})

 const successMsg = `${transactions.length} transaction(s) found for account id ${accountId}. Period between ${startDate.toISOString().split('T')[0]} and ${endDate.toISOString().split('T')[0]}.`;
   
  const data = {
      totalTransactions: transactions.length,
      summary: {
        initialBalance,
        finalBalance,
        periodStartDate: startDate.toISOString().split('T')[0],
        periodEndDate: endDate.toISOString().split('T')[0],
      },
      transactions
    }

  //==========================================================
  console.log('data')
    return RESPONSE(res, 200, successMsg, data)

  } catch (error) {
    const generalmessage = `Error while getting transactions for account id ${req.params.accountId}`
     console.error(pc.red(generalmessage), error);

      if (error instanceof Error) {
        if (process.env.NODE_ENV === 'development') {
        console.warn(error.stack);
      }
    } else {
      console.error(
        pc.red('Error during getting transactions by account ID'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    //  PostgreSQL error handling  
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
}
}

