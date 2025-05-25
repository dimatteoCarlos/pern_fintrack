import {
  AccountingListType,
  DropdownOptionType,
  PocketsToRenderType,
  VariantType,
} from '../types/types';

//------------------------
export const PAGE_LOC_NUM = 3

//-------------------------
export const CURRENCY_OPTIONS = { usd: 'en-US', cop: 'cop-CO', eur: 'en-US' };
export const DEFAULT_CURRENCY = 'usd';
export const DATE_TIME_FORMAT_DEFAULT = 'es-ES';
export const VARIANT_DEFAULT: VariantType = 'tracker';
export const VARIANT_FORM: VariantType = 'form';

//tracker/expense
export const ACCOUNT_OPTIONS_DEFAULT = [
  { value: 'acc.name_01', label: 'acc.name_01' },
  { value: 'acc.name_02', label: 'acc.name_02' },
  { value: 'acc.name_03', label: 'acc.name_03' },
];

export const CATEGORY_OPTIONS_DEFAULT = [
  { value: 'category_01', label: 'Category_01 / SubCategory 01' },
  { value: 'category_02', label: 'Category_02 / SubCategory 02' },
  { value: 'category_03', label: 'Category_03 / SubCategory 03' },
];

//tracker/income
export const INCOME_OPTIONS_DEFAULT = [
  { value: 'account_01', label: 'Account_01' },
  { value: 'account_02', label: 'Account_02' },
  { value: 'account_03', label: 'Account_03' },
  { value: 'account_04', label: 'Account_04' },
];

export const SOURCE_OPTIONS_DEFAULT = [
  { value: 'source_01', label: 'source_01' },
  { value: 'source_02', label: 'source_02' },
  { value: 'source_03', label: 'source_03' },
  { value: 'source_04', label: 'source_04' },
];

//tracker/investment
export const INVESTMENT_ACCOUNT_OPTIONS_DEFAULT = [
  { value: 'account_01', label: 'Investment_Account_01' },
  { value: 'account_02', label: 'Investment_Account_02' },
  { value: 'account_03', label: 'Investment_Account_03' },
  { value: 'account_04', label: 'Investment_Account_04' },
];

//tracker/debts
export const DEBTOR_OPTIONS_DEFAULT = [
  { value: 'debtor_01', label: 'debtor_01' },
  { value: 'debtor_02', label: 'debtor_02' },
  { value: 'debtor_03', label: 'debtor_03' },
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

//pages/debts/ListPocket.tsx


 export const DEFAULT_POCKET_LIST: PocketsToRenderType[] = [
  {
    pocketName: 'Name Pocket 01',
    description: 'Description 01',
    saved: Math.random() * 100,
    goal: Math.random() * 100,
    status: Math.floor((Math.random() - 0.5) * 100),
    pocket_id: 4,
  },
  {
    pocketName: 'Name Pocket 02',
    description: 'Description 02',
    saved: 99,
    goal: 100,
    currency: 'cop',
    pocket_id: 4,
  },
  {
    pocketName: 'Name Pocket 03',
    description: 'Description 03',
    saved: 500,
    goal: 98,
    currency: 'eur',
    pocket_id: 4,
  },
  {
    pocketName: 'Name Pocket 04',
    description: 'Description 04',
    saved: Math.random() * 100,
    goal: Math.random() * 100,
    currency: 'eur',
    pocket_id: 4,
  },
];

//account detail



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
