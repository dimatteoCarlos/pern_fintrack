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
import {
  dayInZone,
  isCalendarDate,
  resolveZonedWindow,
  todayInZone,
} from '../../utils/fintrackUtils/date-utils/resolveZonedWindow.js';
import { extractNoteFromDescription } from '../../utils/fintrackUtils/transactionManagement/extractNoteFromDescription.js';
import {
  accountLedgerCte,
  withDerivedBalance,
} from '../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

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

// The stretch of the month this account actually spans.
//
// A statement is bounded by the life of the thing it reports on. The month's own
// bounds open before the account existed for the month it was created in, and
// close on a day that has not happened for the month in course — and the panel
// then contradicts itself, heading balances dated the 20th with a period running
// to the 31st.
//
// Both sides are YYYY-MM-DD, so the comparisons are lexicographic and correct.
const clampToAccountLife = (bounds, accountStartDay, today) => ({
  periodStartDate:
    bounds.periodStartDate < accountStartDay
      ? accountStartDay
      : bounds.periodStartDate,
  periodEndDate: bounds.periodEndDate > today ? today : bounds.periodEndDate,
});

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
    // Both paths report a period bounded by the life of the account and an
    // initial balance dated by something that happened. What still differs is
    // which figure "initial" names, and the comment above getInitialBalance says
    // why the window decides that.
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
      // Refused rather than coerced. new Date() accepted an ISO instant, and
      // casting one to a date resolves it in the session's zone, which is the
      // thing this branch stopped doing.
      if ((start && !isCalendarDate(start)) || (end && !isCalendarDate(end))) {
        return RESPONSE(res, 400, 'Invalid date format. Use YYYY-MM-DD.');
      }

      // Resolved in the owner's zone, like the month branch above. What this
      // replaces built both bounds from new Date(), so the thirty days it
      // answered for belonged to whatever zone the server happened to run in.
      window = {
        mode: 'range',
        ...resolveZonedWindow({
          start,
          end,
          timeZone: await getUserTimeZone(pool, userId),
        }),
      };
    }

    // The period this screen states. Resolved here and not beside the response
    // so a window the account cannot report on is refused before the queries run.
    //
    // Both paths are bounded now. A continuum needs it as much as a month does:
    // the start/end window comes from the browser's clock, so it opened a
    // pocket's period before the pocket existed and closed it on a day that has
    // not happened.
    const accountStartDay = dayInZone(
      accountInfoNeededResult[0].account_start_date,
      window.timeZone,
    );

    let period;

    if (window.mode === 'month') {
      period = clampToAccountLife(
        monthBounds(window.month),
        accountStartDay,
        todayInZone(window.timeZone),
      );

      // The two bounds crossed: the month falls entirely before the account was
      // opened, or entirely ahead of today. Neither is a statement this account
      // can produce, and answering 200 with zeroes is what printed a January
      // period over balances dated in August.
      if (period.periodStartDate > period.periodEndDate) {
        return RESPONSE(
          res,
          422,
          `This account has no statement for ${window.month.slice(0, 7)}. It was opened on ${accountStartDay}.`,
        );
      }
    } else {
      // The clamp bounds what is REPORTED, not what is queried: no row can be
      // dated outside the life of its account, so narrowing the WHERE below
      // would exclude nothing and would touch a statement that works.
      period = clampToAccountLife(
        {
          periodStartDate: window.startDate,
          periodEndDate: window.endDate,
        },
        accountStartDay,
        todayInZone(window.timeZone),
      );

      // Same crossing as the month branch: a window lying entirely before the
      // account was opened is not a statement this account can produce.
      if (period.periodStartDate > period.periodEndDate) {
        return RESPONSE(
          res,
          422,
          `This account has no statement for ${window.startDate} to ${window.endDate}. It was opened on ${accountStartDay}.`,
        );
      }
    }
    //-------------------------------
    //--main query for transactions by account_id and user_id, with the balance derived from the ledger
    //--rule: there must exist at least one transaction (account-opening). It should not be possible for an account to exist without this single recorded transaction
    const TRANSACTIONS_BY_ACCOUNT_QUERY = {
      text: `
      WITH ${accountLedgerCte('$1')}
      SELECT
        tr.*, mt.movement_type_name, cr.currency_code, ua.account_name, CAST(ua.account_starting_amount AS FLOAT), ua.account_start_date,
        -- The balance derived from the ledger, replacing the stored column that
        -- tr.* still ships. It is renamed onto that column's key in JavaScript,
        -- so the stale figure never reaches the response.
        al.balance AS derived_balance_after_tr,
        -- The day the owner lived, not the day UTC saw. COALESCE mirrors the
        -- WHERE below, which also admits a row by created_at alone.
        (COALESCE(tr.transaction_actual_date, tr.created_at)
          AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date::text AS transaction_local_date,
        -- The hour of that same day, on that same calendar. The row used to
        -- carry the day alone, so a list showing a time had to read the raw
        -- instant on the reader's clock and could disagree with its own date.
        to_char(
          COALESCE(tr.transaction_actual_date, tr.created_at)
            AT TIME ZONE COALESCE(u.timezone, 'UTC'),
          'HH24:MI'
        ) AS transaction_local_time
      FROM
        transactions tr
      JOIN
        account_ledger al ON al.transaction_id = tr.transaction_id
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
        tr.account_id = $1 AND ua.user_id = $2
        AND (
          (tr.transaction_actual_date >= ($3::timestamp AT TIME ZONE $5)
            AND tr.transaction_actual_date <
              (($4::date + INTERVAL '1 day') AT TIME ZONE $5))
          OR
          (tr.created_at >= ($3::timestamp AT TIME ZONE $5)
            AND tr.created_at < (($4::date + INTERVAL '1 day') AT TIME ZONE $5))
        )

      ORDER BY
       tr.transaction_actual_date DESC , tr.created_at DESC
       `,
      values: [accountId, userId, window.startDate, window.endDate, window.timeZone],
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
    //     moving the total. That counted set is a category's spend and nothing
    //     else — on a pocket it would sit at zero and on a bank it would
    //     undercount — so the figure is served on category_budget alone and
    //     left NULL everywhere else. An absent figure beats a false zero.
    const TRANSACTIONS_BY_MONTH_QUERY = {
      text: `
      WITH ${accountLedgerCte('$1')}
      SELECT
        tr.*, mt.movement_type_name, cr.currency_code, ua.account_name, CAST(ua.account_starting_amount AS FLOAT), ua.account_start_date,
        -- Derived over the account's whole life, not over this month: a window
        -- function sees only the rows its own query returns, so anchoring the
        -- series here would restart the balance at each month.
        al.balance AS derived_balance_after_tr,
        (tr.transaction_actual_date AT TIME ZONE $4)::date::text AS transaction_local_date,
        -- The hour of that same day, on that same calendar. Same pair the
        -- transaction detail already serves.
        to_char(
          tr.transaction_actual_date AT TIME ZONE $4,
          'HH24:MI'
        ) AS transaction_local_time,
        CASE WHEN act.account_type_name = 'category_budget' THEN
          CAST(SUM(CASE WHEN tr.movement_type_id IN (1, 6) THEN tr.amount ELSE 0 END)
            OVER (ORDER BY tr.transaction_actual_date ASC, tr.transaction_id ASC
                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS FLOAT)
        END AS month_cumulative_spent
      FROM
        transactions tr
      JOIN
        account_ledger al ON al.transaction_id = tr.transaction_id
      JOIN
        movement_types mt ON tr.movement_type_id = mt.movement_type_id
      JOIN
        currencies cr  ON tr.currency_id = cr.currency_id
      JOIN
        user_accounts ua ON tr.account_id = ua.account_id
      JOIN
        transaction_types trt ON tr.transaction_type_id= trt.transaction_type_id
      -- LEFT so a row whose account type is missing still lists, without the
      -- figure. account_type_id is nullable on user_accounts.
      LEFT JOIN
        account_types act ON act.account_type_id = ua.account_type_id
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

    // The derived figure takes over the key the stored column shipped under, so
    // the wire contract is unchanged and no frontend file moves.
    const transactions = withDerivedBalance(
      await queryFn(QUERY.text, QUERY.values),
    );

    // Función para formatear fechas consistentemente/consistent date format
    const formatDate = (date) => date.toISOString().split('T')[0];

    // The last balance known BEFORE the boundary, with the date it was struck.
    //
    // A period with no movements is not a period with no money, and the balance
    // carried in is the one the last transaction before the boundary left.
    //
    // The boundary is a parameter because both windows have one: the month's
    // first day, or the clamped start of the range.
    const getBalanceCarriedIntoPeriod = async (boundaryDay) => {
      // Both outcomes are computed in one statement, and the no-movement case is
      // a COALESCE rather than a branch in JavaScript. It used to be a branch,
      // and it dated the carried-in balance with a UTC slice of the account's
      // opening timestamp while everything around it went through the owner's
      // zone — which put a balance on a day AFTER the period it opens: a window
      // clamped to 14-08 reading "Initial Balance (15-08)" underneath it. There
      // is now no JavaScript date path left here to get wrong.
      const PRIOR_BALANCE_QUERY = {
        text: `
      WITH ${accountLedgerCte('$1')},
      prior AS (
        SELECT
          al.balance,
          (tr.transaction_actual_date AT TIME ZONE $3)::date::text AS local_date
        FROM
          transactions tr
        JOIN
          account_ledger al ON al.transaction_id = tr.transaction_id
        WHERE
          tr.account_id = $1
          AND tr.transaction_actual_date < ($2::timestamp AT TIME ZONE $3)
        ORDER BY
          tr.transaction_actual_date DESC, tr.transaction_id DESC
        LIMIT 1
      )
      SELECT
        COALESCE(
          (SELECT balance FROM prior),
          CAST(ua.account_starting_amount AS FLOAT)
        ) AS balance,
        COALESCE(
          (SELECT local_date FROM prior),
          (ua.account_start_date AT TIME ZONE $3)::date::text
        ) AS local_date
      FROM
        user_accounts ua
      WHERE
        ua.account_id = $1`,
        values: [accountId, boundaryDay, window.timeZone],
      };

      const [prior] = await queryFn(
        PRIOR_BALANCE_QUERY.text,
        PRIOR_BALANCE_QUERY.values,
      );

      return {
        amount: prior.balance,
        currency: accountInfoNeededResult[0].currency_code,
        date: prior.local_date,
      };
    };

    //NO TRANSACTIONS
    if (transactions.length === 0) {
      // Both balances are the same figure AND the same date: nothing moved, so
      // nothing changed, and re-dating the closing one to the period's edge
      // would put a balance on a day no movement touched.
      const carried = await getBalanceCarriedIntoPeriod(period.periodStartDate);

      const data = {
        totalTransactions: 0,
        summary: {
          initialBalance: carried,
          finalBalance: carried,
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
    // One definition of "initial", for both windows: the balance carried INTO the
    // period, read from the movement before the boundary.
    //
    // The month branch used to report the balance left BY the month's first
    // movement, on the ground that no column holds the balance before a
    // transaction. That ground is gone — the ledger CTE derives it, which is how
    // the range branch has been answering the same question all along. The two
    // definitions made the panel contradict itself: an initial balance that
    // already contained the month's first movement never adds up to the final one
    // with the movements listed between them.
    //
    // Both ends take their currency from the account and never from the row that
    // produced the figure. A balance is denominated in the accounting currency of
    // its account; a movement carries the currency it was typed in on its FX
    // columns, and asking it instead let the two halves of the panel disagree —
    // measured as "$0.00" over "COP 0.00" on a pocket whose opening row had been
    // written with the typed currency.
    const getInitialBalance = () =>
      getBalanceCarriedIntoPeriod(period.periodStartDate);

    const getFinalBalance = () => ({
      amount: parseFloat(transactions[0].account_balance_after_tr),
      currency: accountInfoNeededResult[0].currency_code,
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
        initialBalance: await getInitialBalance(),
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
