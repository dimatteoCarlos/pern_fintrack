//total asset balance: total bank + total investment accounts
//total liquidity: bank
//total investment: investment
//total expense vs budget
//total debtors balance
//total payable balance
//total receivable balance
//total income
//total budget
//total target -> saving goal in pockets

//*********** */
//por cada uno de los anteriores, mostrar la lista de cuentas que componen los balances y despues mostrar cuenta detallada, con sus movimientos.

//monthly average por cada uno

//balance per period
//manejo del currency: se debe definir el manejo de multiples monedas, por ahora todo se asumira en usd.

//------
//debido a las dudas en como es la funcionalidad de fintrack en el disenio, me planteo empezar con el frontend de la aplicacion de espenses tipo sitio web, y dejar fintrack para cuando quieran reunirse para aclarar lo que hace falta definir y se hagan los disenios que faltan. Asi, avanzo en aplicar mantine y otras tecnologias como next js con backend y type script y otro tipo de aplicaciones

//get: //http://localhost:5000/api/fintrack/dashboard/balance
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import pc from 'picocolors';
import { pool } from '../../db/configDB.js';

//common functions

// get: //http://localhost:5000/api/fintrack/dashboard/balance
//get the total balance account for each group of account type, for all account types
export const dashboardTotalBalanceAccounts = async (req, res, next) => {
  const backendColor = 'green';
  const errorColor = 'red';
  console.log(pc[backendColor]('dashboardTotalBalanceAccountByType'));
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };

  try {
    const userId = req.body.user ?? req.query.user;

    if (!userId) {
      return RESPONSE(res, 400, 'User ID is required');
    }

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
      const message = `No available accounts or something went wrong`;
      console.warn(pc[errorColor](message));
      return RESPONSE(res, 400, message);
    }

    const accountTotalBalance = accountTotalBalanceResult.rows;
    const data = {
      rows: accountTotalBalanceResult.rows.length,
      accountTotalBalance,
    };
    console.log(data);
    return RESPONSE(res, 200, successMsg, data);
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting accounts balances'));

      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
    // return RESPONSE(error, next)
  }
};

//========================================================
//get the total balance for a specific type account
//========================================================
//get: //http://localhost:5000/api/fintrack/dashboard/balance/type
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

