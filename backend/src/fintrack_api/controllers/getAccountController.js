// backend/src/fintrack_api/controllers/getAccountController.js

//defined functions here:
//getAllAccountsByType, getAccounts, getAccountById, getAccountsByCategory

import pc from 'picocolors';
import { createError, handlePostgresError } from '../../utils/errorHandling.js';
import { pool } from '../../db/config/configDB.js';
import { respondError, respondSuccess } from '../../utils/responseHelpers.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import {
  dayInZone,
  todayInZone,
} from '../../utils/fintrackUtils/date-utils/resolveZonedWindow.js';
import { accountAllocationService } from '../services/pocket_services/services/accountAllocationService.js';
import {
  accountLedgerCte,
  derivedAccountBalanceSql,
  withDerivedBalance,
} from '../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

const backendColor = 'greenBright';
const errorColor = 'red';

// Every list below serves this in place of the stored user_accounts.account_balance.
// One expression, so a list and the detail of the same account cannot disagree.
const DERIVED_BALANCE = derivedAccountBalanceSql('ua');

//BASIC FUNCTIONS
const RESPONSE = (res, status, message, data = null) => {
  const backendColor =
    status >= 400 ? 'red' : status >= 300 ? 'yellow' : 'green';
  console.log(pc[backendColor](`[${status}] ${message}`));

  res.status(status).json({ status, message, data });
};
//------
// 🧮 CATEGORY BUDGET METRICS CALCULATOR
//
// DEPRECATED — legacy budget calculation, scheduled for removal (Plan C, C8).
// Do not extend it and do not add callers.
//
// It answers a different question from the budget module, not the same one less
// precisely:
//  - budgetAccount is cba.budget, the legacy column. The budget endpoints price
//    from budget_policy_allocations, which carry a frequency and a validity
//    range, so the two disagree for anything but an unedited monthly budget.
//  - balanceAccount is the account balance, with no period. remainingBudget in
//    the new system is the accumulated budget minus what was spent inside the
//    requested window.
//  - Math.round drops the cents that the DECIMAL(15,2) column stores.
//
// Replacement: GET /api/fintrack/budget/summary, which returns remainingBudget
// and executionPercentage for an explicit period.
const calculateBudgetMetrics = (balanceAccount, budgetAccount) => {
  const remain = Math.round(
    parseFloat(budgetAccount) - parseFloat(balanceAccount),
  );
  const statusAlert = remain <= 0;

  return { remain, statusAlert };
};
//-------
// 📊 TRANSACTIONS QUERY
const getAccountTransactions = async (
  userId,
  accountId,
  startDate,
  endDate,
) => {
  // 🗓️ DEFAULT PERIOD: the previous month and the current one.
  //
  // Both bounds were written `new Date().getMonth`, with no call parentheses,
  // so the expression was a function minus a number: NaN. new Date(y, NaN, 1)
  // is an Invalid Date and toISOString throws RangeError on it. The only
  // caller passes no dates, so the defaults always ran and this function threw
  // on every request.
  //
  // The month is read on the owner's calendar. A boundary struck on the
  // server's clock puts the first and the last day of the window in the wrong
  // month for anyone the server does not share a zone with.
  const timeZone = await getUserTimeZone(pool, userId);
  const [currentYear, currentMonth] = todayInZone(timeZone)
    .split('-')
    .map(Number);

  const defaultStartDate =
    startDate ||
    new Date(Date.UTC(currentYear, currentMonth - 2, 1))
      .toISOString()
      .slice(0, 10);

  // Day 0 of the next month is the last day of this one.
  const defaultEndDate =
    endDate ||
    new Date(Date.UTC(currentYear, currentMonth, 0)).toISOString().slice(0, 10);

  // 📝 TRANSACTIONS QUERY
  const transactionsQuery = {
    text: `
    WITH ${accountLedgerCte('$2')}
    SELECT tr.*, mt.movement_type_name, trt.transaction_type_name,
    ct.currency_code,
    oc.currency_code AS original_currency_code,
    -- The balance derived from the ledger, replacing the stored column that
    -- tr.* still ships. Renamed onto that column's key below, so the stale
    -- figure never reaches the response.
    al.balance AS derived_balance_after_tr

    FROM transactions tr
    JOIN account_ledger al ON al.transaction_id = tr.transaction_id
    JOIN user_accounts ua ON (tr.account_id = ua.account_id AND tr.user_id = ua.user_id)
      JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
      JOIN transaction_types trt ON tr.transaction_type_id = trt.transaction_type_id
      JOIN currencies ct ON tr.currency_id = ct.currency_id
      LEFT JOIN currencies oc ON tr.original_currency_id = oc.currency_id 
     WHERE tr.user_id = $1
        AND tr.account_id = $2
        AND tr.transaction_actual_date >= ($3::timestamp AT TIME ZONE $5)
        AND tr.transaction_actual_date <
          (($4::date + INTERVAL '1 day') AT TIME ZONE $5)
      ORDER BY tr.transaction_actual_date DESC, tr.created_at DESC
    `,
    values: [userId, accountId, defaultStartDate, defaultEndDate, timeZone],
  };

  const transactionsResult = await pool.query(transactionsQuery);

  // 📈 CALCULATE SUMMARY DATA
  // The derived figure takes over the key the stored column shipped under, so
  // the wire contract is unchanged and no frontend file moves.
  const transactions = withDerivedBalance(transactionsResult.rows);
  const totalTransactions = transactions.length;

  // 🏦 FIND INITIAL AND FINAL BALANCES
  const initialBalance =
    transactions.length > 0
      ? {
          amount:
            parseFloat(
              transactions[transactions.length - 1].account_balance_after_tr,
            ) || 0,
          date: transactions[transactions.length - 1].transaction_actual_date,
          currency: transactions[0].currency_code,
        }
      : { amount: 0, date: defaultStartDate, currency: 'usd' };
  //---
  const finalBalance =
    transactions.length > 0
      ? {
          amount: parseFloat(transactions[0].account_balance_after_tr) || 0,
          date: transactions[0].transaction_actual_date,
          currency: transactions[0].currency_code,
        }
      : { amount: 0, date: defaultEndDate, currency: 'usd' };

  return {
    totalTransactions,
    summary: {
      initialBalance,
      finalBalance,
      periodStartDate: defaultStartDate,
      periodEndDate: defaultEndDate,
    },
    transactions,
  };
}; //END OF getAccountTransactions
//----------
// 🎯 UNIFIED CATEGORY BUDGET DATA FETCHER
// Get complete category_budget account data including transactions
const getCategoryBudgetFullData = async (userId, accountId) => {
  try {
    console.log(
      pc[backendColor](
        `Fetching full category_budget data for account: ${accountId}`,
      ),
    );

    // 📋 ACCOUNT BASIC INFO + CATEGORY BUDGET DATA
    // The query held three faults that never surfaced because the route that
    // reaches it is commented out in accountRoutes.js: an undefined alias `ui`,
    // a join on `category_nature` (the table is `category_nature_types`), and
    // `category_nature_type_name` read off cba, which does not hold it.
    const accountQuery = {
      text: `
    SELECT
      ua.*,
      act.account_type_name,
      ct.currency_code,
      cba.budget,
      cnt.category_nature_type_name
    FROM user_accounts ua

    JOIN account_types act ON ua.account_type_id = act.account_type_id

    JOIN currencies ct ON ua.currency_id = ct.currency_id

    JOIN category_budget_accounts cba ON ua.account_id = cba.account_id

    JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id

    WHERE ua.user_id = $1
      AND ua.account_id = $2
      AND act.account_type_name = 'category_budget'
    `,
      values: [userId, accountId],
    };

    const accountResult = await pool.query(accountQuery);

    if (accountResult.rows.length === 0) {
      throw new Error('Category budget account not found');
    }

    const accountData = accountResult.rows[0];
    const { remain, statusAlert } = calculateBudgetMetrics(
      parseFloat(accountData.account_balance),
      parseFloat(accountData.budget),
    );

    // 📊 GET TRANSACTIONS DATA
    const transactionsData = await getAccountTransactions(userId, accountId);

    // 🏗️ BUILD COMPLETE RESPONSE OBJECT
    const completeAccountData = {
      accountInfo: {
        ...accountData,
        remain,
        statusAlert,
      },
      transactions: transactionsData,
    };

    console.log(
      pc[backendColor]('Category budget full data prepared successfully'),
    );
    return completeAccountData;
  } catch (error) {
    console.error('Error in getCategoryBudgetFullData:', error);
    throw error;
  }
}; //END OF getCategoryBudgetFullData

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
    const userId = requireUserId(req, res);
    if (!userId) return;

    if (!accountType) {
      const message = `Account type is required.Try again!.`;
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
          text: `SELECT ua.account_id, ua.account_name, ${DERIVED_BALANCE} AS account_balance, ct.currency_code, act.account_type_id, act.account_type_name,
          CAST(ua.account_starting_amount AS FLOAT),  ua.account_start_date
       FROM user_accounts ua
       JOIN account_types act ON ua.account_type_id = act.account_type_id
       JOIN currencies ct ON ua.currency_id = ct.currency_id
       WHERE ua.user_id = $1
       AND act.account_type_name = $2 AND ua.account_name != $3
       ORDER BY ua.account_name ASC, account_balance DESC
       `,
          values: [userId, accountType, 'slack'],
        },
      },

      category_budget: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, ${DERIVED_BALANCE} AS account_balance,
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
   ORDER BY ABS(${DERIVED_BALANCE}) DESC
       `,
          values: [userId, accountType, 'slack'],
        },
      },

      income_source: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, ${DERIVED_BALANCE} AS account_balance, act.account_type_name, ct.currency_code, 
         CAST(ua.account_starting_amount AS FLOAT), ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  ORDER BY ABS(${DERIVED_BALANCE}) DESC
`,
          values: [userId, accountType, 'slack'],
        },
      },

      investment: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, ${DERIVED_BALANCE} AS account_balance, act.account_type_name, ct.currency_code, 
           CAST(ua.account_starting_amount AS FLOAT) ,  ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  ORDER BY ABS(${DERIVED_BALANCE}) DESC
      `,
          values: [userId, accountType, 'slack'],
        },
      },

      pocket_saving: {
        typeQuery: {
          text: `
   SELECT ua.account_id, ua.account_name,
    ${DERIVED_BALANCE} AS account_balance,
    act.account_type_name, ct.currency_code, ps.target, ps.desired_date,
    -- 'user' or 'default'. A defaulted deadline is not a deadline the user
    -- chose, and no pace figure derived from it may read as one.
    ps.desired_date_source,
    ps.account_start_date, 
    ua.account_starting_amount,
    ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
