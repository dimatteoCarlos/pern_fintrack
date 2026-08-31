//backend/src/fintrack_api/controllers/accountCreationController.js

// Inludes: createBasicAccount
// createDebtorAccount,createPocketAccount,

import pc from 'picocolors';
import { pool } from '../../db/config/configDB.js';
import { createError, handlePostgresError } from '../../utils/errorHandling.js';

import { requireUserId } from '../../utils/authUtils/requireUserId.js';

import {
  determineTransactionType,
  formatDate,
  formatDateToDDMMYYYY,
  normalizePersonName,
} from '../../utils/helpers.js';
import { recordTransaction } from '../../utils/fintrackUtils/transactionManagement/recordTransaction.js';
import { checkAndInsertAccount } from '../../utils/fintrackUtils/accountManagement/checkAndInsertAccount.js';
import {
  verifyAccountExistence,
  verifyAccountExists,
} from '../../utils/fintrackUtils/accountManagement/verifyAccountExistence.js';
import { setAccountBalanceFromLedger } from '../../utils/fintrackUtils/accountManagement/setAccountBalanceFromLedger.js';
import { lockAndDeriveBalances } from '../../utils/fintrackUtils/accountManagement/lockAndDeriveBalances.js';
import { insertAccount } from '../../utils/fintrackUtils/accountManagement/insertAccount.js';
import { getTransactionTypeId } from '../../utils/fintrackUtils/accountDataRetrieval/getTransactionTypeId.js';

import { determineSourceAndDestinationAccounts } from '../../utils/fintrackUtils/accountManagement/determineSourceAndDestinationAccounts.js';
import { prepareTransactionOption } from '../../utils/fintrackUtils/transactionManagement/prepareTransactionOption.js';

//FX dependencies
import { ACCOUNTING_CURRENCY_CODE } from '../config/fintrackConfig.js';
import { getCurrencyId } from '../../utils/currencyLookup.js';
import { currencyAmountConversion } from '../services/fx_services/conversion/currencyAmountConversion.js';

import { buildFxMetadata } from '../../utils/fintrackUtils/transactionManagement/fxMetadataHelper.js';

//Pocket deadline rules: this is the authority, the browser schema only mirrors them.
import { getUserTimeZone } from '../../utils/fintrackUtils/date-utils/getUserTimeZone.js';
import {
  checkDesiredDate,
  defaultDesiredDate,
} from '../../utils/fintrackUtils/date-utils/pocketDeadline.js';
import {
  rateDayForOpening,
  resolveOpeningDay,
} from '../../utils/fintrackUtils/date-utils/resolveOpeningDay.js';

//--------------------------------
//endpoint: post: /api/fintrack/account/new_account/account_type_name?user=UUID
//use this only for bank, income_source and investment accounts

