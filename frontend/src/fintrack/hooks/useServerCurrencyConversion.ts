// frontend/src/fintrack/hooks/useServerCurrencyConversion.ts

// 💱 HOOK: the conversion the SERVER resolves, not the one the client guesses.
//
// It exists beside useCurrencyPreview, which is not being replaced. The two
// answer different questions and only one of them is binding:
//
// - useCurrencyPreview divides by a rate already in the store. It costs no
//   request, it is instantaneous, and it is an approximation. Every form that
//   only has to hint at an order of magnitude keeps using it.
// - this one asks the same service the write path itself uses, so the figure it
//   shows is the figure the row will carry, together with the rate, where that
//   rate came from and when it was read.
//
// Use it only where the owner is about to commit to the number. Anywhere else
// it buys a network round trip for a hint.
//
// Three states, and they are not degrees of one another: a request in flight is
// not a failed one, and neither is having nothing to convert. A rate the server
// could not resolve used to be indistinguishable from an amount already in the
// stored currency — both rendered as no conversion at all — which is exactly
// the case where the owner most needs to be told.

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import { authFetch } from '../../auth/auth_utils/authFetch';
import { normalizeError } from '../helpers/normalizeError';
import { useCurrencyStore } from '../stores/useCurrencyStore';
import { CurrencyType } from '../types/types';
import { url_currency_convert } from '../../urlConfig';

// Long enough that a figure typed digit by digit costs one request instead of
// one per keystroke, short enough that the answer arrives before the owner has
// moved on to the submit button.
const DEBOUNCE_MS = 400;

type ConversionStatus = 'inactive' | 'querying' | 'resolved' | 'failed';

type ServerCurrencyConversion = {
 // inactive: nothing to convert, because the amount is not usable yet or it is
 // already typed in the currency the row will be stored in.
 status: ConversionStatus;
 convertedAmount: number | null;
 rate: number | null;
 // Which rate answered: the live provider, the cached state or the historical
 // store. The owner is entitled to know a figure came from a stale reading.
 source: string | null;
 fetchedAt: string | null;
 errorMessage: string | null;
 // Only meaningful while the status is failed. Re-runs the same request.
 retry: () => void;
};

type ConvertResponse = {
 convertedAmount: number;
 rate: number;
 source: string;
 fetchedAt: string;
};

const INACTIVE: Omit<ServerCurrencyConversion, 'retry'> = {
 status: 'inactive',
 convertedAmount: null,
 rate: null,
 source: null,
 fetchedAt: null,
 errorMessage: null,
};

export function useServerCurrencyConversion(
 amount: number | string,
 currency: CurrencyType,
 // The day the movement is dated on, YYYY-MM-DD. Optional: a form that records
 // on today alone omits it and the server prices at today's rate, which is what
 // every caller did before this existed. A form that offers a date must pass it
 // — otherwise it shows a figure resolved on one day and stores one resolved on
 // another, which is the exact divergence a server-side preview exists to close.
 day?: string,
): ServerCurrencyConversion {
 // The currency the amount will be STORED in, as the server declares it. Not
 // DEFAULT_CURRENCY, which is only what the interface renders in.
 const accountingCurrency = useCurrencyStore((state) => {
  return state.accountingCurrency;
 });

 const [result, setResult] =
  useState<Omit<ServerCurrencyConversion, 'retry'>>(INACTIVE);

 // Bumped to re-run the effect on retry without changing any of its inputs.
 const [attempt, setAttempt] = useState(0);

 const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;
 const numericAmount = isNaN(parsed) ? 0 : parsed;

 // A response that arrives after a newer one was issued must not overwrite it.
 // Aborting is not enough on its own: a request already past the wire returns
 // before its abort lands, so the answer is also stamped and checked.
 const latestRequest = useRef(0);

 const retry = useCallback(() => {
  setAttempt((previous) => previous + 1);
 }, []);

 useEffect(() => {
  if (numericAmount <= 0 || currency === accountingCurrency) {
   setResult(INACTIVE);
   return;
  }

  const requestId = latestRequest.current + 1;
  latestRequest.current = requestId;

  const controller = new AbortController();

  const timer = setTimeout(async () => {
   setResult({ ...INACTIVE, status: 'querying' });

   try {
    const response = await authFetch<ConvertResponse>(url_currency_convert, {
     method: 'POST',
     signal: controller.signal,
     data: {
      amount: numericAmount,
      fromCurrency: currency,
      toCurrency: accountingCurrency,
      // Omitted rather than sent as undefined, so a caller with no date puts
      // the same body on the wire it put there before.
      ...(day ? { day } : {}),
     },
    });

    if (latestRequest.current !== requestId) return;

    setResult({
     status: 'resolved',
     convertedAmount: response.data.convertedAmount,
     rate: response.data.rate,
     source: response.data.source,
     fetchedAt: response.data.fetchedAt,
     errorMessage: null,
    });
   } catch (error: unknown) {
    // An abort is this hook replacing its own question, not a failure to
    // answer it. Reporting it would flash an error between two keystrokes.
    if (axios.isCancel(error)) return;
    if (latestRequest.current !== requestId) return;

    setResult({
     ...INACTIVE,
     status: 'failed',
     errorMessage: normalizeError(error).message,
    });
   }
  }, DEBOUNCE_MS);

  return () => {
   clearTimeout(timer);
   controller.abort();
  };
 // day is a dependency, not just a payload field: without it here, changing the
 // date would leave the previous day's figure on screen.
 }, [numericAmount, currency, accountingCurrency, day, attempt]);

 return { ...result, retry };
}
