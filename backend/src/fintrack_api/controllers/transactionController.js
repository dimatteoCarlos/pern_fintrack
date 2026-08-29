// backend/src/fintrack_api/controllers/transactionController.js

//controller:transferBetweenAccounts.js
// Functions: Handles financial transfers between accounts with balance updates and transaction recording.

//FUNCTION: Get transaction by ID with FX metadata

//declared functions defined here:
//getAccountTypeId,getAccountInfo, getAccountTypes,getTransactionTypes, balanceMultiplierFn,updateAccountBalance, getTransactionById.

// transferBetweenAccounts.js (Controller)
// Main controller for financial transfers between accounts
// Handles expense, income, debt, pocket, transfer, and PnL movements
// Updates balances and records dual transactions (source/destination)
// Includes Slack account creation for PnL operations
//--------------------------------
import pc from 'picocolors';
import { pool } from '../../db/config/configDB.js';
import { createError, handlePostgresError } from '../../utils/errorHandling.js';
import { requireUserId } from '../../utils/authUtils/requireUserId.js';
import {
  getExpenseConfig,
  getIncomeConfig,
  getDebtConfig,
  getTransferConfig,
  getPnLConfig,
} from '../../utils/fintrackUtils/transactionManagement/movementInputHandler.js';
import { recordTransaction } from '../../utils/fintrackUtils/transactionManagement/recordTransaction.js';
import { formatDate } from '../../utils/helpers.js';
import { getCurrencyId } from '../../utils/currencyLookup.js';
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import {
  dayInZone,
  isCalendarDate,
  todayInZone,
} from '../../utils/fintrackUtils/date-utils/resolveZonedWindow.js';
import { currencyAmountConversion } from '../services/fx_services/conversion/currencyAmountConversion.js';
import { ACCOUNTING_CURRENCY_CODE } from '../config/fintrackConfig.js';
//==================================
// 🔧 FX DEBUG UTILITY (centralized)
// ==================================
const FX_DEBUG_ENABLED = true; // Cambiar a false para desactivar todos los logs

const fxDebug = (step, data) => {
  if (!FX_DEBUG_ENABLED) return;
  console.log(`🔍 [FX DEBUG] ${step}:`, JSON.stringify(data, null, 2));
};
//=====================================

//endpoint: put:/api/fintrack/transaction/transfer-between-accounts?movement=expense
//====================================
//FUNCTIONS DECLARATION
//get the account_type_id by account_type_name
export const getAccountTypeId = async (dbClient = pool, accountTypeName) => {
  const accountTypeQuery = `SELECT * FROM account_types WHERE account_type_name =  $1`;
  const accountTypeResult = await dbClient.query({
    text: accountTypeQuery,
    values: [accountTypeName],
  });
  // console.log(
  //   'Get type id acc By accountTypeName',
  //   accountTypeResult.rows[0]?.account_type_id
  // );
  return accountTypeResult.rows[0]?.account_type_id;
};

// Get the account info by user_id, plus either account_id or account_name.
//
// Both identifiers are received and the id wins when present. The previous
// signature packed either one into a single parameter and took a separate
// useId flag to say which: a flag carried beside the value can disagree with
// it, and it did.
//
// The name branch is transitional and goes away when every caller sends an id.
export const getAccountInfo = async (
  dbClient = pool,
  { accountId = null, accountName = null, accountTypeName, userId },
) => {
  // Not truthiness: an accountId of 0 is an invalid id, but it is not absent.
  // Falling back to a name lookup on a bad id is the silent failure this
  // function exists to stop making.
  const byId = accountId !== null && accountId !== undefined && accountId !== '';

  // Text values compared in lowercase on both sides: account names are stored
  // as the user typed them, so an exact match would miss Bancolombia when the
  // request carries bancolombia. Ids are compared as they are.
  const accountQuery = byId
    ? `SELECT ua.* FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      WHERE ua.user_id = $1 AND ua.account_id = $2 AND LOWER(act.account_type_name) = LOWER($3)`
    : `SELECT ua.* FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      WHERE ua.user_id = $1 AND LOWER(ua.account_name) = LOWER($2) AND LOWER(act.account_type_name) = LOWER($3)`;

  const accountInfoResult = await dbClient.query({
    text: accountQuery,
    values: [userId, byId ? accountId : accountName, accountTypeName],
  });
  return accountInfoResult.rows[0];
};

//---
//get the array of ACCOUNT type objects
export const getAccountTypes = async (clientOrPool = null) => {
  const dbClient = clientOrPool || pool;
  const accountTypeQuery = `SELECT * FROM account_types`;
  const accountTypeResult = await dbClient.query(accountTypeQuery);
  const accountTypeArr = accountTypeResult.rows;
  return accountTypeArr;
};

