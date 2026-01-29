//controller:transferBetweenAccounts.js
// Functions: Handles financial transfers between accounts with balance updates and transaction recording

//functions defined here:getAccountTypeId,getAccountInfo, getAccountTypes,getTransactionTypes, balanceMultiplierFn,updateAccountBalance,
//-----------------------------
import pc from 'picocolors';
import { pool } from '../../db/configDB.js';
import {
  createError,
  handlePostgresError,
} from '../../utils/errorHandling.js';
import {
  getExpenseConfig,
  getIncomeConfig,
  getDebtConfig,
  getTransferConfig,
  getPnLConfig,

} from '../../utils/movementInputHandler.js';
import { recordTransaction } from '../../utils/recordTransaction.js';
import { formatDate } from '../../utils/helpers.js';

//endpoint: put:/api/fintrack/transaction/transfer-between-accounts?user=UUID&&movement=expense
//=============================
//FUNCTIONS DECLARATION
//get the currency_id by the currency_code

export const getCurrencyId = async (dbClient=pool,currency_code) => {
  const currencyQuery = `SELECT * FROM currencies WHERE currency_code = $1`;
  const currencyResult = await dbClient.query(currencyQuery, [currency_code]);
  return currencyResult.rows[0]?.currency_id;
};

//get the account_type_id by account_type_name
export const getAccountTypeId = async (dbClient=pool, accountTypeName) => {
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

//get the account info by user_id, account_id or account_name and account_type_name
export const getAccountInfo = async (dbClient=pool, useId = false,accountIdentifier, accountTypeName, userId) => {
  let accountQuery;
  let queryValues;
  
  if (useId) {
   // Search by account_id /Buscar por account_id
    accountQuery = `SELECT ua.* FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      WHERE ua.user_id = $1 AND ua.account_id = $2 AND act.account_type_name = $3`;
    queryValues = [userId, (accountIdentifier), accountTypeName];
  } else{
      //Search by account_name /Buscar por account_name
      accountQuery = `SELECT ua.* FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      WHERE ua.user_id = $1 AND ua.account_name = $2 AND act.account_type_name = $3`;
      queryValues = [userId, (accountIdentifier), accountTypeName];
    }

  const accountInfoResult = await dbClient.query({
    text: accountQuery,
    values: queryValues,
  });
  return accountInfoResult.rows[0];
};

//---
//get the array of ACCOUNT type objects
export const getAccountTypes = async (clientOrPool=null) => {
  const dbClient = clientOrPool || pool;
  const accountTypeQuery = `SELECT * FROM account_types`;
  const accountTypeResult = await dbClient.query(accountTypeQuery);
  const accountTypeArr = accountTypeResult.rows;
  return accountTypeArr;
};

//get the array of TRANSACTION type objects
export const getTransactionTypes = async (clientOrPool=null) => {
const db= clientOrPool || pool;
const transactionTypeQuery = `SELECT * FROM transaction_types`;
const transactionTypeResult = await db.query(transactionTypeQuery);
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

//update account balance in user_accounts table
export const updateAccountBalance = async (
  clientOrPool,
  newBalance,
  accountId,
  transactionActualDate
) => {
  const dbClient = clientOrPool || pool;
  console.log('updateAccountBalance Transaction Actual Date:', transactionActualDate);
//assure first the existence of updatedAccountResult?
  const insertBalanceQuery = {
    text: `UPDATE user_accounts SET account_balance=$1, updated_at = $2 WHERE account_id = $3 RETURNING *`,
    values: [newBalance, transactionActualDate??new Date(), accountId],
  };
  //request
  const updatedAccountResult = await dbClient.query(insertBalanceQuery);
  return updatedAccountResult.rows[0];
};

//transfer movement renamed
export function transformMovementType(
movementName,
sourceAccountTypeName,
destinationAccountTypeName
) {
  if (movementName === 'transfer'){

  // if (sourceAccountTypeName === destinationAccountTypeName) {
  //   const message = 'origin and destination accounts must not be the same';
  //   console.warn(pc.magentaBright(message));
  //   return res.status(400).json({ status: 400, message });
  //   }

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
    // const userId = req.body.user === '' || !req.body.user ? req.query.user : req.body.user;
    const userId = req.user.userId
    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const { movement } = req.query;
    const movementName = movement === 'debts' ? 'debt' : movement; //debt movement is called as debts in frontend
    // console.log({ movementName });
//-------------------------------------
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
        'pnl'
      ].includes(movementName)
    ) {
      const message = `movement name " ${movementName} " is not correct`;
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }

//=================================
//--get the movement types, get the movement type id and check 
    const movement_typesResult = await pool.query(`SELECT * FROM movement_types`);
    const movement_typesResultExist = movement_typesResult.rows.length > 0;
    // console.log('movement_types', movement_typesResultsExist)

    if (!movement_typesResultExist) {
      const message = 'something went wrong with the movement_types table';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const movement_types = movement_typesResult.rows;
    // console.log(
    //   '🚀 ~ transferBetweenAccounts ~ movement_types:',
    //   movement_types
    // );
//----------------------------------
//==================================
//PnL movement preparation
//==================================
//PnL Movements need a compensation account, in this case named "slack", to serve as a counter part of the transaction.
//--function for slack account --
   const checkAndInsertSlackAccount = async (dbClient=null, userId) => {
    const db=dbClient || pool;
      try {
       //Check existence using the transaction client
        const chekAccountResult = await db.query(
          'SELECT * FROM user_accounts WHERE account_name = $1 AND user_id = $2',
          ['slack', userId]
        );

      if (chekAccountResult.rows.length > 0) {
       console.log('slack account already exists');
       return chekAccountResult.rows[0];
        } else {
          const insertResult = await db.query(
            'INSERT INTO user_accounts (user_id,account_name,account_type_id,currency_id,account_starting_amount,account_balance,account_start_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
            [userId, 'slack', 1, 1, 0, 0, new Date()]
          );
          console.log(
            'slack account created successfully',
            'account:',
            insertResult.rows[0]
          );
         return insertResult.rows[0]; // Return the new account 
        }
      } catch (error) {
      // We throw the error so the main catch block can perform the ROLLBACK 
        const message = 'Error creating slack account';
        console.error(message, error);

        throw new Error('Error creating/checking slack account: ' + error.message);
       }
      };
//-------------------------------
//--this is for pnl movements which does not consider an explicit counter account
    // if (
    //     movementName === 'pnl'
    // ) {
    //   checkAndInsertSlackAccount(req, res, next, userId);
    // }
//---------------------------------------
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
      date
  } = req.body; //common fields to all tracker movements.
//---
  // console.log('body', req.body);
  // console.log({'movementName':movementName},'type',transactionTypeName,
  // accountType,
  // date);
//-----------------
//From the original design, Not all tracker movements input data form have the same input data structure, so, get the data structure configuration strategy based on movementName
const config = {
  expense: getExpenseConfig(req.body),
  income: getIncomeConfig(req.body),
  transfer: getTransferConfig(req.body),
  debt: getDebtConfig(req.body),
  pnl: getPnLConfig(req.body),
}[movementName];
//---
const {
  useId,
  sourceAccountName,
  sourceAccountTypeName,
  sourceAccountTransactionType,

  destinationAccountName,
  destinationAccountTypeName,
  destinationAccountTransactionType,
    } = config;
  // console.log('🚀 ~ transferBetweenAccounts ~ config:', config, sourceAccountTypeName);

  //adjust the movement type name
  const movement_type_name = transformMovementType(
    movementName,
    sourceAccountTypeName,
    destinationAccountTypeName
    );
//=================================
// get the movement type ID
// console.log('🚀 ~ transferBetweenAccounts ~ movement_type_name:', movement_type_name
// );
    const movement_type_idResult = movement_types.filter(
      (mov) => mov.movement_type_name === movement_type_name
    );
    // console.log(
    //   '🚀 ~ transferBetweenAccounts ~ movement_type_idResult:',
    //   movement_type_idResult
    // );
    if (!movement_type_idResult ||movement_type_idResult.length===0) {
      const message = `movement type id of ${movement_type_name} was not found.`;
      // console.warn(pc.magentaBright(message));
      // console.log('🚀 ~ transferBetweenAccounts ~ message:', message);
      const err = new Error(message);
      err.status=400;
      throw err;
    }

    const movement_type_id = movement_type_idResult[0].movement_type_id;
//===============================
//transaction and account types from db
//===============================
    const transactionsTypes = await getTransactionTypes();

    const sourceTransactionTypeId = transactionsTypes.filter(
      (type) => type.transaction_type_name === sourceAccountTransactionType
    )[0].transaction_type_id;

    const destinationTransactionTypeId = transactionsTypes.filter(
      (type) => type.transaction_type_name === destinationAccountTransactionType
    )[0].transaction_type_id;
    const accountTypes = await getAccountTypes();
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
//validate amount
  const numericAmount = amount ? parseFloat(amount) : 0.0;
    if (numericAmount <= 0) {
      const message = 'Amount must be >= 0. Try again!';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }
//validate currency
    const currencyIdReq = await getCurrencyId(pool, currencyCode);

    if (!currencyIdReq) {
      // console.log('error en', currencyCode, )
      const message= `Currency ${currencyCode} not found`
      const err = new Error(message)
      err.status=400
      throw err;
    }
//validate input date
    const { transactionActualDate:actualDate} = req.body; 

    const transaction_actual_date =
      !actualDate || actualDate === '' || !date ||actualDate === ''
        ? new Date()
        : new Date((actualDate??date));

// console.log(
// '🚀 ~ transferBetweenAccounts ~ transactionActualDate:',
//   date, actualDate, transaction_actual_date,
// );

// =============================
//=== Begin transaction========
  await client.query('BEGIN');

  if (movementName === 'pnl') {
   await checkAndInsertSlackAccount(client, userId);
    }
//-------account info----------------
    // console.log('accountInfo',  useId,
    //   sourceAccountName, parseInt(sourceAccountName),
    //   sourceAccountTypeName,
    //   userId)
//source and destination account info
    const sourceAccountInfo = await getAccountInfo(
      client,
      useId,
      sourceAccountName,
      sourceAccountTypeName,
      userId
    );

    if (!sourceAccountInfo ) {
      const message = `Origin account ${sourceAccountInfo.account_name} not found`;
      throw createError(404, message);
    }
//---
    const destinationAccountInfo = await getAccountInfo(
     client,
     useId,
     destinationAccountName,
     destinationAccountTypeName,
     userId
     );
    // console.log(
    // '🚀 ~ transferBetweenAccounts ~ destinationAccountInfo:',
    // destinationAccountInfo
    // );
    if (!destinationAccountInfo ) {
      const message = `Destination account ${destinationAccountInfo.account_name} not found`;
      throw createError(404, message);
    }
//----source account-----------------
    const sourceAccountTypeId = accountTypes.filter(
      (type) => type.account_type_name === sourceAccountTypeName
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
console.log("---FK DEBUGGING / DEBUG DE LLAVES FORÁNEAS ---");
console.log("User ID:", userId);
console.log("Currency ID FOUND:", currencyIdReq);
console.log("Account Type ID :", accountType);
console.log("Movement Type ID (Hardcoded):", 8);
console.log("---------------------------------");

//-------------------------------
//--this is for pnl movements which does not consider an explicit counter account
   if (
       movementName === 'pnl'
   ) {
     await checkAndInsertSlackAccount(client, userId);
   }
//---------------------------------------
//---Update the balance in the source account
    const sourceAccountBalance = parseFloat(sourceAccountInfo.account_balance);
//---check for enough funds on source account
  if (
    sourceAccountBalance < numericAmount &&
    (
      (sourceAccountTypeName === 'bank' && sourceAccountInfo.account_name!=='slack')
      || sourceAccountTypeName === 'investment'
      || sourceAccountTypeName === 'pocket_saving'
      || sourceAccountTypeName === 'category_budget'
    )
  ) //reversal of expense
  {
      const message = `Not enough funds in "${sourceAccountInfo.account_name.toUpperCase()}" (${currencyCode} ${sourceAccountBalance})`;
      console.warn(pc.magentaBright(message));
      return res.status(400).json({
        status: 400,
        message,
      });
    }
//-----------------------------------
// --- Update Source balance ---
  const newSourceAccountBalance =
    parseFloat(sourceAccountBalance) - numericAmount;

  const sourceAccountId = sourceAccountInfo.account_id;
  console.log('tad:', transaction_actual_date,"#",sourceAccountId);

  const updatedSourceAccountInfo = await updateAccountBalance(
    client,
    newSourceAccountBalance,
    sourceAccountId,
    transaction_actual_date
  );
    // console.log(
    //   '🚀 ~ updatedSourceAccountInfo:',
    //   updatedSourceAccountInfo,updatedSourceAccountInfo.account_balance,
    //   'type of:',
    //   typeof updatedSourceAccountInfo.account_balance
    // );
//-----------------------------
//--------- Destination Account -------
//-----------------------------
//--Update the balance in the destination account
  const destinationAccountBalance = destinationAccountInfo.account_balance;
  const newDestinationAccountBalance =
   parseFloat(destinationAccountBalance) + numericAmount;

  const destinationAccountId = destinationAccountInfo.account_id;

  const updatedDestinationAccountInfo = await updateAccountBalance(
    client, 
    newDestinationAccountBalance,
    destinationAccountId,
    transaction_actual_date
  );
    // console.log(
    //   '🚀 ~ updatedDestinationAccountInfo:',
    //   updatedDestinationAccountInfo,updatedDestinationAccountInfo.account_balance,
    // );

//---Register transfer/receive transaction---
//----Source transaction-----------
const expenseReversalNotePrefix = sourceAccountTypeName==='category_budget'
?'Expense Reversal. ':''

const incomeReversalNotePrefix = destinationAccountTypeName==='income_source'?'Income Reversal. ':''

const transactionDescription =
  `${expenseReversalNotePrefix}${incomeReversalNotePrefix}${note ? note + '.' : ''}Transaction: ${sourceAccountTransactionType}. Transfered ${numericAmount} ${currencyCode} from account "${sourceAccountInfo.account_name} #${sourceAccountInfo.account_id}" (${sourceAccountTypeName}) credited to "${destinationAccountInfo.account_name} # ${destinationAccountInfo.account_id}" (${destinationAccountTypeName}). Date: ${formatDate(transaction_actual_date)}`;
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
      status: 'complete',
      amount: -(numericAmount),
      currency_id: currencyIdReq,
      account_id: sourceAccountId,
      source_account_id: sourceAccountId,
      transaction_type_id: sourceTransactionTypeId, //withdraw or lend
      destination_account_id: destinationAccountId,
      transaction_actual_date,
      account_balance:parseFloat(updatedSourceAccountInfo.account_balance)
    };

//ex: Transaction: Deposit of 3.00 USD received from the account "Nueva Cuenta" (Type: Bank Account), credited to "Food_Must" under the budget category "Category_Budget".
 await recordTransaction(client, sourceTransactionOption);
//====================================
//-----destination transaction--------
const transactionDescriptionReceived =
  `${incomeReversalNotePrefix}${expenseReversalNotePrefix}${note ? note + '.' : ''}Transaction: ${destinationAccountTransactionType}. Received ${numericAmount} ${currencyCode} in account "${destinationAccountInfo.account_name} (${destinationAccountTypeName}) # ${destinationAccountInfo.account_id}, from "${sourceAccountInfo.account_name}" # ${sourceAccountInfo.account_id} (${sourceAccountTypeName}). Date: ${formatDate(transaction_actual_date)}`;
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
      // numericAmount * balanceMultiplierFn(destinationAccountTransactionType),
      transaction_actual_date,
      account_balance:parseFloat(updatedDestinationAccountInfo.account_balance)
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
          currency: currencyCode,
        },
        balance_updated: {
          amount_transaction: sourceTransactionOption.amount,
          account_balance: sourceTransactionOption.account_balance,//newSourceAccountBalance,
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
          currency: currencyCode,
        },
        balance_updated: {
          amount_transaction: destinationTransactionOption.amount,
          account_balance: destinationTransactionOption.account_balance,//newDestinationAccountBalance,
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
    // COMMIT ALL CHANGES
    //END OF TRANSACTION
    await client.query('COMMIT');
    return res.status(200).json({ status: 200, message, data });

  } catch (error) {
    await client.query('ROLLBACK');

    if (error instanceof Error) {
      console.error(
       pc.red('Error during transfer'),
       pc.magentaBright(error.stack || error.message), error
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
   // Always release the connection
   client.release();
  }
}
//end of transactionController