export const getExpenseConfig = (body) => ({
  sourceAccountName: body.account,
  destinationAccountName: body.category,
  c: 'bank',
  destinationAccountTypeName: 'category_budget',
  sourceAccountTransactionType: 'withdraw',
  destinationAccountTransactionType: 'deposit',
});
//===================================================
export const getIncomeConfig = (body) => ({
  sourceAccountName: body.source,
  destinationAccountName: body.account,
  sourceAccountTypeName: 'income_source',
  destinationAccountTypeName: 'bank',
  sourceAccountTransactionType: 'withdraw',
  destinationAccountTransactionType: 'deposit',
});
//===================================================
export const getDebtConfig = (body) => {
  const isLend = body.type === 'lend';
  // console.log('is lend', isLend, body.debtor, {body});

  return {
    destinationAccountName: isLend ? body.debtor : body.account,
    destinationAccountTypeName: isLend ? 'debtor' : body.accountType ,
    sourceAccountName: isLend ? body.account : body.debtor,
    sourceAccountTypeName: isLend ? body.accountType  : 'debtor',
    sourceAccountTransactionType: 'borrow',
    destinationAccountTransactionType: 'lend',
  };
};
//===========================================
export const getTransferConfig = (body) => {
  const originAccountType =
    body.originAccountType === 'pocket'
      ? 'pocket_saving'
      : body.originAccountType;

  const destinationAccountType =
    body.destinationAccountType === 'pocket'
      ? 'pocket_saving'
      : body.destinationAccountType;
      //set movement type to saving or pocket

  return {
    destinationAccountName: body.destination,
    destinationAccountTypeName: destinationAccountType,
    destinationAccountTransactionType: 'deposit',
    sourceAccountName: body.origin,
    sourceAccountTypeName: originAccountType,
    sourceAccountTransactionType: 'withdraw',
  };
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
