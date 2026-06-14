
// 💰 CENTRAL CURRENCY CONSTANTS (frontend)
// Must match backend/src/fintrack_api/config/constants.js supportedCurrencies
import { CurrencyType } from '../types/types';

export const SUPPORTED_CURRENCIES: CurrencyType[] = ['usd', 'eur', 'cop', 'ves', 'mxn'];

// Circular order for currency badge toggle (same order as SUPPORTED_CURRENCIES, but can be customized)
export const CURRENCY_CYCLE: CurrencyType[] = ['usd', 'eur', 'cop', 'ves', 'mxn'];

export const DEFAULT_CURRENCY: CurrencyType = 'usd';

export const CURRENCY_OPTIONS: Record<CurrencyType, string> = {
  usd: 'en-US',
  eur: 'en-US',
  cop: 'cop-CO',
  ves: 'es-VE',
  mxn: 'es-MX',
};

// Dynamic select options using Intl
const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

export const SELECT_CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map(code => ({
  value: code,
  label: `${code.toUpperCase()} - ${currencyNames.of(code.toUpperCase())}`,
}));
