//backend/utils/movementInputHandler.js

//Strategies according to type movement tracker.
//Each side reports its id and its name separately, and getAccountInfo prefers
//the id when it is present. The two no longer have to arrive together, so the
//frontend can move to ids one screen at a time.
//===============================
export const getExpenseConfig = (body) => ({
  sourceAccountId: body.account_id ?? null,
  sourceAccountName: body.account ?? null,
  sourceAccountTypeName: 'bank',
  sourceAccountTransactionType: 'withdraw',

  destinationAccountId: body.category_account_id ?? null,
  destinationAccountName: body.category ?? null,
  destinationAccountTypeName: 'category_budget',
  destinationAccountTransactionType: 'deposit',
});
//===============================
export const getIncomeConfig = (body) => ({
  sourceAccountId: body.source_account_id ?? null,
  sourceAccountName: body.source ?? null,
  sourceAccountTransactionType: 'withdraw',
  sourceAccountTypeName: 'income_source',

  destinationAccountId: body.account_id ?? null,
  destinationAccountName: body.account ?? null,
  destinationAccountTypeName: 'bank',
  destinationAccountTransactionType: 'deposit',
});
//=================================
export const getDebtConfig = (body) => {
  const { type, debtor, debtor_id, account, account_id, accountType } = body;

  const isLend = type === 'lend';
//---------
  // Lending moves money out of the user's account into the debtor's; borrowing
  // is the reverse. Each side carries its own id, so a debtor the frontend
  // failed to resolve falls back to its name without dragging the other side
  // onto the name path with it.
  return {
    sourceAccountId: isLend ? (account_id ?? null) : (debtor_id ?? null),
    sourceAccountName: isLend ? (account ?? null) : (debtor ?? null),
    sourceAccountTypeName: isLend ? accountType  : 'debtor',
    sourceAccountTransactionType: 'lend',
    // sourceAccountTransactionType: type === 'lend' ? 'withdraw' : 'deposit',

    destinationAccountId: isLend ? (debtor_id ?? null) : (account_id ?? null),
    destinationAccountName: isLend ? (debtor ?? null) : (account ?? null),
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
//---------    
  return {
    destinationAccountId: body.destination_account_id ?? null,
    destinationAccountName: body.destination ?? null,

    destinationAccountTypeName: destinationAccountType,

    destinationAccountTransactionType: 'deposit',
//--------
    sourceAccountId: body.origin_account_id ?? null,
    sourceAccountName: body.origin ?? null,
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
  // Both sides stay on the name path. One of them is always the slack account,
  // which has no id of its own to send, and PnL is left unchanged here on
  // purpose: it already posts account_id, so enabling it is a one-line change
  // once that id is verified, in its own commit.
  sourceAccountId: null,
  sourceAccountName: isProfit ? 'slack' : body.account,
  sourceAccountTransactionType: 'withdraw',
  sourceAccountTypeName: isProfit ? 'bank' : accountType,

  destinationAccountId: null,
  destinationAccountName: isProfit ? body.account : 'slack',
  destinationAccountTransactionType: 'deposit',
  destinationAccountTypeName: isProfit ? accountType : 'bank',

}
};
//==================================
//----------------------------------
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
