// frontend/src/fintrack/helpers/currencyConstants.ts

// 💰 CENTRAL CURRENCY CONSTANTS (frontend)
//
// The one home for every currency list the interface reads. `constants.ts`
// re-exports this file wholesale, so a consumer may import either path and gets
// the same binding.
//
// It used to be true that a consumer got DIFFERENT bindings depending on the
// path: `constants.ts` re-exported this file and then redeclared four of its
// five exports, and a local export wins over a star re-export, so half the
// application read one locale map and half read the other. The redeclarations
// were removed on 2026-09-05; if a currency constant is ever added to
// `constants.ts` again, that split comes back silently.
//
// The list below must match SUPPORTED_CURRENCIES in
// backend/src/fintrack_api/services/fx_services/core/fxConfig.js, which is what
// the request validators derive their accepted set from. A code missing there is
// refused by the API even if this file offers it.
import { CurrencyType, DropdownOptionType } from '../types/types';

export const SUPPORTED_CURRENCIES: CurrencyType[] = [
 'usd',
 'eur',
 'cop',
 'ves',
 'mxn',
];

// Circular order for the currency badge toggle. Deliberately NOT the order of
// SUPPORTED_CURRENCIES: the toggle puts the two most used currencies next to
// each other so one tap moves between them.
export const CURRENCY_CYCLE: CurrencyType[] = [
 'usd',
 'cop',
 'eur',
 'ves',
 'mxn',
];

// The locale each currency is formatted under. A locale, not a currency code —
// the Colombian peso read 'cop-CO' until 2026-09-05, which is a language subtag
// filled with a currency code and made the formatter fall back instead of
// formatting as the map says.
export const CURRENCY_OPTIONS: Record<CurrencyType, string> = {
 usd: 'en-US',
 eur: 'en-US',
 cop: 'es-CO',
 ves: 'es-VE',
 mxn: 'es-MX',
};

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

// Generated from SUPPORTED_CURRENCIES rather than written out, so a currency
// added to that list reaches every dropdown without a second edit.
export const SELECT_CURRENCY_OPTIONS: DropdownOptionType<CurrencyType>[] =
 SUPPORTED_CURRENCIES.map((code) => ({
  value: code,
  label: `${code.toUpperCase()} - ${currencyNames.of(code.toUpperCase())}`,
 }));

// The currency the interface renders in when the owner has expressed no choice.
// Read from the environment so it can follow the backend's own accounting
// currency without a code change.
export const DEFAULT_CURRENCY = (import.meta.env
 .VITE_ACCOUNTING_CURRENCY_CODE || 'usd') as CurrencyType;