//get the array of TRANSACTION type objects
export const getTransactionTypes = async (clientOrPool = null) => {
  const db = clientOrPool || pool;
  const transactionTypeQuery = `SELECT * FROM transaction_types`;
  const transactionTypeResult = await db.query(transactionTypeQuery);
  const transactionTypeArr = transactionTypeResult.rows;
  return transactionTypeArr;
};

//set the sign according to transaction type
export const balanceMultiplierFn = (transactionTypeName) => {
  const negativeArr = ['withdraw', 'borrow', 'borrowing'];
  const trimTypeName = transactionTypeName.trim().toLowerCase();
  const mult = negativeArr.includes(trimTypeName) ? -1.0 : 1.0;
  // console.log("🚀 ~ balanceMultiplierFn ~ :", mult, 'para', transactionTypeName)
  return mult;
};

//update account balance in user_accounts table
// updated_at records when the row was last touched, not when the movement
// happened; that is what the transactions say. NOW() is the pattern
// accountEditController.js:282 already uses.
export const updateAccountBalance = async (
  clientOrPool,
  newBalance,
  accountId,
) => {
  const dbClient = clientOrPool || pool;
  //assure first the existence of updatedAccountResult?
  const insertBalanceQuery = {
    text: `UPDATE user_accounts SET account_balance=$1, updated_at = NOW() WHERE account_id = $2 RETURNING *`,
    values: [newBalance, accountId],
  };
  //request
  const updatedAccountResult = await dbClient.query(insertBalanceQuery);
  return updatedAccountResult.rows[0];
};

//transfer movement renamed
export function transformMovementType(
  movementName,
  sourceAccountTypeName,
  destinationAccountTypeName,
) {
  if (movementName === 'transfer') {
    if (destinationAccountTypeName === 'pocket_saving') return 'pocket';

    if (sourceAccountTypeName === 'pocket_saving') return 'pocket';
  }
  //---
  return movementName;
}

