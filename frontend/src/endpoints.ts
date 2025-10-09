//temporary user id - while developing
export const USER_ID: string = import.meta.env.VITE_USER_ID;
//http://localhost:5000/api/
//authentication
// http://localhost:5000/api/auth/
//sign-up
export const url_signup: string = 'http://localhost:5000/api/auth/sign-up';
//sign-in
export const url_signin: string = 'http://localhost:5000/api/auth/sign-in';
// export const url_signin: string = 'http://localhost:5000/api/auth/sign-in';
//sign-out
export const url_signout: string = 'http://localhost:5000/api/auth/sign-out';
//refresh-token
export const url_refrestoken: string =
  'http://localhost:5000/api/auth/refresh-token';
//----------------------------
//http://localhost:5000/api/fintrack
export const BASE_URL: string = import.meta.env.VITE_API_URL_APP;

//account_types list
//http://localhost:5000/api/fintrack/account/type/list
export const url_account_type_list: string = BASE_URL + '/account/type/list';
//-----------------------------------
//CREATE NEW ACCOUNT
//for Overview page
//create a new account for types: bank, investment and income_source
//http://localhost:5000/api/fintrack/account/new_account/account_type
export const url_create_basic_account: string =
  BASE_URL + '/account/new_account'; //account_type is dynamic
 
//ENDPOINTS FOR BUDGET PAGE
// dashboardAccountSummaryList
//accouny list summary by account type and acc name
//example:http://localhost:5000/api/fintrack/dashboard/balance/summary/?type=category_budget&user=
export const url_summary_balance_ByType: string =
  BASE_URL + '/dashboard/balance/summary/'; //?type=expense&user=

//create a category_budget account
//http://localhost:5000/api/fintrack/account/new_account/category_budget
export const url_create_category_budget_account: string =
  BASE_URL + '/account/new_account/category_budget';

//get accounts info  by categoryName
//--endpoint: http://localhost:5000/api/fintrack/budget/category/:categoryName?&user=${user}
//api response type data:
export const url_get_accounts_by_category: string = BASE_URL + '/account/category'; 

//create a pocket_saving account
//http://localhost:5000/api/fintrack/account/new_account/pocket_saving
export const url_create_pocket_saving_account: string =
  BASE_URL + '/account/new_account/pocket_saving';

//FOR DEBTS PAGE
//create a debtor account
//http://localhost:5000/api/fintrack/account/new_account/debtor
export const url_create_debtor_account: string =
  BASE_URL + '/account/new_account/debtor';

//--for debts page
//---GET ACCOUNT INFO BY ACCOUNT ID
//--endpoint: http://localhost:5000/api/fintrack/debts/debtor/${account_id)?&user=c109eb15-4139-43b4-b081-8fb9860588af
export const url_get_debtor_by_id: string = BASE_URL + '/debts/debtor/';

//--FOR OVERVIEW PAGE
//---GET ACCOUNT INFO BY ACCOUNT ID
//--endpoint: http://localhost:5000/api/fintrack/account/11?&user=${user}
//api response type data:PocketListSummaryType
export const url_get_account_by_id: string = BASE_URL + '/account';

//---GET ACCOUNT TRANSACTIONS BY ACCOUNT ID
//--endpoint: http://localhost:5000/api/fintrack/account/transactions/:account_id/?start=&end=&user=c109eb15-4139-43b4-b081-8fb9860588af
export const url_get_transactions_by_account_id: string = BASE_URL + '/account/transactions';
//----------------------------------------
//----GET ALL ACCOUNTS INFO OF A SPECIFIC ACCOUNT TYPE
//get all accounts info by account type: id, name, type, currency and balance.By user id and account_type but slack account.
//controller:getAllAccountsByType
//endpoint: http://localhost:5000/api/fintrack/account/type/?type=${account_type_name}&user=${6e0ba475-bf23-4e1b-a125-3a8f0b3d352c}
//Example:for expense tracker, types used are: bank or category_budget,
export const url_get_accounts_by_type: string = BASE_URL + '/account/type';

//get user accounts info by account prefixed type_name bank and investment except slack account
//for accounting and overview components
//http://localhost:5000/api/fintrack/account/type/?type=bankAndInvestment
//example for expense tracker, types used are: bank and category_budget,
export const url_get_accounting_accounts: string =
  BASE_URL + '/account/type/?type=bank_and_investment';

//get the sum of balance of all accounts of one account type
//example: total balance is the sum of all bank accounts balance
//for pocket and category budget also get the total goal or budget respectively
//also, get the balance of income source accounts

// fintrack dashboardTotalBalanceAccountByType
//endpoint:  http://localhost:5000/api/fintrack/dashboard/balance/type
//used in:OverviewLayout.tsx, Overview.tsx,
export const url_get_total_account_balance_by_type: string =
  BASE_URL + '/dashboard/balance/type';

//movement transaction record
//ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?user=eacef623-6fb0-4168-a27f-fa135de093e1&movement=expense
export const url_movement_transaction_record: string =
  BASE_URL + '/transaction/transfer-between-accounts';

//=======================================
//endpoints for OVERVIEWLAYOUT page
//endpoint:  http://localhost:5000/api/fintrack/dashboard/balance/type
// export const url_get_total_account_balance_by_type: string =
//   BASE_URL + '/dashboard/balance/type';
//=======================================
//ENDPOINTS for OVERVIEW page
//controller:dashboardMonthlyTotalAmountByType
//get.http://localhost:5000/api/fintrack/dashboard/balance/monthly_total_amount_by_type/?user=

export const url_monthly_TotalAmount_ByType: string =
  BASE_URL + '/dashboard/balance/monthly_total_amount_by_type/'; //?&user=
//---------------------------------------
//for accounting and overview components
//http://localhost:5000/api/fintrack/account/type/?type=
// export const url_get_accounts_by_type: string = BASE_URL + '/account/type';

//=======================================
//LAST MOVEMENTS BY MOVEMENT TYPE
//this includes transaction_type
// controller:dashboardMovementTransactionsByType
// insomnia:fintrack dashboardMovementTransactionType
// endpoint:dashboardMovementTransactionsByType
//example: http://localhost:5000/api/fintrack/dashboard/movements/account_type/?start=&end=&movement=expense&transaction_type=&account_type=category_budget&user=51ba7238-31f0-4153-a80b-6709c34a1955

export const dashboardMovementTransactionsByType: string =
  BASE_URL + '/dashboard/movements/account_type/';
//---------------------------------------------
// controller:dashboardMovementTransactions
// insomnia: fintrack dashboardMovementTransactions
// endpoint:dashboardMovementTransactions
//example:http://localhost:5000/api/fintrack/dashboard/movements/movement/?movement=pocket&user=${user}
//http://localhost:5000/api/fintrack/dashboard/movements/movement/?start=&end=&movement=debt&user=eacef623-6fb0-4168-a27f-fa135de093e1
export const dashboardMovementTransactions: string =
  BASE_URL + '/dashboard/movements/movement/';

//---------------------------------------
//fintrack dashboard movements
//this is more general since it can search
//get.http://localhost:5000/api/fintrack/dashboard/movements/search/?start=&end=&search=opening&user=eacef623-6fb0-4168-a27f-fa135de093e1
// dashboardMovementTransactionsSearch
export const url_get_transactions_by_search: string =
  BASE_URL + '/dashboard/movements/search/';

  

