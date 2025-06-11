//I used https://jvilk.com/MakeTypes/ to define the types
//API RESPONSE TYPES FROM BACKEND

//API RESPONSE TYPE DEFINITIONS
import { CurrencyType } from './types';

//ACCOUNT BALANCE BY TYPE

export type BalanceBankRespType = {
  status: number;
  message: string;
  data: {
    total_balance: number | null;
    accounts: number;
    currency_code: CurrencyType;
  };
};

export type BalanceIncomeRespType = {
  status: number;
  message: string;
  data: {
    total_balance: number | null;
    accounts: number;
    currency_code: CurrencyType;
  };
};

export type BalancePocketRespType = {
  status: number;
  message: string;
  data: {
    account_name: string | null;
    account_id?: number | null;
    total_balance: number | null;
    total_target: number | null;
    total_remaining?: number | null;
    currency_code: CurrencyType;
    note?: string | null;
  };
};

export type BalanceCategoryRespType = {
  status: number;
  message: string;
  data: {
    total_balance: number | null;
    total_budget: number | null;
    total_remaining: number | null;
    currency_code: CurrencyType;
  };
};

export type DebtorRespType = {
  status: number;
  message: string;
  data: {
    total_debt_balance: number | null;
    debt_receivable: number | null;
    debt_payable: number | null;
    debtors: number | null;
    creditors: number | null;
    debtors_without_debt: number | null;
        currency_code: CurrencyType;
  };
};

//CREATE BASIC ACCOUNT RESPONSE TYPE FROM API

// Complete API response structure
export interface CreateBasicAccountApiResponseType {
  status: number;
  data: ResponseDataType;
  message: string;
}

// Main response data structure
interface ResponseDataType {
  user_id: string;
  account_basic_data: AccountBasicDataType;
  new_account_data: NewAccountDataType;
  counter_account_data: CounterAccountDataType;
}

// Base transaction data interface (reused in multiple places)
export interface TransactionDataType {
  description: string;
  transaction_type_id: number;
  amount: number;
  currency_id: number;
  account_id: number;
  source_account_id?: number;
  destination_account_id?: number;
  movement_type_id: number;
  status: string;
  transaction_actual_date: string | Date;
}

// Extended transaction info (includes additional fields)
interface TransactionInfoType extends TransactionDataType {
  transaction_id: number;
  created_at: string;
  amount: number;
  // Note: amount is string here (different from TransactionData)
}

// Account basic data structure
export interface AccountBasicDataType {
  account_id: number;
  account_name: string;
  account_type_id: number;
  account_type_name: string;
  currency_id?: number;
  currency_code: CurrencyType;
  account_balance: number;
  account_starting_amount?: number;
  account_start_date?: string | Date;
  created_at?: Date;
  updated_at?: Date;
}

// New account data structure
interface NewAccountDataType {
  account_name: string;
  transaction_data: TransactionDataType;
  transaction_info: TransactionInfoType;
  transaction_type_name: string;
}

// Counter account data structure
interface CounterAccountDataType {
  transaction_data: TransactionDataType & {
    userId: string;
  };
  transaction_info: TransactionInfoType;
  transaction_type_name: string;
  balance: number;
  account_type_name: string;
}

//CREATE CATEGORY BUDGET ACCOUNT
export type CreateCategoryBudgetAccountApiResponseType = {
  status: number;
  data: CategoryBudgetResponseDataType;
  message: string;
};

interface CategoryBudgetResponseDataType extends ResponseDataType {
  new_category_budget_account: CategoryBudgetAccountType;
}

type CategoryBudgetAccountType = {
  account_id: number;
  category_name: string;
  category_nature_type_id: number;
  subcategory?: string | null;
  budget: number | string;
  amount?: number;
  account_start_date: Date | string;
  nature_type_name: string;
  currency_code: CurrencyType;
};

//CREATE DEBTOR ACCOUNT
export type CreateDebtorAccountApiResponseType = {
  status: number;
  data: DebtorResponseDataType;
  message: string;
};

interface DebtorResponseDataType extends ResponseDataType {
  new_debtor_account: DebtorAccountType;
}

type DebtorAccountType = {
  account_id: number;
  value: number; // Formato monetario -120.00
  debtor_name: string;
  debtor_lastname: string;
  selected_account_name: string;
  selected_account_id: number | null;
  account_start_date: Date | string; // ISO 8601 format
  currency_code: CurrencyType;
  account_type_name: 'debtor';
};

//CREATE POCKET SAVING ACCOUNT

export type CreatePocketSavingAccountApiResponseType = {
  status: number;
  data: PocketResponseDataType;
  message: string;
};