//=====================================
// MAIN CONTROLLER FUNCTION
//CONTROLLER: transferBetweenAccounts
//=====================================
export const transferBetweenAccounts = async (req, res, next) => {
  console.log(pc.magentaBright('transferBetweenAccounts'));
  const client = await pool.connect();

  try {
    // ================================
    // DATA EXTRACTION and VALIDATION
    // ================================
    const userId = requireUserId(req, res);
    if (!userId) return;
    //-------------------------------------
    const { movement } = req.query;
    const movementName = movement === 'debts' ? 'debt' : movement; //debt movement is called as debts in frontend
    // console.log({ movementName });
    if (!movementName) {
      const message = 'movement name is required';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }

    if (
      ![
        'expense',
        'income',
        'investment',
        'debt',
        'pocket',
        'transfer',
        'pnl',
      ].includes(movementName)
    ) {
      const message = `movement name " ${movementName} " is not correct`;
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }

    //=================================
    //--get the movement types, get the movement type id and check
    const movement_typesResult = await pool.query(
      `SELECT * FROM movement_types`,
    );
    const movement_typesResultExist = movement_typesResult.rows.length > 0;
    // console.log('movement_types', movement_typesResultsExist)

    if (!movement_typesResultExist) {
      const message = 'something went wrong with the movement_types table';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const movement_types = movement_typesResult.rows;
    // console.log(
    //   '🚀 ~ transferBetweenAccounts ~ movement_types:', movement_types);

    //==================================
    //PnL movement preparation
    //==================================
    //PnL Movements need a compensation account, in this case named "slack", to serve as a counter part of the transaction.
    //--function for slack account --
    const checkAndInsertSlackAccount = async (dbClient = null, userId) => {
      const db = dbClient || pool;
      try {
        //Check existence using the transaction client
        const chekAccountResult = await db.query(
          'SELECT * FROM user_accounts WHERE account_name = $1 AND user_id = $2',
          ['slack', userId],
        );

        if (chekAccountResult.rows.length > 0) {
          console.log('slack account already exists');
          return chekAccountResult.rows[0];
        } else {
          const insertResult = await db.query(
            'INSERT INTO user_accounts (user_id,account_name,account_type_id,currency_id,account_starting_amount,account_balance,account_start_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
            [userId, 'slack', 1, 1, 0, 0, new Date()],
          );
          console.log(
            'slack account created successfully',
            'account:',
            insertResult.rows[0],
          );
          return insertResult.rows[0]; // Return the new account
        }
      } catch (error) {
        // We throw the error so the main catch block can perform the ROLLBACK
        const message = 'Error creating slack account';
        console.error(message, error);

        throw new Error(
          'Error creating/checking slack account: ' + error.message,
        );
      }
    };

    //-------------------------------
    //req.body extraction and config
    //example:expense
    //movementName: expense, sourceAccountTypeName: 'bank', destinationAccountTypeName:'category_budget', sourceAccountTransactionType:withdraw, destinationAccountTransactionType:deposit,
    //-----------------------------------
    const {
      note,
      amount,
      currency: currencyCode,
      type: transactionTypeName, //for pnl or for debt in new version
      accountType,
      date,
    } = req.body; //common fields to all tracker movements.
    //-----------------
    // console.log('body', req.body);
    console.log(
      { movementName: movementName },
      'type',
      transactionTypeName,
      accountType,
      date,
    );
    //------------------------------------
    //Store original amount and currency (as sent by frontend)
    const originalAmountValue = parseFloat(amount);
    const originalCurrencyCode = currencyCode;

    //------DEBUG-----
    fxDebug('Datos recibidos del frontend', {
      amountRaw: req.body.amount,
      currencyCodeRaw: req.body.currency,
      originalAmountValue,
      originalCurrencyCode,
    });
    //---------DEBUG---------

    // Validate amount using original amount
    if (isNaN(originalAmountValue) || originalAmountValue <= 0) {
      const message = 'Amount must be a positive number.';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }

    // Get original currency ID
    const originalCurrencyId = await getCurrencyId(pool, originalCurrencyCode);
    if (!originalCurrencyId) {
      const message = `Currency ${originalCurrencyCode} not found`;
      const err = new Error(message);
      err.status = 400;
      throw err;
    }

    // Get accounting currency ID (e.g., USD)
    const accountingCurrencyId = await getCurrencyId(
      pool,
      ACCOUNTING_CURRENCY_CODE,
    );
    const accountingCurrencyCode = ACCOUNTING_CURRENCY_CODE.toUpperCase();

    //------DEBUG-----
    fxDebug('Comparación de monedas', {
      originalCurrencyCode,
      accountingCurrency: ACCOUNTING_CURRENCY_CODE,
      necesitaConversion: originalCurrencyCode !== ACCOUNTING_CURRENCY_CODE,
    });
    //---------DEBUG---------

    // Perform FX conversion to USD
    let convertedAmount = originalAmountValue;
    let exchangeRate = 1.0;
    let exchangeRateSource = 'identity';
    let exchangeRateTimestamp = new Date();

    if (originalCurrencyCode !== ACCOUNTING_CURRENCY_CODE) {
      //------DEBUG-----
      fxDebug('Iniciando conversión de moneda', {
        from: originalCurrencyCode,
        to: ACCOUNTING_CURRENCY_CODE,
        amount: originalAmountValue,
      });
      //---------DEBUG---------

      const conversion = await currencyAmountConversion(
        originalAmountValue,
        originalCurrencyCode,
        ACCOUNTING_CURRENCY_CODE,
      );

      convertedAmount = conversion.amount.toNumber();
      exchangeRate = conversion.rate;
      exchangeRateSource = conversion.source;
      exchangeRateTimestamp = conversion.fetchedAt;
      //------DEBUG-----
      fxDebug('Resultado de conversión', {
        from: originalCurrencyCode,
        to: ACCOUNTING_CURRENCY_CODE,
        originalAmount: originalAmountValue,
        convertedAmount,
        rate: exchangeRate,
        source: exchangeRateSource,
      });
      //---------DEBUG---------
    }
    //------DEBUG-----
    fxDebug('Valores finales después de conversión (o sin ella)', {
      originalAmount: originalAmountValue,
      convertedAmount,
      exchangeRate,
      exchangeRateSource,
      exchangeRateTimestamp,
      monedaOriginal: originalCurrencyCode,
      monedaDestino: ACCOUNTING_CURRENCY_CODE,
    });
    //---------DEBUG---------
    //------------------------------
    // Reassign numericAmount to the converted USD value
    // This variable is used throughout the controller for balances, transactions, and descriptions.
    let numericAmount = convertedAmount;

    // Update currencyIdReq to the accounting currency ID
    let currencyIdReq = accountingCurrencyId;
    //----------------------------------
    //From the original design, not all tracker movements input data form, have the same input data structure, so, get the data structure configuration strategy based on movementName
    const config = {
      expense: getExpenseConfig(req.body),
      income: getIncomeConfig(req.body),
      transfer: getTransferConfig(req.body),
      debt: getDebtConfig(req.body),
      pnl: getPnLConfig(req.body),
    }[movementName];
    //---
    // Renamed on the way in: sourceAccountId and destinationAccountId are
    // already taken further down for the ids of the rows that were found.
    // These two are what the request asked for, which is not the same thing.
    const {
      sourceAccountId: requestedSourceAccountId,
      sourceAccountName,
      sourceAccountTypeName,
      sourceAccountTransactionType,

      destinationAccountId: requestedDestinationAccountId,
      destinationAccountName,
      destinationAccountTypeName,
      destinationAccountTransactionType,
    } = config;
    // console.log('🚀 ~ transferBetweenAccounts ~ config:', config, sourceAccountTypeName);

    //adjust the movement type name
    const movement_type_name = transformMovementType(
      movementName,
      sourceAccountTypeName,
      destinationAccountTypeName,
    );
    //=================================
    // get the movement type ID
    // console.log('🚀 ~ transferBetweenAccounts ~ movement_type_name:', movement_type_name
    // );
    const movement_type_idResult = movement_types.filter(
      (mov) => mov.movement_type_name === movement_type_name,
    );
    // console.log(
    //   '🚀 ~ transferBetweenAccounts ~ movement_type_idResult:',
    //   movement_type_idResult
    // );
    if (!movement_type_idResult || movement_type_idResult.length === 0) {
      const message = `movement type id of ${movement_type_name} was not found.`;
      // console.warn(pc.magentaBright(message));
      // console.log('🚀 ~ transferBetweenAccounts ~ message:', message);
      const err = new Error(message);
      err.status = 400;
      throw err;
    }
    const movement_type_id = movement_type_idResult[0].movement_type_id;
    //===============================
    //transaction and account types from db
    //===============================
    const transactionsTypes = await getTransactionTypes(client);

    const sourceTransactionTypeId = transactionsTypes.filter(
      (type) => type.transaction_type_name === sourceAccountTransactionType,
    )[0].transaction_type_id;

    const destinationTransactionTypeId = transactionsTypes.filter(
      (type) =>
        type.transaction_type_name === destinationAccountTransactionType,
    )[0].transaction_type_id;
    const accountTypes = await getAccountTypes(client);
    // console.log(
    //   '🚀 ~ transferBetweenAccounts ~ transactionsTypes:',
    //   sourceTransactionTypeId,
    //   'sourceAccountTransactionType',
    //   sourceAccountTransactionType,
    //   'destinationTransactionTypeId',
    //   destinationTransactionTypeId
    // );
    //===================================
    //---check common input data --------
    // //validate amount
    // const numericAmount = amount ? parseFloat(amount) : 0.0;
    // if (numericAmount <= 0) {
    //   const message = 'Amount must be >= 0. Try again!';
    //   console.warn(pc.redBright(message));
    //   return res.status(400).json({ status: 400, message });
    // }
    //validate currency
    // const currencyIdReq = await getCurrencyId(pool, currencyCode);

    // if (!currencyIdReq) {
    //   // console.log('error en', currencyCode, )
    //   const message = `Currency ${currencyCode} not found`;
    //   const err = new Error(message);
    //   err.status = 400;
    //   throw err;
    // }
    const { transactionActualDate: actualDate } = req.body;

    // =============================
    //=== Begin transaction========
    await client.query('BEGIN');

    if (movementName === 'pnl') {
      await checkAndInsertSlackAccount(client, userId);
    }
    //-------account info----------------
    // console.log('accountInfo',
    //   requestedSourceAccountId, sourceAccountName,
    //   sourceAccountTypeName,
    //   userId)

    //source and destination account info
    const sourceAccountInfo = await getAccountInfo(client, {
      accountId: requestedSourceAccountId,
      accountName: sourceAccountName,
      accountTypeName: sourceAccountTypeName,
      userId,
    });

    if (!sourceAccountInfo) {
      // The identifier searched with, not a field of the row that was not
      // found: dereferencing it raised a TypeError and turned this 404 into a
      // 500 that never named the account.
      throw createError(
        404,
        `Origin account ${requestedSourceAccountId ?? sourceAccountName} not found`,
      );
    }
    //---
    const destinationAccountInfo = await getAccountInfo(client, {
      accountId: requestedDestinationAccountId,
      accountName: destinationAccountName,
      accountTypeName: destinationAccountTypeName,
      userId,
    });
    // console.log(
    // '🚀 ~ transferBetweenAccounts ~ destinationAccountInfo:',
    // destinationAccountInfo
    // );
    if (!destinationAccountInfo) {
      // Same defect as the origin branch above.
      throw createError(
        404,
        `Destination account ${requestedDestinationAccountId ?? destinationAccountName} not found`,
      );
    }

    // The movement's date. Absent or empty means now, which is what every form
    // sends today. It is validated here, below both lookups, because the lower
    // bound is the later of the two accounts' opening days.
    const timeZone = await getUserTimeZone(client, userId);
    const requestedDay = typeof actualDate === 'string' ? actualDate.trim() : '';
    let transaction_actual_date = new Date();

    if (requestedDay !== '') {
      if (!isCalendarDate(requestedDay)) {
        throw createError(
          400,
          `transactionActualDate must be a calendar day, YYYY-MM-DD`,
        );
      }

      const today = todayInZone(timeZone);

      if (requestedDay > today) {
        throw createError(
          422,
          `A movement cannot be dated after today, ${today}`,
        );
      }

      // Calendar days on both sides, never instants. account_start_date holds an
      // arbitrary wall-clock time, so an account opened at 20:00 would refuse a
      // movement on its own opening day once that day is anchored at noon.
      const openings = [
        [
          sourceAccountInfo.account_name,
          dayInZone(sourceAccountInfo.account_start_date, timeZone),
        ],
        [
          destinationAccountInfo.account_name,
          dayInZone(destinationAccountInfo.account_start_date, timeZone),
        ],
      ];
      const [openedName, openedDay] = openings.reduce((later, current) =>
        current[1] > later[1] ? current : later,
      );

      if (requestedDay < openedDay) {
        throw createError(
          422,
          `A movement cannot be dated before ${openedName} was opened on ${openedDay}`,
        );
      }

      // Composed once, in SQL, and reused by both legs so the two halves of one
      // entry cannot land in different months. A past day is anchored at noon in
      // the owner's zone; today keeps the real current instant.
      if (requestedDay < today) {
        const composed = await client.query({
          text: `SELECT (($1::date + TIME '12:00') AT TIME ZONE $2) AS instant`,
          values: [requestedDay, timeZone],
        });
        transaction_actual_date = composed.rows[0].instant;
      }
    }
    //----source account-----------------
    const sourceAccountTypeId = accountTypes.filter(
      (type) => type.account_type_name === sourceAccountTypeName,
    )[0].account_type_id;

    console.log(
      '🚀 ~ transferBetweenAccounts ~ sourceAccountTypeId:',
      sourceAccountTypeId,
    );
    //-----------------------------------
    //---check for enough funds on source account
    //----------------------------------
    //rules about overdraft due to transfer between accounts are restricted.
    //OVERDRAFT IS NOT ALLOWED: bank to category_budget, bank to investment, bank to debtor , others: investment to investment, bank to bank, bank or investment to pocket, or pocket to any

    //OVERDRAFT IS ALLOWED: slack to any account, income_source to any account, debtor to debtor,  debtor to bank, debtor to any account

    //NOT TRANSFERS ALLOWED BETWEEN: category_budget to any account, other than bank to category_budget, any account to income_source. Any transaction between debt and category_budget nor income_source

    //REVERSAL TRANSFERS FROM EXPENSE AND INCOME ACCOUNTS, NOW ARE ALLOWED TO ANY ACCOUNT BUT SLACK and DEBTOR
    //-----------------------------
    //----- Origin or source Account
    //-----------------------------
    console.log('---FK DEBUGGING / DEBUG DE LLAVES FORÁNEAS ---');
    console.log('User ID:', userId);
    console.log('Currency ID FOUND:', currencyIdReq);
    console.log('Account Type ID :', accountType);
    console.log('Movement Type ID (Hardcoded):', 8);
    console.log('---------------------------------');
    //-------------------------------
    //--this is for pnl movements which does not consider an explicit counter account
    if (movementName === 'pnl') {
      await checkAndInsertSlackAccount(client, userId);
    }
    //---------------------------------------
    //---Update the balance in the source account
    //---------------------------------------
    const sourceAccountBalance = parseFloat(sourceAccountInfo.account_balance);
    //---check for enough funds on source account
    if (
      sourceAccountBalance < numericAmount &&
      ((sourceAccountTypeName === 'bank' &&
        sourceAccountInfo.account_name !== 'slack') ||
        sourceAccountTypeName === 'investment' ||
        sourceAccountTypeName === 'pocket_saving' ||
        sourceAccountTypeName === 'category_budget') //reversal of a expense
    ) //----------------------------------
    //Use accounting currency code in error message
    //----------------------------------
    {
      const message = `Not enough funds in "${sourceAccountInfo.account_name.toUpperCase()}" (${accountingCurrencyCode} ${sourceAccountBalance})`;

      console.warn(pc.magentaBright(message));

      return res.status(400).json({
        status: 400,
        message,
      });
    }
    //--------------------------------------
    // --- Update Source account balance ---
    //--------------------------------------
    const newSourceAccountBalance =
      parseFloat(sourceAccountBalance) - numericAmount;

    const sourceAccountId = sourceAccountInfo.account_id;
    console.log(
      'transaction actual date (tad):',
      transaction_actual_date,
      '#',
      sourceAccountId,
    );

    const updatedSourceAccountInfo = await updateAccountBalance(
      client,
      newSourceAccountBalance,
      sourceAccountId,
    );
    // console.log(
    //   '🚀 ~ updatedSourceAccountInfo:',
    //   updatedSourceAccountInfo,updatedSourceAccountInfo.account_balance,
    //   'type of:',
    //   typeof updatedSourceAccountInfo.account_balance
    // );
    //---------------------------
    //--- Destination Account ---
    //---------------------------
    //--Update the balance in th destination account
    const destinationAccountBalance = destinationAccountInfo.account_balance;
    const newDestinationAccountBalance =
      parseFloat(destinationAccountBalance) + numericAmount;

    const destinationAccountId = destinationAccountInfo.account_id;

    const updatedDestinationAccountInfo = await updateAccountBalance(
      client,
      newDestinationAccountBalance,
      destinationAccountId,
    );
    // console.log(
    //   '🚀 ~ updatedDestinationAccountInfo:',
    //   updatedDestinationAccountInfo,updatedDestinationAccountInfo.account_balance,
    // );
    //====================================
    //---Register transfer/receive transaction---
    //----Source transaction----------
    const expenseReversalNotePrefix =
      sourceAccountTypeName === 'category_budget' ? 'Expense Reversal. ' : '';

    const incomeReversalNotePrefix =
      destinationAccountTypeName === 'income_source' ? 'Income Reversal. ' : '';

    // Use numericAmount (USD) and accountingCurrencyCode in description
    const transactionDescription = `${expenseReversalNotePrefix}${incomeReversalNotePrefix}${note ? note + '.' : ''}Transaction: ${sourceAccountTransactionType}. Transfered ${numericAmount.toFixed(3)} ${accountingCurrencyCode} from account "${sourceAccountInfo.account_name} #${sourceAccountInfo.account_id}" (${sourceAccountTypeName}) credited to "${destinationAccountInfo.account_name} # ${destinationAccountInfo.account_id}" (${destinationAccountTypeName}). Date: ${formatDate(transaction_actual_date)}`;

    //------DEBUG-----
    // console.log(
    //   userId,
    //   transactionDescription,
    //   movement_type_id,
    //   sourceTransactionTypeId,
    //   newSourceAccountBalance,
    //   currencyIdReq,
    //   sourceAccountId,
    //   destinationAccountId,
    //   transaction_actual_date
    // );

    //------DEBUG-----
    fxDebug('FX metadata que se guardará en la transacción (source)', {
      original_amount: originalAmountValue,
      original_currency_id: originalCurrencyId,
      original_currency_code: originalCurrencyCode,
      exchange_rate: exchangeRate,
      exchange_rate_source: exchangeRateSource,
      exchange_rate_timestamp: exchangeRateTimestamp,
      exchange_rate_target_currency_id: accountingCurrencyId,
    });
    //---------DEBUG---------

    const sourceTransactionOption = {
      userId,
      description: transactionDescription,
      movement_type_id,
      status: 'complete',
      amount: -numericAmount,
      currency_id: currencyIdReq,
      account_id: sourceAccountId,
      source_account_id: sourceAccountId,
      transaction_type_id: sourceTransactionTypeId, //withdraw or lend
      destination_account_id: destinationAccountId,
      transaction_actual_date,
      account_balance: parseFloat(updatedSourceAccountInfo.account_balance),

      // FX metadata fields for recordTransaction
      original_amount: originalAmountValue,
      original_currency_id: originalCurrencyId,
      exchange_rate: exchangeRate,
      exchange_rate_source: exchangeRateSource,
      exchange_rate_timestamp: exchangeRateTimestamp,
      exchange_rate_target_currency_id: accountingCurrencyId,
    };

    //example: Transaction: Deposit of 3.00 USD received from the account "Nueva Cuenta" (Type: Bank Account), credited to "Food_Must" under the budget category "Category_Budget".

    await recordTransaction(client, sourceTransactionOption);
    //====================================
    //-----destination transaction--------
    const transactionDescriptionReceived = `${incomeReversalNotePrefix}${expenseReversalNotePrefix}${note ? note + '.' : ''}Transaction: ${destinationAccountTransactionType}. Received ${numericAmount.toFixed(2)} ${accountingCurrencyCode} in account "${destinationAccountInfo.account_name} (${destinationAccountTypeName}) # ${destinationAccountInfo.account_id}, from "${sourceAccountInfo.account_name}" # ${sourceAccountInfo.account_id} (${sourceAccountTypeName}). Date: ${formatDate(transaction_actual_date)}`;
    // console.log(
    //   userId,
    //   transactionDescriptionReceived,
    //   movement_type_id,
    //   sourceTransactionTypeId,
    //   newDestinationAccountBalance,
    //   numericAmount
    //   currencyIdReq,
    //   sourceAccountId,
    //   destinationAccountId,
    //   transaction_actual_date
    // );

    const destinationTransactionOption = {
      userId,
      description: transactionDescriptionReceived,
      movement_type_id,
      status: 'complete',
      amount: numericAmount,
      currency_id: currencyIdReq,
      account_id: destinationAccountId,
      source_account_id: sourceAccountId,
      transaction_type_id: destinationTransactionTypeId, //withdraw or borrow
      destination_account_id: destinationAccountId,
      transaction_actual_date,
      account_balance: parseFloat(
        updatedDestinationAccountInfo.account_balance,
      ),
      // FX metadata (same as source)
      original_amount: originalAmountValue,
      original_currency_id: originalCurrencyId,
      exchange_rate: exchangeRate,
      exchange_rate_source: exchangeRateSource,
      exchange_rate_timestamp: exchangeRateTimestamp,
      exchange_rate_target_currency_id: accountingCurrencyId,
    };
    // destinationTransactionOption.movement_type_id;
    await recordTransaction(client, destinationTransactionOption);
    //==============================
    // data response
    const data = {
      movement: { movement_type_name, movement_type_id },
      source: {
        account_info: {
          account_name: sourceAccountInfo.account_name,
          account_type: sourceAccountTypeName,
          amount: numericAmount,
          currency: accountingCurrencyCode,
        },
        balance_updated: {
          amount_transaction: sourceTransactionOption.amount,
          account_balance: sourceTransactionOption.account_balance, //newSourceAccountBalance,
        },
        transaction_info: {
          transaction_type: sourceAccountTransactionType,
          transaction_description: transactionDescription,
          transaction_id: sourceTransactionOption.transaction_id,
          transaction_date: transaction_actual_date,
        },
      },

      destination: {
        account_info: {
          account_name: destinationAccountInfo.account_name,
          account_type: destinationAccountTypeName,
          amount: numericAmount,
          currency: accountingCurrencyCode,
        },
        balance_updated: {
          amount_transaction: destinationTransactionOption.amount,
          account_balance: destinationTransactionOption.account_balance, //newDestinationAccountBalance,
        },
        transaction_info: {
          transaction_type: destinationAccountTransactionType,
          transaction_description: transactionDescriptionReceived,
          transaction_id: destinationTransactionOption.transaction_id,
          transaction_date: transaction_actual_date,
        },
      },
    };
    //----------------
    const message = 'Transaction successfully completed.';
    console.log(pc.magentaBright(message));
    // console.log('data',data,'')
    // commit all changes to the database
    await client.query('COMMIT');
    //end of transaction
    return res.status(200).json({ status: 200, message, data });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error instanceof Error) {
      console.error(
        pc.red('Error during transfer'),
        pc.magentaBright(error.stack || error.message),
        error,
      );
    } else {
      console.error(
        pc.red('Error during transfer'),
        pc.magentaBright('Unknown error occurred'),
      );
    }
    // Manejo de errores de PostgreSQL - pg error handling
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  } finally {
    // Always release the connection
    client.release();
  }
};
//end of transactionController

