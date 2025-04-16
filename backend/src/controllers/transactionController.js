//transactionController: getTransaction, addTransaction, getDashboardInformation

import { pool } from '../db/configDB.js';
import {
  createError,
  handlePostgresError,
  handlePostgresErrorEs,
} from '../../utils/errorHandling.js';
import { getMonthName, validateAndNormalizeDate } from '../../utils/helpers.js';
import pc from 'picocolors';

//*************/
//getTransaction
//endpoint :  http://localhost:5000/api/transaction/?user=userIdl&startD=sd&endD=ed&search=s&limit=0&offset=0
export const getTransaction = async (req, res, next) => {
  console.log(pc.blueBright('getTransaction'));

  try {
    const today = new Date();
    const _sevenDaysAgo = new Date(today);
    //dateObj.getDate(number): An integer, between 1 and 31, representing the day of the month for the given date according to local time. Returns NaN if the date is invalid.
    _sevenDaysAgo.setDate(today.getDate(-7));

    //The toISOString() method of Date instances returns a string representing this date in the date time string format, a simplified format based on ISO 8601, which is always 24 or 27 characters long (YYYY-MM-DDTHH:mm:ss.sssZ or ±YYYYYY-MM-DDTHH:mm:ss.sssZ, respectively). The timezone is always UTC, as denoted by the suffix Z.
    const sevenDaysAgo = _sevenDaysAgo.toISOString().split('T')[0];
    console.log('🚀 ~ getTransaction ~ sevenDaysAgo:', sevenDaysAgo);

    console.log('req.query;', req.query);
    const { user: userId, startD, endD, search } = req.query;

    // const {userId} = req.body.userId

    const startDate = new Date(startD || sevenDaysAgo);
    const endDate = new Date(endD || today); //dt <= today
    console.log(startDate, endDate, typeof startDate);
    /*%: Es un comodín en SQL que representa cero o más caracteres. Cuando se usa con LIKE, permite buscar patrones parciales. ||: Es el operador de concatenación en PostgreSQL. Se usa para unir cadenas de texto. $4: Representa un parámetro posicional (en este caso, el cuarto parámetro de la consulta).*/

    const transactionsInfoResult = await pool.query({
      text: `SELECT * FROM transactions WHERE user_id=$1
       AND (created_at BETWEEN $2 AND $3 OR transaction_actual_date BETWEEN $2 AND $3 )
      AND (description ILIKE '%'||$4||'%' OR status ILIKE '%'||$4||'%'
       OR CAST(source_account_id AS TEXT) ILIKE '%'||$4||'%' OR CAST(destination_account_id AS TEXT) ILIKE '%'||$4||'%'
       OR  CAST(transaction_type_id AS TEXT) ILIKE '%'||$4||'%' OR status ILIKE '%'||$4||'%'
      ) ORDER BY created_at DESC`,
      values: [userId, startDate, endDate, search],
    });

    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, message: 'User ID is required.' });
    }

    //Successfull response
    const message = `${transactionsInfoResult.rows.length} transaction(s) found`;
    console.warn(pc.blueBright(message));
    return res.status(200).json({
      message,
      data: transactionsInfoResult.rows,
    });
    // }
  } catch (error) {
    console.error(
      pc.redBright('when getting transactions:'),
      error.message || 'something went wrong'
    );
    // Handle PostgreSQL error
    const { code, message } = handlePostgresError(error);
    // Send response to frontend
    return next(createError(code, message));
  }
};
//-----------------------------
//addTransaction
//POST: http://localhost:5000/api/transaction/add-transaction/:account_id?user=430e5635-d1e6-4f53-a104-5575c6e60c81
//add a transaction of a specific account?
//add transaction is a withdraw of any type of account, to any other account

