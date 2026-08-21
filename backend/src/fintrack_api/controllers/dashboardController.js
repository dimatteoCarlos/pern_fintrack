//backend/src/fintrack_api/controllers/dashboardController.js

// dashboardTotalBalanceAccounts
// dashboardTotalBalanceAccountByType
// dashboardAccountSummaryList

// dashboardMovementTransactions
// dashboardMovementTransactionsSearch
// dashboardMovementTransactionsByType
//----------------------------------
import { createError, handlePostgresError } from '../../utils/errorHandling.js';
import pc from 'picocolors';
import { pool } from '../../db/config/configDB.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { extractNoteFromDescription } from '../../utils/fintrackUtils/transactionManagement/extractNoteFromDescription.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import { resolveZonedWindow } from '../../utils/fintrackUtils/date-utils/resolveZonedWindow.js';

//COMMON FUNCTIONS
const RESPONSE = (res, status, message, data = null) => {
  const backendColor =
    status >= 400 ? 'red' : status >= 300 ? 'yellow' : 'green';
  console.log(pc[backendColor](`[${status}] ${message}`));
  res.status(status).json({ status, message, data });
};

const ERR_RESP = (status, message, controllerName = null) => {
  const backendColor =
    status >= 400 ? 'red' : status >= 300 ? 'yellow' : 'green';
  console.log(pc[backendColor](`[${status}] ${message}. ${controllerName}`));
  const error = new Error(message);
  error.status = 400;
  throw error;
};
//---------------------------------
// get: //http://localhost:5000/api/fintrack/dashboard/balance
//get the total balance account for each group of account type, for all account types.
export const dashboardTotalBalanceAccounts = async (req, res, next) => {
  let backendColor = 'green';
  const errorColor = 'red';
  const controllerName = 'dashboardTotalBalanceAccounts';
  console.log(pc[backendColor](controllerName));

  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const successMsg = `Total balance accounts were successfully calculated`;

    const TOTAL_BALANCE_QUERY = {
      text: `SELECT act.account_type_name, CAST(SUM(ua.account_balance) AS FLOAT) as total_balance, ct.currency_code FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      JOIN currencies ct ON ua.currency_id = ct.currency_id
      WHERE user_id = $1 AND ua.account_name!=$2
      GROUP BY act.account_type_name, ct.currency_code
      ORDER BY account_type_name ASC
  `,
      values: [userId, 'slack'],
    };

    const accountTotalBalanceResult = await pool.query(TOTAL_BALANCE_QUERY);

    if (accountTotalBalanceResult.rows.length === 0) {
      const message = `No available accounts for this user`;
      console.warn(pc[errorColor](message));
      // Without the return, the 200 below raised ERR_HTTP_HEADERS_SENT.
      return RESPONSE(res, 404, message);
    }

    const accountTotalBalance = accountTotalBalanceResult.rows;
    const data = {
      rows: accountTotalBalanceResult.rows.length,
      accountTotalBalance,
    };
    // console.log(data);
    return RESPONSE(res, 200, successMsg, data);
  } catch (error) {
    console.error(pc.red('Error while getting account balance'), error);

    if (error instanceof Error) {
      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred'),
      );
      RESPONSE(res, 500, 'Error desconocido al procesar la solicitud');
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
//------------------------------
//===============================
//-- dashboardTotalBalanceAccountByType
//-- get the total balance for a specific type account
//used in:TrackerLayout, OverviewLayout.tsx
//==================================
//get enpoint: //http://localhost:5000/api/fintrack/dashboard/balance/type
//get the sum total balance of a specified account type

/* example of output: 
{
	"status": 200,
	"message": "Total balance account of account type category_budget successfully calculated",
	"data": [
		{
			"total_balance": 136858,
			"total_budget": 2852,
			"total_remaining": -134006,
			"currency_code": "usd"
		}
	]
}
*/
//--------------
export const dashboardTotalBalanceAccountByType = async (req, res, next) => {
  const backendColor = 'cyan';
  const errorColor = 'red';
  const controllerName = 'dashboardTotalBalanceAccountByType';
  console.log(pc[backendColor](controllerName));

  try {
    const { type } = req.query; //bank| investment | income_source | category_budget | debtor | pocket_saving
    const userId = requireUserId(req, res);
    if (!userId) return;
    // console.log(
    //   '🚀 ~ dashboardTotalBalanceAccountByType ~ userId:',
    //   userId,
    //   req.query,
    //   'Body',
    //   req.body,
    //   'type',
    //   type
    // );
    const accountType = type;

    if (!accountType) {
      const message = 'Account TYPE is required';
      console.log('MESSAGE', message);
      // ERR_RESP(400, message, controllerName);
      return RESPONSE(res, 400, message);
    }

    if (
      ![
        'bank',
        'investment',
        'income_source',
        'category_budget',
        'debtor',
        'pocket_saving',
      ].includes(accountType)
    ) {
      const message = `${accountType} is not a valid type account. Try again`;
      console.log('MESSAGE', message);
      ERR_RESP(400, message, controllerName);
      // return RESPONSE(res, 400, message);
    }

    const successMsg = `Total balance account of account type ${accountType} successfully calculated`;
    //****************************/
    //---queries definition
    // TOTAL_BALANCE_QUERY  is used for bank, investment and income_source type account
    const TOTAL_BALANCE_QUERY = {
      text: `
   SELECT 
    CAST(SUM(ua.account_balance) AS FLOAT ) AS total_balance,
    CAST(COUNT(*) AS INTEGER) AS accounts, ct.currency_code
      FROM user_accounts ua
      JOIN account_types act
       ON ua.account_type_id = act.account_type_id
      JOIN currencies ct
       ON ua.currency_id = ct.currency_id
      WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
      GROUP BY ct.currency_code
`,
      values: [userId, accountType, 'slack'],
    };
    //-----------
    const TOTAL_BALANCE_AND_GOAL_BY_TYPE = {
      category_budget: {
        text: `
      SELECT
       CAST(SUM(ua.account_balance) AS FLOAT ) AS total_balance,  CAST(SUM(st.budget) AS FLOAT ) AS total_budget,
      (CAST(SUM(st.budget) AS FLOAT ) - CAST(SUM(ua.account_balance) AS FLOAT)) AS total_remaining,CAST(COUNT(*) AS INTEGER) AS accounts,
      ct.currency_code FROM user_accounts ua
        JOIN account_types act ON ua.account_type_id = act.account_type_id
        JOIN currencies ct ON ua.currency_id = ct.currency_id
        JOIN category_budget_accounts st ON ua.account_id = st.account_id
      WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
      GROUP BY ct.currency_code
`,
        values: [userId, accountType, 'slack'],
      },
      //-----------
      pocket_saving: {
        text: `SELECT 
  CAST(SUM(ua.account_balance) AS FLOAT ) AS total_balance,
  CAST(SUM(st.target) AS FLOAT ) AS total_target,
  (CAST(SUM(st.target) AS FLOAT ) - CAST(SUM(ua.account_balance) AS FLOAT)) AS total_remaining, 
  CAST(COUNT(*) AS INTEGER) AS accounts, ct.currency_code
  FROM user_accounts ua
   JOIN account_types act ON ua.account_type_id = act.account_type_id
   JOIN pocket_saving_accounts st ON ua.account_id = st.account_id
   JOIN currencies ct ON ua.currency_id = ct.currency_id
   WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
   GROUP BY  ct.currency_code
    `,
        values: [userId, accountType, 'slack'],
      },

      debtor: {
        text: `
      SELECT CAST(SUM(ua.account_balance) AS FLOAT ) AS total_debt_balance, CAST(SUM(CASE WHEN ua.account_balance > 0 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS debt_receivable,  CAST(SUM(CASE WHEN ua.account_balance < 0 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS debt_payable, 

        CAST(COUNT(CASE WHEN ua.account_balance>0 THEN 1 ELSE NULL END) AS FLOAT) AS debtors, 
        CAST(COUNT(*) FILTER (WHERE ua.account_balance<0) AS FLOAT) AS lenders, 
        CAST(COUNT(*) FILTER (WHERE ua.account_balance=0) AS FLOAT) AS debtors_without_Debt, ct.currency_code

      FROM user_accounts ua
        JOIN account_types act ON ua.account_type_id = act.account_type_id
        JOIN debtor_accounts st ON ua.account_id = st.account_id
        JOIN currencies ct ON ua.currency_id = ct.currency_id

        WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
        GROUP BY  ct.currency_code
`,
        values: [userId, accountType, 'slack'],
      },
    };
    //------queries
    if (
      accountType == 'bank' ||
      accountType == 'investment' ||
      accountType === 'income_source'
    ) {
      const query = TOTAL_BALANCE_QUERY;
      // console.log('🚀 ~ dashboardTotalBalanceAccount ~ query:', query);
      const accountTotalBalanceResult = await pool.query(query);
      if (accountTotalBalanceResult.rows.length === 0) {
        const message = `No accounts of type "${accountType}"`;
        // ERR_RESP(res, 400, message, controllerName);
        return RESPONSE(res, 400, message);
      }

      const data = accountTotalBalanceResult.rows[0];
      // console.log('data from dashboardTotalBalanceAccountByType', data);

      return RESPONSE(res, 200, successMsg, data);
    }
    //------------------------------------
    //---total balance, target or limit
    if (
      accountType == 'category_budget' ||
      accountType == 'debtor' ||
      accountType == 'pocket_saving'
    ) {
      const query = TOTAL_BALANCE_AND_GOAL_BY_TYPE[accountType];

      const accountTotalBalanceResult = await pool.query(query);

      if (accountTotalBalanceResult.rows.length === 0) {
        const message = `No available accounts of type ${accountType}`;
        // ERR_RESP(res, 400, message);
        return RESPONSE(res, 400, message);
      }

      const data = accountTotalBalanceResult.rows[0];
      // console.log('datos', data);

      return RESPONSE(res, 200, successMsg, data);
    }
    //-----------------------------------------
    //in case accountType does not exist
    const message = `No accounts of type ${accountType} were found`;
    // Was `throw new error(...)`: a ReferenceError masked this message.
    return RESPONSE(res, 400, message);
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting account by type'));
      if (process.env.NODE_ENV == 'development') {
       console.log('stack:', error.stack);
      }
      // Returned: the branch below called next() twice for one error.
      return next(createError(error.status, error.message));
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred'),
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
//================================
//get the total balance for 'category_budget', 'debtor' and 'pocket_saving'. Considering also goals, budget, target,
//get: //http://localhost:5000/api/fintrack/dashboard/balance/summary/?type=&user=
//================================
export const dashboardAccountSummaryList = async (req, res, next) => {
  const backendColor = 'yellow';
  const errorColor = 'red';
  //---functions declaration
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };
  //--
  const controllerName = 'dashboardAccountSummaryList';
  console.log(pc[backendColor](controllerName));

  try {
    const { type } = req.query;
    const userId = requireUserId(req, res);
    if (!userId) return;
    const accountType = req.body.type ?? req.query.type;

    // console.log(
    //   '🚀 ~ dashboardTotalBalanceAccountByType ~ userId:',
    //   userId,
    //   req.query,
    //   req.body,
    //   type
    // );

    if (!accountType) {
      return RESPONSE(res, 400, 'Account TYPE is required');
    }

    if (!['category_budget', 'debtor', 'pocket_saving'].includes(accountType)) {
      const message = `Invalid account type for summary list "${accountType}" check endpoint queries.`;
      console.warn(pc.red(message));
      // ERR_RESP(400, message, controllerName);
      return RESPONSE(res, 400, message);
    }

    const successMsg = `Summary list of accounts type ${accountType} was successfully calculated`;

    //********************************/
    const SUMMARY_BALANCE_AND_GOAL_BY_TYPE = {
      category_budget: {
        text: `
        SELECT cba.category_name,  ct.currency_code, 
          SUM(ua.account_balance)::FLOAT AS total_balance, 
          (COALESCE(SUM(cba.budget), 0) - SUM(ua.account_balance))::FLOAT AS total_remaining
          
          FROM user_accounts ua
          
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          LEFT JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
          
          WHERE ua.user_id = $1
          AND act.account_type_name =$2
          AND ua.account_name !=$3
          
          GROUP BY ct.currency_code, cba.category_name
          ORDER BY cba.category_name ASC, ct.currency_code DESC;
`,
        values: [userId, accountType, 'slack'],
      },

      //for pocket_saving and debtor account,  is like listing the account balance of each account.grouping by currency.

      pocket_saving: {
        text: `SELECT ua.account_name, ua.account_id,ua.account_start_date, CAST((ua.account_balance) AS FLOAT ) AS balance, CAST((st.target) AS FLOAT ) AS target,  ct.currency_code, st.note, st.desired_date
          FROM user_accounts ua
            JOIN account_types act ON ua.account_type_id = act.account_type_id
            JOIN pocket_saving_accounts st ON ua.account_id = st.account_id
            JOIN currencies ct ON ua.currency_id = ct.currency_id
          WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
          -- GROUP BY ua.account_name, ct.currency_code, ua.account_id, st.target, st.note, 
          ORDER BY balance DESC, ua.account_name ASC
`,
        values: [userId, accountType, 'slack'],
      },

      debtor: {
        text: `SELECT ua.account_name, ua.account_id, CAST((ua.account_balance) AS FLOAT ) AS total_debt_balance, CAST((CASE WHEN ua.account_balance > 0 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS debt_receivable,  CAST((CASE WHEN ua.account_balance < 0 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS debt_payable,

        CAST(COUNT(CASE WHEN ua.account_balance>0 THEN 1 ELSE NULL END) AS FLOAT) AS debtor, 
        CAST(COUNT(*) FILTER (WHERE ua.account_balance<0) AS FLOAT) AS creditor, 
        ct.currency_code
        
        FROM user_accounts ua
        JOIN account_types act ON ua.account_type_id = act.account_type_id
        JOIN debtor_accounts st ON ua.account_id = st.account_id
        JOIN currencies ct ON ua.currency_id = ct.currency_id

        WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
        GROUP BY ua.account_name, ct.currency_code, ua.account_id
        ORDER BY total_debt_balance DESC, ua.account_name ASC
`,
        values: [userId, accountType, 'slack'],
      },
    };
    //------qweries
    if (
      accountType == 'category_budget' ||
      accountType == 'debtor' ||
      accountType == 'pocket_saving'
    ) {
      const query = SUMMARY_BALANCE_AND_GOAL_BY_TYPE[accountType];

      if (!query) {
        const message = `Invalid account type "${accountType}" check endpoint queries.`;
        console.warn(pc.red(message));
        return RESPONSE(res, 400, message);
      }

      const accountSummaryResult = await pool.query(query);

      if (accountSummaryResult.rows.length === 0) {
        const message = `No accounts available of type ${accountType}.`;
        // ERR_RESP(400, message, controllerName);
        return RESPONSE(res, 400, message);
      }

      const data = accountSummaryResult.rows;
      // console.log(data);

      return RESPONSE(res, 200, successMsg, data);
    }
    //-------------------------
    //in case accountType does not exist
    const message = `No available accounts of type ${accountType} for summary list`;
    return RESPONSE(res, 400, message);
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting account balances'));
      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred'),
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
    // return RESPONSE(error, next)
  }
};
//**********************************/
//GET ALL USER TRACKER MOVEMENT TRANSACTIONS BY MOVEMENT_TYPE_NAME WITH A PRE-FIXED CORRESPONDING ACCOUNT TYPE
//endpoint: http://localhost:5000/api/fintrack/dashboard/movements/movement/?movement=${mov_type}&user=${user}
//usage: to show all transaction by movement name with corresponding accounts.
//examples:
// http://localhost:5000/api/fintrack/dashboard/movements/movement/?movement=investment&user=51ba...
// http://localhost:5000/api/fintrack/dashboard/movements/movement/?movement=pocket&user=51ba7...
//--------------------------------------
export const dashboardMovementTransactions = async (req, res, next) => {
  const backendColor = 'yellow';
  const errorColor = 'red';
  //functions
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };
  console.log(pc[backendColor]('dashboardMovementTransactions'));
  //------------------------------
  //pre-fixed account type for each movement type
  const accountTypeMap = {
    expense: 'category_budget',
    income: 'income_source',
    investment: 'investment',
    debt: 'debtor',
    pocket: 'pocket_saving',
    transfer: '',
    receive: '',
    'account-opening': '',
  };

  //----------------------------
  const queryFn = async (text, values) => {
    try {
      const result = await pool.query(text, values);
      return result.rows;
    } catch (error) {
      console.error(
        'Database query error occurred',
        process.env.NODE_ENV === 'development'
          ? console.log(error.stack, error)
          : '',
      );
    }
  };
  //-------------------------------------
  const { movement } = req.query;
  const movement_type_name = movement === 'debts' ? 'debt' : movement;
  const userId = requireUserId(req, res);
  if (!userId) return;
  // console.log('params:', req.body, req.query);
  console.log('movement', movement, movement_type_name);
  //-----------------------------------
  //date period input
  // The window is resolved in the account owner's zone and leaves as two
  // calendar dates. Every predicate below turns them into instants with one
  // AT TIME ZONE, so no bound is measured on the server's clock. What this
  // replaces pushed its ceiling to tomorrow, which let a transaction dated
  // forward into a window that claims to end today, and read the day of the
  // month after that shift, which made the default span 32 days, not 30.
  const { start, end } = req.query;

  const { startDate, endDate, timeZone } = resolveZonedWindow({
    start,
    end,
    timeZone: await getUserTimeZone(pool, userId),
  });
  // console.log('date range', startDate, endDate);

  //   console.log('Used Dates:', {
  //   start: startDate.toISOString(),
  //   end: endDate.toISOString(),
  // });
  //----------------------------------------
  //later add a function to validate type and movement against the types
  //!account_type_name ||
  if (!movement_type_name) {
    const message = 'Missing required parameter: movement type name';
    return RESPONSE(res, 400, message);
  }

  if (
    ![
      'expense',
      'income',
      'investment',
      'debt',
      'pocket',
      'account-opening',
      'transfer',
      'receive',
      'pnl',
    ].includes(movement_type_name)
  ) {
    const message = `movement name " ${movement_type_name} " is not included`;
    console.warn(pc.magentaBright(message));
    return RESPONSE(res, 400, message);
    // return res.status(400).json({ status: 400, message });
  }
  //account types are related to the movement type, and db table name, in order to track movement transactions
  let tableName;
  let queryModel;
  // console.log('mov:', movement_type_name);

  switch (movement_type_name) {
    case 'expense':
      tableName = 'category_budget_accounts'; //destination account
      //category_budget
      queryModel = {
        text: `
        SELECT
          ua.account_id,
          ua.account_name,
          ua.account_balance,

          act.account_type_id,
          act.account_type_name,
         
          ua.account_starting_amount, ua.account_start_date, 

          tr.transaction_id, tr.description,
          tr.amount, tr.transaction_actual_date

        FROM transactions tr 
            JOIN user_accounts ua ON
              (
                (tr.amount > 0 AND ua.account_id = tr.destination_account_id) OR
                (tr.amount < 0 AND ua.account_id = tr.source_account_id)
              )
              
            JOIN account_types act ON ua.account_type_id = act.account_type_id

            WHERE ua.user_id = $1
              AND (act.account_type_name = $2)
              AND ua.account_name != $3
              AND tr.amount !=0

            AND (
              tr.transaction_actual_date >= ($4::timestamp AT TIME ZONE $6)
              AND tr.transaction_actual_date <
                (($5::date + INTERVAL '1 day') AT TIME ZONE $6)
              )

            ORDER BY tr.transaction_actual_date DESC
          `,
        values: [
          userId,
          accountTypeMap.expense,
          'slack',
          // Calendar dates and not instants. The ::timestamp cast on the lower
          // bound is load-bearing: with a bare date AT TIME ZONE picks the
          // TIMESTAMPTZ overload and converts it the wrong way. The upper bound
          // needs no cast, date + interval is already a TIMESTAMP.
          startDate,
          endDate,
          timeZone,
        ],
      };
      break;

    case 'income':
      tableName = 'income_source_accounts'; //as source account

      queryModel = {
        text: `
        SELECT
          ua.account_id,
          ua.account_name,
          ua.account_balance,

          act.account_type_id,
          act.account_type_name,
         
          ua.account_starting_amount,
          ua.account_start_date, 

          tr.transaction_id,
          tr.description,
          tr.amount,
          tr.movement_type_id,
          tr.transaction_actual_date

        FROM transactions tr 
          JOIN user_accounts ua ON
            tr.account_id = ua.account_id
                            
          JOIN account_types act
           ON ua.account_type_id = act.account_type_id

          WHERE tr.user_id = $1
           AND (act.account_type_name = $2)
           AND ua.account_name != $3
           AND tr.amount !=0

            AND (
              tr.transaction_actual_date >= ($4::timestamp AT TIME ZONE $6)
              AND tr.transaction_actual_date <
                (($5::date + INTERVAL '1 day') AT TIME ZONE $6)
              )

            ORDER BY tr.transaction_actual_date DESC
          `,
        values: [
          userId,
          accountTypeMap.income,
          'slack',
          // Calendar dates and not instants. The ::timestamp cast on the lower
          // bound is load-bearing: with a bare date AT TIME ZONE picks the
          // TIMESTAMPTZ overload and converts it the wrong way. The upper bound
          // needs no cast, date + interval is already a TIMESTAMP.
          startDate,
          endDate,
          timeZone,
        ],
      };
      // queryModel = {
      //   text: `SELECT mt.movement_type_name,ua.account_id, ua.account_name, ua.account_balance,
      //     ct.currency_code, act.account_type_id, act.account_type_name,
      //      ua.account_starting_amount, ua.account_start_date,
      //     tr.description, tr.transaction_actual_date, ABS(tr.amount) as amount

      //     FROM transactions tr
      //       JOIN user_accounts ua ON tr.account_id = ua.account_id
      //       JOIN account_types act ON ua.account_type_id = act.account_type_id
      //       JOIN currencies ct ON ua.currency_id = ct.currency_id
      //       JOIN movement_types mt  ON tr.movement_type_id = mt.movement_type_id

      //       --JOIN income_source_accounts isc ON ua.account_id = isc.account_id

      //     WHERE ua.user_id = $1
      //       AND (act.account_type_name = $2) AND ua.account_name != $3
      //       AND( mt.movement_type_name = $4  OR mt.movement_type_name=$5)

      //     ORDER BY tr.transaction_actual_date DESC, ua.account_balance DESC, ua.account_name ASC
      //     `,
      //   values: [userId, accountTypeMap.income, 'slack', movement_type_name, 'account-opening'],
      // };
      break;

    case 'investment':
      tableName = 'investment_accounts'; //investment can be source/destination account
      queryModel = {
        text: `
        SELECT 
          ua.account_id, ua.account_name, ua.account_balance,
          ct.currency_code,
          act.account_type_id, act.account_type_name,
          ua.account_starting_amount, ua.account_start_date, 
          tr.description, tr.transaction_actual_date, tr.amount,
          tr.transaction_id

          FROM transactions tr 
            JOIN user_accounts ua ON tr.account_id = ua.account_id
            JOIN account_types act ON ua.account_type_id = act.account_type_id
            JOIN currencies ct ON ua.currency_id = ct.currency_id

          WHERE ua.user_id = $1
            AND (act.account_type_name = $2) AND ua.account_name != $3

          ORDER BY tr.transaction_actual_date DESC, ua.account_balance DESC, ua.account_name ASC
          `,
        values: [userId, accountTypeMap.investment, 'slack'],
      };
      break;

    case 'pocket':
      tableName = 'pocket_saving_accounts'; //pocket source/destination account
      queryModel = {
        text: `SELECT  mt.movement_type_name, ua.account_id, ua.account_name, ua.account_balance,
        ct.currency_code, act.account_type_id, act.account_type_name,
        psa.target,psa.desired_date,           
        ua.account_starting_amount, ua.account_start_date, 
        tr.description, tr.transaction_actual_date, tr.amount, tr.transaction_id

         FROM transactions tr 
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
          JOIN pocket_saving_accounts psa ON ua.account_id = psa.account_id
            WHERE ua.user_id = $1
              AND (act.account_type_name = $2) AND ua.account_name != $3
               AND( mt.movement_type_name = $4  OR mt.movement_type_name=$7)
                  AND (
                    (tr.transaction_actual_date >= ($5::timestamp AT TIME ZONE $8)
                      AND tr.transaction_actual_date <
                        (($6::date + INTERVAL '1 day') AT TIME ZONE $8))
                    OR
                    (tr.created_at >= ($5::timestamp AT TIME ZONE $8)
                      AND tr.created_at <
                        (($6::date + INTERVAL '1 day') AT TIME ZONE $8))
                  )
            ORDER BY tr.transaction_actual_date DESC, ua.account_balance DESC, ua.account_name ASC
          `,
        values: [
          userId,
          accountTypeMap.pocket,
          'slack',
          'pocket',
          startDate,
          endDate,
          'account-opening',
          timeZone,
        ],
      };
      break;

    case 'debt':
      tableName = 'debtor_accounts'; //debtor account source/destination account
      queryModel = {
        text: `SELECT  mt.movement_type_name,
        ua.account_id, ua.account_name, ua.account_balance,
        ct.currency_code, act.account_type_id, act.account_type_name,

        dbt.debtor_name,dbt.debtor_lastname, dbt.value,         
        ua.account_starting_amount, ua.account_start_date, 
          tp.transaction_type_name, tr.description, 
          tr.transaction_actual_date, tr.amount, tr.transaction_id

        FROM transactions tr 
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
          JOIN transaction_types tp ON tp.transaction_type_id = tr.transaction_type_id
            JOIN debtor_accounts dbt ON ua.account_id = dbt.account_id
            WHERE ua.user_id = $1
          AND (act.account_type_name = $2) AND ua.account_name != $3
          AND (mt.movement_type_name = $4  OR (tp.transaction_type_name = $5 OR tp.transaction_type_name = $6))

          ORDER BY tr.transaction_actual_date DESC, 
          tr.created_at DESC
          `,
        values: [
          userId,
          accountTypeMap.debt,
          'slack',
          movement_type_name,
          'lend',
          'borrow',
        ],
      };
      break;

    case 'account-opening':
    case 'transfer':
    case 'receive':
    case 'pnl':
      // case transfer:
      tableName = 'transactions'; //all account types but slack
      queryModel = {
        text: `SELECT  mt.movement_type_name,ua.account_id, ua.account_name, ua.account_balance,
        ct.currency_code, act.account_type_id, act.account_type_name,
        ua.account_starting_amount, ua.account_start_date, 
        tp.transaction_type_name, tr.description, tr.transaction_actual_date, tr.amount, tr.transaction_id

          FROM transactions tr 
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
          JOIN transaction_types tp ON tp.transaction_type_id = tr.transaction_type_id
          WHERE ua.user_id = $1
            AND ua.account_name != $2
            AND (mt.movement_type_name = $3)

          ORDER BY tr.transaction_actual_date DESC,
          tr.created_at DESC,tr.updated_at DESC,
          ua.account_balance DESC, ua.account_name ASC
          `,
        values: [userId, 'slack', movement_type_name],
      };
      break;

    case 'all':
      tableName = 'transactions';
      queryModel = {
        text: `SELECT mt.movement_type_name, ua.*, tr.*
         FROM transactions tr
        JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
        WHERE ua.user_id = $1
         ORDER BY tr.transaction_actual_date DESC, tr.transaction_type_id ASC `,
        values: [userId],
      };

      break;
    default:
      return RESPONSE(
        res,
        400,
        `Invalid movement type name: ${movement_type_name}`,
      );
  }
  //-------------------------------
  try {
    const movements = await queryFn(queryModel.text, queryModel.values);
    // console.log('🚀 ~ dashboardMovementTransactions ~ result:', movements);

    if (movements && movements?.length === 0) {
      const message = `No info encountered for movement: ${movement_type_name} and type: ${accountTypeMap[movement_type_name]}`;
      console.error('error', message);
      return RESPONSE(res, 400, message);

      // return res.status(404).json({
      //   message: `No info encountered for movement: ${movement_type_name} and type: ${accountTypeMap[movement_type_name]}`,
      // });
    }
    const message = `${movements.length} transaction(s) found. Period between ${startDate} and ${endDate}`;
    // console.log(pc[backendColor](message));

    // One point for the six branches above: every one of them selects
    // tr.description, so the note is split out once rather than per movement
    // kind. description travels untouched beside it.
    const movementsWithNote = movements.map((movement) => ({
      ...movement,
      note: extractNoteFromDescription(movement.description),
    }));

    return RESPONSE(res, 200, message, movementsWithNote);
    // return res.status(200).json(movements);
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        pc.red(
          `Error while getting movement transactions ${movement_type_name}`,
        ),
      );
      if (process.env.NODE_ENV === 'development') {
        console.warn(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred'),
      );
    }
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
//----------------------------------------
//**************************************/
//GET: TRACKER MOVEMENT TRANSACTIONS. BY USER, PERIOD (default:last 30 days) AND  a SEARCH PARAM
//endpoint: http://localhost:5000/api/fintrack/dashboard/movements/search/?start=sd&end=ed&search=searchParam&user=${user}

export const dashboardMovementTransactionsSearch = async (req, res, next) => {
  const backendColor = 'green';
  const errorColor = 'red';
  //functions
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };
  console.log(pc[backendColor]('dashboardMovementTransactionsSearch'));
  //---------------------------------------
  try {
    const { start, end, search } = req.query;
    const userId = requireUserId(req, res);
    if (!userId) return;
    //--------------------------------------
    // Same zoned half-open window as the other movement endpoints. What this
    // replaces put no time of day on either bound, so the ceiling landed on the
    // end day's 00:00 UTC and dropped everything the owner did after that hour.
    const { startDate, endDate, timeZone } = resolveZonedWindow({
      start,
      end,
      timeZone: await getUserTimeZone(pool, userId),
    });

    // console.log(
    //   '🚀 ~ dashboardMovementTransactionByPeriod ~ _daysAgo:',
    //   req.query,
    //   daysAgo,
    //   's',
    //   start,
    //   startDate,
    //   'e',
    //   end,
    //   endDate
    // );
    //---------------------------------------
    const movementsResult = await pool.query({
      text: `
  SELECT mt.movement_type_name, ct.currency_code,ua.*, tr.*, trt.transaction_type_name,
    CAST(tr.amount AS FLOAT), CAST(ua.account_balance AS FLOAT), CAST(ua.account_starting_amount AS FLOAT)
  FROM transactions tr
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
          JOIN transaction_types trt ON tr.transaction_type_id = trt.transaction_type_id
  WHERE ua.user_id = $1 
  AND (
   (tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $6)
     AND tr.transaction_actual_date < (($3::date + INTERVAL '1 day') AT TIME ZONE $6))
   OR
   (tr.created_at >= ($2::timestamp AT TIME ZONE $6)
     AND tr.created_at < (($3::date + INTERVAL '1 day') AT TIME ZONE $6))
  )
  AND (ua.account_name != $5)
  AND (
   tr.description ILIKE '%'||$4||'%' 
  OR CAST(tr.status AS TEXT)  ILIKE '%'||$4||'%'
  OR CAST(mt.movement_type_name AS TEXT) ILIKE '%'||$4||'%'
  OR CAST(trt.transaction_type_name AS TEXT) ILIKE '%'||$4||'%'
  OR CAST(ct.currency_code AS TEXT) ILIKE '%'||$4||'%'
  OR CAST(tr.amount AS TEXT) ILIKE '%'||$4||'%'
  OR CAST(tr.source_account_id AS TEXT) ILIKE '%'||$4||'%'
  OR CAST(tr.destination_account_id  AS TEXT) ILIKE '%'||$4||'%'
    )
   ORDER BY tr.transaction_actual_date DESC, tr.created_at DESC
  `,
      values: [
        userId,
        startDate,
        endDate,
        search,
        search === 'slack' ? '' : 'slack',
        timeZone,
      ],
    });

    // console.log(
    //   '🚀 ~ dashboardMovementTransactionsByPeriod ~ movementsResult.rows:',
    //   movementsResult.rows
    // );

    if (movementsResult.rows?.length === 0) {
      const message = `No info encountered for movements`;

      return RESPONSE(res, 404, message);
    }
    const message = `${movementsResult.rows.length} transaction(s) found`;
    // console.log(pc[backendColor](message));

    return RESPONSE(res, 200, message, movementsResult.rows);
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        pc.red(
          // `Error while getting movement transactions in the period between ${startDate} and ${endDate}`
          `Error while getting movement transactions in the period between`,
        ),
      );
      if (process.env.NODE_ENV === 'development') {
        console.warn(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred'),
      );
    }
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
//*******************************/
//GET: TRACKER MOVEMENT TRANSACTIONS. BY USER, MOVEMENT_TYPE_NAME, ACCOUNT_TYPE_NAME, TRANSACTION_TYPE_NAME
//endpoint: http://localhost:5000/api/fintrack/dashboard/movements/account_type/?start=sd&end=ed&movement=&account_type=&transaction_type=&user=${user}
//examples:
// ?start=&end=&movement=expense&transaction_type=&account_type=category_budget&user=51ba7238...
// ?start=&end=&movement=debt&transaction_type=&account_type=debtor&user=51ba7238-31f0-...
//http://localhost:5000/api/fintrack/dashboard/movements/account_type/?start=&end=&movement=income&transaction_type=&account_type=income_source&user=51ba7...
//for transfer movements (pocket, investment) use other endpoint:dashboardMovementTransactions

export const dashboardMovementTransactionsByType = async (req, res, next) => {
  const backendColor = 'blue';
  const errorColor = 'red';
  //functions
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };
  console.log(pc[backendColor]('dashboardMovementTransactionsByType'));
  //------------------------------
  try {
    //input data
    const { start, end, transaction_type, movement, account_type } = req.query;
    const userId = requireUserId(req, res);
    if (!userId) return;

    if (!(movement || transaction_type || account_type)) {
      const message =
        'movement, transaction_type or account_type is required';
      return RESPONSE(res, 400, message);
    }
    // Same zoned half-open window as the other movement endpoints. What this
    // replaces put no time of day on either bound, so the ceiling landed on the
    // end day's 00:00 UTC and dropped everything the owner did after that hour.
    const { startDate, endDate, timeZone } = resolveZonedWindow({
      start,
      end,
      timeZone: await getUserTimeZone(pool, userId),
    });

    // console.log(
    //   '🚀 ~ dashboardMovementTransactionByPeriod ~ _daysAgo:',
    //   req.query,   'daysAgo',   daysAgo,   'start',   start,   'startDate',   startDate,   'end',   end,   'endDate:',   endDate );

    const movementsResult = await pool.query({
      text: `
  SELECT mt.movement_type_name, ct.currency_code, ua.*, tr.*, trt.transaction_type_name,act.account_type_name,
  CAST ( ua.account_starting_amount AS FLOAT),  CAST (tr.amount AS FLOAT),
  CAST(ua.account_balance AS FLOAT)
    FROM transactions tr
      JOIN user_accounts ua ON tr.account_id = ua.account_id
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      JOIN currencies ct ON ua.currency_id = ct.currency_id
      JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
      JOIN transaction_types trt ON tr.transaction_type_id = trt.transaction_type_id
    WHERE ua.user_id = $1 

    AND (
      (tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $9)
        AND tr.transaction_actual_date < (($3::date + INTERVAL '1 day') AT TIME ZONE $9))
      OR
      (tr.created_at >= ($2::timestamp AT TIME ZONE $9)
        AND tr.created_at < (($3::date + INTERVAL '1 day') AT TIME ZONE $9))
    )
    -- Its own term and no longer trailing the OR. AND binds tighter, so the
    -- slack exclusion used to apply to the created_at branch alone and a slack
    -- row still came through on its transaction_actual_date.
    AND ua.account_name != $4

    AND (mt.movement_type_name = $6 OR mt.movement_type_name = $8 )
    AND (trt.transaction_type_name = $5 OR act.account_type_name = $7)

    ORDER BY tr.transaction_actual_date DESC, tr.created_at DESC
  `,
      values: [
        userId,
        startDate,
        endDate,
        'slack',
        transaction_type,
        movement,
        account_type,
        movement === 'debt' || movement === 'pocket'
          ? 'account-opening'
          : movement,
        timeZone,
      ],
    });

    // console.log(
    //   '🚀 ~ dashboardMovementTransactionsByPeriod ~ movementsResult.rows:',
    //   movementsResult.rows
    // );

    if (movementsResult.rows?.length === 0) {
      const message = `No transactions encountered for "${movement}" and ${
        transaction_type || account_type
      }`;

      return RESPONSE(res, 404, message);
    }

    const message = `${movementsResult.rows.length} transaction(s) found. Period between ${startDate} and ${endDate}`;
    // console.log(pc[backendColor](message));

    return RESPONSE(res, 200, message, movementsResult.rows);
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        pc.red(
          `Error while getting movement transactions in the period between ${startDate} and ${endDate}`, //variables should be out of try/catch scope
          // `Error while getting movement transactions in the period`
        ),
      );
      if (process.env.NODE_ENV === 'development') {
        console.warn(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred'),
      );
    }
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
