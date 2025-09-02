//backend/utils/movementInputHandler.js

//Strategies according to type movement tracker.
// Note: use id if available, if not use name
//let's assume that if account_id exists, it exists for both accounts, source and destination.
//===============================
export const getExpenseConfig = (body) => ({
  useId:!!body.acountId,
  sourceAccountName: body.account_id || body.account,
  sourceAccountTypeName: 'bank',
  sourceAccountTransactionType: 'withdraw',

  destinationAccountName:body.category_account_id || body.category,
  destinationAccountTypeName: 'category_budget',
  destinationAccountTransactionType: 'deposit',
});
//===============================
export const getIncomeConfig = (body) => ({
  useId:!!body.acountId,

  sourceAccountName: body.source_account_id || body.source,
  sourceAccountTransactionType: 'withdraw',
  sourceAccountTypeName: 'income_source',

  destinationAccountName: body.account_id || body.account,
  destinationAccountTypeName: 'bank',
  destinationAccountTransactionType: 'deposit',
});
//=================================
export const getDebtConfig = (body) => {
  const { type, debtor, debtor_id, account, account_id, accountType } = body;

  const useId = !!account_id

  const isLend = type === 'lend';

  const accountIdentifier = account_id || account;

  const debtorIdentifier = debtor_id || debtor;

  return {
    useId, 

    sourceAccountName: isLend ? accountIdentifier : debtorIdentifier,
    sourceAccountTypeName: isLend ? accountType  : 'debtor',
    sourceAccountTransactionType: 'lend',
    // sourceAccountTransactionType: type === 'lend' ? 'withdraw' : 'deposit',

    destinationAccountName: isLend ? debtorIdentifier : accountIdentifier,
    destinationAccountTypeName: isLend ? 'debtor' : accountType ,
    destinationAccountTransactionType: 'borrow',
    // destinationAccountTransactionType: type === 'lend' ? 'deposit' : 'withdraw',
  };
};
//===============================
export const getTransferConfig = (body) => {
//set pocket type to pocket_saving
  const originAccountType =
  body.originAccountType === 'pocket'
  ? 'pocket_saving'
  : body.originAccountType;
  
  const destinationAccountType =
  body.destinationAccountType === 'pocket'
  ? 'pocket_saving'
  : body.destinationAccountType;
    
  return {
    useId:!!body.origin_account_id,

    destinationAccountName:body.destination_account_id || body.destination,

    destinationAccountTypeName: destinationAccountType,

    destinationAccountTransactionType: 'deposit',
//---
    sourceAccountName: body.origin_account_id ||  body.origin,
    sourceAccountTypeName: originAccountType,
    sourceAccountTransactionType: 'withdraw',
  };
};
//=================================
export const getPnLConfig = (body) => {
const isProfit = body.type === 'deposit';
const accountType=body.accountType
//??body.accountType==''?'bank':body.accountType

return {
    useId:false,//!!body.origin_account_id,

    sourceAccountName: isProfit ? 'slack' : body.account,
    sourceAccountTransactionType: 'withdraw',
    sourceAccountTypeName: isProfit ? 'bank' : accountType,

    destinationAccountName: isProfit ? body.account : 'slack',
    destinationAccountTransactionType: 'deposit',
    destinationAccountTypeName: isProfit ? accountType : 'bank',

}
};
//===================================================
//---config strategy for old version

// export const getInvestmentConfig = (body) => ({
//   destinationAccountName: body.type === 'deposit' ? body.account : 'slack',
//   sourceAccountName: body.type === 'deposit' ? 'slack' : body.account,
//   sourceAccountTypeName: body.type === 'deposit' ? 'bank' : 'investment',
//   destinationAccountTypeName: body.type === 'deposit' ? 'investment' : 'bank',
//   sourceAccountTransactionType: 'withdraw',
//   destinationAccountTransactionType: 'deposit',
// });

// export const getPocketConfig = (body) => ({
//   destinationAccountName: body.type === 'deposit' ? body.account : 'slack',
//   sourceAccountName: body.type === 'deposit' ? 'slack' : body.account,
//   //los tipos de cuentas se deben determinar segun las cuentas seleccionadas.
//   sourceAccountTypeName: body.type === 'deposit' ? 'bank' : 'pocket_saving',
//   destinationAccountTypeName:
//     body.type === 'deposit' ? 'pocket_saving' : 'bank',
//   sourceAccountTransactionType: 'withdraw',
//   destinationAccountTransactionType: 'deposit',
// });
//--------------------------------------------------
//transaction_types:
// "transaction_type_id"	"transaction_type_name"
// 1	"withdraw"
// 2	"deposit"
// 3	"lend"
// 4	"borrow"
// 5	"account-opening"

// "movement_type_id"	"movement_type_name"
// 1	"expense"
// 2	"income"
// 3	"investment"
// 4	"debt"
// 5	"pocket"
// 6	"transfer"
// 7	"receive"
// 8	"account-opening"
