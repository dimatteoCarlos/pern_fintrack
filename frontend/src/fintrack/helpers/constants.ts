// frontend/src/fintrack/helpers/constants.ts

import {
  AccountListType,
  TransactionsAccountApiResponseType,
} from '../types/responseApiTypes';
import {
  AccountingListType,
  CurrencyType,
  DropdownOptionType,
  VariantType,
} from '../types/types';

//------------------------
export const PAGE_LOC_NUM = 3;

//useAuth.ts
export const INITIAL_PAGE_ADDRESS = '/fintrack/tracker/expense';
export const LOCAL_STORAGE_KEY = {
 REMEMBER_ME: 'fintrack_remember_me',
 USER_DATA: 'fintrack_user_data',
};

//-------------------------
export * from './currencyConstants';
//-------------------------
//=================================
// 🔄 Order for circular currency toggle (USD → COP → EUR → VES → MXN → USD)
export const CURRENCY_CYCLE: CurrencyType[] = ['usd',  'cop', 'eur', 'ves', 'mxn'];

export const CURRENCY_OPTIONS:Record<CurrencyType, string> = {
  usd: 'en-US',
  cop: 'cop-CO',
  eur: 'en-US',
  ves: 'es-VE',
  mxn: 'es-MX',
};

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });


export const SELECT_CURRENCY_OPTIONS: DropdownOptionType<CurrencyType>[] = [
  { value: 'usd', label: `USD - ${currencyNames.of('USD')}` },
  { value: 'cop', label: `COP - ${currencyNames.of('COP')}` },
  { value: 'eur', label: `EUR - ${currencyNames.of('EUR')}` },
  { value: 'ves', label: `VES - ${currencyNames.of('VES')}` },
  { value: 'mxn', label: `MXN - ${currencyNames.of('MXN')}` },
];

// console.log(SELECT_CURRENCY_OPTIONS)

export const DEFAULT_CURRENCY = (import.meta.env.VITE_ACCOUNTING_CURRENCY_CODE || 'usd' ) as CurrencyType;
//==================================

// How far back a calendar may offer an operative date, in whole calendar months
// counting the current one: 1 is the current month alone, 2 also opens the
// previous month.
//
// This mirrors BACKDATING_WINDOW_MONTHS in backend/.env, and mirroring is what
// it is: two declarations of one policy, which the browser cannot read off the
// server. They must carry the same number. Set only here, the calendar offers a
// day the server refuses — a 422 the owner sees, never a wrong row — and set
// only there, the window simply stays closed to him. The defaults agree, so
// neither drifts until somebody changes one of them alone.
const configuredBackdatingWindow = Number.parseInt(
  import.meta.env.VITE_BACKDATING_WINDOW_MONTHS ?? '',
  10,
);

export const BACKDATING_WINDOW_MONTHS =
  Number.isInteger(configuredBackdatingWindow) && configuredBackdatingWindow >= 1
    ? configuredBackdatingWindow
    : 2;
//==================================

export const DATE_TIME_FORMAT_DEFAULT = 'es-ES';

// For dates that render a WORD rather than digits. DATE_TIME_FORMAT_DEFAULT only
// decides separators and order, but a long month name makes the locale the
// interface language, and the interface is in English.
export const DATE_TEXT_FORMAT = 'en-US';

export const VARIANT_DEFAULT: VariantType = 'tracker';

export const VARIANT_FORM: VariantType = 'form';

//=================================
// 🏷️ Movement type mapping (exactly as stored in DB)
export const MOVEMENT_TYPES: Record<number, string> = {
  1: 'expense',
  2: 'income',
  3: 'investment',
  4: 'debt',
  5: 'pocket',
  6: 'transfer',
  7: 'receive',
  8: 'account-opening',
  9: 'pnl',
};

