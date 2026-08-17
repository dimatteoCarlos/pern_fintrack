// ==============================
// Module: getTransactionsForAccountById
// Path: /fintrack/controllers/getTransactionsForAccountById.js
// Purpose: Handles transactions by account id queries for the account detail
// ==============================
import pc from 'picocolors';
import { createError, handlePostgresError } from '../../utils/errorHandling.js';
import { pool } from '../../db/config/configDB.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import { extractNoteFromDescription } from '../../utils/fintrackUtils/transactionManagement/extractNoteFromDescription.js';

// A month, as YYYY-MM or YYYY-MM-DD. The day is accepted and discarded.
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/;

// The two labels the period line renders, from the month text alone.
//
// The Date is built and read entirely in UTC and never meets an instant: it
// produces two display strings and nothing else. That is why it cannot shift a
// day the way a local getter over a UTC-parsed date does.
const monthBounds = (month) => {
  const [year, index] = month.split('-').map(Number);
  return {
    periodStartDate: month,
    periodEndDate: new Date(Date.UTC(year, index, 0)).toISOString().split('T')[0],
  };
};

export const getTransactionsForAccountById = async (req, res, next) => {
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
        process.env.NODE_ENV === 'development' ? console.log(error.stack) : '',
      );
      throw error;
    }
  };
  // --- End Helper Functions ---

  //controller module
  try {
    //validation of input data
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { accountId } = req.params;
    if (!accountId) {
      const message = `Account ID is required.`;
      console.warn(pc[backendColor](message));
      return RESPONSE(res, 400, message);
    }
    //==================================
    //check the user id and the account id relationship
    const ACCOUNT_INFO_QUERY = {
      text: `
    SELECT 
      ua.account_starting_amount, ua.account_start_date, cr.currency_code, ua.currency_id 
    FROM user_accounts ua
    JOIN
     currencies cr ON ua.currency_id = cr.currency_id
    WHERE
     ua.account_id = $1 AND ua.user_id = $2 LIMIT 1`,
      values: [accountId, userId],
    };

    const accountInfoNeededResult = await queryFn(
      ACCOUNT_INFO_QUERY.text,
      ACCOUNT_INFO_QUERY.values,
    );

    if (accountInfoNeededResult.length === 0) {
      const message =
        'The specified account does not belong to the user or does not exist.';
      console.warn(pc[backendColor](message));

      return RESPONSE(res, 403, message); //access forbidden
    }
    //-------------------------------
    //date period
    //
    // The window can be named two ways, and they are not two flavours of the
    // same thing:
    //
    //  - month  resolves on the ACCOUNT OWNER's calendar, so the rows agree with
    //           the monthly budget figures shown above them. Only the budget
    //           screen sends it.
    //  - start/end is the legacy path. Pocket, Debtor and Account detail all
    //           send a two-month window built from the BROWSER's clock, and
    //           those are not monthly domains — a savings pocket's history is a
    //           continuum. It stays until those three screens are revisited.
    //
    // Legacy note: on the start/end path initialBalance is NOT the balance at
    // the start of the window. It reads account_balance_before_tr, which is not
    // a column anywhere, so the || always falls through to the account's opening
    // amount. Left in place deliberately: fixing it here would silently change
    // what three screens outside budget display.
    const { start, end, month } = req.query;

    // Explicit over silent precedence: a request naming both windows has not
    // decided which one it means.
    if (month && (start || end)) {
      return RESPONSE(
        res,
        400,
        'Send either month or start/end, not both.',
      );
    }

    let window;

    if (month) {
      if (!MONTH_PATTERN.test(month)) {
        return RESPONSE(res, 400, 'Invalid month format. Use YYYY-MM.');
      }
      window = {
        mode: 'month',
        month: `${month.slice(0, 7)}-01`,
        timeZone: await getUserTimeZone(pool, userId),
      };
    } else {
      const today = new Date();
      today.setHours(23, 59, 59, 999); //end of today

      const _daysAgo = new Date(today);
      _daysAgo.setDate(today.getDate() - 30);
      _daysAgo.setHours(0, 0, 0, 0); //start of the day

      const daysAgoDate = _daysAgo.toISOString();
      const startDate = new Date(start || daysAgoDate);
      const endDate = new Date(end || today.toISOString());

      // Date validation - check if a helper exists
      if (isNaN(startDate.getTime())) {
        return RESPONSE(res, 400, 'Invalid start date format. Use YYYY-MM-DD.');
      }
      if (isNaN(endDate.getTime())) {
        return RESPONSE(res, 400, 'Invalid end date format. Use YYYY-MM-DD.');
      }

      window = { mode: 'range', startDate, endDate };
    }
    //-------------------------------
    //--main query for transactions by account_id and user_id getting account_balance_after_tr
    //--rule: there must exist at least one transaction (account-opening). It should not be possible for an account to exist without this single recorded transaction
    const TRANSACTIONS_BY_ACCOUNT_QUERY = {
      text: `
      SELECT
        tr.*, mt.movement_type_name, cr.currency_code, ua.account_name, CAST(ua.account_starting_amount AS FLOAT), ua.account_start_date,
        -- The day the owner lived, not the day UTC saw. COALESCE mirrors the
        -- WHERE below, which also admits a row by created_at alone.
        (COALESCE(tr.transaction_actual_date, tr.created_at)
          AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date::text AS transaction_local_date
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
      -- Joined rather than read with getUserTimeZone: the zone is one column of
      -- a row this statement already reaches, and the month branch only calls
      -- that helper because it needs the zone in JavaScript to build its bounds.
      LEFT JOIN
        users u ON u.user_id = ua.user_id
      WHERE
        tr.account_id = $1 AND ua.user_id = $2 AND (tr.transaction_actual_date BETWEEN $3 AND $4 OR
       tr.created_at BETWEEN $3 AND $4)

      ORDER BY
       tr.transaction_actual_date DESC , tr.created_at DESC
       `,
      values: [accountId, userId, window.startDate, window.endDate],
    };

    // The same rows, for one calendar month on the owner's calendar. Written as
    // a second query rather than as fragments spliced into the one above: two
    // whole statements can be read and compared, a template with holes cannot.
    //
    // Three deliberate differences from the legacy query:
    //
    //  1. No `OR tr.created_at BETWEEN`. That clause lets in a transaction dated
    //     in July but recorded in August, and the budget's spent figure — which
    //     filters on transaction_actual_date alone — excludes it. The list and
    //     the card above it would disagree by that row.
    //  2. R42 bounds. Exactly one AT TIME ZONE per direction: the bounds go
    //     local month boundary -> instant, and transaction_local_date goes
    //     instant -> local date. ::timestamp on the lower bound is load-bearing,
    //     as it is in the budget module: with a bare date, AT TIME ZONE picks
    //     the TIMESTAMPTZ overload and converts the bound the wrong way. The
    //     upper bound needs no cast, `date + interval` is already a TIMESTAMP.
    //  3. A running total. OVER(...) orders ASC while the result set is returned
    //     DESC — the two orderings are independent, so each row carries the
    //     total up to and including itself chronologically while the list still
    //     renders newest first. Only movement types 1 and 6 add to it, the same
    //     set the budget counts, so a row of any other type is listed without
    //     moving the total.
    const TRANSACTIONS_BY_MONTH_QUERY = {
      text: `
      SELECT
        tr.*, mt.movement_type_name, cr.currency_code, ua.account_name, CAST(ua.account_starting_amount AS FLOAT), ua.account_start_date,
        (tr.transaction_actual_date AT TIME ZONE $4)::date::text AS transaction_local_date,
        CAST(SUM(CASE WHEN tr.movement_type_id IN (1, 6) THEN tr.amount ELSE 0 END)
          OVER (ORDER BY tr.transaction_actual_date ASC, tr.transaction_id ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS FLOAT) AS month_cumulative_spent
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
        tr.account_id = $1 AND ua.user_id = $2
        AND tr.transaction_actual_date >= ($3::timestamp AT TIME ZONE $4)
        AND tr.transaction_actual_date <  (($3::date + INTERVAL '1 month') AT TIME ZONE $4)
      ORDER BY
       tr.transaction_actual_date DESC , tr.created_at DESC
       `,
      values: [accountId, userId, window.month, window.timeZone],
    };

    const QUERY =
      window.mode === 'month'
        ? TRANSACTIONS_BY_MONTH_QUERY
        : TRANSACTIONS_BY_ACCOUNT_QUERY;

    const transactions = await queryFn(QUERY.text, QUERY.values);

    // Función para formatear fechas consistentemente/consistent date format
    const formatDate = (date) => date.toISOString().split('T')[0];

    // The period labels: the month's own bounds, or the requested range.
    const period =
      window.mode === 'month'
        ? monthBounds(window.month)
        : {
            periodStartDate: formatDate(window.startDate),
            periodEndDate: formatDate(window.endDate),
          };

    // The last balance known BEFORE the month, with the date it was struck.
    //
    // A month with no movements is not a month with no money. Reporting the
    // account's opening amount on a fabricated boundary date, which is what the
    // legacy branch does, tells the user something that never happened; the
    // balance they actually carried into the month is the one left by the last
    // transaction before it.
    const getBalanceCarriedIntoMonth = async () => {
      const PRIOR_BALANCE_QUERY = {
        text: `
      SELECT
        CAST(tr.account_balance_after_tr AS FLOAT) AS balance,
        (tr.transaction_actual_date AT TIME ZONE $3)::date::text AS local_date,
        cr.currency_code
      FROM
        transactions tr
      JOIN
        currencies cr ON cr.currency_id = tr.currency_id
      WHERE
        tr.account_id = $1
        AND tr.transaction_actual_date < ($2::timestamp AT TIME ZONE $3)
      ORDER BY
        tr.transaction_actual_date DESC, tr.transaction_id DESC
      LIMIT 1`,
        values: [accountId, window.month, window.timeZone],
      };

      const [prior] = await queryFn(
        PRIOR_BALANCE_QUERY.text,
        PRIOR_BALANCE_QUERY.values,
      );

      // No transaction before the month means the account had not moved yet, so
      // its opening amount and its start date ARE the real answer here.
      if (!prior) {
        return {
          amount: parseFloat(accountInfoNeededResult[0].account_starting_amount),
          currency: accountInfoNeededResult[0].currency_code,
          date: formatDate(
            new Date(accountInfoNeededResult[0].account_start_date),
          ),
        };
      }

      return {
        amount: prior.balance,
        currency: prior.currency_code,
        date: prior.local_date,
      };
    };

    //NO TRANSACTIONS
    if (transactions.length === 0) {
      // Both balances are the same figure: nothing moved, so nothing changed.
      const carried =
        window.mode === 'month'
          ? await getBalanceCarriedIntoMonth()
          : {
              amount: parseFloat(
                accountInfoNeededResult[0].account_starting_amount,
              ),
              currency: accountInfoNeededResult[0].currency_code,
              date: period.periodStartDate,
            };

      const data = {
        totalTransactions: 0,
        summary: {
          initialBalance: carried,
          finalBalance:
            window.mode === 'month'
              ? carried
              : { ...carried, date: period.periodEndDate },
          ...period,
        },
        transactions: [],
      };
      return RESPONSE(
        res,
        200,
        'No transactions found for the selected period',
        data,
      );
    }
    // console.log('transactions',transactions)

    //Funciones para obtener balances usando accountInfoNeededResult ================
    //
    // Both ends name a movement that really happened, and both amounts are the
    // stored account_balance_after_tr of that movement — an audit fact written
    // at transaction time, never re-derived here. The rows arrive newest first,
    // so the last element is the month's first transaction.
    //
    // "Initial" is therefore the balance left BY the month's first movement, not
    // the one carried into the month. V1 decision 45: every figure on this panel
    // has to be a row that exists, and no stored column holds the balance before
    // a transaction.
    //
    // The range branch is the legacy one, unchanged including its defect: it
    // reads a column that does not exist, so it always reports the account's
    // opening amount on the window's start date. Three screens outside budget
    // display that today and this commit does not move them.
    const getInitialBalance = () => {
      const oldestTransaction = transactions[transactions.length - 1];

      if (window.mode !== 'month') {
        return {
          amount: parseFloat(
            oldestTransaction.account_balance_before_tr ||
              accountInfoNeededResult[0].account_starting_amount,
          ),
          currency: oldestTransaction.currency_code,
          date: formatDate(window.startDate),
        };
      }

      return {
        amount: parseFloat(oldestTransaction.account_balance_after_tr),
        currency: oldestTransaction.currency_code,
        date: oldestTransaction.transaction_local_date,
      };
    };

    const getFinalBalance = () => ({
      amount: parseFloat(transactions[0].account_balance_after_tr),
      currency: transactions[0].currency_code,
      date:
        transactions[0].transaction_local_date ??
        formatDate(
          new Date(
            transactions[0].transaction_actual_date ||
              transactions[0].created_at,
          ),
        ),
    });

    // Construir respuesta final
    const data = {
      totalTransactions: transactions.length,
      summary: {
        initialBalance: getInitialBalance(),
        finalBalance: getFinalBalance(),
        ...period,
      },
      // The note, split out of the narrative by the side that composes it.
      // description travels untouched beside it: the detail modal shows the
      // sentence in full, and only the rows show the note alone.
      transactions: transactions.map((transaction) => ({
        ...transaction,
        note: extractNoteFromDescription(transaction.description),
      })),
    };

    return RESPONSE(
      res,
      200,
      `${transactions.length} transaction(s) found`,
      data,
    );
  } catch (error) {
    const generalmessage = `Error while getting transactions for account id ${req.params.accountId}`;
    console.error(pc.red(generalmessage), error);

    if (error instanceof Error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(error.stack);
      }
    } else {
      console.error(
        pc.red('Error during getting transactions by account ID'),
        pc[errorColor]('Unknown error occurred'),
      );
    }
    // PostgreSQL error handling
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
