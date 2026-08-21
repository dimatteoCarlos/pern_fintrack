//backend/src/fintrack_api/controllers/dashboardMonthlyTotalAmountByType.js
//======================================
//GET TOTAL AND AVERAGE of MONTH transactions FOR CATEGORIES (expenses) AND INCOMES (income source)
//get the total and monthly average amount for category expense accounts and income from source accounts
//rules: the time period considered is the current year from january the first to december the 31st or till today.
//---------------------------------------
//COMENTARIOS AL MARGEN: alternative: se puede hacer el promedio mensual durante un periodo dado, independientement de la cantidad de años reportados.
//aunque se requiere solo los valores de promedio mensual del total de los gastos, se hara un procedimiento donde se obtenga primero los gastos por mes por cada cuenta o categoria, y luego con estos datos se calculan los valores agregados o totales. los valores por mes pueden servir de insumo para realizar graficos de gastos por mes.
//---------------------------------------
// router.get('/balance/monthly_total_amount_by_type/?type=${type}&', dashboardMonthlyTotalAmountByType);
//get: //http://localhost:5000/api/fintrack/dashboard/balance/monthly_total_amount_by_type/?type=${type}
import { createError, handlePostgresError } from '../../utils/errorHandling.js';
import pc from 'picocolors';
import { pool } from '../../db/config/configDB.js';
import { validate as uuidValidate } from 'uuid';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import {
  isCalendarDate,
  todayInZone,
} from '../../utils/fintrackUtils/date-utils/resolveZonedWindow.js';

/**
 * The year's total for each movement type, served rather than folded.
 *
 * The rule the budget module holds (§10.8.3) is that the client never sums a
 * total it was not given: a figure folded on screen and the same figure served
 * by the backend end up a cent apart. Overview already asks for this payload,
 * so the yearly figure rides in it and costs no request.
 *
 * Currencies are not converted, for the reason makeTotals refuses to: adding
 * USD to COP is a conversion at an implicit rate of 1:1. A type whose rows span
 * more than one currency reports null, and the months underneath keep their own
 * amounts, so nothing is lost except the bad addition.
 *
 * The amounts arrive as FLOAT from the query, so the sum is rounded to the two
 * decimals the DECIMAL(15,2) column stores rather than carried at full width.
 */
const makeYearlyTotals = (rows) => {
  const byType = {};

  for (const row of rows) {
    const bucket = (byType[row.type] ??= { amount: 0, currencies: new Set() });
    bucket.amount += Number(row.amount) || 0;
    bucket.currencies.add(row.currency_code);
  }

  return Object.fromEntries(
    Object.entries(byType).map(([type, { amount, currencies }]) => [
      type,
      currencies.size === 1
        ? {
            amount: Math.round(amount * 100) / 100,
            currency: [...currencies][0],
          }
        : { amount: null, currency: null },
    ]),
  );
};

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
  const userId = requireUserId(req, res);
  if (!userId) return;
  // if (!['expense', 'income', 'saving'].includes(movement_type)) {
  //   const msg = 'Movement type must be expense, income or saving';
  //   return RESPONSE(res, 400, msg);
  // }
//this is an assertion to ensure that the userId is a valid UUID format. If not, it returns a 400 response with an error message.
  if (!uuidValidate(userId)) {
    const msg = 'Invalid user ID format';
    return RESPONSE(res, 400, msg);
  }

  //time period to evaluate
  // The year the owner is living, not the one the server's clock reads. On the
  // night of 31 December those are two different years, and every month this
  // endpoint reports is a month of one of them.
  const timeZone = await getUserTimeZone(pool, userId);

  if (startDate && endDate && !(isCalendarDate(startDate) && isCalendarDate(endDate))) {
    // Refused rather than coerced: new Date() accepted an ISO instant, and
    // casting one to a date resolves it in the session's zone, which is the
    // very thing this endpoint stopped doing.
    return RESPONSE(res, 400, 'Invalid date format. Use YYYY-MM-DD');
  }

  const currentYear = todayInZone(timeZone).slice(0, 4);

  // Two calendar dates, never instants. The query turns them into instants
  // with one AT TIME ZONE per bound.
  const dateRange =
    startDate && endDate
      ? { start: startDate, end: endDate }
      : { start: `${currentYear}-01-01`, end: `${currentYear}-12-31` };
  //-----get expense, saving or income data by month and currency --------
  //functions definition
  async function getFinancialData(userId) {
    //rules: withdrawed amount from income source accounts represents income deposited to bank accounts.
    //deposited amount in category budget account, represents an expense, withdrawed from a bank account
    //deposit amount in pocket saving account, represents a saving contribution, withdrawed from a bank account, but it is possible to withdraw from pockets too, so this would measured the contribution to saving but no the balance of total saved in the period

    try {
      const queryText = `
     WITH financial_data AS (
      SELECT CAST(EXTRACT(MONTH FROM (tr.transaction_actual_date AT TIME ZONE $4)) AS INTEGER) AS month_index,
          TRIM(TO_CHAR((tr.transaction_actual_date AT TIME ZONE $4), 'month')) AS month_name,
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
            AND tr.transaction_actual_date >= ($2::timestamp AT TIME ZONE $4)
            AND tr.transaction_actual_date <
              (($3::date + INTERVAL '1 day') AT TIME ZONE $4)
            AND (
              (tr.movement_type_id = 1 AND tr.transaction_type_id = 2) -- Expense
              OR
              (tr.movement_type_id = 2 AND tr.transaction_type_id = 1) -- Income
              OR
              (tr.movement_type_id = 5 AND tr.transaction_type_id = 2) -- Saving
            )
              
        GROUP BY 
            EXTRACT(MONTH FROM (tr.transaction_actual_date AT TIME ZONE $4)),
            TO_CHAR((tr.transaction_actual_date AT TIME ZONE $4), 'month'),
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
        timeZone,
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
      dateRange.end,
    );

    if (dataArr.length === 0) {
      const message = `No financial data available`;
      console.warn(pc[backendColor](message));
      return RESPONSE(res, 400, message);
    }

    const responseData = {
      // Calendar dates and no longer instants. DateRange on the client is
      // typed string | Date, so YYYY-MM-DD satisfies it, and no screen reads
      // this field today.
      dateRange: {
        start: dateRange.start,
        end: dateRange.end,
      },
      // currency: dataArr.length > 0 ? dataArr[0].currency_code : 'usd', //Asume USD by default

      monthlyAmounts: dataArr,

      // The year's figure for each type, so Overview can print it without
      // summing the twelve months itself.
      yearlyTotals: makeYearlyTotals(dataArr),
    };
    return RESPONSE(
      res,
      200,
      'Financial data retrieved successfully',
      responseData,
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        pc.red(
          `Error while getting monthly total amount from movement ${movement_type}`,
        ),
      );
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
  }
};