//VALUES WERE USED FOR VISUAL MOCKS
//tracker/expense
export const ACCOUNT_OPTIONS_DEFAULT = [
  /*{ value: 'acc.name_01', label: 'account name here' },
  { value: 'acc.name_02', label: 'acc.name_02' },
  { value: 'acc.name_03', label: 'acc.name_03' },
   */
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
export const DEBTOR_OPTIONS_DEFAULT: DropdownOptionType[] = [];

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

export const ACCOUNT_DEFAULT: AccountListType[] = [
  {
    account_name: '',
    account_balance: 0,
    account_id: Infinity,
    currency_code: DEFAULT_CURRENCY,
    account_type_name: '',
    account_type_id: 0,
    account_starting_amount: 0,
    account_start_date: '',
  },

  // {
  //   account_name: 'acc name_example',
  //   // concept: 'balance',
  //   account_balance: 2546,
  //   account_id: 2001,
  //   currency_code: 'cop',
  //   account_type_name: 'type example',
  //   account_type_id: 1,
  //   account_starting_amount:0,
  //   account_start_date:new Date(),
  // },
  // {
  //   account_name: 'acc name_2',
  //   // concept: 'balance',
  //   account_balance: 32546,
  //   account_id: 1001,
  //   currency_code: 'cop',
  //   account_type_name: 'type1',
  //       account_type_id: 2,
  //       account_starting_amount:0,
  //    account_start_date:new Date()
  // },
];

//account detail transactions
export const DEFAULT_ACCOUNT_TRANSACTIONS: TransactionsAccountApiResponseType =
  {
    status: 200,
    message:
      'This is a sample. 5 transaction(s) found for account id SAMPLE. Period between startDate and endDate.',

    data: {
      totalTransactions: 5,
      summary: {
        initialBalance: {
          amount: 1010.55,
          date: '2025-06-15T22:40:50.140Z',
          currency: 'usd',
        },
        finalBalance: {
          amount: 902.55,
          currency: 'usd',
          date: '2025-06-16T00:55:12.445Z',
        },
        periodStartDate: '2025-05-18',
        periodEndDate: '2025-06-18',
      },

      transactions: [
        {
          transaction_id: 23,
          user_id: 'c109eb15-4139-43b4-b081-8fb9860588af',
          description:
            'EXAMPLE.Transaction: withdraw. Transfered 2 usd from account "Nueva Cuenta" (bank) credited to "presents_other" (category_budget). Date: 15/06/2025, 20:55',
          amount: -2.0,
          movement_type_id: 1,
          transaction_type_id: 1,
          currency_id: 1,
          account_id: 21,
          account_balance_after_tr: 902.55,
          source_account_id: 21,
          destination_account_id: 27,
          status: 'complete',
          transaction_actual_date: '2025-06-16T00:55:12.445Z',
          created_at: '2025-06-16T04:55:13.424Z',
          updated_at: '2025-06-16T04:55:13.424Z',
          movement_type_name: 'example',
          currency_code: 'usd',
          account_name: 'Nueva Cuenta',
          account_starting_amount: 1010.55,
          account_start_date: '2025-06-15T22:40:50.140Z',
        },
      ],
    },
  };

//debtor detail
export const DEFAULT_LAST_MOVEMENTS = [
  // {
  //   categoryName: 'Category Name_01',
  //   record: 'Record',
  //   description: 'Description',
  //   date: new Date(),
  // },
  // {
  //   categoryName: 'Category Name_02',
  //   record: 'Record',
  //   description: 'Description',
  //   date: new Date().setDate(
  //     new Date().getDate() - Math.floor(Math.random() * 31)
  //   ),
  // },
  // {
  //   categoryName: 'Category Name_05',
  //   record: 'Record',
  //   description: 'Description',
  //   date: new Date().setDate(
  //     new Date().getDate() - Math.floor(Math.random() * 31)
  //   ),
  // },
  // {
  //   categoryName: 'Category Name_06',
  //   record: 'Record',
  //   description: 'Description',
  //   date: new Date().setDate(
  //     new Date().getDate() - Math.floor(Math.random() * 31)
  //   ),
  // },
];

//Category Detail
//Last Movements
export const DEFAULT_CATEGORY_LIST = [
  // {
  //   categoryName: 'subcategory name',
  //   record: 'spent',
  //   description: '% percentage',
  //   date: new Date(),
  // },
  // {
  //   categoryName: 'subcategory name',
  //   record: 'spent',
  //   description: '% percentage',
  //   date: new Date(),
  // },
  // {
  //   categoryName: 'subcategory name',
  //   record: 'spent',
  //   description: '% percentage',
  //   date: new Date(),
  // },
  // {
  //   categoryName: 'subcategory name',
  //   record: 'spent',
  //   description: '% percentage',
  //   date: new Date(),
  // },
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
  // { title: 'Account_1', amount: 9999999999.99, currency: 'usd', type: 'bank' },
  // { title: 'Account_2', amount: 9999999999.999, currency: 'eur', type: 'bank' },
  // { title: 'Account_3', amount: 2000000, currency: 'cop', type: 'bank' },
  // {
  //   title: 'Account_4 (investment)',
  //   amount: 9999999999.99,
  //   currency: 'usd',
  //   type: 'bank',
  // },
  // {
  //   title: 'Acc_5.com (investment)',
  //   amount: 9999999999.99,
  //   currency: 'cop',
  //   type: 'bank',
  // },
  // {
  //   title: 'Account_6 (investment)',
  //   amount: 9999999999.99,
  //   currency: 'usd',
  //   type: 'bank',
  // },
];

//InvestmentAccBalance

//SavingGoals
