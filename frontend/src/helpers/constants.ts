import { AccountListType, PocketListType, PocketSavingAccountListType, TransactionsAccountApiResponseType } from '../types/responseApiTypes';
import {
  AccountingListType,
  CurrencyType,
  DropdownOptionType,
  VariantType,
} from '../types/types';

//------------------------
export const PAGE_LOC_NUM = 3;
//-------------------------
export const CURRENCY_OPTIONS = { usd: 'en-US', cop: 'cop-CO', eur: 'en-US' };

export const DEFAULT_CURRENCY:CurrencyType = 'usd';

export const DATE_TIME_FORMAT_DEFAULT = 'es-ES';

export const VARIANT_DEFAULT: VariantType = 'tracker';

export const VARIANT_FORM: VariantType = 'form';

//tracker/expense
export const ACCOUNT_OPTIONS_DEFAULT = [
  // { value: 'acc.name_01', label: 'account name here' },
  // { value: 'acc.name_02', label: 'acc.name_02' },
  // { value: 'acc.name_03', label: 'acc.name_03' },
];

export const CATEGORY_OPTIONS_DEFAULT = [
  // { value: 'category_01', label: 'Category/SubCategory' },
  // { value: 'category_02', label: 'Category_02 / SubCategory 02' },
  // { value: 'category_03', label: 'Category_03 / SubCategory 03' },
];

//tracker/income
export const INCOME_OPTIONS_DEFAULT = [
  // { value: 'account_01', label: 'Account_01' },
  // { value: 'account_02', label: 'Account_02' },
  // { value: 'account_03', label: 'Account_03' },
  // { value: 'account_04', label: 'Account_04' },
];

export const SOURCE_OPTIONS_DEFAULT = [
  // { value: 'source_01', label: 'source_01' },
  // { value: 'source_02', label: 'source_02' },
  // { value: 'source_03', label: 'source_03' },
  // { value: 'source_04', label: 'source_04' },
];

//tracker/investment
export const INVESTMENT_ACCOUNT_OPTIONS_DEFAULT = [
  // { value: 'account_01', label: 'Investment_Account_01' },
  // { value: 'account_02', label: 'Investment_Account_02' },
  // { value: 'account_03', label: 'Investment_Account_03' },
  // { value: 'account_04', label: 'Investment_Account_04' },
];

//tracker/debts
export const DEBTOR_OPTIONS_DEFAULT = [
  // { value: 'debtor_01', label: 'debtor_01' },
  // { value: 'debtor_02', label: 'debtor_02' },
  // { value: 'debtor_03', label: 'debtor_03' },
];

export const DEFAULT_DEBTOR_TYPE = 'lending';

export const TYPEDEBTS_OPTIONS_DEFAULT = [
  { value: 'lending', label: 'Lending' },
  { value: 'borrowing', label: 'Borrowing' },
];

//overview/new_account
export const ACCOUNT_TYPE_DEFAULT: DropdownOptionType[] = [
  {
    value: 'account type',
    label: 'bank',
  },
  {
    value: 'account type',
    label: 'investment',
  },
  {
    value: 'account type',
    label: 'income_source',
  },
];

//overview/
//account balance

export const ACCOUNT_DEFAULT:AccountListType[] = [
  {
    account_name: 'acc name_example',
    // concept: 'balance',
    account_balance: 2546,
    account_id: 2001,
    currency_code: 'cop',
    account_type_name: 'type example',
    account_type_id: 1,
    account_starting_amount:0,
    account_start_date:new Date(),
  },
  {
    account_name: 'acc name_2',
    // concept: 'balance',
    account_balance: 32546,
    account_id: 1001,
    currency_code: 'cop',
    account_type_name: 'type1',
        account_type_id: 2,
        account_starting_amount:0,
     account_start_date:new Date()
  },
  
];

//pages/budget/ListPocket.tsx
//just a DEMO
export const DEFAULT_POCKET_LIST: PocketListType[] = [{
  account_id: 1,
    account_name: 'pocket name example',
    note: 'note example',
    balance: 100,
    target: 50,
    currency_code:DEFAULT_CURRENCY,
    desired_date:new Date(),
    account_start_date:new Date(),
          },
    {
    account_name: 'pocket name example',
    note: 'note example',
    balance: 0,
    target:140,
    currency_code:DEFAULT_CURRENCY,
    account_id: 1,
    desired_date:new Date(),    account_start_date:new Date()
          }
        ];

   export const DEFAULT_POCKET_ACCOUNT_LIST  :   PocketSavingAccountListType[]=[{
  account_id: 1,
    account_name: 'pocket name example',
    note: 'note example',
    account_balance: 100,
    target: 50,
    currency_code:DEFAULT_CURRENCY,
    desired_date:new Date(),
    account_start_date:new Date(),
    account_type_id:4,
    account_type_name:'pocket_saving',
    user_id:'user id'
          },
    
        ];

