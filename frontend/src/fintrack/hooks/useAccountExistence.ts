// ===================
// 📦 useAccountExistence - Hook for account existence validation
// ===================
// Purpose:
//   Fetch all user accounts once and provide utilities for:
//   - Autocomplete suggestions (filtered by account type)
//   - Duplicate checking (case-insensitive, by type)
//   Centralizes logic to avoid duplication across forms.
// ===================
import { useMemo } from 'react';
import { useFetch } from './useFetch';
import { url_get_all_accounts } from '../../urlConfig';
// ===================
// 📝 Local Type Definitions (minimal, no external dependencies)
// ===================

/**
 * Minimal structure of each account item returned by /account/allAccounts
 */
type AccountListItem = {
  account_name: string;
  account_type_name: string;
};

/**
 * Response structure from /account/allAccounts endpoint
 */
type AllAccountsResponse = {
  data: {
    accountList: AccountListItem[];
  };
};

/**
 * Return type of the useAccountExistence hook
 */
type UseAccountExistenceReturn = {
  isLoading: boolean;
  error: string | null;
  getSuggestions: (type: string) => string[];
  checkDuplicate: (name: string, type: string) => boolean;
};

// ===================
// 🎯 Main Hook
// ===================

/**
 * Hook that fetches all user accounts and provides utilities for
 * autocomplete and duplicate checking by account type.
 *
 * @example
 * const { getSuggestions, checkDuplicate } = useAccountExistence();
 * const suggestions = getSuggestions('bank');
 * const isDuplicate = checkDuplicate('Savings', 'bank');
 *
 * @returns {UseAccountExistenceReturn} Object with loading state, error,
 *          and utility functions.
 */
export const useAccountExistence = (): UseAccountExistenceReturn => {
// ===================
// 📡 1. DATA FETCHING (ONE-TIME REQUEST)
// ===================
  const { apiData, isLoading, error } =
    useFetch<AllAccountsResponse>(url_get_all_accounts);

// ===================
  // 📝 2. BUILD INDEX: type -> Set of names (lowercase)
// ===================
  const accountsByType = useMemo(() => {
    const accounts = apiData?.data?.accountList || [];
    const map = new Map<string, Set<string>>();

    accounts.forEach((acc) => {
      const type = acc.account_type_name;
      if (!map.has(type)) {
        map.set(type, new Set());
      }
      // Normalize to lowercase for case-insensitive comparison
      map.get(type)!.add(acc.account_name.toLowerCase());
    });

    return map;
  }, [apiData]);

// ===================
  // 🔍 3. UTILITY FUNCTIONS
// ===================

  /**
   * Returns a sorted list of account names for a given type.
   * Preserves original case from the database.
   *
   * @param type - Account type (e.g., 'bank', 'category_budget', 'debtor')
   * @returns Array of account names (original case, sorted alphabetically)
   */
  const getSuggestions = (type: string): string[] => {
    if (!type || !apiData?.data?.accountList) return [];

    const accounts = apiData.data.accountList;
    const filtered = accounts
      .filter((acc) => acc.account_type_name === type)
      .map((acc) => acc.account_name);

    return Array.from(new Set(filtered)).sort();
  };

  /**
   * Checks if a given name already exists for a specific account type.
   * Comparison is case-insensitive.
   *
   * @param name - Account name to check (will be trimmed and lowercased)
   * @param type - Account type
   * @returns true if the name exists for that type, false otherwise
   */
  const checkDuplicate = (name: string, type: string): boolean => {
    if (!type || !name.trim()) return false;
    const namesSet = accountsByType.get(type);
    return namesSet ? namesSet.has(name.trim().toLowerCase()) : false;
  };

// ===================
  // 📦 4. RETURN API
// ===================
  return {
    isLoading,
    error: error || null,
    getSuggestions,
    checkDuplicate,
  };
};

// ===================
// ✅ END OF HOOK
// ===================