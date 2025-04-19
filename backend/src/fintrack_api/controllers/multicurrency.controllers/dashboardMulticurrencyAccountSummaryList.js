import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../../utils/errorHandling.js';
import { pool } from '../../../db/configDB.js';

//==============================================================================
//get the total balance for a specific type account
//get: //http://localhost:5000/api/fintrack/dashboard/multicurrency/balance/summary/?type=${accountType}&user=
export const dashboardMulticurrencyAccountSummaryList = async (
  req,
  res,
  next
) => {
  const backendColor = 'yellow';
  const errorColor = 'red';
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };

  console.log(pc[backendColor]('dashboardMulticurrencyAccountSummaryList'));

  //entry validation
  try {
    const { type } = req.query;
    const userId = res.user ?? req.body.user ?? req.query.user;
    const accountType = req.body.type ?? req.query.type;

    console.log('🚀 ~ ~ userId:', userId, req.query, req.body, type);

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
        text: `
    SELECT  cba.category_name, 
    CAST(SUM(CASE WHEN ct.currency_id = $4 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS total_balance_usd,
    CAST(SUM(CASE WHEN ct.currency_id = $4 THEN cba.budget ELSE 0 END) AS FLOAT ) AS total_budget_usd,
    (CAST(SUM(CASE WHEN ct.currency_id = $4 THEN cba.budget ELSE 0 END) AS FLOAT ) - CAST(SUM(CASE WHEN ct.currency_id = $4 THEN ua.account_balance ELSE 0 END) AS FLOAT)) AS total_remaining_usd,

    CAST(SUM(CASE WHEN ct.currency_id = $5 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS total_balance_cop,
    CAST(SUM(CASE WHEN ct.currency_id = $5 THEN cba.budget ELSE 0 END) AS FLOAT ) AS total_budget_cop,
    (CAST(SUM(CASE WHEN ct.currency_id = $5 THEN cba.budget ELSE 0 END) AS FLOAT ) - CAST
    (SUM(CASE WHEN ct.currency_id = $5 THEN ua.account_balance ELSE 0 END) AS FLOAT)) AS total_remaining_cop,
    
    CAST(SUM(CASE WHEN ct.currency_id = $6 THEN ua.account_balance ELSE 0 END) AS FLOAT ) AS total_balance_eur,
    CAST(SUM(CASE WHEN ct.currency_id = $6 THEN cba.budget ELSE 0 END) AS FLOAT ) AS total_budget_eur,
    (CAST(SUM(CASE WHEN ct.currency_id = $6 THEN cba.budget ELSE 0 END) AS FLOAT ) - CAST(SUM(CASE WHEN ct.currency_id = $6 THEN ua.account_balance ELSE 0 END) AS FLOAT)) AS total_remaining_eur
    
  FROM user_accounts ua

  JOIN account_types act ON ua.account_type_id = act.account_type_id
  JOIN currencies ct ON ua.currency_id = ct.currency_id
  JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
  WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
  AND ct.currency_id IN ($4, $5, $6) 

  GROUP BY cba.category_name
    ORDER BY cba.category_name ASC
`,
        values: [userId, accountType, 'slack', 1, 2, 3],
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