interface PocketResponseDataType extends ResponseDataType {
  new_pocket_saving_account: PocketSavingAccountType;
}

type PocketSavingAccountType = {
  account_id: number;
  note: string;
  target: number; //| string;
  desired_date: Date | string;
  account_start_date: Date | string;
  // currency_code: CurrencyType;
  // account_type_name: pocket_saving
};

//GET ACCOUNT BY TYPE. RESPONSE TYPE
//bank type
export type AccountByTypeResponseType = {
  status: number;
  message: string;
  data: {
    rows: number;
    accountList: AccountListType[];
  };
};

export type AccountListType = Omit<
  AccountBasicDataType,
  'currency_id' | 'created_at' | 'updated_at'
>;

//category_budget type
export type CategoryBudgetAccountsResponseType = {
  status: number;
  message: string;
  data: {
    rows: number;
    accountList: CategoryBudgetAccountListType[];
  };
};

type CategoryBudgetAccountListType = Omit<
  AccountBasicDataType,
  'currency_id' | 'created_at' | 'updated_at'
> & {
  budget: number;
  subcategory?: string;
  category_nature_type_name: string;
  account_starting_amount: number;
  account_start_date: Date | string;
};

//MOVEMENT TRANSFER BETWEEN ACCOUNTS
export type MovementTransactionResponseType = {
  status: number;
  message: string;
  data: DataTransactionType;
};
type DataTransactionType = {
  movement: MovementType;
  source: SourceOrDestinationType;
  destination: SourceOrDestinationType;
};

type MovementType = {
  movement_type_name: string;
  movement_type_id: number;
};

type SourceOrDestinationType = {
  account_info: AccountInfo;
  balance_updated: BalanceUpdatedType;
  transaction_info: RecordTransactionInfoType;
};
type AccountInfo = {
  account_name: string;
  account_type: string;
  amount: number;
  currency: CurrencyType;
};

type BalanceUpdatedType = {
  amount_transaction: number;
  new_balance: number;
};

type RecordTransactionInfoType = {
  transaction_type: string;
  transaction_description: string;
  transaction_date: string | Date;
};

//MONTHLY TOTAL AMOUNT BY MOVEMENT TYPE AND CURRENCY

export type FinancialDataRespType = {
  status: number;
  message: string;
  data: FinancialDataType;
};
export interface FinancialDataType {
  dateRange: DateRange;
  monthlyAmounts: MonthlyDataType[] | null;
}

export interface DateRange {
  start: string | Date;
  end: string | Date;
}

export type MonthlyDataType = {
  month_index: number;
  month_name: string;
  movement_type_id: number;
  transaction_type_id: number;
  name: string;
  amount: number;
  currency_code: CurrencyType;
  type: 'expense' | 'income' | 'saving' | 'other';
};

//MOVEMENT TRANSACTIONS BY TYPE
//LAST MOVEMENTS LIST

export type LastMovementRespType = {
  status: number;
  message: string;
  data: MovementTransactionDataType[] | null;
};

export type MovementTransactionDataType = {
  movement_type_name: string;
  account_id: number;
  user_id: string;
  account_name: string;
  account_type_id: number;
  currency_code: CurrencyType;
  currency_id: number;
  account_starting_amount: number;
  account_balance: number;
  account_start_date: string | Date;
  created_at: string;
  updated_at: string;
  transaction_id: number;
  description: string;
  amount: number;
  movement_type_id: number;
  transaction_type_id: number;
  source_account_id: number;
  destination_account_id: number;
  status: string;
  transaction_actual_date: string | Date;
  transaction_type_name: string;
  account_type_name: string;
};

//CATEGORY LIST SUMMARY
export interface CategoryListSummaryType {
  status: number;
  message: string;
  data?: CategoryListType[] | null;
}
export interface CategoryListType {
  category_name: string;
  currency_code: CurrencyType;
  total_balance: number;
  total_remaining: number;
}

//DEBTOR LIST SUMMARY
export interface DebtorListSummaryType {
  status: number;
  message: string;
  data?: DebtorListType[] | null;
}

export interface DebtorListType {
  account_name: string;
  account_id: number; //| null;
  currency_code: CurrencyType;
  total_debt_balance: number; //| null;
  debt_receivable: number; //| null;
  debt_payable: number;
  debtor: number; //1/0
  creditor: number; //1/0
}

//POCKET LIST SUMMARY
export interface PocketListSummaryType {
  status: number;
  message: string;
  data?: PocketListType[] | null;
}

export interface PocketListType {
  account_name: string;
  account_id: number; //| null;
  currency_code: CurrencyType;
  total_balance: number; //| null;
  total_remaining?: number; //| null;
  total_target: number;
  desired_date:Date;
  note: string;
}