export const dashboardTotalBalanceAccountByType = async (req, res, next) => {
  const backendColor = 'cyan';
  const errorColor = 'red';
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };

  console.log(pc[backendColor]('dashboardTotalBalanceAccountByType'));

  try {
    const { type } = req.query; //bank| investment | income_source | category_budget | debtor | pocket_saving
    const userId = req.body.user ?? req.query.user;

    console.log(
      '🚀 ~ dashboardTotalBalanceAccountByType ~ userId:',
      userId,
      req.query,
      req.body,
      type
    );

    const accountType = type;

    if (!accountType || !userId) {
      return RESPONSE(res, 400, 'User ID and account TYPE are required');
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
      return RESPONSE(res, 400, message);
    }

    const successMsg = `Total balance account of account type ${accountType} successfully calculated`;
    //********************************************/
    const TOTAL_BALANCE_QUERY = {
      text: `SELECT CAST(SUM(ua.account_balance) AS FLOAT ) AS total_balance,COUNT(*) AS accounts, ct.currency_code FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
GROUP BY ct.currency_code
`,
      values: [userId, accountType, 'slack'],
    };
    //-----------
    const TOTAL_BALANCE_AND_GOAL_BY_TYPE = {
      category_budget: {
        text: `SELECT CAST(SUM(ua.account_balance) AS FLOAT ) AS total_balance,  CAST(SUM(st.budget) AS FLOAT ) AS total_budget,
        (CAST(SUM(st.budget) AS FLOAT ) - CAST(SUM(ua.account_balance) AS FLOAT)) AS total_remaining,
        ct.currency_code FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
JOIN category_budget_accounts st ON ua.account_id = st.account_id
WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
GROUP BY  ct.currency_code
`,
        values: [userId, accountType, 'slack'],
      },
      //-----------
      pocket_saving: {
        text: `SELECT CAST(SUM(ua.account_balance) AS FLOAT ) AS total_balance, CAST(SUM(st.target) AS FLOAT ) AS total_target,
         (CAST(SUM(st.target) AS FLOAT ) - CAST(SUM(ua.account_balance) AS FLOAT)) AS total_remaining
        
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
        text: `SELECT CAST(SUM(ua.account_balance) AS FLOAT ) AS total_debt_balance, CAST(SUM(CASE WHEN ua.account_balance > 0 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS debt_receivable,  CAST(SUM(CASE WHEN ua.account_balance < 0 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS debt_payable, 

        CAST(COUNT(CASE WHEN ua.account_balance>0 THEN 1 ELSE NULL END) AS FLOAT) AS debtors, 
        CAST(COUNT(*) FILTER (WHERE ua.account_balance<0) AS FLOAT) AS creditors, 
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
      console.log('🚀 ~ dashboardTotalBalanceAccount ~ query:', query);

      const accountTotalBalanceResult = await pool.query(query);

      if (accountTotalBalanceResult.rows.length === 0) {
        const message = `No available accounts of type ${accountType}`;
        return RESPONSE(res, 400, message);
      }

      const data = accountTotalBalanceResult.rows[0];
      console.log(data);

      return RESPONSE(res, 200, successMsg, data);
    }
    //-------

    //---total balance, target or limit

    if (
      accountType == 'category_budget' ||
      accountType == 'debtor' ||
      accountType == 'pocket_saving'
    ) {
      const query = TOTAL_BALANCE_AND_GOAL_BY_TYPE[accountType];

      // if (!query) {
      //   const message = `Invalid account type "${accountType}" check endpoint queries.`;
      //   console.warn(pc.red(message));
      //   return RESPONSE(res, 400, message);
      // }

      const accountTotalBalanceResult = await pool.query(query);

      if (accountTotalBalanceResult.rows.length === 0) {
        const message = `No available accounts of type ${accountType}`;
        return RESPONSE(res, 400, message);
      }

      const data = accountTotalBalanceResult.rows;
      console.log(data);

      return RESPONSE(res, 200, successMsg, data);
    }
    //----------------------------------------------

    //in case accountType does not exist
    const message = `No available accounts of type ${accountType}`;
    return RESPONSE(res, 400, message);
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting account summary list'));
      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
    // return RESPONSE(error, next)
  }
};


//------------------------------------------------
//==============================================================================
//get the total balance for a specific type account
//get: //http://localhost:5000/api/fintrack/dashboard/balance/summary/?type=&user=
export const dashboardAccountSummaryList = async (req, res, next) => {
  const backendColor = 'yellow';
  const errorColor = 'red';
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };

  console.log(pc[backendColor]('dashboardAccountSummaryList'));

  try {
    const { type } = req.query;
    const userId = req.body.user ?? req.query.user;
    const accountType = req.body.type ?? req.query.type;

    console.log(
      '🚀 ~ dashboardTotalBalanceAccountByType ~ userId:',
      userId,
      req.query,
      req.body,
      type
    );

    if (!accountType || !userId) {
      return RESPONSE(res, 400, 'User ID and account TYPE are required');
    }

    if (!['category_budget', 'debtor', 'pocket_saving'].includes(accountType)) {
      const message = `Invalid account type for summary list "${accountType}" check endpoint queries.`;
      console.warn(pc.red(message));
      return RESPONSE(res, 400, message);
    }

    const successMsg = `Summary list of accounts type ${accountType} was successfully calculated`;

    //***********************************************/
    const SUMMARY_BALANCE_AND_GOAL_BY_TYPE = {
      category_budget: {
        text: `SELECT  cba.category_name, 
    CAST(SUM(ua.account_balance) AS FLOAT ) AS total_balance,
    CAST(SUM(cba.budget) AS FLOAT ) AS total_budget,
    (CAST(SUM(cba.budget) AS FLOAT ) - CAST(SUM(ua.account_balance) AS FLOAT)) AS total_remaining,
    ct.currency_code

    FROM user_accounts ua

  JOIN account_types act ON ua.account_type_id = act.account_type_id
  JOIN currencies ct ON ua.currency_id = ct.currency_id
  JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
  WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3

    GROUP BY cba.category_name, ct.currency_code
    ORDER BY cba.category_name ASC,ct.currency_code DESC,total_balance DESC
`,
        values: [userId, accountType, 'slack'],
      },

      pocket_saving: {
        text: `SELECT ua.account_name, CAST(SUM(ua.account_balance) AS FLOAT ) AS total_balance, CAST(SUM(st.target) AS FLOAT ) AS total_target,  ct.currency_code
  FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN pocket_saving_accounts st ON ua.account_id = st.account_id
JOIN currencies ct ON ua.currency_id = ct.currency_id

WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
GROUP BY ua.account_name, ct.currency_code
ORDER BY total_balance DESC, ua.account_name ASC
`,
        values: [userId, accountType, 'slack'],
      },

      debtor: {
        text: `SELECT ua.account_name, CAST(SUM(ua.account_balance) AS FLOAT ) AS total_debt_balance, CAST(SUM(CASE WHEN ua.account_balance > 0 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS debt_receivable,  CAST(SUM(CASE WHEN ua.account_balance < 0 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS debt_payable,

        CAST(COUNT(CASE WHEN ua.account_balance>0 THEN 1 ELSE NULL END) AS FLOAT) AS debtor, 
        CAST(COUNT(*) FILTER (WHERE ua.account_balance<0) AS FLOAT) AS creditor, 
        ct.currency_code
        
        FROM user_accounts ua
        JOIN account_types act ON ua.account_type_id = act.account_type_id
        JOIN debtor_accounts st ON ua.account_id = st.account_id
        JOIN currencies ct ON ua.currency_id = ct.currency_id

        WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
        GROUP BY ua.account_name, ct.currency_code
        ORDER BY total_debt_balance DESC, ua.account_name ASC
`,
        values: [userId, accountType, 'slack'],
      },
    };
    //revisar debtor By pocket saving
    //------queries
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
        const message = `No accounts available of type ${accountType}`;
        return RESPONSE(res, 400, message);
      }

      const data = accountSummaryResult.rows;
      console.log(data);

      return RESPONSE(res, 200, successMsg, data);
    }
    //--------------------------------------

    //-------------------------------------

    //in case accountType does not exist
    const message = `No available accounts of type ${accountType}`;
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
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
    // return RESPONSE(error, next)
  }
};


//**********************************************************************************/
//GET ALL USER TRACKER MOVEMENT TRANSACTIONS BY MOVEMENT_TYPE_NAME WITH A PRE-FIXED CORRESPONDING ACCOUNT TYPE
//endpoint: http://localhost:5000/api/fintrack/dashboard/movements/movement/?movement=${mov_type}&user=${user}
//usage: to show all transaction by movement name with correponding accounts.

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
    transfer: 'all',
    receive: 'all',
    'account-opening': 'all',
  };
  //------------------------------
  const queryFn = async (text, values) => {
    try {
      const result = await pool.query(text, values);
      return result.rows;
    } catch (error) {
      console.error(
        'Datbase query error occurred',
        process.env.NODE_ENV === 'development' ? console.log(error.stack) : ''
      );
    }
  };

  //---------------------------------------

  const { movement: movement_type_name } = req.query;
  const userId = req.body.user ?? req.query.user;

  console.log('params:', req.body, req.query);

  //later add a function to validate type and movement against the types
  //!account_type_name ||
  if (!movement_type_name || !userId) {
    const message =
      'Missing required parameters: user, account type name, movement type name';
    return RESPONSE(res, 400, message);
  }

  //verify whether is necessary to check the existence of these parameters in the db tables

  //account types are related to the movement type, and db table name, in order to track movement transactions
  let tableName;
  let queryModel;
  console.log('mov:', movement_type_name);
  switch (movement_type_name) {
    case 'expense':
      tableName = 'category_budget_accounts'; //destination account
      //category_budget
      queryModel = {
        text: `SELECT  mt.movement_type_name,ua.account_id, ua.account_name, ua.account_balance, cba.budget,
          ct.currency_code, act.account_type_id, act.account_type_name,
           cba.category_name, cba.subcategory, cnt.category_nature_type_name,
                  ua.account_starting_amount, ua.account_start_date, 
                  tr.description, tr.transaction_actual_date, tr.amount
               FROM transactions tr 
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt  ON tr.movement_type_id = mt.movement_type_id
            JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
            JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
               WHERE ua.user_id = $1
               AND (act.account_type_name = $2) AND ua.account_name != $3
          AND mt.movement_type_name = $4

            ORDER BY tr.transaction_actual_date DESC, ua.account_balance DESC, ua.account_name ASC
          `,
        values: [userId, accountTypeMap.expense, 'slack', movement_type_name],
      };
      break;

    case 'income':
      tableName = 'income_source_accounts'; //source account

      queryModel = {
        text: `SELECT mt.movement_type_name,ua.account_id, ua.account_name, ua.account_balance,
          ct.currency_code, act.account_type_id, act.account_type_name,
           ua.account_starting_amount, ua.account_start_date, 
          tr.description, tr.transaction_actual_date, tr.amount
               FROM transactions tr 
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt  ON tr.movement_type_id = mt.movement_type_id
            JOIN income_source_accounts isc ON ua.account_id = isc.account_id
          WHERE ua.user_id = $1
          AND (act.account_type_name = $2) AND ua.account_name != $3
          AND mt.movement_type_name = $4

            ORDER BY tr.transaction_actual_date DESC, ua.account_balance DESC, ua.account_name ASC
          `,
        values: [userId, accountTypeMap.income, 'slack', movement_type_name],
      };
      break;

    case 'investment':
      tableName = 'investment_accounts'; //investment can be source/destination account
      queryModel = {
        text: `SELECT mt.movement_type_name,ua.account_id, ua.account_name, ua.account_balance,
          ct.currency_code, act.account_type_id, act.account_type_name,
           ua.account_starting_amount, ua.account_start_date, 
          tr.description, tr.transaction_actual_date, tr.amount
               FROM transactions tr 
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
            JOIN investment_accounts iac ON ua.account_id = iac.account_id
          WHERE ua.user_id = $1
          AND (act.account_type_name = $2) AND ua.account_name != $3
          AND mt.movement_type_name = $4

            ORDER BY tr.transaction_actual_date DESC, ua.account_balance DESC, ua.account_name ASC
          `,
        values: [
          userId,
          accountTypeMap.investment,
          'slack',
          movement_type_name,
        ],
      };
      break;

    case 'pocket':
      tableName = 'pocket_saving_accounts'; //pocket source/destination account
      queryModel = {
        text: `SELECT  mt.movement_type_name,ua.account_id, ua.account_name, ua.account_balance,
        ct.currency_code, act.account_type_id, act.account_type_name,
        psa.target,psa.desired_date,           
        ua.account_starting_amount, ua.account_start_date, 
        tr.description, tr.transaction_actual_date, tr.amount
          FROM transactions tr 
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
            JOIN pocket_saving_accounts psa ON ua.account_id = psa.account_id
            WHERE ua.user_id = $1
          AND (act.account_type_name = $2) AND ua.account_name != $3
          AND mt.movement_type_name = $4
            ORDER BY tr.transaction_actual_date DESC, ua.account_balance DESC, ua.account_name ASC
          `,
        values: [userId, accountTypeMap.expense, 'slack', movement_type_name],
      };
      break;

    case 'debt':
      tableName = 'debtor_accounts'; //debtor account source/destination account
      queryModel = {
        text: `SELECT  mt.movement_type_name,ua.account_id, ua.account_name, ua.account_balance,
        ct.currency_code, act.account_type_id, act.account_type_name,

        dbt.debtor_name,dbt.debtor_lastname, dbt.value,         
        ua.account_starting_amount, ua.account_start_date, 
        tr.description, tr.transaction_actual_date, tr.amount
          FROM transactions tr 
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id

            JOIN debtor_accounts dbt ON ua.account_id = dbt.account_id
            WHERE ua.user_id = $1
          AND (act.account_type_name = $2) AND ua.account_name != $3
          AND mt.movement_type_name = $4
            ORDER BY tr.transaction_actual_date DESC, ua.account_balance DESC, ua.account_name ASC
          `,
        values: [userId, accountTypeMap.debt, 'slack', movement_type_name],
      };
      break;

    case 'account-opening':
    case 'transfer':
    case 'receive':
      // case transfer:
      tableName = 'transactions'; //all account types but slack
      queryModel = {
        text: `SELECT  mt.movement_type_name,ua.account_id, ua.account_name, ua.account_balance,
        ct.currency_code, act.account_type_id, act.account_type_name,

        ua.account_starting_amount, ua.account_start_date, 
        tr.description, tr.transaction_actual_date, tr.amount
          FROM transactions tr 
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id

          WHERE ua.user_id = $1
          
          AND ua.account_name != $2
          AND mt.movement_type_name = $3
            ORDER BY tr.transaction_actual_date DESC,ua.account_balance DESC, ua.account_name ASC
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
        WHERE tr.user_id = $1
         ORDER BY tr.transaction_actual_date DESC, tr.transaction_type_id ASC `,
        values: [userId],
      };

      break;
    default:
      return RESPONSE(
        res,
        400,
        `Invalid movement type name: ${movement_type_name}`
      );
  }
  //-------------------------------

  //-------------------------------
  try {
    const movements = await queryFn(queryModel.text, queryModel.values);
    console.log('🚀 ~ dashboardMovementTransactions ~ result:', movements);

    if (movements?.length === 0) {
      return res.status(404).json({
        message: `No info encountered for movement: ${movement_type_name} and type: ${accountTypeMap[movement_type_name]}`,
      });
    }
    return res.status(200).json(movements);
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        pc.red(
          `Error while getting movement transactions ${movement_type_name}`
        )
      );
      if (process.env.NODE_ENV === 'development') {
        console.warn(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
//------------------------------------------------

//------------------------------------------------

//************************************************/
//GET: TRACKER MOVEMENT TRANSACTIONS. BY USER, PERIOD (default:last 30 days) AND SEARCH PARAM
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
  //------------------------------
  try {
    //-------------------------------------------------
    const today = new Date();
    const _daysAgo = new Date(today);
    _daysAgo.setDate(today.getDate() - 30);
    const daysAgo = _daysAgo.toISOString().split('T')[0];

    const { start, end, search } = req.query;
    const userId = req.user ?? req.query.user;

    //-------------------------------------------------

    if (!userId) {
      const message = 'User Id is required';
      return RESPONSE(res, 400, message);
    }

    const startDate = new Date(start || daysAgo);
    const endDate = new Date(end || today.toISOString().split('T')[0]);

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
    //-------------------------------------------------
    const movementsResult = await pool.query({
      text: `
  SELECT mt.movement_type_name, ua.*, tr.*, trt.transaction_type_name,
    CAST(tr.amount AS FLOAT), CAST(ua.account_balance AS FLOAT), CAST(ua.account_starting_amount AS FLOAT)
  FROM transactions tr
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
          JOIN transaction_types trt ON tr.transaction_type_id = trt.transaction_type_id
  WHERE ua.user_id = $1 
  AND (tr.transaction_actual_date BETWEEN $2 AND $3 OR tr.created_at BETWEEN $2 AND $3 )
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
          `Error while getting movement transactions in the period between`
        )
      );
      if (process.env.NODE_ENV === 'development') {
        console.warn(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
//************************************************/
//GET: TRACKER MOVEMENT TRANSACTIONS. BY USER, MOVEMENT_TYPE_NAME, ACCOUNT_TYPE_NAME, TRANSACTION_TYPE_NAME
//endpoint: http://localhost:5000/api/fintrack/dashboard/movements/account_type/?start=sd&end=ed&movement=&account_type=&transaction_type=&user=${user}

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
    const today = new Date();
    const _daysAgo = new Date(today);
    _daysAgo.setDate(today.getDate() - 30); // 30 days period by default
    const daysAgo = _daysAgo.toISOString().split('T')[0];

    //input data
    const { start, end, transaction_type, movement, account_type } = req.query;
    const userId = req.user ?? req.query.user;

    if (!userId || !movement || !(transaction_type || account_type)) {
      const message = 'User Id , movement and transaction_type are required';
      return RESPONSE(res, 400, message);
    }
    const startDate = new Date(start || daysAgo);
    const endDate = new Date(end || today.toISOString().split('T')[0]);

    // console.log(
    //   '🚀 ~ dashboardMovementTransactionByPeriod ~ _daysAgo:',
    //   req.query,
    //   'daysAgo',
    //   daysAgo,
    //   's',
    //   start,
    //   'startDate',
    //   startDate,
    //   'e',
    //   end,
    //   'endDate:',
    //   endDate
    // );
    //HACER UN QUERY PARA MOVEMENT TYPE Y TRANSACTION TYPE, PARA REFLEJAR LOS MOVIMIENTOS.
    // Y LA ORIGINAL DE ESTE QUERY QUEDARIA PARA REALIZAR BUSQUEDAS ENTRE LAS TRANSACCIONES

    const movementsResult = await pool.query({
      text: `
  SELECT mt.movement_type_name, ua.*, tr.*, trt.transaction_type_name,act.account_type_name,
  CAST ( ua.account_starting_amount AS FLOAT),  CAST (tr.amount AS FLOAT),CAST(ua.account_balance AS FLOAT)

  FROM transactions tr
          JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
          JOIN transaction_types trt ON tr.transaction_type_id = trt.transaction_type_id
  WHERE ua.user_id = $1 

  AND (tr.transaction_actual_date BETWEEN $2 AND $3 OR tr.created_at BETWEEN $2 AND $3 AND ua.account_name !=$4)
  
  AND (mt.movement_type_name = $6)
  AND (trt.transaction_type_name = $5
  OR act.account_type_name = $7)

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
    const message = `${
      movementsResult.rows.length
    } transaction(s) found. Period between ${
      startDate.toISOString().split('T')[0]
    } and ${endDate.toISOString().split('T')[0]}`;
    // console.log(pc[backendColor](message));

    return RESPONSE(res, 200, message, movementsResult.rows);
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        pc.red(
          // `Error while getting movement transactions in the period between ${startDate} and ${endDate}` //variables should be out of try/catch scope
          `Error while getting movement transactions in the period`
        )
      );
      if (process.env.NODE_ENV === 'development') {
        console.warn(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};


