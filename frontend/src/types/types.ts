import { AccountListType } from "./responseApiTypes";

//accounting
export type AccountingListType = {
  title: string;
  amount: number | string;
  currency: CurrencyType;
  type: string;
};

//-------------------
export type CategoriesType = {
  categories?: CategoryType[] | null;
};

export type CategoryType = {
  id: number;
  name: string; //in the future specify the possible names as a union of string types
  description: string;
  is_essential: boolean;
  created_at: string;
};

//expenses
export type ExpenseAccountsType = {
  accounts?: ExpenseAccountType[] | null;
};
export type ExpenseAccountType = {
  id: number;
  name: string; //in the future specify the possible names as a union of string types
  description: string;
  type: string;
  currency: CurrencyType;
  balance: number;
};

export type ExpensesInfoType = {
  count: number;
  expenses?: ExpenseType[] | null;
  limit: number;
  offset: number;
};

export type ExpenseType = {
  id: number;
  date: string;
  category: string; //in the future specify the possible names as a union of string types
  category_id: number;
  expense: number;
  description: string;
  method: string;
  originalAmount: number;
  account_id: number;
  account_type: string;
};

//-------------------------------------
//income
export type IncomeAccountsType = {
  accounts?: IncomeAccountType[] | null;
};
export type IncomeAccountType = {
  id: number;
  name: string; //in the future specify the possible names as a union of string types
  description: string;
  type: string; //specify the possible types as a union of string types
  currency: string;
  balance: number;
};
export type IncomeInfoType = {
  count: number;
  incomes: IncomeType[] | null;
  limit?: number;
  offset?: number;
};

export type IncomeType = {
  id: number;
  date: string;
  amount: number;
  description: string;
  account_id: number;
  account_name: string; //in the future specify the possible names as a union of string types
  created_at: string;
};

//sources
/*
export type SourcesType = {
  sources?: SourceType[] | null;
};
export type SourceType = {
  id: number;
  name: string; //in the future specify the sources name as a union of string
  description: string;
  type?: string;
  currency?: string;
  balance?: number;
};
*/
//investments
export type InvestmentAccountsType = {
  accounts?: InvestmentAccountType[] | null;
};

export type TransactionType = 'deposit' | 'withdraw';

export type InvestmentAccountType = {
  id: number;
  name: string;
  description: string;
  type: TransactionType;
  currency: string;
  balance: number;
};

//transfer (between investment, bank and pocket_saving account types)
export type MovementInputDataType = {
  amount:string;
  origin: string;
  currency: CurrencyType;
  destination: string //| undefined
 ;
 note: string;

 originAccountType: TransferAccountType;
  destinationAccountType: TransferAccountType;

 originAccountId?: number;
 destinationAccountId?: number;

 type?: MovementTransactionType;
 date?: Date;
};

export type TransferAccountType=
  'bank' | 'investment' | 'pocket'| 'category_budget' | 'income_source' ;

export type MovementTransaction = 'deposit' | 'withdraw';
//---
export type MovementAccountType = {
  id: number;
  name: string;
  description: string;
  type: TransactionType;
  currency: string;
  balance: number;
};

//-------------------
//debtor-tracker
export type DebtorsListType = { debtors: DebtorDataType[] };
export type DebtorDataType = {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  description: string;
};

export type DebtsTransactionType = string;

// export type DebtsTransactionType = 'lend' | 'borrow';

export type DebtorNewProfileType = 'lending' | 'borrowing';

//--------------------------------
//debts
export type DebtsType = {
  result?: DebtType[] | null;
};

export type DebtType = {
  debtor_id: number;
  debtor_name: string;
  net_amount: number;
  total_amount_borrowed: number;
  total_amount_lent: number;
  currency?: string;
  // transaction_count: number;
};

//budget
export type CategoryBudgetListType = {
  budgets?: CategoryBudgetType[];
};

export type CategoryBudgetType = {
  category_name: string;
  // category_id: number;
  remaining: number; //amount
  spent: number;
};

//saving/ListPocket
export type PocketsToRenderType = {
  pocketName: string;
  description: string;
  saved: number;
  goal: number;
  currency: CurrencyType;
  status?: number;
  pocket_id: number;
  desired_date:Date
};
//----------------------------------
export type StatusType = boolean;

export type CurrencyType = 'usd' | 'cop' | 'eur';

export type DebtorType = 'debtor' | 'lender';

export type CURRENCY_OPTIONSTYPE = {
  usd: 'en-US';
  cop: 'cop-CO';
  eur: 'en-US';
};

//LabelInputNumberHandler
export type FormNumberInputType = { [key: string]: string };

// export type FormNumberInputType = Pick<ProfileInputDataType, 'amount'>;


export type VariantType = 'tracker' | 'form' | 'light' | 'dark';

export type DropdownOptionType = { value: string; label: string };

//tracker input mask data type
export type TopCardSelectStateType =
  | ExpenseInputDataType
  | IncomeInputDataType
  | InvestmentInputDataType
  | DebtsTrackerInputDataType
  | BasicTrackerMovementInputDataType;

export type ExpenseInputDataType = {
  amount:string;
  account: string;
  category: string | undefined; //ojo
  note: string;
  currency: string;
  // date?: Date;
  // type?: MovementTransactionType;
};

export type IncomeInputDataType = {
  amount: string;
  account: string;
  source: string ;//| undefined;
  note: string;
  currency: CurrencyType;
  // date?: string;
  // type?: MovementTransactionType;
};

export type InvestmentInputDataType = {
  amount: number | '';
  account: string;
  currency: CurrencyType;
  type: MovementTransactionType;
  date: Date;
  note: string;
};

export type DebtsTrackerInputDataType = {
  amount: number | '';
  debtor: string;
  currency: CurrencyType;
  type: MovementTransactionType;
  account: string;
  accountType: string | undefined;
  date: Date;
  note: string;
};

export type MovementTransactionType = TransactionType | DebtsTransactionType;

export type BasicTrackerMovementInputDataType = {
  amount:string;
  currency: CurrencyType;
  account: string;
  accountType: string | undefined;
  note: string;
  type?: MovementTransactionType;
  date?: Date;
  accountId?:string;
};

export type TopCardElementsType = {
    titles: { title1: string; title2: string , label2?:string};
    value: string;
    selectOptions: {
      title: string;
      options: {
        value: string;
        label: string;
      }[];
      variant: VariantType;
    };
    accountsListInfo?:AccountListType[];
  };

//------------------------------------
export type UserRolesType = 'user' | 'admin' | 'super_admin';

//--Budget Category Detail
//--CategoryAccountList.tsx

export type CategorySummaryInfoType = {
    total_balance: number;
    total_budget: number;
    remain: number;
    total_remaining?:number;
    statusAlert: boolean;
    currency_code: CurrencyType;
    category_name?: string;
}

// export type ValidationMessagesType<T> = Partial<Record<keyof T, string>>;