//account detail transactions
export const DEFAULT_ACCOUNT_TRANSACTIONS:TransactionsAccountApiResponseType= {
  "status": 200,
  "message": "This is a sample. 5 transaction(s) found for account id SAMPLE. Period between startDate and endDate.",
  "data": {
    "totalTransactions": 5,
    "summary": {
      "initialBalance": {
        "amount": 1010.55,
        "date": "2025-06-15T22:40:50.140Z",
        "currency": "usd"
      },
      "finalBalance": {
        "amount": 902.55,
        "currency": "usd",
        "date": "2025-06-16T00:55:12.445Z"
      },
      "periodStartDate": "2025-05-18",
      "periodEndDate": "2025-06-18"
    },
    
    "transactions": [
      {
        "transaction_id": 23,
        "user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
        "description": "EXAMPLE.Transaction: withdraw. Transfered 2 usd from account \"Nueva Cuenta\" (bank) credited to \"presents_other\" (category_budget). Date: 15/06/2025, 20:55",
        "amount": -2.00,
        "movement_type_id": 1,
        "transaction_type_id": 1,
        "currency_id": 1,
        "account_id": 21,
        "account_balance_after_tr": 902.55,
        "source_account_id": 21,
        "destination_account_id": 27,
        "status": "complete",
        "transaction_actual_date": "2025-06-16T00:55:12.445Z",
        "created_at": "2025-06-16T04:55:13.424Z",
        "updated_at": "2025-06-16T04:55:13.424Z",
        "movement_type_name": "example",
        "currency_code": "usd",
        "account_name": "Nueva Cuenta",
        "account_starting_amount": 1010.55,
        "account_start_date": "2025-06-15T22:40:50.140Z"
      },
      ]
    }
  }
  //debtor detail
export const DEFAULT_LAST_MOVEMENTS = [
  {
    categoryName: 'Category Name_01',
    record: 'Record',
    description: 'Description',
    date: new Date(),
  },

  {
    categoryName: 'Category Name_02',
    record: 'Record',
    description: 'Description',
    date: new Date().setDate(
      new Date().getDate() - Math.floor(Math.random() * 31)
    ),
  },
  {
    categoryName: 'Category Name_05',
    record: 'Record',
    description: 'Description',
    date: new Date().setDate(
      new Date().getDate() - Math.floor(Math.random() * 31)
    ),
  },
  {
    categoryName: 'Category Name_06',
    record: 'Record',
    description: 'Description',
    date: new Date().setDate(
      new Date().getDate() - Math.floor(Math.random() * 31)
    ),
  },
];

//Category Detail
//Last Movements
export const DEFAULT_CATEGORY_LIST = [
  {
    categoryName: 'subcategory name',
    record: 'spent',
    description: '% percentage',
    date: new Date(),
  },
  {
    categoryName: 'subcategory name',
    record: 'spent',
    description: '% percentage',
    date: new Date(),
  },
  {
    categoryName: 'subcategory name',
    record: 'spent',
    description: '% percentage',
    date: new Date(),
  },
  {
    categoryName: 'subcategory name',
    record: 'spent',
    description: '% percentage',
    date: new Date(),
  },
];

//new category page
export const TILE_LABELS = [
  { labelText: 'Must', className: 'label--text' },
  { labelText: 'Need', className: 'label--text' },
  { labelText: 'Want', className: 'label--text' },
  { labelText: 'Other', className: 'label--text' },
  // { labelText: 'New One', className: 'label--text' },
];

//AccountBalance

export const ACCOUNTING_DEFAULT: AccountingListType[] = [
  { title: 'Account_1', amount: 9999999999.99, currency: 'usd', type: 'bank' },
  { title: 'Account_2', amount: 9999999999.999, currency: 'eur', type: 'bank' },
  { title: 'Account_3', amount: 2000000, currency: 'cop', type: 'bank' },
  {
    title: 'Account_4 (investment)',
    amount: 9999999999.99,
    currency: 'usd',
    type: 'bank',
  },
  {
    title: 'Acc_5.com (investment)',
    amount: 9999999999.99,
    currency: 'cop',
    type: 'bank',
  },
  {
    title: 'Account_6 (investment)',
    amount: 9999999999.99,
    currency: 'usd',
    type: 'bank',
  },
];

//InvestmentAccBalance

//SavingGoals
