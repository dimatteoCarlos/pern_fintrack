// frontend/src/fintrack/hooks/useRatePreview.ts

import { useRef } from 'react';

import { useServerCurrencyConversion } from './useServerCurrencyConversion';
import { useCurrencyStore } from '../stores/useCurrencyStore';
import { CURRENCY_OPTIONS } from '../helpers/currencyConstants';
import {
 currencyMinorUnit,
 numberFormatCurrency,
 toCalendarDay,
} from '../helpers/functions';
import { CurrencyType } from '../types/types';

const DASH = '—';

const toNumericDate = (date: Date): string =>
 date.toLocaleDateString('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
 });

// Built from the parts: new Date('YYYY-MM-DD') is UTC midnight, the previous day
// for every reader west of Greenwich.
const calendarDayLabel = (calendarDay: string): string => {
 const [year, month, day] = calendarDay.split('-').map(Number);
 if (!year || !month || !day) return '';
 return toNumericDate(new Date(year, month - 1, day));
};

// The converted amount and the rate chip of an amount field, asked of the same
// service the write path uses. `day` is the date the row is recorded on; omitted,
// the server prices at today's rate.
export function useRatePreview(
 amountToSave: number | undefined,
 currency: CurrencyType,
 day?: string,
) {
 const hasAmount = amountToSave !== undefined && amountToSave > 0;

 // One unit stands in for a missing amount, so the rate and its date are quoted
 // before anything is typed.
 const conversion = useServerCurrencyConversion(
  hasAmount ? amountToSave : 1,
  currency,
  day,
 );

 const accountingCurrency = useCurrencyStore((state) => state.accountingCurrency);

 // Kept while a new request is in flight, so the chip does not blink per keystroke.
 const lastSettled = useRef(conversion);
 if (conversion.status !== 'querying') lastSettled.current = conversion;
 const shown =
  conversion.status === 'querying' ? lastSettled.current : conversion;

 const locale = CURRENCY_OPTIONS[accountingCurrency];

 const convertedAmountText =
  hasAmount && shown.convertedAmount !== null
   ? numberFormatCurrency(
      shown.convertedAmount,
      currencyMinorUnit(accountingCurrency),
      undefined,
      locale,
     )
   : DASH;

 const previewText = `≈ ${convertedAmountText} ${accountingCurrency}`;

 // The quote, not the conversion's multiplier: a peso-to-dollar rate of 0.00031
 // renders as 0,00. Four decimals below ten keep the euro's 0.8470 readable.
 const quotedRate = shown.quote
  ? numberFormatCurrency(
     shown.quote.rate,
     Math.abs(shown.quote.rate) < 10 ? 4 : 2,
     undefined,
     locale,
    )
  : '';

 // A dated rate names the day it is in force since when that is not the day
 // asked for (a Saturday is valued by Friday's quote); an undated one names the
 // day it was read.
 const rateDayLine = shown.effectiveDate
  ? shown.effectiveDate !== (day ?? toCalendarDay(new Date()))
   ? `in force since ${calendarDayLabel(shown.effectiveDate)}`
   : `as of ${calendarDayLabel(shown.effectiveDate)}`
  : shown.fetchedAt
   ? `as of ${toNumericDate(new Date(shown.fetchedAt))}`
   : '';

 const tooltipText = [
  shown.quote ? `${accountingCurrency}→${shown.quote.currency}` : '',
  quotedRate ? `rate: ${quotedRate}` : '',
  rateDayLine,
 ]
  .filter(Boolean)
  .join('\n');

 return {
  // inactive when the currency is the accounting one: nothing to convert.
  status: shown.status,
  previewText,
  tooltipText,
  retry: conversion.retry,
  accountingCurrency,
 };
}
