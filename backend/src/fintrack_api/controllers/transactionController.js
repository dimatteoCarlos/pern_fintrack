import pc from 'picocolors';
import { pool } from '../../db/configDB.js';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import {
  getExpenseConfig,
  getIncomeConfig,
  getDebtConfig,
  getTransferConfig,
  // getInvestmentConfig,
  // getPocketConfig,
} from '../../../utils/movementInputHandler.js';
import { recordTransaction } from '../../../utils/recordTransaction.js';

//endpoint: put:/api/fintrack/transaction/transfer-between-accounts?user=UUID&&movement=expense

//FUNCTIONS DECLARATION
//get the currency_id by the currency_code
export const getCurrencyId = async (currency_code) => {
  const currencyQuery = `SELECT * FROM currencies WHERE currency_code = $1`;
  const currencyResult = await pool.query(currencyQuery, [currency_code]);
  return currencyResult.rows[0]?.currency_id;
};
//get the account_type_id by account_type_name
export const getAccountTypeId = async (accountTypeName) => {
  const accountTypeQuery = `SELECT * FROM account_types WHERE account_type_name =  $1`;
  const accountTypeResult = await pool.query({
    text: accountTypeQuery,
    values: [accountTypeName],
  });

  // console.log(
  //   'Get type id acc By accountTypeName',
  //   accountTypeResult.rows[0]?.account_type_id
  // );
  return accountTypeResult.rows[0]?.account_type_id;
};

//get the account info by user_id, account_name and account_type_name
export const getAccountInfo = async (accountName, accountTypeName, userId) => {
  const accountQuery = `SELECT ua.* FROM user_accounts ua
  JOIN account_types act ON ua.account_type_id = act.account_type_id
  WHERE ua.user_id = $1 AND ua.account_name = $2 AND act.account_type_name = $3`;

  const accountInfoResult = await pool.query({
    text: accountQuery,
    values: [userId, accountName, accountTypeName],
  });
  return accountInfoResult.rows[0];
};

//get the array of ACCOUNT type objects
export const getAccountTypes = async () => {
  const accountTypeQuery = `SELECT * FROM account_types`;
  const accountTypeResult = await pool.query(accountTypeQuery);
  const accountTypeArr = accountTypeResult.rows;
  return accountTypeArr;
};

//get the array of TRANSACTION type objects
export const getTransactionTypes = async () => {
  const transactionTypeQuery = `SELECT * FROM transaction_types`;
  const transactionTypeResult = await pool.query(transactionTypeQuery);
  const transactionTypeArr = transactionTypeResult.rows;
  return transactionTypeArr;
};
//set the sign of the amount according to transaction type
export const balanceMultiplierFn = (transactionTypeName) => {
  const negativeArr = ['withdraw', 'borrow', 'borrowing'];
  const trimTypeName = transactionTypeName.trim().toLowerCase();
  const mult = negativeArr.includes(trimTypeName) ? -1.0 : 1.0;
  // console.log("🚀 ~ balanceMultiplierFn ~ :", mult, 'para', transactionTypeName)
  return mult;
};

export const updateAccountBalance = async (
  newBalance,
  accountId,
  transactionActualDate
) => {
  // console.log('updateAccountBalance tad:', transactionActualDate);
  //assure first the existence of updatedAccountResult
  const insertBalanceQuery = {
    text: `UPDATE user_accounts SET account_balance=$1, updated_at = $2 WHERE account_id = $3 RETURNING *`,
    values: [newBalance, transactionActualDate, accountId],
  };
  const updatedAccountResult = await pool.query(insertBalanceQuery);
  return updatedAccountResult.rows[0];
};