export const addTransaction = async (req, res, next) => {
  console.log(pc.greenBright('addTransaction'));
  const client = await pool.connect(); // Get a client from the pool
  try {
    const { user: userId, account: accountQueryId } = req.query;
    const { account_id: accountParamsId } = req.params;
    const { description, amount, currency, transactionActualDate } = req.body;

    const accountId = accountParamsId ?? accountQueryId; //sorce account or from account

    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, message: 'User ID is required.' });
    }

    //que pasa si el user es undefined o si no existe en las tablas de user? creo que para llegar aqui, deberia pasarse por verifyUser

    // console.log(
    //   '🚀 ~ createAccount ~ accountStartDateNormalized:',
    //   accountStartDateNormalized
    // );

    if (!accountId || !description || !amount) {
      const message = 'Account ID, description  and amount fields are required';
      console.warn(pc.greenBright(message));
      return res.status(400).json({ status: 400, message });
    }

    if (parseFloat(amount) <= 0) {
      const message = 'Amount must be greater than 0';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //Get account info
    const accountResult = await pool.query({
      text: `SELECT  *  FROM user_accounts WHERE account_id = $1`,
      values: [accountId],
    });

    const accountInfo = accountResult.rows[0];
    console.log('accountInfo:', accountInfo);

    if (!accountInfo) {
      const message = 'Invalid account information. Account not found';
      console.warn(pc.redBright(message));
      return res.status(404).json({ status: 404, message });
    }

    //---
    //check for currency
    const currencyCode = currency ?? 'usd';
    const currencyInfoResult = await pool.query({
      text: `SELECT * FROM currencies`,
      values: [],
    });

    const registeredCurrencyInfo = currencyInfoResult.rows;

    const currencyObj = registeredCurrencyInfo.filter(
      (c) => c.currency_code === currencyCode
    )[0];

    if (!currencyObj) {
      const message = `Currency code ${currencyCode} is not registered. Check for registered currency codes`;
      console.warn(pc.redBright(message));
      return res.status(404).json({ status: 404, message });
    }

    const accountCurrencyId = accountInfo.currency_id;
    const accountCurrencyCode = registeredCurrencyInfo.filter(
      (c) => c.currency_id === accountCurrencyId
    )[0].currency_code;

    // console.log('🚀 ~ addTransaction ~ currencyObj:',currencyObj,  currencyObj.currency_id, currencyObj['currency_id'], currencyObj.currency_code,accountInfo.currency_id );

    if (currencyObj.currency_id !== accountInfo.currency_id) {
      const message = `Currency code ${currencyCode} is not the same as the registered account currency code ${accountCurrencyCode}. Check the entered currency or let's exchange with a proper rate...yet to develope`;
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }

    console.log(
      'currency verified. ',
      accountCurrencyCode,
      'and',
      currencyCode
    );

    //---end of currency checking--------
    if (
      accountInfo.account_balance <= 0 ||
      accountInfo.account_balance < parseFloat(amount)
    ) {
      const message = `Transaction failed. Insufficient funds on account: ${accountInfo.account_name}. Available funds: ${accountInfo.account_balance}`;
      console.warn(pc.redBright(message));
      return res.status(403).json({ status: 403, message }); // code 403: forbidden http request
    }

    //start the transaction

    await client.query('BEGIN');
    await pool.query({
      text: `UPDATE user_accounts SET account_balance=(account_balance - $1), updated_at = CURRENT_TIMESTAMP WHERE account_id= $2`,
      values: [amount, accountId],
    });

    const movement_type_id = 1, //expense
      status = 'completed',
      source_account_id = accountId,
      transaction_type_id = 1; //withdraw
    const destination_account_id = 24; //cash
    const transaction_actual_date = transactionActualDate ?? new Date();
    const currencyFinalId = accountInfo.currency_id;

    const transactionResult = await pool.query({
      text: `INSERT INTO transactions(user_id, description, movement_type_id, status, amount,currency_id, source_account_id,transaction_type_id,destination_account_id, transaction_actual_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      values: [
        userId,
        description,
        movement_type_id,
        status,
        amount,
        currencyFinalId,
        source_account_id,
        transaction_type_id,
        destination_account_id,
        transaction_actual_date,
      ],
    });

    console.log(transactionResult.rows);

    await client.query('COMMIT');

    const message = 'Transaction successfully completed.';
    console.log(pc.greenBright(message));
    return res.status(200).json({ status: 200, message });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      pc.redBright('Error occured on adding transaction'),
      pc.greenBright(error.message || 'something went wrong')
    );
    const { code, message } = handlePostgresError(error);
    return next(createError(code, message));
  } finally {
    // Release the client back to the pool
    client.release();
  }
};
//--------------------------------------------------
//transferMoneyToAccount
export const transferMoneyToAccount = async (req, res, next) => {
  console.log(pc.yellowBright('transferMoneyToAccount'));
  const client = await pool.connect();

  try {
    const { user: userId } = req.query;
    const {
      from_account,
      to_account,
      amount,
      transactionActualDdate,
      currency,
    } = req.body;

    if (!from_account || !to_account || !amount) {
      const message = 'All fields are required';
      console.warn(pc.yellowBright(message));
      return res.status(400).json({ status: 400, message });
    }

    const numericAmount = parseFloat(amount);

    if (numericAmount <= 0) {
      const message = 'Amount should be greater than 0';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //verifiar que las cuentas existen? y tienen datos?
    //Verificar el currency de amount. verificar que los currencies de las dos cuentas coincidan con el del monto introducido.  que hacer si los currencies no coinciden?

    //check account details and balance for the 'from account'
    const fromAccountResult = await pool.query({
      text: `SELECT * FROM user_accounts WHERE account_id = $1`,
      values: [from_account],
    });

    console.log('fromAccountResult', fromAccountResult.rows);

    const fromAccountInfo = fromAccountResult.rows[0];

    if (!fromAccountInfo) {
      const message = 'Account Information not found';
      console.warn(pc.redBright(message));
      return res.status(404).json({ status: 404, message });
    }

    if (numericAmount > fromAccountInfo.account_balance) {
      const message = 'Transfer failed. Insufficient funds.';
      console.warn(pc.redBright(message));
      return res.status(404).json({ status: 404, message });
    }

    //Begin transaction
    await client.query('BEGIN');

    //Transfer from account
    await pool.query({
      text: `UPDATE user_accounts SET account_balance=(account_balance - $1), updated_at = CURRENT_TIMESTAMP WHERE account_id= $2`,
      values: [numericAmount, from_account],
    });

    //Yo  confirmaria aqui si la cuenta to_account existe?
    //Transfer to account
    const toAccountInfo = await pool.query({
      text: `UPDATE user_accounts SET account_balance=(account_balance + $1), updated_at = CURRENT_TIMESTAMP WHERE account_id= $2 RETURNING *`,
      values: [numericAmount, to_account],
    });

    //Insert transaction records
    const descriptionTransfered = `Transfered (withdraw from ${fromAccountInfo.account_name} to ${toAccountInfo.rows[0].account_name})`;

    console.log(
      '🚀 ~ transferMoneyToAccount ~ descriptionTransfered:',
      descriptionTransfered
    );
    //--------

    const movement_type_id = 6, //transfer
      status = 'completed',
      source_account_id = from_account,
      transaction_type_id = 1; //withdraw
    const destination_account_id = to_account; //cash
    const transaction_actual_date = transactionActualDdate ?? new Date();
    const currencyFinalId = 3;

    // const currencyFinalId = accountInfo.currency_id;

    const transactionResult = await pool.query({
      text: `INSERT INTO transactions(user_id, description, movement_type_id, status, amount,currency_id, source_account_id,transaction_type_id,destination_account_id, transaction_actual_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      values: [
        userId,
        descriptionTransfered,
        movement_type_id,
        status,
        -numericAmount,
        currencyFinalId,
        source_account_id,
        transaction_type_id,
        destination_account_id,
        transaction_actual_date,
      ],
    });

    console.log(transactionResult.rows);

    //-------------------
    const descriptionReceived = `Received (from ${fromAccountInfo.account_name} deposit to ${toAccountInfo.rows[0].account_name})`;

    const movement_type_id_to = 7, //transfer
    //  status_to = 'completed',
    //  source_account_id = from_account,
      transaction_type_id_to = 2; //deposit
    //  const destination_account_id = to_account; //cash
    //  const transaction_actual_date = transactionActualDdate ?? new Date();
    //  const currencyFinalId = 3;

    // const currencyFinalId = accountInfo.currency_id;
    const transactionResultReceived = await pool.query({
      text: `INSERT INTO transactions(user_id, description, movement_type_id, status, amount,currency_id, source_account_id,transaction_type_id,destination_account_id, transaction_actual_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      values: [
        userId,
        descriptionReceived,
        movement_type_id_to,
        status,
        numericAmount,
        currencyFinalId,
        source_account_id,
        transaction_type_id_to,
        destination_account_id,
        transaction_actual_date,
      ],
    });

    console.log(transactionResultReceived.rows);

    await client.query('COMMIT');

    const message = 'Transaction successfully completed.';
    console.log(pc.yellowBright(message));
    res.status(200).json({ status: 200, message });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      pc.redBright('Error occured on transfering Money To an Account'),
      pc.greenBright(error.message || 'something went wrong')
    );
    const { code, message } = handlePostgresError(error);
    return next(createError(code, message));
  } finally {
    // Release the client back to the pool
    client.release();
  }
};
//----------------
//http://localhost:5000/api/transaction/
//getDashboardInformation
export const getDashboardInformation = async (req, res, next) => {
  console.log(pc.yellowBright('getDashboardInformation'));

  try {
    const { user: userId } = req.query;

    //   // get the total amount of type transaction, from transactions table by a specific user_id,  grouped by movement_type_id
    const totalAmountMovementTypeResult = await pool.query({
      text: `SELECT tr.movement_type_id, mt.movement_type_name, CAST(SUM(tr.amount) AS DECIMAL) AS total_amount FROM transactions tr
   JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id WHERE user_id = $1 GROUP BY tr.movement_type_id, mt.movement_type_name
  `,
      values: [userId],
    });

    // console.log("🚀 ~ getDashboardInformation ~ totalAmountMovementTypeResult:", totalAmountMovementTypeResult)
    const totalAmountMovementType = totalAmountMovementTypeResult.rows;
    console.log(
      '🚀 ~ getDashboardInformation ~ totalAmountMovementType:',
      totalAmountMovementType
    );

    const totalIncomeInfo = totalAmountMovementType.filter(
      (type) => type.movement_type_name === 'income'
    );

    console.log(
      '🚀 ~ getDashboardInformation ~ totalIncome:',
      totalIncomeInfo[0].total_amount
    );
    const totalExpenseInfo = totalAmountMovementType.filter(
      (type) => type.movement_type_id === 1
    ); //expense
    console.log(
      '🚀 ~ getDashboardInformation ~ totalExpense:',
      totalExpenseInfo[0].total_amount
    );
    //----
    const totalInvestmentInfo = totalAmountMovementType.filter(
      (type) => type.movement_type_name === 'investment'
    ); //Investment
    console.log(
      '🚀 ~ getDashboardInformation ~ totalInvestment:',
      totalInvestmentInfo[0].total_amount
    );
    //----
    const totalDebtInfo = totalAmountMovementType.filter(
      (type) => type.movement_type_name === 'debt'
    ); //Debt
    console.log(
      '🚀 ~ getDashboardInformation ~ totalDebt:',
      totalDebtInfo[0].total_amount
    );
    //----
    const totalPocketInfo = totalAmountMovementType.filter(
      (type) => type.movement_type_name === 'pocket'
    ); //Pocket
    console.log(
      '🚀 ~ getDashboardInformation ~ totalPocket:',
      totalPocketInfo[0].total_amount
    );

    //   //movement debts transaction_type: borrow /
    //   // debtor_lend / debtor_borrow /investment_withdraw/investment_deposit/pocket_deposit/pocket_withraw, o sea que la tranasaction tambien tiene que tener el tipo de cuenta?

    const availableBalance =
      totalIncomeInfo[0].total_amount - totalExpenseInfo[0].total_amount;

    const totalAmounts = {
      totalBalance: availableBalance,
      totalIncome: totalIncomeInfo[0].total_amount,
      totalExpense: totalExpenseInfo[0].total_amount,
      totalInvestment: totalInvestmentInfo[0].total_amount,
      totalDebt: totalDebtInfo[0].total_amount,
      totalPocket: totalPocketInfo[0].total_amount,
    };
    console.table([
      availableBalance,
      totalIncomeInfo[0].total_amount + 0,
      totalExpenseInfo[0].total_amount + 0,
    ]);

    //   //Aggregate transactions to sum by transaction movement_type and group by month
    //these are CONSTANTS
    const year = new Date().getFullYear();
    const start_date = new Date(year, 0, 1); //January 1st of the year
    const end_date = new Date(year, 11, 31, 23, 59, 59); //December 31st of the year
    //-----------
    const groupByMonthQuery = {
      text: `SELECT EXTRACT(MONTH FROM tr.created_at) AS month_index, CAST(SUM(tr.amount) AS DECIMAL) AS total_amount, tr.movement_type_id, mt.movement_type_name FROM transactions tr  JOIN movement_types AS mt ON tr.movement_type_id = mt.movement_type_id  WHERE tr.user_id = $1 AND created_at BETWEEN $2 and $3 GROUP BY month_index, tr.movement_type_id, mt.movement_type_name`,
      values: [userId, start_date, end_date],
    };
    const amountTypeByMonthResult = await pool.query(groupByMonthQuery);

    console.log(
      '🚀 ~ getDashboardInformation ~ amountTypeByMonthResult:',
      amountTypeByMonthResult.rows
    );

    // grouping data by month
    const data = Array.from({ length: 12 }, (_, indx) => {
      const month_index = indx + 1;
      console.log('🚀 ~ data ~ month_index:', month_index);
      const dataByMonth = amountTypeByMonthResult.rows.filter(
        (item) => parseInt(item.month_index) == month_index
      );
      const totalIncomeMonth =
        dataByMonth.find((item) => item.movement_type_name == 'income')
          ?.total_amount || 0;
      const totalExpenseMonth =
        dataByMonth.find((item) => item.movement_type_name == 'expense')
          ?.total_amount || 0;
      const totalDebtMonth =
        dataByMonth.find((item) => item.movement_type_name == 'debt')
          ?.total_amount || 0; //hay que asegurarse que los amount tomados aqui corresponden son a los balances de las cuentas de debtors borrow - lend o lend- borrow. verificar preferencia.

      const totalInvestmentMonth =
        dataByMonth.find((item) => item.movement_type_name == 'investment')
          ?.total_amount || 0;

      console.log({
        label: getMonthName(Number(month_index)),
        totalExpenseMonth,
        totalIncomeMonth,
        totalBalanceMonth: totalIncomeMonth - totalExpenseMonth,
        totalInvestmentMonth,
        totalDebtMonth,
      });

      return {
        label: getMonthName(month_index),
        totalBalanceMonth: totalIncomeMonth - totalExpenseMonth,
        totalIncomeMonth,
        totalExpenseMonth,
        totalDebtMonth,
        totalInvestmentMonth,
      };
    });

    //Last transactions
    const lastTransactionsResult = await pool.query({
      text: `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC  LIMIT 30`,
      values: [userId],
    });

    //Last accounts
    const lastAccountsResult = await pool.query({
      text: `SELECT * FROM user_accounts ua JOIN account_types act ON ua.account_type_id = act.account_type_id  WHERE user_id = $1 ORDER BY act.account_type_id, ua.account_id ASC,ua.created_at DESC`,
      values: [userId],
    });

    const message = 'Dashboard info successfully completed.';
    console.log(pc.yellowBright(message));
    return res.status(200).json({
      status: 200,
      message,
      availableBalance,

      totalAmounts,
      lastAccounts: lastAccountsResult.rows,
      lastTransactions: lastTransactionsResult.rows,
      chartData: data,
    });
  } catch (error) {
    console.error(
      pc.redBright('Error occured on getting Dashboard Information'),
      pc.greenBright(error.message || 'Something went wrong')
    );
    const { code, message } = handlePostgresError(error);
    return next(createError(code, message));
  }
};
