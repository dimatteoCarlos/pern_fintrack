//backend/src/fintrack_api/controllers/dashboardMonthlyTotalAmountByType.js
//======================================
//GET TOTAL AND AVERAGE of MONTH transactions FOR CATEGORIES (expenses) AND INCOMES (income source)
//get the total and monthly average amount for category expense accounts and income from source accounts
//rules: the time period considered is the current year from january the first to december the 31st or till today.
//---------------------------------------
//COMENTARIOS AL MARGEN: alternative: se puede hacer el promedio mensual durante un periodo dado, independientement de la cantidad de agnios reportados.
//aunque se requiere solo los valores de promedio mensual del total de los gastos, se hara un procedimiento donde se obtenga primero los gastos por mes por cada cuenta o categoria, y luego con estos datos se calculan los valores agregados o totales. los valores por mes pueden servir de insumo para realizar graficos de gastos por mes.
//---------------------------------------
// router.get('/balance/monthly_total_amount_by_type/?type=${type}&', dashboardMonthlyTotalAmountByType);
//get: //http://localhost:5000/api/fintrack/dashboard/balance/monthly_total_amount_by_type/?type=${type}&user=eacef623-6fb0-4168-a27f-fa135de093e1

import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import pc from 'picocolors';
import { pool } from '../../db/configDB.js';
import { validate as uuidValidate } from 'uuid';

export const dashboardMonthlyTotalAmountByType = async (req, res, next) => {
  //response function
  const backendColor = 'yellow';
  const errorColor = 'red';
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };
  console.log(pc[backendColor]('dashboardMonthlyTotalAmountByType'));
//-----------------------------------------
//params validation
  const { startDate, endDate } = req.query;
  const userId =req.user.userId ||( req.body.user ?? req.query.user); //uuid
// console.log(
//   '🚀 ~ dashboardTotalBalanceAccountByType ~ userId:',
//   userId,
//   req.query,
//   req.body
//   // movement_type
// );
  if (!userId) {
    return RESPONSE(res, 400, 'User ID and account type are required');
  }
// if (!['expense', 'income', 'saving'].includes(movement_type)) {
//   const msg = 'Movement type must be expense, income or saving';
//   return RESPONSE(res, 400, msg);
// }

  if (!uuidValidate(userId)) {
    const msg = 'Invalid user ID format';
    return RESPONSE(res, 400, msg);
  }

//time period to evaluate
  const currentYear = new Date().getFullYear();
  let dateRange = {
    start: new Date(currentYear, 0, 1), //January 1st of the year
    end: new Date(currentYear, 11, 31, 23, 59, 59), //December 31st of the year
  };

  if (startDate && endDate) {
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return RESPONSE(res, 400, 'Invalid date format. Use YYYY-MM-DD');
    }

    dateRange = {
      start: parsedStart,
      end: parsedEnd,
    };
  }
  //-----get expense, saving or income data by month and currency --------
  //functions definition
  async function getFinancialData(userId) {
    //rules: withdrawed amount from income source accounts represents income deposited to bank accounts.
    //deposited amount in category budget account, represents an expense, withdrawed from a bank account
    //deposit amount in pocket saving account, represents a saving contribution, withdrawed from a bank account, but it is possible to withdraw from pockets too, so this would measured the contribution to saving but no the balance of total saved in the period

    try {
    const queryText = `
     WITH financial_data AS (
      SELECT CAST(EXTRACT(MONTH FROM tr.transaction_actual_date) AS INTEGER) AS month_index,
          TRIM(TO_CHAR(tr.transaction_actual_date, 'month')) AS month_name,
          tr.movement_type_id,
          tr.transaction_type_id,
          COALESCE(cba.category_name, ua.account_name) AS name,
          CAST(SUM(tr.amount) AS FLOAT) AS amount,
          ct.currency_code, 

        CASE
            WHEN tr.movement_type_id = 1 AND tr.transaction_type_id = 2  THEN 'expense'
            WHEN tr.movement_type_id = 2 AND tr.transaction_type_id = 1  THEN 'income'
            WHEN tr.movement_type_id = 5 AND tr.transaction_type_id = 2  THEN 'saving'
            ELSE 'other'
          END AS type

        FROM transactions tr
          LEFT JOIN category_budget_accounts cba ON tr.account_id = cba.account_id
          LEFT JOIN pocket_saving_accounts psa ON tr.account_id = psa.account_id
          LEFT JOIN user_accounts ua ON tr.account_id = ua.account_id
          JOIN currencies ct ON tr.currency_id = ct.currency_id
      
        WHERE ua.user_id = $1
            AND tr.transaction_actual_date BETWEEN $2 AND $3
            AND (
              (tr.movement_type_id = 1 AND tr.transaction_type_id = 2) -- Expense
              OR
              (tr.movement_type_id = 2 AND tr.transaction_type_id = 1) -- Income
              OR
              (tr.movement_type_id = 5 AND tr.transaction_type_id = 2) -- Saving
            )
              
        GROUP BY 
            EXTRACT(MONTH FROM tr.transaction_actual_date),
            TO_CHAR(tr.transaction_actual_date, 'month'),
            tr.movement_type_id,
            tr.transaction_type_id,
            cba.category_name,
            ua.account_id,
            ct.currency_code
        )
		
        SELECT * FROM financial_data
        ORDER BY month_index ASC, type, name, currency_code
`;
    const result = await pool.query(queryText, [
        userId,
        dateRange.start,
        dateRange.end,
      ]);
    return result.rows;
    } catch (error) {
      console.error('Error fetching financial data:', error);
      throw error;
    }
  } //end of getFinancialData function
//****************************************/
  try {
    const dataArr = await getFinancialData(
      userId,
      dateRange.start,
      dateRange.end
    );

    if (dataArr.length === 0) {
      const message = `No financial data available`;
      console.warn(pc[backendColor](message));
      return RESPONSE(res, 400, message);
    }

    const responseData = {
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
      // currency: dataArr.length > 0 ? dataArr[0].currency_code : 'usd', //Asume USD by default

      monthlyAmounts: dataArr,
    };
    return RESPONSE(
      res,
      200,
      'Financial data retrieved successfully',
      responseData
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        pc.red(
          `Error while getting monthly total amount from movement ${movement_type}`
        )
      );
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
  }
};
