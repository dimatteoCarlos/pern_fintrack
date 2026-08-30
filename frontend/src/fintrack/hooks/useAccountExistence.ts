// useAccountExistence - shared account name existence check.
//
// Fetches every account of the user once and answers two questions over that
// index: which names of a type already exist (autocomplete), and whether a
// given name is taken by ANOTHER account of the same type.
//
// The index is keyed by account identifier, not by name, because a rename has
// to be able to discard the account being edited: a name is a duplicate of
// another account, never of itself. Mirrors the predicate the server runs in
// accountEditController.js when a name is rewritten.
import { useCallback, useMemo } from 'react';
import { useFetch } from './useFetch';
import { url_get_all_accounts } from '../../urlConfig';

/**
 * Minimal structure of each account item returned by /account/allAccounts.
 * The identifier is what makes the self-exclusion possible.
 */
type AccountListItem = {
 account_id: number | string;
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
 * One entry of the per-type index: the identifier that allows an account to be
 * excluded, and the folded name that is compared against.
 */
type AccountIndexEntry = {
 accountId: string;
 foldedName: string;
};

/**
 * Three states, because the index can be unanswered.
 * 'taken'   - another account of this type already holds the name.
 * 'free'    - no other account of this type holds it.
 * 'unknown' - the account list has not arrived, so nothing can be claimed.
 */
export type NameAvailability = 'taken' | 'free' | 'unknown';

/**
 * Return type of the useAccountExistence hook
 */
type UseAccountExistenceReturn = {
 isLoading: boolean;
 error: string | null;
 /** False until the account list has actually arrived. */
 isIndexReady: boolean;
 getSuggestions: (type: string, excludeAccountId?: number | string) => string[];
 checkNameCollision: (
  name: string,
  type: string,
  excludeAccountId?: number | string,
 ) => NameAvailability;
 checkDuplicate: (
  name: string,
  type: string,
  excludeAccountId?: number | string,
 ) => boolean;
};

// The list carries a numeric identifier while a route parameter arrives as a
// string. Comparing them raw would never match and the exclusion would be a
// silent no-op, so both sides are folded to a string.
const asAccountKey = (
 accountId: number | string | null | undefined,
): string | null =>
 accountId === null || accountId === undefined ? null : String(accountId);

/**
 * Hook that fetches all user accounts and provides utilities for autocomplete
 * and duplicate checking by account type, with an optional account excluded
 * from both so an edition does not collide with itself.
 *
 * @example
 * const { getSuggestions, checkNameCollision } = useAccountExistence();
 * const suggestions = getSuggestions('bank', accountId);
 * const availability = checkNameCollision('Savings', 'bank', accountId);
 */
export const useAccountExistence = (): UseAccountExistenceReturn => {
 const { apiData, isLoading, error } =
  useFetch<AllAccountsResponse>(url_get_all_accounts);

 // The only proof the question was answered. isLoading is not enough: useFetch
 // initialises it to false, so the very first render is neither loading nor
 // answered, and reading it as "free" there is the false negative this hook
 // has to stop producing.
 const accountList = useMemo(() => {
  const list = apiData?.data?.accountList;
  return Array.isArray(list) ? list : null;
 }, [apiData]);

 const isIndexReady = accountList !== null;

 // Index: account type -> entries carrying identifier and folded name.
 const accountsByType = useMemo(() => {
  const map = new Map<string, AccountIndexEntry[]>();

  (accountList ?? []).forEach((account) => {
   const type = account.account_type_name;
   const accountKey = asAccountKey(account.account_id);
   if (!type || accountKey === null) return;

   const entries = map.get(type) ?? [];
   entries.push({
    accountId: accountKey,
    // Folded to lowercase to match the server, which compares with LOWER().
    foldedName: account.account_name.trim().toLowerCase(),
   });
   map.set(type, entries);
  });

  return map;
 }, [accountList]);

 /**
  * Sorted account names of a given type, original case preserved.
  * The excluded account does not offer its own name back as a suggestion: it
  * is exempt from the collision check, so suggesting it would invite a name
  * the form then accepts for a reason the user cannot see.
  */
 const getSuggestions = useCallback(
  (type: string, excludeAccountId?: number | string): string[] => {
   if (!type || accountList === null) return [];

   const excludedKey = asAccountKey(excludeAccountId);
   const names = accountList
    .filter((account) => account.account_type_name === type)
    .filter((account) => asAccountKey(account.account_id) !== excludedKey)
    .map((account) => account.account_name);

   return Array.from(new Set(names)).sort();
  },
  [accountList],
 );

 /**
  * Whether the name is already held by another account of the same type.
  * Returns 'unknown' while the account list has not arrived, so a caller can
  * tell "no collision" from "no answer yet".
  */
 const checkNameCollision = useCallback(
  (
   name: string,
   type: string,
   excludeAccountId?: number | string,
  ): NameAvailability => {
   // An empty name asks nothing; the required-field rule owns that case.
   if (!type || !name.trim()) return 'free';
   if (!isIndexReady) return 'unknown';

   const excludedKey = asAccountKey(excludeAccountId);
   const target = name.trim().toLowerCase();
   const entries = accountsByType.get(type) ?? [];

   const collides = entries.some(
    (entry) => entry.foldedName === target && entry.accountId !== excludedKey,
   );

   return collides ? 'taken' : 'free';
  },
  [accountsByType, isIndexReady],
 );

 /**
  * Boolean view of the check, kept for the creation screens that already read
  * it that way. 'unknown' reads as not-a-duplicate here, which is why a caller
  * that gates a submit control must read checkNameCollision instead.
  */
 const checkDuplicate = useCallback(
  (name: string, type: string, excludeAccountId?: number | string): boolean =>
   checkNameCollision(name, type, excludeAccountId) === 'taken',
  [checkNameCollision],
 );

 return {
  isLoading,
  error: error || null,
  isIndexReady,
  getSuggestions,
  checkNameCollision,
  checkDuplicate,
 };
};
