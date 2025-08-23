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

//common functions

const RESPONSE = (res, status, message, data = null) => {
  const backendColor =
    status >= 400 ? 'red' : status >= 300 ? 'yellow' : 'green';
  console.log(pc[backendColor](`[${status}] ${message}`));
  res.status(status).json({ status, message, data });
};

// const ERR_RESP = (status, message, controllerName = null) => {
//   const backendColor =
//     status >= 400 ? 'red' : status >= 300 ? 'yellow' : 'green';
//   console.log(pc[backendColor](`[${status}] ${message}. ${controllerName}`));
//   const error = new Error(message);
//   error.status = 400;
//   throw error;
// };

//get all accounts info by account type: id, name, type, currency and balance, by user id and account_type but slack account.
//endpoint: http://localhost:5000/api/fintrack/account/type/?type=${bank}&user=${6e0ba475-bf23-4e1b-a125-3a8f0b3d352c}
//type can be: bank, category_budget, income_source, investment, debtor, bank_and_investment

export const getAllAccountsByType = async (req, res, next) => {
  console.log(pc[backendColor]('getAllAccountsByType'));
  const controllerName = 'getAllAccountsByType';

  try {
    const { type } = req.query;
    const userId = req.body.user ?? req.query.user;
    const accountType = type.trim();

    // console.log(userId, accountType.length, controllerName);

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
    //------------------------------------------
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
          text: `SELECT ua.account_id, ua.account_name, CAST(ua.account_balance AS FLOAT), ct.currency_code, act.account_type_id, act.account_type_name,
          CAST(ua.account_starting_amount AS FLOAT),  ua.account_start_date
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

//***************************************************/
// get all the available accounts, all types,  but slack acount
//endpoint: http://localhost:5000/api/fintrack/account/allAccounts/?user=6e0ba475-bf23-4e1b-a125-3a8f0b3d352c

export const getAccounts = async (req, res, next) => {
  console.log(pc[backendColor]('getAccounts'));

  try {
    // const { user: userId } = req.query;
    const userId = req.body.user ?? req.query.user;

    if (!userId) {
      const message = `User ID is required. Try again.`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    const accountTypeQuery = {
      all: {
        typeQuery: {
          text: `SELECT ua.*,  ct.currency_code,  act.account_type_name, CAST(ua.account_balance AS FLOAT), CAST(ua.account_starting_amount AS FLOAT)   
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
    //check account type on ddbb
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
      console.error(pc.red('Error while getting accounts by account type'));

      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Error during transfer'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
//******************************************************************
//get account info by account_id
//endpoint example: http://localhost:5000/api/fintrack/account/${accountId}?&user=${user}
//**************************************
export const getAccountById = async (req, res, next) => {
  // console.log(pc[backendColor]('getAccountById'));
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
   const userId = req.body.user ?? req.query.user;
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
    //==========================================
    //--get account basic info and its type name
    const accountsResult = await pool.query({
      text: `SELECT act.account_type_name , ua.*
        FROM user_accounts ua
        JOIN account_types act ON act.account_type_id = ua.account_type_id
        WHERE ua.account_id= $1`,
      values: [accountId],
    });
    // console.log('result', accountsResult.rows[0])

     if (!accountsResult || accountsResult.rows.length===0) {
      const message = `Account does not exist`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

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
     const account_type_name =accountsResult.rows[0].account_type_name

    if(!['pocket_saving','category_budget', 'bank', 'investment', 'income_source','debtor'].includes(account_type_name)){
    const message = `${account_type_name} is not included in the account types`
    console.warn(message)
     return RESPONSE(res, 400, message);
    }
   //====================================
    //--get account info by account id and account type (catgory_budget, debtor or pocket_saving)
    //--bank account type
    
 const accountTypeQuery = {
   //category_budget
      category_budget: {
        typeQuery: {
          text: `SELECT ua.*, act.*, cba.*, ct.currency_code, cnt.category_nature_type_name
          FROM user_accounts ua
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
          JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
          WHERE ua.user_id =$1
          AND act.account_type_name = $2
          AND ua.account_id = $3 AND ua.account_name != $4
          ORDER BY ua.created_at DESC, ua.updated_at DESC, 
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
      // bank: {
        //   typeQuery: {
          //     text: `SELECT ua.*,  ct.currency_code, act.*
          //     FROM user_accounts ua
      //     JOIN currencies ct ON ua.currency_id = ct.currency_id
      //     JOIN account_types act ON ua.account_type_id = act.account_type_id
      //     WHERE ua.user_id = $1
      //     AND act.account_type_name = $2
      //     AND ua.account_id = $3
      //  `,
      //     values: [userId, account_type_name, accountId ],
      //   },
      // },
      //investment
      // investment: {
      //   typeQuery: {
      //      text: `SELECT ua.*,  ct.currency_code, act.*
      //     FROM user_accounts ua
      //     JOIN currencies ct ON ua.currency_id = ct.currency_id
      //     JOIN account_types act ON ua.account_type_id = act.account_type_id
      //     WHERE ua.user_id = $1
      //     AND act.account_type_name = $2
      //     AND ua.account_id = $3
      //  `,
      //     values: [userId, account_type_name, accountId ],
      //   },
      // },
      // income_source: {
      //   typeQuery: {
      //      text: `SELECT ua.*,  ct.currency_code, act.*
      //     FROM user_accounts ua
      //     JOIN currencies ct ON ua.currency_id = ct.currency_id
      //     JOIN account_types act ON ua.account_type_id = act.account_type_id
      //     WHERE ua.user_id = $1
      //     AND act.account_type_name = $2
      //     AND ua.account_id = $3
      //     `,
      //     values: [userId, account_type_name, accountId ],
      //   },
      // },
    };

    //check account type on ddbb
    //es necesario chequear si el usuario tiene ese tipo de cuentas?

    const accountListResult = ['bank','investment','source_income'].includes(account_type_name)

    ? accountsResult
    :
      await pool.query(
      accountTypeQuery[account_type_name].typeQuery
    );

    if (accountListResult.rows.length === 0) {
      const message = `No accounts available`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    const accountList = accountListResult.rows;
    //devolver el nombre de la cuenta, (balance actual), currency_code

    const data = { rows: accountList.length, accountList };

    const message = `Account list successfully completed `;
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
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};

//*****************************
//get accounts of a category by category_name
//endpoint example: http://localhost:5000/api/fintrack/budget/category/${category_name}?&user=${user}

//example of route:http://localhost:5173/fintrack/budget/category/${category_name}
//*************************************
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
   const userId = req.body.user ?? req.query.user;
   
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
   //======================================================
    //--get accounts info by category name

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
};

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