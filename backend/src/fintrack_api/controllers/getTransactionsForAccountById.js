// ==============================
// Module: getTransactionsForAccountById
// Path: /fintrack/controllers/getTransactionsForAccountById.js
// Purpose: Handles transactions by account id queries for the account detail
// ==============================
import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';

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
  //validation of input data
  const userId = req.user.userId ||(req.body.user || req.query.user);
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
//==================================
//check the user id and the account id relationship
  const ACCOUNT_INFO_QUERY ={
    text:`
    SELECT 
      ua.account_starting_amount, ua.account_start_date, cr.currency_code, ua.currency_id 
    FROM user_accounts ua
    JOIN
     currencies cr ON ua.currency_id = cr.currency_id
    WHERE
     ua.account_id = $1 AND ua.user_id = $2 LIMIT 1`,
    values: [accountId, userId]
    }
    
  const accountInfoNeededResult = await queryFn(ACCOUNT_INFO_QUERY.text, ACCOUNT_INFO_QUERY.values)

  if (accountInfoNeededResult.length === 0) {
    const message = 'The specified account does not belong to the user or does not exist.';
    console.warn(pc[backendColor](message));
    
    return RESPONSE(res, 403, message);//access forbidden
    }
//-------------------------------
  //date period 
    const today = new Date()
    today.setHours(23,59,59,999) //end of today
   
    const _daysAgo = new Date(today)
    _daysAgo.setDate(today.getDate()-30)
    _daysAgo.setHours(0,0,0,0) //start of the day
    
    // const daysAgoDate=_daysAgo.toISOString().split('T')[0]
    const daysAgoDate=_daysAgo.toISOString()
    const {start, end } = req.query;
    const startDate = new Date(start || daysAgoDate)
    const endDate = new Date(end || today.toISOString())
    // .split('T')[0])

    // Date validation - check if a helper exists
    if (isNaN(startDate.getTime())) {
      return RESPONSE(res, 400, 'Invalid start date format. Use YYYY-MM-DD.');
    }
    if (isNaN(endDate.getTime())) {
      return RESPONSE(res, 400, 'Invalid end date format. Use YYYY-MM-DD.');
    }
    //-------------------------------
    //--main query for transactions by account_id and user_id getting account_balance_after_tr
    //--rule: there must exist at least one transaction (account-opening). It should not be possible for an account to exist without this single recorded transaction
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

// Función para formatear fechas consistentemente/consistent date format
    const formatDate = (date) => date.toISOString().split('T')[0];

    //NO TRANSACTIONS
    if (transactions.length === 0) {
      const data = {
        totalTransactions: 0,
        summary: {
          initialBalance: {
            // amount: 0,
            amount: parseFloat(accountInfoNeededResult[0].account_starting_amount),
            currency: accountInfoNeededResult[0].currency_code,
            date: formatDate(startDate)
          },
          finalBalance: {
            // amount: 0,
            amount: parseFloat(accountInfoNeededResult[0].account_starting_amount),
            currency: accountInfoNeededResult[0].currency_code,
            date: formatDate(endDate)
          },
          periodStartDate: formatDate(startDate),
          periodEndDate: formatDate(endDate),
        },
        transactions: []
      };
    return RESPONSE(res, 200, 'No transactions found for the selected period', data);
    }
  // console.log('transactions',transactions)
 
//Funciones para obtener balances usando accountInfoNeededResult ================
  const getInitialBalance = () => {
    const oldestTransaction = transactions[transactions.length - 1];
    return {
      amount: parseFloat(oldestTransaction.account_balance_before_tr || accountInfoNeededResult[0].account_starting_amount),
      currency: oldestTransaction.currency_code,
      date: formatDate(startDate)
    };
  };

  const getFinalBalance = () => ({
    amount: parseFloat(transactions[0].account_balance_after_tr),
    currency: transactions[0].currency_code,
    date: formatDate(new Date(transactions[0].transaction_actual_date || transactions[0].created_at))
  });

  // Construir respuesta final
  const data = {
    totalTransactions: transactions.length,
    summary: {
      initialBalance: getInitialBalance(),
      finalBalance: getFinalBalance(),
      periodStartDate: formatDate(startDate),
      periodEndDate: formatDate(endDate),
    },
    transactions
  };

  return RESPONSE(res, 200, `${transactions.length} transaction(s) found`, data);
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
    // PostgreSQL error handling  
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  } 
}