export const createBasicAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount
  //account types: bank, income_sorce, investment.Example, cash and slack accounts can be created as bank type account.
  //movement_type_name:'account-opening', movement_type_id: 8, transaction_type_name:deposit,
  console.log(pc.blueBright('createBasicAccount'));

  // console.log('body:',req.body,'params:',req.params,'query:',req.query,'path:',req.path,'originalUrl:',req.originalUrl );

  const client = await pool.connect();

  try {
    const { userId } = req.user;
    //check if the userId exist in the database or verifyUser
    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //--------
    //account basic data
    const {
      type: account_type_name, //not necessary just for developing
      name: newAccountName,
      currency: currency_code,
      amount,
      date,
      transactionActualDate,
      sourceAccountId: selectedAccountInput, //adaptar para cambiar a sourceAccountTypeName
    } = req.body;
    //-----------
    //check for the account_type_name = bank
    //check coherence of type account requested
    const typeAccountRequested = req.originalUrl.split('/').pop().split('?')[0];

    if (account_type_name) {
      const checkTypeCoherence = typeAccountRequested === account_type_name;
      //here under dev mode typeAccountRequested is just to confirm
      if (!checkTypeCoherence || !typeAccountRequested) {
        const message = `Check coherence between account type requested on url: ${typeAccountRequested.toUpperCase()} vs account type entered: ${account_type_name.toUpperCase()}`;
        console.warn('Warning:', pc.cyanBright(message));
        throw new Error(message);
      }
    }
    //---------------------------------
    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : transactionActualDate;

    const account_start_date =
      date && date !== ''
        ? date
        : !transactionActualDate || transactionActualDate == ''
          ? new Date()
          : transactionActualDate;

    // The opening must belong to the month in course, the same window a
    // movement is held to. Validated against the value the row will actually
    // carry, not against req.body.date, so the two cannot disagree.
    const openingTimeZone = await getUserTimeZone(client, userId);
    const openingDay = resolveOpeningDay(account_start_date, openingTimeZone);
    const openingRateDay = rateDayForOpening(openingDay, openingTimeZone);

    if (amount < 0) {
      const message = 'Amount must be >= 0. Tray again!';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //-----------------------
    // console.log(pc.bgCyan('userId', userId));
    //-----------------------

    //check input data
    if (!account_type_name || !currency_code || !newAccountName) {
      const message =
        'Currency_code, account name and account type name fields are required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }

    //get all account types and then get the account type id requested

    const accountTypeQuery = `SELECT * FROM account_types`;

    const accountTypeResult = await pool.query(accountTypeQuery);

    const accountTypeArr = accountTypeResult.rows;
    // console.log('🚀 ~ createAccount ~ accountTypeArr:', accountTypeArr,  accountTypeArr[0]);

    const accountTypeIdReqObj = accountTypeArr.filter(
      (type) => type.account_type_name == account_type_name.trim(),
    )[0];
    const accountTypeIdReq = accountTypeIdReqObj.account_type_id;
    console.log('🚀 ~ createAccount ~ account_type_id:', accountTypeIdReq);
    //--------------------------------
    //verify account existence in user_accounts by userId and account name
    const accountExist = await verifyAccountExistence(
      client,
      userId,
      newAccountName,
      account_type_name,
    );
    // console.log('🚀 ~ createBasicAccount ~ accountExist:', accountExist);
    //---------------------------------
    //get currency id from currency_code requested
    const currencyQuery = `SELECT * FROM currencies`;
    const currencyResult = await pool.query(currencyQuery);
    const currencyArr = currencyResult?.rows;
    const currencyIdReq = currencyArr.filter(
      (currency) => currency.currency_code === currency_code,
    )[0].currency_id;
    //-------debug-----
    console.log('🚀 ~ createBasicAccount ~ currencyIdReq:', currencyIdReq);
    //-----------------
    const newaccount_starting_amount = amount
      ? Math.abs(parseFloat(amount))
      : 0.0;

    const isTransfer = newaccount_starting_amount !== 0;

    // console.log('🚀 ~ createAccount ~ currencyIdReq:', currencyIdReq);
    //---------------------------------
    // console.log("--- FK DEBUGING / DEBUG DE LLAVES FORÁNEAS ---");
    // console.log("User ID:", userId);
    // console.log("Currency ID encontrado:", currencyIdReq);
    // console.log("Account Type ID encontrado:", accountTypeIdReq);
    // console.log("Movement Type ID (Hardcoded):", 8);
    // console.log("---------------------------------");

    // =============================
    // 💰 FX CONVERSION
    // =============================
    // Get original currency ID and accounting currency ID
    const originalCurrencyId = currencyIdReq;
    const accountingCurrencyId = await getCurrencyId(
      pool,
      ACCOUNTING_CURRENCY_CODE,
    );
    // const accountingCurrencyCode = ACCOUNTING_CURRENCY_CODE.toUpperCase();

    let convertedAmount = newaccount_starting_amount;
    let exchangeRate = 1.0;
    let exchangeRateSource = 'identity';
    let exchangeRateTimestamp = new Date();

    if (currency_code !== ACCOUNTING_CURRENCY_CODE) {
      // Valued on the day the account was opened, not the day the form was
      // submitted. A day this month that no source can price is refused with a
      // 422 by the resolver, never valued at today's rate.
      const conversion = await currencyAmountConversion(
        newaccount_starting_amount,
        currency_code,
        ACCOUNTING_CURRENCY_CODE,
        openingRateDay,
      );

      convertedAmount = conversion.amount.toNumber();
      exchangeRate = conversion.rate;
      exchangeRateSource = conversion.source;
      exchangeRateTimestamp = conversion.fetchedAt;
    }
    //Use convertedAmount for account balance
    const newAccountBalance = convertedAmount;

    // Build FX metadata using the helper
    const fxMetadata = await buildFxMetadata(
      //original amount
      newaccount_starting_amount,
      //original currency ID
      originalCurrencyId,
      //database pool
      pool,
      //options
      {
        exchangeRate,
        exchangeRateSource,
        exchangeRateTimestamp,
      },
    );
    //---------------------------------
    await client.query('BEGIN');
    //NEW ACCOUNT TO CREATE AND COUNTER TRANSACTION ACCOUNT (SLACK)
    // const newaccount_starting_amount = amount
    //   ? Math.abs(parseFloat(amount))
    //   : 0.0;
    //-------------------------------
    //-------NEW ACCOUNT AND COUNTER (SLACK) ACCOUNT INFO PREP -------
    //DETERMINE TRANSACTION TYPE NAME FOR EACH ACCOUNT
    let transactionType = 'account-opening';
    let counterTransactionType = 'account-opening';

    // console.log(
    //   '🚀 ~ createBasicAccount ~ account_type_name:',
    //   account_type_name
    // );

    if (account_type_name === 'bank' || account_type_name === 'investment') {
      transactionType = 'deposit';
      counterTransactionType = 'withdraw';
    }
    // console.log(
    //   'TRANSACTIONS TYPE:',
    //   transactionType,
    //   counterTransactionType
    // );

    //---- COUNTER (SLACK) ACCOUNT INFO -----
    const counterAccountInfo = await checkAndInsertAccount(
      client,
      userId,
      'slack',
    );

    const counterAccountTransactionAmount = -convertedAmount; //it will always be withdraw

    // The compensation account, locked and derived like every other account a
    // movement touches. No funds check here on purpose — this counterparty is
    // the one account allowed to overdraft — but the figure still has to be the
    // ledger's, because it is the balance this opening entry states in the audit
    // trail. A stored figure would have the row explain the account with a
    // number the account does not hold.
    const counterAccountId = counterAccountInfo.account.account_id;

    const ledgerBalances = await lockAndDeriveBalances(client, userId, [
      counterAccountId,
    ]);

    const newCounterAccountBalance =
      parseFloat(ledgerBalances.get(counterAccountId)) - convertedAmount;

    //transaction type id's
    const transactionTypeDescriptionIds = await getTransactionTypeId(
      client,
      transactionType,
      counterTransactionType,
    );
    // console.log(('getTransactionTypeIds:', transactionTypeDescriptionIds));
    const { transaction_type_id, countertransaction_type_id } =
      transactionTypeDescriptionIds;

    const counterTransactionDescription = `Transaction: ${counterTransactionType}. Account ${counterAccountInfo.account.account_name} (bank, ID: ${counterAccountInfo.account.account_id}). Amount:${counterAccountTransactionAmount} ${currency_code}. Reference: ${newAccountName}). Date: ${formatDateToDDMMYYYY(transaction_actual_date)}`;

    const slackCounterAccountInfo = {
      user_id: userId,
      description: counterTransactionDescription,
      transaction_type_id: countertransaction_type_id,
      transaction_type_name: counterTransactionType,
      amount: parseFloat(counterAccountTransactionAmount, 2),
      currency_id: accountingCurrencyId,
      account_id: counterAccountInfo.account.account_id,
      transaction_actual_date: transaction_actual_date,
      currency_code,
      account_name: counterAccountInfo.account.account_name,
      account_type_name: 'bank',
      account_type_id: counterAccountInfo.account.account_type_id,
      account_balance: parseFloat(newCounterAccountBalance),
      // FX metadata
      ...fxMetadata,
    };

    // The funding account's stored balance is written below, after the rows
    // exist. It was commented out entirely, which is the defect this closes:
    // opening an account funded from another left that other account's stored
    // figure behind, saying it still held what it had just given away.

    //----- INSERT NEW ACCOUNT -------
    const { account_basic_data } = await insertAccount(
      client,
      userId,
      newAccountName,
      accountTypeIdReq,
      accountingCurrencyId,
      newAccountBalance, //converted amount
      newAccountBalance,
      account_start_date ?? transaction_actual_date,
    );

    const account_id = account_basic_data.account_id;

    const transactionDescription = `Transaction: ${transactionType}. Account: ${newAccountName}. Type: ${account_type_name}. Initial-(${transactionType}). Amount: ${newaccount_starting_amount} ${currency_code}. Date: ${formatDateToDDMMYYYY(transaction_actual_date)}`;

    const message = `${newAccountName} account of type ${account_type_name} with number ${account_id} was successfully created `;
    // console.log('🚀 ~ createAccount ~ message:', message);

    //-------NEW ACCOUNT INFO -------
    const newAccountInfo = {
      user_id: userId,
      description: transactionDescription,
      transaction_type_id,
      transaction_type_name: transactionType,
      amount: convertedAmount,
      currency_id: accountingCurrencyId,
      account_id: account_basic_data.account_id,
      // This leg is the account's own opening row; the counter leg below is not.
      opening_for_account_id: account_basic_data.account_id,
      transaction_actual_date: transaction_actual_date,
      currency_code,
      account_name: newAccountName,
      account_type_name,
      account_type_id: account_basic_data.account_type_id,
      account_balance: newAccountBalance,
      //FX metadata
      ...fxMetadata,
      // original_amount: newaccount_starting_amount,//XX
      // original_currency_id: originalCurrencyId,//XX
      // exchange_rate: exchangeRate,//XX
      // exchange_rate_source: exchangeRateSource,
      // exchange_rate_timestamp: exchangeRateTimestamp,
      // exchange_rate_target_currency_id: accountingCurrencyId,
    };
    // console.log(
    //   'slackCounter:',
    //   slackCounterAccountInfo,
    //   'newAccount:',
    //   newAccountInfo
    // );

    //------------------------------
    //------ RECORD TRANSACTION INTO transactions table ----
    //--- determine which account serves as a SOURCE OR DESTINATION account
    let destination_account_id = newAccountInfo.account_id,
      source_account_id = newAccountInfo.account_id;

    if (isTransfer) {
      destination_account_id = newAccountInfo.account_id;
      source_account_id = counterAccountInfo.account.account_id;
    }
    // console.log('id:', destination_account_id, source_account_id);

    //------MOVEMENT TYPE ASSOCIATED TO CREATE A NEW ACCOUNT ---
    const movement_type_id = 8; //account opening
    //-------------------------------------
    //-REGISTER TRANSACTIONS OF NEW ACCOUNT AND THE COUNTER ACCOUNT
    //--Register transaction ----
    //Add deposit transaction
    //Rules: movement_type_name:receive, movement_type_id: 8, transaction_type_name:deposit/account-opening,transaction_type_id: 2/5
    //-REGISTER NEW ACCOUNT TRANSACTION --
    const transactionOption = prepareTransactionOption(
      newAccountInfo,
      source_account_id,
      destination_account_id,
      movement_type_id,
    );

    const recordTransactionInfo = await recordTransaction(
      client,
      transactionOption,
    );

    //--REGISTER COUNTER ACCOUNT (SLACK) TRANSACTION -
    const counterTransactionOption = prepareTransactionOption(
      slackCounterAccountInfo,
      source_account_id,
      destination_account_id,
      movement_type_id,
    );

    const counterTransactionInfo = isTransfer
      ? await recordTransaction(client, counterTransactionOption)
      : {};

    // Only when this opening actually took money from another account. With no
    // starting amount there is no counterparty row, so there is nothing whose
    // projection would have changed.
    if (isTransfer) {
      await setAccountBalanceFromLedger(
        client,
        slackCounterAccountInfo.account_id,
        userId,
      );
    }
    //--------------------------------
    await client.query('COMMIT');
    //---deliver user_id only once
    delete account_basic_data.user_id;
    delete counterTransactionInfo.user_id; //que pasa si es undefined en validacion?
    delete transactionOption.userId;
    delete recordTransactionInfo.user_id;
    //-------------------------------
    return res.status(201).json({
      status: 201,
      data: {
        user_id: userId,
        account_basic_data: {
          ...account_basic_data,
          account_type_name,
          currency_code,
        },

        new_account_data: {
          account_name: newAccountInfo.account_name,
          transaction_data: transactionOption,
          transaction_info: {
            ...recordTransactionInfo,
            amount: parseFloat(recordTransactionInfo.amount),
          },
          transaction_type_name: newAccountInfo.transaction_type_name,
        },

        counter_account_data: {
          account_name: counterTransactionInfo.account_name,
          transaction_data: counterTransactionOption,
          transaction_info: counterTransactionInfo,
          transaction_type_name: slackCounterAccountInfo.transaction_type_name,
          account_balance: slackCounterAccountInfo.account_balance,
          account_type_name: slackCounterAccountInfo.account_type_name,
        },
      },
      message,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    //handle pg errors
    const { code, message, errorCode, details } = handlePostgresError(error);
    console.error(pc.red(`Error creating new account:`), message);
    return next(createError(code, message, { errorCode, details }));
  } finally {
    client.release();
  }
};
//end of createBasicAccount
//---------------------------
//POST: http://localhost:5000/api/fintrack/account/new_account/debtor?user=6e0ba475-bf23-4e1b-a125-3a8f0b3d352c
export const createDebtorAccount = async (req, res, next) => {
  //data structure:
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount
  //account_type_name: debtor.
  //movement_type_name:'account-opening', movement_type_id: 8, transaction_type_name:lend / borrow,
  console.log(pc.blueBright('createDebtorAccount'));
  // console.log(req.body, req.user, req.params, req.query);
  const client = await pool.connect();
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;
    //data from debt new profile input ui form - frontend fintrack
    const {
      account_type, //refers to debtor account
      lastname: debtor_lastname,
      name: debtor_name,
      amount,

      selected_account_name, //refers to bank account name
      selected_account_type, //refers to bank account type
      transaction_type, //here, transaction_type in the ui frontend input form, is transaction type name (lending/borrowing), meanwhile in other input to create other accounts, it refers to type of account (bank, pocket_saving, ecc).  Check fintrack frontend.
    } = req.body;
    //-----------------------------------
    const transactionTypeInputOptions = {
      lending: 'lend',
      borrowing: 'borrow',
    };
    const selectedAccountTransactionType =
      transactionTypeInputOptions[transaction_type.trim().toLowerCase()] ??
      'lend';
    const debtorTransactionType =
      selectedAccountTransactionType === 'lend' ? 'borrow' : 'lend';
    const debtorAccountType = account_type ?? 'debtor';
    //-------------------------------
    //NEW DEBTOR ACCOUNT BASIC DATA
    // Falls back to the accounting currency rather than a literal 'usd', which
    // stops being true the moment the installation is configured otherwise.
    const { currency } = req.body;
    const currencyCode = currency ? currency : ACCOUNTING_CURRENCY_CODE;
    // Cleaned once and reused: the composed account_name and the parts stored
    // in debtor_accounts must be the same strings. Case is left as typed.
    const debtorLastnameInput = normalizePersonName(debtor_lastname);
    const debtorNameInput = normalizePersonName(debtor_name);
    const newAccountName = `${debtorLastnameInput}, ${debtorNameInput}`;

    //currency and account_type data, better taken from frontend
    if (
      !account_type ||
      !currencyCode ||
      !debtorLastnameInput ||
      !debtorNameInput
    ) {
      const message =
        'Currency_code, account name and account type name fields are required';
      //theses fields are required, although, not originally considered in the ui input form frontend.
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //---
    // Resolved with the same helper as the accounting currency rather than by
    // filtering the whole catalogue, which yields undefined when the code does
    // not match and lets it travel as a NULL into a NOT NULL column.
    let currencyIdReq;

    try {
      currencyIdReq = await getCurrencyId(pool, currencyCode);
    } catch {
      const message = `Unknown currency code: ${currencyCode}`;
      console.warn(pc.red(message));
      return res.status(400).json({ status: 400, message });
    }

    const accountingCurrencyId = await getCurrencyId(
      pool,
      ACCOUNTING_CURRENCY_CODE,
    );

    //---------------------------------------
    //Validation of amount value
    if (parseFloat(amount) < 0) {
      const message = 'Transaction amount value must be >= 0';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const value = amount ? parseFloat(amount) : 0.0;
    if (isNaN(value)) {
      return res
        .status(400)
        .json({ status: 400, message: 'Amount must be a valid number' });
    }
    //---------------------------------------
    //set the transaction date for creating new profile debtor
    const { date, transactionActualDate } = req.body;
    const account_start_date = !!date && date !== '' ? date : new Date();
    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : transactionActualDate;

    // Same window as every other operative date: the month in course.
    const openingTimeZone = await getUserTimeZone(client, userId);
    const openingDay = resolveOpeningDay(account_start_date, openingTimeZone);
    const openingRateDay = rateDayForOpening(openingDay, openingTimeZone);

    //---------------------------------------
    //get all account types and then get the account type id for the account name requested. although id debtor is 3 and id bank is 1.
    const accountTypeQuery = `SELECT * FROM account_types`;
    const accountTypeResult = await pool.query(accountTypeQuery);
    const accountTypeArr = accountTypeResult.rows;

    // console.log('🚀 ~ createAccount ~ currencyIdReq:', currencyIdReq);
    // console.log(pc.cyan(`userId: ${userId}`));
    // console.log('dateInput:', transactionActualDate, transaction_actual_date);
    // console.log(
    //   'selected_account_type01',
    //   { selected_account_type }
    // );

    //for debtor account
    const debtorAccountTypeIdReqObj = accountTypeArr.filter(
      (type) => type.account_type_name == debtorAccountType.trim(),
    )[0];
    const debtorAccountTypeIdReq = debtorAccountTypeIdReqObj.account_type_id;
    // console.log('🚀 ~ createAccount ~ account_type_id:', debtorAccountTypeIdReq,'actypetArr', accountTypeArr);
    if (debtorAccountTypeIdReq === undefined) {
      throw new Error(`Account type "${debtorAccountType}" not found`);
    }

    //for selected account
    const selectedAccountTypeIdReqObj = accountTypeArr.filter(
      (type) =>
        type.account_type_name.trim().toLowerCase() ==
        selected_account_type.trim().toLowerCase(),
    )[0];
    const selectedAccountTypeIdReq =
      selectedAccountTypeIdReqObj.account_type_id;

    // console.log("🚀 ~ createDebtorAccount ~ selectedAccountTypeIdReqObj:", selectedAccountTypeIdReqObj)
    // console.log('🚀 ~ createAccount ~ selected_account_type_id:', selectedAccountTypeIdReq);

    if (selectedAccountTypeIdReq === undefined) {
      throw new Error(
        `Selected Account type "${selected_account_type}" not found`,
      );
    }
    //----------------------------
    //verify and assure new debtor account does not exist in user_accounts table and handle error
    const debtorAccountExist = await verifyAccountExistence(
      client,
      userId,
      newAccountName,
      debtorAccountType,
    );
    // console.log('🚀 ~ createDebtorAccount ~ debtorAccountExist:',  newAccountName,debtorAccountExist );
    //----------------------------------------
    //verify selected account existence and get account_id from user_accounts table or handling error
    const selectedAccountExists = await verifyAccountExists(
      client,
      userId,
      selected_account_name,
      selected_account_type,
    );
    // console.log('selectedAccountExist',selectedAccountExists, selectedAccountExists.accountId)

    //============================
    //NEW VERSION:get selected account info as the counter account. checkAndInsertAccount gets the selected account info
    // console.log('arg', userId,
    //   selected_account_name,
    //   selected_account_type)

    const counterAccountInfo = await checkAndInsertAccount(
      client,
      userId,
      selected_account_name,
      selected_account_type,
    );
    const messageCounterAccountInfo = counterAccountInfo.exists
      ? `${selected_account_name} exists`
      : `${selected_account_name} didn't exist and it was created`;
    // console.log(
    //   '🚀 ~ createDebtorAccount ~ messageCounterAccountInfo:',messageCounterAccountInfo,
    //   counterAccountInfo.account.account_balance
    // );
    //==================================
    //---check for enough funds
    //rules
    //overdraft not allowed: BANK TO DEBTOR , others: investment to investment, bank to bank, bank or investment to pocket, or pocket to any, bank to category_budget, bank to investment,

    //allowed overdraft : DEBTOR TO ANY BANK, slack to any account, income_source to any account
    //not possible transfers: category_budget to any,other than bank to category_budget, any to income_source. Any transaction between debt and other account than bank

    // The bank account this loan is drawn from holds its balance in the
    // accounting currency, so the amount has to be converted before it can be
    // compared against it. Comparing the typed figure would block valid loans
    // and let invalid ones through as soon as the form offers a currency.
    let convertedValue = value;
    let exchangeRate = 1.0;
    let exchangeRateSource = 'identity';
    let exchangeRateTimestamp = new Date();

    if (currencyCode !== ACCOUNTING_CURRENCY_CODE && value !== 0.0) {
      const conversion = await currencyAmountConversion(
        value,
        currencyCode,
        ACCOUNTING_CURRENCY_CODE,
        openingRateDay,
      );
      convertedValue = conversion.amount.toNumber();
      exchangeRate = conversion.rate;
      exchangeRateSource = conversion.source;
      exchangeRateTimestamp = conversion.fetchedAt;
    }

    // The check itself lives below, inside the transaction. It cannot run here:
    // the figure it needs has to come from the ledger with the account row
    // locked, and there is no transaction open yet at this point.
    const isCheckForFundsRequired =
      selectedAccountTransactionType === 'lend' && Number(convertedValue) > 0;
    //===============================
    //-------------------------------
    //--DEBTOR ACCOUNT --------
    //--newdebtor_initial_balance
    // Sign is applied to both figures: the audit trail has to keep the same
    // direction as the balance it explains.
    const isOutgoing = debtorTransactionType === 'lend' && value !== 0.0;
    const originalTransactionAmount = isOutgoing ? value * -1 : value;
    const transactionAmount = isOutgoing ? convertedValue * -1 : convertedValue;
    const newAccountBalance = transactionAmount;

    // The origin travels on the metadata: the first argument is the figure as
    // typed, the rate is the one that produced the converted amount.
    const fxMetadata = await buildFxMetadata(
      originalTransactionAmount,
      currencyIdReq,
      pool,
      { exchangeRate, exchangeRateSource, exchangeRateTimestamp },
    );
    //------- NEW DEBTOR BASIC ACCOUNT INFO ----------
    await client.query('BEGIN');

    // The account the loan is drawn from, locked and derived before anything is
    // decided or written. Two defects close here at once, the same pair the
    // transfer path closed: the stored column has drifted from the ledger, so
    // the ceiling this check enforced was not the account's and the refusal
    // message quoted that wrong ceiling to the owner; and nothing serialised
    // two simultaneous draws on one account, so both read the same prior state,
    // both passed and both wrote.
    //
    // The lend balance is also what the counter movement is carried forward
    // from further down, so a stale figure here was rewritten intact into the
    // projection. Deriving makes that projection self-heal on the next movement
    // of the account instead of propagating the drift.
    const counterAccountId = counterAccountInfo.account.account_id;

    const ledgerBalances = await lockAndDeriveBalances(client, userId, [
      counterAccountId,
    ]);

    const counterAccountBalance = parseFloat(
      ledgerBalances.get(counterAccountId),
    );

    if (isCheckForFundsRequired && counterAccountBalance < parseFloat(convertedValue)) {
      const message = `Not enough funds to transfer ${ACCOUNTING_CURRENCY_CODE} ${parseFloat(convertedValue)} from account ${counterAccountInfo.account.account_name} (${ACCOUNTING_CURRENCY_CODE} ${counterAccountBalance})`;
      console.warn(pc.magentaBright(message));

      // Thrown rather than returned: the transaction is open now, and a bare
      // response would leave it open on a connection handed back to the pool.
      // The catch below rolls back.
      throw createError(400, message);
    }

    //---INSERT DEBTOR ACCOUNT into user_accounts table
    const { account_basic_data } = await insertAccount(
      client,
      userId,
      newAccountName,
      debtorAccountTypeIdReq,
      accountingCurrencyId, //countable currency ID
      newAccountBalance,
      newAccountBalance,
      account_start_date ?? transaction_actual_date,
    );

    const account_id = account_basic_data.account_id;
    // console.log('account_basic_data',account_basic_data)
    //--------------------------------
    //---INSERT DEBTOR ACCOUNT into debtor_accounts table
    const debtorInsertQuery = {
      text: `INSERT INTO debtor_accounts (account_id, debtor_lastname, debtor_name, value,
       currency_id,
       selected_account_name, selected_account_id,
       account_start_date,
       original_value, original_currency_id, exchange_rate, exchange_rate_source, exchange_rate_timestamp, exchange_rate_target_currency_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      values: [
        account_id,
        debtorLastnameInput,
        debtorNameInput,
        newAccountBalance,
        accountingCurrencyId,
        selected_account_name,
        selectedAccountExists.accountId,
        account_start_date,
        originalTransactionAmount,
        currencyIdReq,
        exchangeRate,
        exchangeRateSource,
        exchangeRateTimestamp,
        accountingCurrencyId,
      ],
    };

    const debtorAccount = await client.query(debtorInsertQuery);

    // currency_code describes value, which is now the converted figure. The
    // code the user picked is recoverable through original_currency_id.
    const debtor_account = {
      ...debtorAccount.rows[0],
      currency_code: ACCOUNTING_CURRENCY_CODE,
      account_type_name: debtorAccountType,
    };
    //----------------------------------
    //DETERMINE THE TRANSACTION TYPE ID FOR NEW DEBTOR ACCOUNT AND FOR COUNTER ACCOUNT (SELECTED ACCOUNT OR SLACK)
    //----------------------------------
    //transaction type comes from FE, though
    const transactionTypeDescriptionObj = {
      transactionType: debtorTransactionType,
      counterTransactionType: selectedAccountTransactionType,
    };

    const { transactionType, counterTransactionType } =
      transactionTypeDescriptionObj;
    //-----------------------------------
    //get the transaction type id's
    const transactionTypeDescriptionIds = await getTransactionTypeId(
      client,
      transactionTypeDescriptionObj.transactionType,
      transactionTypeDescriptionObj.counterTransactionType,
    );

    const { transaction_type_id, countertransaction_type_id } =
      transactionTypeDescriptionIds;

    const isToOpenNewAccount = transactionAmount === 0.0 ? true : false;
    // The amount printed is the converted one, so the code printed next to it
    // is the accounting one. Pairing it with the typed code would state a
    // figure the user never wrote in a currency they did not pick.
    const transactionDescription = `Transaction: account-opening. Account: "${newAccountName}" (${debtorAccountType}). Initial-( ${isToOpenNewAccount ? 'account-opening' : debtorTransactionType}). Amount: ${transactionAmount} ${ACCOUNTING_CURRENCY_CODE}. Reference:${selected_account_name}. Date: ${formatDate(transaction_actual_date)}`;

    //------ DEBTOR NEW ACCOUNT INFO -----
    const newAccountInfo = {
      user_id: userId,
      description: transactionDescription,
      transaction_type_id,
      transaction_type_name: transactionType,
      amount: parseFloat(transactionAmount),
      currency_id: accountingCurrencyId,
      account_id: account_basic_data.account_id,
      // The debtor's own opening row. Stated rather than inferred: for a debtor
      // the user owes, the money flows away from the account being opened, and
      // the direction test picked the funding leg instead.
      opening_for_account_id: account_basic_data.account_id,
      transaction_actual_date,
      currency_code: ACCOUNTING_CURRENCY_CODE,
      account_name: newAccountName,
      account_type_name: debtorAccountType,
      account_type_id: account_basic_data.account_type_id,
      account_balance: newAccountBalance,
      ...fxMetadata,
    };

    //--------------------------------
    const counterAccountTransactionAmount = -Number(transactionAmount);

    // Carried forward from the derived figure, not the stored one. Reading the
    // stored column here rewrote whatever drift it held straight back into the
    // projection, so the error survived every later movement; from the ledger
    // the projection corrects itself the next time this account moves.
    const newCounterAccountBalance =
      counterAccountBalance + counterAccountTransactionAmount;

    // Its own metadata: the counter movement runs in the opposite direction, so
    // reusing the debtor's would store an origin whose sign contradicts the
    // amount it is supposed to explain.
    const counterFxMetadata = await buildFxMetadata(
      -Number(originalTransactionAmount),
      currencyIdReq,
      pool,
      { exchangeRate, exchangeRateSource, exchangeRateTimestamp },
    );

    const counterTransactionDescription = `Transaction: ${counterTransactionType}. Account: ${counterAccountInfo.account.account_name} (${selected_account_type}), number: ${counterAccountInfo.account.account_id}. Amount: ${counterAccountTransactionAmount} ${ACCOUNTING_CURRENCY_CODE}. Account reference: ${newAccountName}. Date: ${formatDate(transaction_actual_date)}`;
    //----------------------------------
    //--COUNTER ACCOUNT INFO (SLACK OR SELECTED ACCOUNT ------
    const slackCounterAccountInfo = {
      user_id: userId,
      description: counterTransactionDescription,
      transaction_type_id: countertransaction_type_id,
      transaction_type_name: counterTransactionType,
      amount: parseFloat(counterAccountTransactionAmount),
      currency_id: accountingCurrencyId,
      account_id: counterAccountInfo.account.account_id,
      transaction_actual_date,
      currency_code: ACCOUNTING_CURRENCY_CODE,
      account_name: counterAccountInfo.account.account_name,
      account_type_name: 'bank',
      account_type_id: counterAccountInfo.account.account_type_id,
      account_balance: newCounterAccountBalance,
      ...counterFxMetadata,
    };

    // The funding account's stored balance is NOT written here. It is
    // re-derived from the ledger once the movement rows exist, below: a
    // derivation at this point would read the ledger without the opening
    // movement and store the balance the account held before it.

    // console.log('updateCounterAccountInfo iput ',  newCounterAccountBalance,
    //   slackCounterAccountInfo.account_id,
    //   transaction_actual_date)

    //--- determine which account serves as a SOURCE OR DESTINATION account
    const { destination_account_id, source_account_id, isAccountOpening } =
      determineSourceAndDestinationAccounts(newAccountInfo, counterAccountInfo);

    //------- RECORD TRANSACTION INTO transactions table ----
    //-------------------------------------------------------
    //--------Rules to register a transaction----------------
    //movement_type_name:account-opening, movement_type_id: 8,  transaction_type_name:lend/borrow/account-opening, transaction_type_id: 3/4/5
    //nombre de la cuenta principal- tipo de cuenta -initial-transaction type name
    //*************************************
    //----MOVEMENT TYPE ASSOCIATED TO CREATE A NEW ACCOUNT ---
    const movement_type_id = 8; //account-opening
    //--------REGISTER NEW ACCOUNT TRANSACTION -------
    const transactionOption = prepareTransactionOption(
      newAccountInfo,
      source_account_id,
      destination_account_id,
      movement_type_id,
    );
    const recordTransactionInfo = await recordTransaction(
      client,
      transactionOption,
    );

    //--------REGISTER COUNTER ACCOUNT (SLACK) TRANSACTION ---
    const counterTransactionOption = prepareTransactionOption(
      slackCounterAccountInfo,
      source_account_id,
      destination_account_id,
      movement_type_id,
    );
    const counterTransactionInfo = await recordTransaction(
      client,
      counterTransactionOption,
    );

    // The rows are in, so the projection can be taken from them. The account
    // was locked further up, in ascending id order, and this is a separate
    // statement issued after that lock.
    const updatedCounterAccountInfo = await setAccountBalanceFromLedger(
      client,
      slackCounterAccountInfo.account_id,
      userId,
    );
    // const counterTransactionInfo = !isAccountOpening
    //   ? await recordTransaction(counterTransactionOption)
    //   : {};
    if (process.env.ENV === 'development') {
      console.log(
        '🚀 ~ createBasicAccount ~ updatedCounterAccountInfo:',
        updatedCounterAccountInfo,
        { isAccountOpening },
      );
    }

    await client.query('COMMIT');
    //-------------------------------
    //SUCCESS MESSAGE RESPONSE
    const message = `${newAccountInfo.account_name} account of type ${newAccountInfo.account_type_name} with number ${account_id} was successfully created `;
    console.log('🚀 ~ createAccount ~ message:', message);
    //---deliver user_id only once
    delete account_basic_data.user_id;
    delete counterTransactionInfo.user_id;
    delete recordTransactionInfo.user_id;
    //-------------------------
    return res.status(201).json({
      status: 201,
      data: {
        user_id: userId,
        account_basic_data: {
          ...account_basic_data,
          account_type_name: debtorAccountType,
          // The row was inserted with accountingCurrencyId, so this is the code
          // that describes its balance.
          currency_code: ACCOUNTING_CURRENCY_CODE,
        },
        new_debtor_account: debtor_account,

        new_account_data: {
          account_name: newAccountInfo.account_name,
          transaction_data: transactionOption,
          transaction_info: recordTransactionInfo,
          transaction_type_name: newAccountInfo.transaction_type_name,
        },

        counter_account_data: {
          account_name: counterTransactionInfo.account_name,
          transaction_data: counterTransactionOption,
          transaction_info: counterTransactionInfo,
          transaction_type_name: counterTransactionInfo.transaction_type_name,
        },
      },
      message,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    //handle pg errors
    const { code, message, errorCode, details } = handlePostgresError(error);
    console.error(pc.red('Error creating new debtor account:'), message);
    return next(createError(code, message, { errorCode, details }));
  } finally {
    client.release();
  }
};
//end of createDebtorAccount

//---------------------------------------
//--- CREATE POCKET ACCOUNT — WITHDRAWN --
//---------------------------------------
// A pocket is a planning object and not an account. It holds no balance, it
// takes part in no transfer, and it lives in its own table reached by its own
// endpoints. The handler that wrote one as an account is gone with its route.
//
// The extension table it wrote into still exists and still has readers, and
// the account-type catalog row stays: historical records carry that id.
//------------------------------------
