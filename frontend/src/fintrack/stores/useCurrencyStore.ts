// frontend/src/fintrack/stores/useCurrencyStore.ts
// 💰 CURRENCY STORE: Global exchange rates management
//Centralizes fx currency rates in a global state

import { create } from 'zustand';
import { authFetch } from '../../auth/auth_utils/authFetch';
import { CurrencyType } from '../types/types';
import { DEFAULT_CURRENCY } from '../helpers/constants';
import { url_currency_rates } from '../../urlConfig';

// ======================================
// 📦 TYPES
// ======================================
type Rates = Record<CurrencyType, number>;

type CurrencyState = {
  rates: Rates;
  // Currency every amount is stored in, as the backend declares it. Distinct
  // from DEFAULT_CURRENCY, which is only what the interface renders in.
  accountingCurrency: CurrencyType;
  isLoading: boolean;
  error: string | null;
  fetchRates: () => Promise<void>;
};

// ======================================
// 🎯 STORE IMPLEMENTATION
// ======================================
export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  // Initial state
  rates: {} as Rates,
  // Starting value only, replaced by the server's own on the first fetch.
  accountingCurrency: DEFAULT_CURRENCY,
  isLoading: false,
  error: null,

// ======================================
// 🔄 FETCH RATES FROM BACKEND
// ======================================
  fetchRates: async () => {
    // Prevent multiple simultaneous requests
    if (get().isLoading) {
      // console.log('💰 fetchRates already in progress, skipping');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await authFetch<{
        base: string;
        rates: Rates;
        timestamp: string;
      }>(url_currency_rates);

      // console.log('💰 Rates fetched successfully:', response.data);

      // base is ACCOUNTING_CURRENCY_CODE, sent on every rates response. Reading
      // it here costs no request and removes the second source of truth.
      set({
        rates: response.data.rates,
        accountingCurrency:
          (response.data.base as CurrencyType) ?? DEFAULT_CURRENCY,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch exchange rates';
      console.error('💰 Error fetching rates:', errorMessage);
      set({ error: errorMessage, isLoading: false });
    }
  },
}));