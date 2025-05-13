export const getExpenseConfig = (body) => ({
  sourceAccountName: body.account,
  destinationAccountName: body.category,
  sourceAccountTypeName: 'bank',
  destinationAccountTypeName: 'category_budget',
  sourceAccountTransactionType: 'withdraw',
  destinationAccountTransactionType: 'deposit',
});

export const getIncomeConfig = (body) => ({
  sourceAccountName: body.source,
  destinationAccountName: body.account,
  sourceAccountTypeName: 'income_source',
  destinationAccountTypeName: 'bank',
  sourceAccountTransactionType: 'withdraw',
  destinationAccountTransactionType: 'deposit',
});

export const getInvestmentConfig = (body) => ({
  destinationAccountName:
    body.transactionTypeName === 'deposit' ? body.account : 'slack',
  sourceAccountName:
    body.transactionTypeName === 'deposit' ? 'slack' : body.account,
  sourceAccountTypeName:
    body.transactionTypeName === 'deposit' ? 'bank' : 'investment',
  destinationAccountTypeName:
    body.transactionTypeName === 'deposit' ? 'investment' : 'bank',
  sourceAccountTransactionType: 'withdraw',
  destinationAccountTransactionType: 'deposit',
});

export const getPocketConfig = (body) => ({
  destinationAccountName:
    body.transactionTypeName === 'deposit' ? body.account : 'slack',
  sourceAccountName:
    body.transactionTypeName === 'deposit' ? 'slack' : body.account,
  //los tipos de cuentas se deben determinar segun las cuentas seleccionadas.
  sourceAccountTypeName:
    body.transactionTypeName === 'deposit' ? 'bank' : 'pocket_saving',
  destinationAccountTypeName:
    body.transactionTypeName === 'deposit' ? 'pocket_saving' : 'bank',
  sourceAccountTransactionType: 'withdraw',
  destinationAccountTransactionType: 'deposit',
});

export const getDebtConfig = (body) => {
  const isLend = body.type === 'lend';
  console.log('islend', isLend, body.debtor);

  return {
    destinationAccountName: isLend ? body.debtor : 'slack',
    destinationAccountTypeName: isLend ? 'debtor' : 'bank',
    sourceAccountName: isLend ? 'slack' : body.debtor,
    sourceAccountTypeName: isLend ? 'bank' : 'debtor',
    sourceAccountTransactionType: 'borrow',
    destinationAccountTransactionType: 'lend',
  };
};

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