// ========================================
// 🎯 FUNCTION: Get transaction by ID with FX metadata
// ========================================
//Endpoint GET /api/fintrack/transactions/:id
export async function getTransactionById(req, res, next) {
  const client = await pool.connect();
  try {
    const { transactionId } = req.params;
    const userId = requireUserId(req, res);
    if (!userId) return;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const result = await client.query(
      `SELECT 
       ua.account_name,
        t.transaction_id,
        t.user_id,
        t.description,
        t.amount,
        t.movement_type_id,
        t.transaction_type_id,
        trt.transaction_type_name, 
        t.currency_id,
        t.account_id,
        t.account_balance_after_tr,
        t.source_account_id,
        t.destination_account_id,
        t.status,
        t.transaction_actual_date,
        t.created_at,
        t.updated_at,
        t.original_amount,
        t.original_currency_id,
        t.exchange_rate,
        t.exchange_rate_source,
        t.exchange_rate_timestamp,
        t.exchange_rate_target_currency_id,
        c.currency_code,
        oc.currency_code AS original_currency_code,
        act.account_type_name,
        mt.movement_type_name,
        sa.account_name AS source_account_name,
        sat.account_type_name AS source_account_type,
        da.account_name AS destination_account_name,
        dat.account_type_name AS destination_account_type,
        -- The owner's calendar, not the reader's browser: a transaction stamped
        -- at 23:40 in Bogota must not read as the next day from another device.
        (t.transaction_actual_date AT TIME ZONE COALESCE(u.timezone, 'UTC'))::date::text AS transaction_local_date,
        to_char(
          t.transaction_actual_date AT TIME ZONE COALESCE(u.timezone, 'UTC'),
          'HH24:MI'
        ) AS transaction_local_time

      FROM transactions t

      LEFT JOIN currencies c ON t.currency_id = c.currency_id
      LEFT JOIN currencies oc ON t.original_currency_id = oc.currency_id
      LEFT JOIN user_accounts ua ON t.account_id = ua.account_id
      LEFT JOIN transaction_types trt ON trt.transaction_type_id = t.transaction_type_id
      LEFT JOIN movement_types mt ON mt.movement_type_id = t.movement_type_id
      LEFT JOIN account_types act ON act.account_type_id = ua.account_type_id

      -- The counterpart accounts of a transfer. Both carry user_id in the join
      -- and not only the id, so a foreign account can never surface its name.
      LEFT JOIN user_accounts sa ON sa.account_id = t.source_account_id AND sa.user_id = t.user_id
      LEFT JOIN account_types sat ON sat.account_type_id = sa.account_type_id
      LEFT JOIN user_accounts da ON da.account_id = t.destination_account_id AND da.user_id = t.user_id
      LEFT JOIN account_types dat ON dat.account_type_id = da.account_type_id

      -- Joined instead of read with getUserTimeZone: the zone is one column of a
      -- row this statement already reaches, and a second round trip to resolve it
      -- is latency once the database is remote.
      LEFT JOIN users u ON u.user_id = t.user_id

      WHERE t.transaction_id = $1 AND t.user_id = $2`,
      [transactionId, userId],
    );

    //------DEBUG-----
    // console.log('🔍 [FX DEBUG] getTransactionById - raw result:', {
    //   transaction_id: result.rows[0]?.transaction_id,

    //   original_amount: result.rows[0]?.original_amount,
    //   original_amount_type: typeof result.rows[0]?.original_amount,
    //   exchange_rate: result.rows[0]?.exchange_rate,
    //   original_currency_code: result.rows[0]?.original_currency_code,
    // });

    // console.log('🔍 [FX DEBUG] getTransactionById - raw result row:', {
    //   transaction_id: result.rows[0]?.transaction_id,
    //   transaction_type_name: result.rows[0]?.transaction_type_name,

    //   original_amount: result.rows[0]?.original_amount,
    //   original_amount_type: typeof result.rows[0]?.original_amount,
    //   original_currency_id: result.rows[0]?.original_currency_id,
    //   exchange_rate: result.rows[0]?.exchange_rate,
    //   exchange_rate_type: typeof result.rows[0]?.exchange_rate,
    //   original_currency_code: result.rows[0]?.original_currency_code,
    // });

    //---------DEBUG---------
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const transaction = result.rows[0];
    //------DEBUG-----
    console.log('🔍 [FX DEBUG] getTransactionById - parsed transaction:', {
      transaction_id: transaction.transaction_id,
      transaction_type_name: transaction.transaction_type_name,
      original_amount: transaction.original_amount,
      original_amount_parsed: transaction.original_amount
        ? parseFloat(transaction.original_amount)
        : null,
      exchange_rate: transaction.exchange_rate,
      exchange_rate_parsed: transaction.exchange_rate
        ? parseFloat(transaction.exchange_rate)
        : null,
      original_currency_code: transaction.original_currency_code,
    });
    //---------DEBUG---------
    res.json({
      transaction_id: transaction.transaction_id,
      description: transaction.description,
      amount: parseFloat(transaction.amount),
      currency_code: transaction.currency_code,
      original_amount: transaction.original_amount
        ? parseFloat(transaction.original_amount)
        : null,
      original_currency_code: transaction.original_currency_code,
      exchange_rate: transaction.exchange_rate
        ? parseFloat(transaction.exchange_rate)
        : null,
      exchange_rate_source: transaction.exchange_rate_source,
      exchange_rate_timestamp: transaction.exchange_rate_timestamp,
      transaction_actual_date: transaction.transaction_actual_date,
      transaction_local_date: transaction.transaction_local_date,
      transaction_local_time: transaction.transaction_local_time,
      account_id: transaction.account_id,
      account_name: transaction.account_name,
      account_type_name: transaction.account_type_name,
      movement_type_id: transaction.movement_type_id,
      movement_type_name: transaction.movement_type_name,
      transaction_type_id: transaction.transaction_type_id,
      transaction_type_name: transaction.transaction_type_name,
      // Both ids were already selected and then dropped here, so the consumer
      // had a name with nothing to link it to.
      source_account_id: transaction.source_account_id,
      source_account_name: transaction.source_account_name,
      source_account_type: transaction.source_account_type,
      destination_account_id: transaction.destination_account_id,
      destination_account_name: transaction.destination_account_name,
      destination_account_type: transaction.destination_account_type,
      status: transaction.status,
      account_balance_after_tr: parseFloat(
        transaction.account_balance_after_tr,
      ),
    });
  } catch (error) {
    console.error('Error fetching transaction by ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}