JOIN pocket_saving_accounts ps ON ua.account_id = ps.account_id
WHERE ua.user_id =$1
AND act.account_type_name = $2 AND ua.account_name != $3
ORDER BY ps.target DESC, ABS(${DERIVED_BALANCE}) DESC
`,
          values: [userId, accountType, 'slack'],
        },
      },

      debtor: {
        typeQuery: {
          text: `
   SELECT ua.account_id,ua.account_name,
    ${DERIVED_BALANCE} AS account_balance,
    act.account_type_name, ct.currency_code,
   dac.value as starting_value,
   dac.debtor_name, dac.debtor_lastname,
   dac.selected_account_id,
   dac.account_start_date, 
   ua.account_starting_amount,
      ua.account_start_date
   FROM user_accounts ua
   JOIN account_types act
    ON ua.account_type_id = act.account_type_id
   JOIN currencies ct
    ON ua.currency_id = ct.currency_id
   JOIN debtor_accounts dac
    ON ua.account_id = dac.account_id
   WHERE ua.user_id =$1
   AND act.account_type_name = $2 AND ua.account_name != $3
   ORDER BY account_balance ASC
`,
          values: [userId, accountType, 'slack'],
        },
      },

      bank_and_investment: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name,
           ${DERIVED_BALANCE} AS account_balance,
            ct.currency_code, act.account_type_id, act.account_type_name,
          CAST(ua.account_starting_amount AS FLOAT),
            ua.account_start_date
          FROM user_accounts ua
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          WHERE ua.user_id = $1
          AND( act.account_type_name = $2 OR act.account_type_name=$3) AND ua.account_name != $4
        ORDER BY ua.account_type_id ASC, ua.account_name ASC, account_balance DESC
       `,
          values: [userId, 'bank', 'investment', 'slack'],
        },
      },
    };

    const accountListResult = await pool.query(
      accountTypeQuery[accountType].typeQuery,
    );

    if (accountListResult.rows.length === 0) {
      const message = `No accounts of type: "${accountType}" found`;
      console.warn(pc[backendColor](message));
      return respondError(res, 404, message);
    }

    const accountList = accountListResult.rows;

    // The picker that chooses which account funds a pocket needs three figures
    // beside each other — the balance, what is committed to pockets, and what
    // is not — precisely so that no single one of them gets called "available".
    // Attached from the same service the commit path validates against, in one
    // query for the whole list, so the business rule and the number on screen
    // cannot drift apart.
    //
    // Bank only. No route creates a cash account, unassigned cash means nothing
    // on an investment balance that is a market valuation nor on a debtor, and
    // a mixed type would carry the figures on some rows and not others — which
    // reads worse than carrying them nowhere.
    if (accountType === 'bank') {
      const allocationByAccountId =
        await accountAllocationService.getAllocationsByAccountId(
          pool,
          userId,
          accountList.map((account) => account.account_id),
        );

      for (const account of accountList) {
        const allocation = allocationByAccountId.get(account.account_id);

        // Absent means the allocation read filtered the row out. Left unset
        // rather than zeroed: a zero would state that nothing is committed to
        // an account this query could not answer for.
        if (!allocation) continue;

        account.allocated = allocation.allocated;
        account.unassignedCash = allocation.unassignedCash;
        account.isOverAllocated = allocation.isOverAllocated;
      }
    }

    //devolver el nombre de la cuenta, (balance actual), currency_code
    const data = {
      rows: accountList.length,
      accountList,
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
    const userId = requireUserId(req, res);
    if (!userId) return;

    const accountTypeQuery = {
      all: {
        typeQuery: {
          text: `SELECT ua.*,  ct.currency_code,  act.account_type_name,
           ${DERIVED_BALANCE} AS account_balance,
           CAST(ua.account_starting_amount AS FLOAT)   
       FROM user_accounts ua
       JOIN account_types act ON ua.account_type_id = act.account_type_id
       JOIN currencies ct ON ua.currency_id = ct.currency_id
       WHERE ua.user_id = $1
       AND ua.account_name != $2
       -- The expression and not the output name: ua.* already ships a column
       -- called account_balance, so the bare name is ambiguous here.
       ORDER BY ua.account_type_id ASC, ${DERIVED_BALANCE} DESC
       `,
          values: [userId, 'slack'],
        },
      },
    };
    //CHECK ACCOUNT TYPE ON DDBB
    //es necesario chequear si el usuario tiene ese tipo de cuentas?
    const accountListResult = await pool.query(
      accountTypeQuery['all'].typeQuery,
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
        pc[errorColor]('Unknown error occurred'),
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
}; //END OF getAccounts

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
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { accountId } = req.params;

    if (!accountId) {
      const message = `Account ID is required.`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }
    //--------------
    // 📋 GET ACCOUNT BASIC INFO
    const accountsResult = await pool.query({
      text: `SELECT act.account_type_name , ua.*,
        -- The ledger figure, carried under its own name so it does not collide
        -- with the stored column ua.* still ships. NUMERIC, so pg hands it back
        -- as text and the wire type of account_balance does not change.
        ${derivedAccountBalanceSql('ua', 'NUMERIC')} AS derived_account_balance
        FROM user_accounts ua
        JOIN account_types act ON 
        act.account_type_id = ua.account_type_id
        WHERE ua.account_id= $1 AND ua.user_id = $2`,
      values: [accountId, userId],
    });
    // console.log('result', accountsResult.rows[0])

    if (!accountsResult || accountsResult.rows.length === 0) {
      const message = `Account does not exist or user mismatch.`;
      console.warn(pc[backendColor](message));
      return res.status(404).json({ status: 404, message }); //400
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
    const account_type_name = accountsResult.rows[0].account_type_name;
    //-------------------------------------
    // in case of a failure db?
    if (
      ![
        'pocket_saving',
        'category_budget',
        'bank',
        'investment',
        'income_source',
        'debtor',
      ].includes(account_type_name)
    ) {
      const message = `${account_type_name} is not included in the account types fintrack app`;
      console.warn(message);
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
          // da.* used to be selected whole, and debtor_accounts repeats three of
          // user_accounts' column names — account_id, currency_id and
          // account_start_date — so the driver kept the extension's copy of each
          // and the row silently stopped being the account's own.
          // account_start_date is the one that bites: account_start_local_date is
          // derived from it below, and the edit path writes neither table's copy,
          // so nothing keeps the two in step. The base table wins, because it is
          // the one the rest of the app reads.
          text: `SELECT ua.*, act.account_type_name, ct.currency_code,
      da.value, da.debtor_name, da.debtor_lastname,
      da.selected_account_id, da.selected_account_name,
      da.original_value, da.original_currency_id, da.exchange_rate,
      da.exchange_rate_source, da.exchange_rate_timestamp,
      da.exchange_rate_target_currency_id
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
    let accountListResult;
    //basic accounts
    if (basicAccountTypes.includes(account_type_name)) {
      accountListResult = accountsResult;
    } else if (accountTypeQuery.hasOwnProperty(account_type_name)) {
      //pocket, debtor, category_budget accounts
      accountListResult = await pool.query(
        accountTypeQuery[account_type_name].typeQuery,
      );
    } else {
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
    const data = {
      rows: accountListResult.rows.length,
      accountList: [accountListResult.rows[0]],
    };
    // console.log("🚀 ~ getAccountById ~ data:", data)

    // Every branch above selects ua.*, so every one of them shipped the stored
    // balance. The detail screen states a figure with no series beside it to
    // contradict it, and the category budget divided by it to say what is left.
    data.accountList[0].account_balance =
      accountsResult.rows[0].derived_account_balance;
    delete data.accountList[0].derived_account_balance;

    //----------------------------
    // 📆 THE DAY THE ACCOUNT WAS OPENED, ON THE OWNER'S CALENDAR
    //
    // account_start_date is an instant (TIMESTAMPTZ) and a calendar day is a
    // label. The conversion between them takes the owner's zone and happens
    // once, here, so a screen never reads the instant's UTC parts — which named
    // the following day for every account opened after 19:00 in Bogota.
    //
    // Served beside the instant, not instead of it: the raw column stays for
    // any caller that needs the moment.
    const accountTimeZone = await getUserTimeZone(pool, userId);

    data.accountList[0].account_start_local_date = dayInZone(
      data.accountList[0].account_start_date,
      accountTimeZone,
    );

    // 🧮 ENRICH CATEGORY ACCOUNT WITH BUDGET CALCULATIONS
    //budget remain and status alert for category_budget account type
    if (account_type_name.trim().toLowerCase() === 'category_budget') {
      const { remain, statusAlert } = calculateBudgetMetrics(
        parseFloat(data.accountList[0].account_balance),
        parseFloat(data.accountList[0].budget),
      );

      data.accountList[0].remain = remain;
      data.accountList[0].statusAlert = statusAlert;

      // console.log('remain and statusAlert',data.accountList[0].remain, data.accountList[0].statusAlert,'data', data )
    }
    //----------------------------
    // 🎯 ENRICH A CASH-HOLDING ACCOUNT WITH ITS POCKET COMMITMENTS
    //
    // account_balance stays what it has always been: real money, the figure that
    // ties to the bank statement. What is added beside it is how much of that
    // money is committed to pockets and how much is not, plus the goals it backs.
    //
    // The remainder is unassignedCash and never "available balance": a pocket
    // blocks no spend, the available balance is still the whole account_balance,
    // and calling the remainder available would tell the owner they cannot spend
    // money they can. It may be negative, which is a state the screen reports and
    // does not correct.
    //
    // Null for every other account type, and the three lines are simply absent
    // there: unassigned cash means nothing on an investment account whose balance
    // is a market valuation, nor on a debtor account.
    const pocketAllocation =
      await accountAllocationService.getAccountAllocation(
        pool,
        userId,
        data.accountList[0].account_id,
        account_type_name,
      );

    if (pocketAllocation) {
      data.accountList[0].allocated = pocketAllocation.allocated;
      data.accountList[0].unassignedCash = pocketAllocation.unassignedCash;
      data.accountList[0].isOverAllocated = pocketAllocation.isOverAllocated;
      data.accountList[0].pockets = pocketAllocation.pockets;
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
        pc[errorColor]('Unknown error occurred'),
      );
    }
    // Manejo de errores de PostgreSQL / pgsql error handling
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
}; //End of getAccountById

//*********************************
// 🆕 ENDPOINT: GET CATEGORY BUDGET FULL DATA
export const getCategoryBudgetFullDataEndpoint = async (req, res, next) => {
  console.log(pc[backendColor]('getCategoryBudgetFullDataEndpoint'));

  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { accountId } = req.params;
    if (!accountId) {
      const message = `Account ID is required`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    // 🎯 VERIFY ACCOUNT EXISTS AND IS CATEGORY_BUDGET
    const accountsResult = await pool.query({
      text: `
     SELECT act.account_type_name
     FROM user_accounts ua
     JOIN account_types act ON act.account_type_id = ua.account_type_id
     WHERE ua.account_id = $1 AND ua.user_id = $2`,
      values: [accountId, userId],
    });

    if (!accountsResult.rows.length) {
      return res
        .status(404)
        .json({ status: 404, message: 'Account not found' });
    }

    const account_type_name = accountsResult.rows[0].account_type_name;

    if (account_type_name !== 'category_budget') {
      return res.status(400).json({
        status: 400,
        message: 'This endpoint is only for category_budget accounts',
      });
    }

    // 🎯 USE EXISTING LOGIC TO GET COMPLETE DATA
    const fullDataCategoryAccount = await getCategoryBudgetFullData(
      userId,
      accountId,
    );
    //---------------------------------
    console.log('full data endpoint', fullDataCategoryAccount);
    //---------------------------------
    const message = `Category budget full data retrieved successfully`;
    console.log('success:', pc[backendColor](message));

    return res.status(200).json({
      status: 200,
      message,
      data: fullDataCategoryAccount,
    });
  } catch (error) {
    console.error(pc.red('Error in getCategoryBudgetFullDataEndpoint:'), error);

    if (error.message === 'Category budget account not found') {
      return res.status(404).json({ status: 404, message: error.message });
    }

    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
}; //End of getCategoryBudgetFullDataEndpoint

//**********************************
//GET ALL ACCOUNTS OF A CATEGORY BY CATEGORY_NAME
//endpoint example: http://localhost:5000/api/fintrack/budget/category/${category_name}?&user=${user}

//example of route:http://localhost:5173/fintrack/budget/category/${category_name}

export const getAccountsByCategory = async (req, res, next) => {
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
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { categoryName } = req.params;

    if (!categoryName) {
      const message = `Category name is required.`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }
    //------------------------------------
    //--GET ACCOUNTS INFO BY CATEGORY NAME
    const accountsResult = await pool.query({
      text: `SELECT ua.*, ${DERIVED_BALANCE} AS account_balance, CAST(ua.Account_starting_amount AS FLOAT), cba.*,CAST(cba.budget AS FLOAT),
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

    if (!accountsResult || accountsResult.rows.length === 0) {
      const message = `No accounts of cateogry ${categoryName} were found`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    // console.log('accounts', accountsResult.rows[0])

    const accountListResult = accountsResult;

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
        pc[errorColor]('Unknown error occurred'),
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
}; //End of getAccountsByCategory

/*
/*
example response of getAccountByCategory (with FX metadata)
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
        "currency_id": 1,
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
        "category_nature_type_name": "must",
        "transactions": {
          "totalTransactions": 5,
          "summary": {
            "initialBalance": {
              "amount": 1010.55,
              "date": "2025-06-15T22:40:50.140Z",
              "currency": "usd"
            },
            "finalBalance": {
              "amount": 902.55,
              "currency": "usd",
              "date": "2025-06-16T00:55:12.445Z"
            },
            "periodStartDate": "2025-05-18",
            "periodEndDate": "2025-06-18"
          },
          "transactions": [
            {
              "transaction_id": 23,
              "user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
              "description": "Grocery Store",
              "amount": 25.00,
              "movement_type_id": 1,
              "transaction_type_id": 1,
              "currency_id": 1,
              "account_id": 21,
              "account_balance_after_tr": 902.55,
              "source_account_id": 21,
              "destination_account_id": 27,
              "status": "complete",
              "transaction_actual_date": "2025-06-16T00:55:12.445Z",
              "created_at": "2025-06-16T04:55:13.424Z",
              "updated_at": "2025-06-16T04:55:13.424Z",
              "movement_type_name": "expense",
              "currency_code": "usd",
              "original_amount": "100000.00",
              "original_currency_code": "cop",
              "exchange_rate": "0.00025000",
              "exchange_rate_source": "exchange-rate-api",
              "exchange_rate_timestamp": "2026-06-10T12:00:00.000Z"
            }
          ]
        }
      }
    ]
  }
}
*/
