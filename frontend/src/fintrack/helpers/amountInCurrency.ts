// frontend/src/fintrack/helpers/amountInCurrency.ts

import { checkNumberFormatValue } from '../validations/utils/custom_validation';
import { currencyMinorUnit } from './functions';

// The typed text is kept as written; the currency only decides how it is read.
// A form that stores the text and derives from it gets the typed decimals back
// when the owner leaves a zero-decimal currency.
export function readAmountInCurrency(
 typedAmount: string,
 currency: string,
): { amountToSave: number | undefined; displayedAmount: string } {
 const amountToSave = checkNumberFormatValue(typedAmount, currency).valueToSave;

 const displayedAmount =
  currencyMinorUnit(currency) === 0 &&
  /[.,]/.test(typedAmount) &&
  amountToSave !== undefined
   ? String(amountToSave)
   : typedAmount;

 return { amountToSave, displayedAmount };
}

// A currency with no decimals refuses the separator keystroke outright.
export function refusesDecimalSeparator(value: string, currency: string): boolean {
 return currencyMinorUnit(currency) === 0 && /[.,]/.test(value);
}
