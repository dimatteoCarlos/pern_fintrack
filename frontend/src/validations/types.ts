//src/validations/types.ts
import {
  CurrencyType,MovementTransactionType } from '../types/types';

export type ExpenseValidatedDataType = {
  amount: number; // Convertido a número después de validación
  account: string;
  category: string;
  note: string;
  currency: CurrencyType;
};

export type IncomeValidatedDataType = {
  amount: number; // Convertido a número después de validación
  account: string;
  source: string;
  note: string;
  currency: CurrencyType;
};

export type MovementValidatedDataType = {
  amount:number;
  origin: string;
  currency: CurrencyType;
  destination: string | undefined;
  originAccountId?: number;
  destinationAccountId?: number;
  note: string;
  originAccountType: string,// | undefined;
  destinationAccountType: string,// | undefined;

};

//---
// export type BasicTrackerMovementValidatedDataType = {
//   [K in keyof BasicTrackerMovementInputDataType]: 
//     K extends 'amount' ? number : BasicTrackerMovementInputDataType[K]
// };

export type BasicTrackerMovementValidatedDataType = {
  amount: number;
  currency: CurrencyType;
  account: string;
  accountType: string | undefined;
  note: string;
  type?: MovementTransactionType;
  date: Date;
  accountId?: string;
};
//---
//ValidationMessagesType:structure data type that validateForm will return when validation errors are found. T is form fields names.

export type ValidationMessagesType<T extends Partial<Record<string, unknown>>> = {
  [K in keyof T]?: string;
};

export type ValidationResultType<T extends Record<string, unknown>> = {
  errors:ValidationMessagesType<T>;
  data:T | null;
};

//================================