//controller: transferBetweenAccounts
//------------------
//------------------
export const transferBetweenAccounts = async (req, res, next) => {
  console.log(pc.magentaBright('transferBetweenAccounts'));
  //Previously create a named slack account bank type. In the cases where a source or destination account are not known, a bank type account named "slack" is used as a counterpart of the transaction.

  const client = await pool.connect();

  try {
    // const { user: userId, movement: movementName } = req.query;
    const { movement } = req.query;
    const movementName = movement === 'debts' ? 'debt' : movement; //debt movement is called as debts in frontend

    console.log({ movementName });

    // const { user: userId } = req.body;
    const userId =
      req.body.user === '' || !req.body.user ? req.query.user : req.body.user;
    // const userId = req.body.user ?? req.query.user;

    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //----------------------------------------------------

    // Debts and Investment Movements need a compensation account, in this case named "slack", to serve as a counter part of the transaction.

    const checkAndInsertAccount = async (req, res) => {
      try {
        const chekAccountResult = await pool.query(
          'SELECT * FROM user_accounts WHERE account_name = $1',
          ['slack']
        );

        if (chekAccountResult.rows.length > 0) {
          console.log('slack account already exists');
        } else {
          const insertResult = await pool.query(
            'INSERT INTO user_accounts (user_id,account_name,account_type_id,currency_id,account_starting_amount,account_balance,account_start_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
            [userId, 'slack', 1, 1, 0, 0, new Date()]
          );

          console.log(
            'slack account created successfully',
            'account:',
            insertResult.rows[0]
          );
        }
      } catch (error) {
        const message = 'error creating slack account';
        console.error(message, error);
        // return res.status(500).json({ status: 500, message });
      }
    };
    //-------------------------------------------

    if (!movementName) {
      const message = 'movement name is required';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //aqui de antemano sabemos los tipos de movimientos
    if (
      ![
        'expense',
        'income',
        'investment',
        'debt',
        'pocket',
        'transfer',
      ].includes(movementName)
    ) {
      const message = `movement name " ${movementName} " is not correct`;
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //--this is for the old version where debt and investment movements do not consider an explicit counter account
    //la nueva version no requiere gestionar el slack
    // if (
    //   movementName !== 'expense' &&
    //   movementName !== 'income' &&
    //   movementName !== 'transfer'
    // ) {
    //   checkAndInsertAccount(req, res, next, userId);
    // }
    //------------------
    //--get the movement types, get the movement type id and check --------------
    const movement_typesResults = await pool.query(
      `SELECT * FROM movement_types`
    );
    const movement_typesResultsExist = movement_typesResults.rows.length > 0;

    // console.log('movement_types', movement_typesResultsExist)

    if (!movement_typesResultsExist) {
      const message = 'something went wrong with the movement_types table';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const movement_types = movement_typesResults.rows;
    // console.log(
    //   '🚀 ~ transferBetweenAccounts ~ movement_types:',
    //   movement_types
    // );
    //aqui aseguro que el movement introducido exista como tipo , es mas dinamico, porque no necesito pre conocer los tipos
    const movement_type_idResult = movement_types.filter(
      (mov) => mov.movement_type_name === movementName.trim().toLowerCase()
    );
    // console.log(
    //   '🚀 ~ transferBetweenAccounts ~ movement_type_idResult:',
    //   movement_type_idResult
    // );
    // throw new Error

    if (!movement_type_idResult) {
      const message = `movement ${movementName} was not found. Try again with valid movement type!`;
      console.warn(pc.magentaBright(message));
      console.log('🚀 ~ transferBetweenAccounts ~ message:', message);

      throw new Error({ status: 400, message });
      // console.warn(pc.magentaBright(message));
      // return res.status(400).json({ status: 400, message });
    }

    const movement_type_id = movement_type_idResult[0].movement_type_id;

    //---------------------------------------
    //VALIDAR TAMBIEN EL TIPO DE TRANSACTION?
    //since frontend input data form are controlled by selection options, then, data should be considered already validated from frontend. Also, frontend, for selection option gets the data through this api
    //example:expense
    //movementName: expense, sourceAccountTypeName: 'bank', destinationAccountTypeName:'category_budget', sourceAccountTransactionType:withdraw, destinationAccountTransactionType:deposit,
    //---------------------------------------
    const {
      note,
      amount,
      currency: currencyCode,
      type: transactionTypeName, //for old versions of investment or for debt in current version
    } = req.body; //common fields to all tracker movements.
    // console.log('tipo de transaccion', transactionTypeName);

    // console.log('body', req.body);
    //-----------------
    //Not all tracker movements have the same input data structure, so, get the data structure config strategy based on movementName
    const config = {
      expense: getExpenseConfig(req.body),
      income: getIncomeConfig(req.body),
      transfer: getTransferConfig(req.body),
      debt: getDebtConfig(req.body),

      //old version
      // investment: getInvestmentConfig(req.body),
      // pocket: getPocketConfig(req.body),
    }[movementName];

    console.log('🚀 ~ transferBetweenAccounts ~ config:', config);

    const {
      sourceAccountName,
      sourceAccountTransactionType,
      sourceAccountTypeName,

      destinationAccountName,
      destinationAccountTypeName,
      destinationAccountTransactionType,
    } = config;
    //==========transaction and account types from db.
    const transactionsTypes = await getTransactionTypes();
    const sourceTransactionTypeId = transactionsTypes.filter(
      (type) => type.transaction_type_name === sourceAccountTransactionType
    )[0].transaction_type_id;

    const destinationTransactionTypeId = transactionsTypes.filter(
      (type) => type.transaction_type_name === destinationAccountTransactionType
    )[0].transaction_type_id;

    // console.log(
    //   '🚀 ~ transferBetweenAccounts ~ transactionsTypes:',
    //   sourceTransactionTypeId,
    //   'sourceAccountTransactionType',
    //   sourceAccountTransactionType,
    //   'destinationTransactionTypeId',
    //   destinationTransactionTypeId
    // );

    const accountTypes = await getAccountTypes();
    //==============================================
    //-------check common input data ----------------
    //validate amount
    const numericAmount = amount ? parseFloat(amount) : 0.0;
    if (numericAmount < 0) {
      const message = 'Amount must be >= 0. Tray again!';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //validate currency
    const currencyIdReq = await getCurrencyId(currencyCode);
    if (!currencyIdReq) {
      throw new Error({
        status: 404,
        message: `Currency ${currencyCode} not found`,
      });
    }
    //validate input date
    const { date: transactionActualDate } = req.body; //OJO revisar COMO LO ENVIA EL FRONTEND

    const transaction_actual_date =
      !transactionActualDate || transactionActualDate === ''
        ? new Date()
        : new Date(Date.parse(transactionActualDate));
    // : Date.parse(transactionActualDate);

    // console.log(
    //   transaction_actual_date,
    //   '🚀 ~ transferBetweenAccounts ~ transactionActualDate:',
    //   transactionActualDate
    // );

    //-------account info------------------------------------
    //source and destination account info
    const sourceAccountInfo = await getAccountInfo(
      sourceAccountName,
      sourceAccountTypeName,
      userId
    );
    const destinationAccountInfo = await getAccountInfo(
      destinationAccountName,
      destinationAccountTypeName,
      userId
    );
    // console.log(
    //   '🚀 ~ transferBetweenAccounts ~ destinationAccountInfo:',
    //   destinationAccountInfo
    // );

    // console.log('🚀 ~ sourceAccountInfo:', sourceAccountInfo);

    if (!sourceAccountInfo || !destinationAccountInfo) {
      // message: `Account  ${sourceAccountName} and type ${sourceAccountTypeName} not found`, // for individual message
      const message = `Destination or Source account not found`;
      return res.status(400).json({
        status: 404,
        message,
      });
    }

    //----source account
    const sourceAccountTypeid = accountTypes.filter(
      (type) => type.account_type_name === sourceAccountTypeName
    )[0].account_type_name;
    // console.log(
    //   '🚀 ~ transferBetweenAccounts ~ accountTypes:',
    //   sourceAccountTypeid
    // );
    //-------------------------
    //-------------------------
    //---begin transaction-----
    await client.query('BEGIN');

    //---Update the balance in the source account
    const sourceAccountBalance = sourceAccountInfo.account_balance;

    //---check balance only for source account
    if (
      sourceAccountBalance < numericAmount &&
      (sourceAccountTypeName === 'bank' ||
        sourceAccountTypeName === 'investment')
    ) {
      const message = `Not enough funds to transfer ${currencyCode} ${numericAmount} from account ${sourceAccountName} (${currencyCode} ${sourceAccountBalance})`;

      console.warn(pc.magentaBright(message));
      return res.status(400).json({
        status: 400,
        message,
      });

      //Verificar si se aplicaran restriccionespor falta de fondos?
      //rules in case transfer between accounts are restricted.
      //overdraft not allowed: bank to category_budget, bank to investment, bank to debtor , others: investment to investment, bank to bank, bank or investment to pocket, or pocket to any

      //overdraft allowed: slack to any account, income_source to any account, debtor to debtor,  bank to debtor/ debtor to bank, any to debtor/ debtor to any acc
    }
    //==============================================
    //pg transaction to insert data in user_accounts
    //las source account deberian ser negativo
    // const transactionSign = balanceMultiplierFn(sourceAccountTransactionType);

    const newSourceAccountBalance =
      parseFloat(sourceAccountBalance) - numericAmount;
    // parseFloat(sourceAccountBalance) + numericAmount * transactionSign;

    // console.log(
    //   '🚀 ~ newSourceAccountBalance:',
    //   newSourceAccountBalance,
    //   '  typeof'
    //   // balanceMultiplierFn(sourceAccountTransactionType)
    // );

    const sourceAccountId = sourceAccountInfo.account_id;
    // console.log('tad:', transaction_actual_date);

    const updatedSourceAccountInfo = await updateAccountBalance(
      newSourceAccountBalance,
      sourceAccountId,
      transaction_actual_date
    );
    // console.log(
    //   '🚀 ~ updatedSourceAccountInfo:',
    //   updatedSourceAccountInfo,
    //   'type of:',
    //   typeof sourceAccountBalance
    // );
    //-----------------------------------------------
    //---Update the balance in the destination account
    const destinationAccountBalance = destinationAccountInfo.account_balance;
    const newDestinationAccountBalance =
      parseFloat(destinationAccountBalance) + numericAmount;
    // parseFloat(destinationAccountBalance) - numericAmount * transactionSign;
    // balanceMultiplierFn(destinationAccountTransactionType);

    const destinationAccountId = destinationAccountInfo.account_id;

    const updatedDestinationAccountInfo = await updateAccountBalance(
      newDestinationAccountBalance,
      destinationAccountId,
      transaction_actual_date
    );
    // console.log(
    //   '🚀 ~ updatedDestinationAccountInfo:',
    //   updatedDestinationAccountInfo,
    //   'type of:',
    //   typeof destinationAccountBalance
    // );

    //----Register transfer/receive transaction-----------------
    //-----------source transaction-----------------------------
    const transactionDescription = `${note}. Transaction: ${sourceAccountTransactionType}. Transfered  ${numericAmount} ${currencyCode} from account "${sourceAccountName}" of type: "${sourceAccountTypeName}" to "${destinationAccountName}" of type ${destinationAccountTypeName}. Date: ${transaction_actual_date.toLocaleString()}`;
    //revisar formato de fecha

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

    const sourceTransactionOption = {
      userId,
      description: transactionDescription,
      movement_type_id,
      transaction_type_id: sourceTransactionTypeId, //withdraw or lend
      status: 'complete',
      amount: -numericAmount,
      // amount: -numericAmount * balanceMultiplierFn(sourceAccountTransactionType),
      currency_id: currencyIdReq,
      source_account_id: sourceAccountId,
      destination_account_id: destinationAccountId,
      transaction_actual_date,
      account_id: sourceAccountId,
    };

    await recordTransaction(sourceTransactionOption);
    //=========================================================
    //-----------destination transaction-----------------------
    const transactionDescriptionReceived = `${note}.Transaction: ${destinationAccountTransactionType}.Received ${numericAmount} ${currencyCode} from account ${sourceAccountName} of type: ${sourceAccountTypeName} account, to ${destinationAccountName} of type ${destinationAccountTypeName}. Date: ${transaction_actual_date.toLocaleString()}`; //revisar formato de fecha

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
      transaction_type_id: destinationTransactionTypeId, //withdraw or borrow
      status: 'complete',
      amount: numericAmount,
      // numericAmount * balanceMultiplierFn(destinationAccountTransactionType),
      currency_id: currencyIdReq,
      source_account_id: sourceAccountId,
      destination_account_id: destinationAccountId,
      account_id: destinationAccountId,
      transaction_actual_date,
    };
    destinationTransactionOption.movement_type_id;

    await recordTransaction(destinationTransactionOption);
    //=====================================================
    await client.query('COMMIT');
    //data response
    const data = {
      movement: { movement_type_name: movementName, movement_type_id },
      source: {
        account_info: {
          account_name: sourceAccountName,
          account_type: sourceAccountTypeName,
          amount: numericAmount,
          currency: currencyCode,
        },
        balance_updated: {
          amount_transaction: sourceTransactionOption.amount,
          new_balance: newSourceAccountBalance,
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
          account_name: destinationAccountName,
          account_type: destinationAccountTypeName,
          amount: numericAmount,
          currency: currencyCode,
        },
        balance_updated: {
          amount_transaction: destinationTransactionOption.amount,
          new_balance: newDestinationAccountBalance,
        },
        transaction_info: {
          transaction_type: destinationAccountTransactionType,
          transaction_description: transactionDescriptionReceived,
          transaction_id: destinationTransactionOption.transaction_id,
          transaction_date: transaction_actual_date,
        },
      },
    };

    const message = 'Transaction successfully completed.';
    console.log(pc.magentaBright(message));
    return res.status(200).json({ status: 200, message, data });
  } catch (error) {
    await client.query('ROLLBACK');
    // const { code, message } = handlePostgresError(error);
    if (error instanceof Error) {
      console.error(
        pc.red('Error during transfer'),
        pc.magentaBright(error.stack || error.message)
      );
    } else {
      console.error(
        pc.red('Error during transfer'),
        pc.magentaBright('Unknown error occurred')
      );
    }

    // Manejo de errores de PostgreSQL - pg error handling
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  } finally {
    client.release();
  }
};
