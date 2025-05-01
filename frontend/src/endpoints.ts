//temporary user id
export const USER_ID: string = import.meta.env.VITE_USER_ID;
//http://localhost:5000/api/

//authentication
// http://localhost:5000/api/auth/
//sign-up
export const url_signup: string = 'http://localhost:5000/api/auth/sign-up';
//sign-in
export const url_signin: string = 'http://localhost:5000/api/auth/sign-in';
//sign-out
export const url_signout: string = 'http://localhost:5000/api/auth/sign-out';
//refresh-token
export const url_refrestoken: string = 'http://localhost:5000/api/auth/refresh-token';

//http://localhost:5000/api/fintrack
export const BASE_URL: string = import.meta.env.VITE_API_URL_APP;
export const url_debtors = BASE_URL + '/' + 'debtors';
export const url_debtors_debt = BASE_URL + '/' + 'debtors/debt';
export const url_categories = BASE_URL + '/' + 'categories';
export const url_investment = BASE_URL + '/' + 'investment';
export const url_sources = BASE_URL + '/' + 'sources';
export const url_budget = BASE_URL + '/' + 'budget';
export const url_accounts = BASE_URL + '/' + 'accounts'; //expense and income accounts are the same
export const url_investment_acc = BASE_URL + '/' + 'investment-accounts'; //not implemented yet

//account_types list
//http://localhost:5000/api/fintrack/account/type/list
export const url_account_type_list: string = BASE_URL + '/account/type/list';

//create a new account for types: bank, investment and income_source
//http://localhost:5000/api/fintrack/account/new_account/account_type
export const url_create_basic_account: string =
  BASE_URL + '/account/new_account'; //account_type is dynamic

//create a category_budget account
//http://localhost:5000/api/fintrack/account/new_account/category_budget
export const url_create_category_budget_account: string =
  BASE_URL + '/account/new_account/category_budget';

//get all accounts info by account type: id, name, type, currency and balance.By user id and account_type but slack account.
//endpoint: http://localhost:5000/api/fintrack/account/type/?type=${bank}&user=${6e0ba475-bf23-4e1b-a125-3a8f0b3d352c}
//ex:for expense tracker, types used are: bank or category_budget,
export const url_get_accounts_by_type: string = BASE_URL + '/account/type';

//get user accounts info by account prefixed type_name bank and investment except slack account
//for accounting and overview components
//http://localhost:5000/api/fintrack/account/type/?type=bankAndInvestment
//for expense tracker, types used are: bank and category_budget,
export const url_get_accounting_accounts: string =
  BASE_URL + '/account/type/?type= bank_and_investment';

//get the sum of balance of account by account type
//ex: available budget, only bank accounts
//for pocket and category budget also get the total goal or budget respectively
//also, get the balance of income source accounts
//endpoint:  http://localhost:5000/api/fintrack/dashboard/balance/type
export const url_get_total_account_balance_by_type: string =
  BASE_URL + '/dashboard/balance/type';

//movement transaction record
//ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?user=eacef623-6fb0-4168-a27f-fa135de093e1&movement=expense
export const url_movement_transaction_record: string =
  BASE_URL + '/transaction/transfer-between-accounts';
