// frontend/src/fintrack/general_components/CurrencyInitializer.tsx
// 💰 CURRENCY INITIALIZER: Loads exchange rates once on app startup

import { useEffect } from 'react';
import { useCurrencyStore } from '../../stores/useCurrencyStore';
import { useAuthStore } from '../../../auth/stores/useAuthStore';

export function CurrencyInitializer() {
  // Subscribe only to fetchRates (not to rates, to avoid unnecessary re-renders)
  const fetchRates = useCurrencyStore((state) => state.fetchRates);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      console.log('💰 CurrencyInitializer: user authenticated, loading rates...');
      fetchRates();
    }
  }, [isAuthenticated, fetchRates]);

  // This component renders nothing
  return null;
}