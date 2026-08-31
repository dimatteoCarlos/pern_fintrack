// frontend/src/fintrack/pages/debts/hooks/useDebtorListFilter.ts
// 🔎 DEBTOR LIST FILTER: shortening the list without moving a figure
//
// One request already carries every debtor, so filtering and sorting happen
// here, in memory, over rows the fetch already holds. Same shape as
// usePocketListFilter: the hero above this list keeps whatever it reports on
// its own, and this hook only changes which of the already-counted rows are
// listed — it never touches a header figure. That boundary matters more than
// usual here: the debts indicator contract is under a separate audit right
// now, and this hook is not where that gets decided.
//
// 'debtor' and 'lender' are the same split the row already prints
// (ListOfDebtors.tsx's transactionType), read off the same two fields rather
// than a third flag, so the filter and the row it narrows down to can never
// disagree about which one a given account is.

import { useMemo } from 'react';
import { DebtorListType } from '../../../types/responseApiTypes';

export type DebtorSortKey = 'balance' | 'name';
export type DebtorSortDirection = 'asc' | 'desc';

// Balance leads with the largest magnitude, the way the list already read
// before it had a sort control at all; name leads A→Z.
export const DEFAULT_SORT_DIRECTION: Record<DebtorSortKey, DebtorSortDirection> = {
 balance: 'desc',
 name: 'asc',
};

export type DebtorQuickFilter = 'all' | 'debtor' | 'lender';

type DebtorListFilterInput = {
 rows: DebtorListType[];
 search: string;
 sort: DebtorSortKey;
 direction: DebtorSortDirection;
 quickFilter: DebtorQuickFilter;
};

type DebtorListFilterResult = {
 rows: DebtorListType[];
 matched: number;
 total: number;
 isFiltered: boolean;
};

// Accent- and case-insensitive, the same fold budget's and pocket's search use.
const fold = (value: string) =>
 value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .trim();

// Same test the row runs to choose its own word (ListOfDebtors.tsx), read here
// rather than duplicated as a third boolean so the two cannot drift. Reads
// total_debt_balance's own sign, not a sum of debt_payable and
// debt_receivable: both of those are positive magnitudes on the contract, and
// adding them only reads as a net because exactly one of the two is zero on
// any given row — a coincidence of the payload, not a rule of the domain.
const transactionTypeOf = (row: DebtorListType): 'debtor' | 'lender' =>
 row.total_debt_balance < 0 ? 'lender' : 'debtor';

export function useDebtorListFilter({
 rows,
 search,
 sort,
 direction,
 quickFilter,
}: DebtorListFilterInput): DebtorListFilterResult {
 return useMemo(() => {
  const term = fold(search);

  const filtered = rows.filter((row) => {
   if (quickFilter !== 'all' && transactionTypeOf(row) !== quickFilter) {
    return false;
   }
   if (!term) return true;

   return fold(row.account_name).includes(term);
  });

  // Sorted on a copy: the array passed in may be the fetch hook's own state,
  // and Array.prototype.sort mutates in place.
  const sorted = [...filtered].sort((a, b) => {
   const flip = direction === 'desc' ? -1 : 1;

   const result =
    sort === 'name'
     ? a.account_name.localeCompare(b.account_name) * flip
     : (Math.abs(a.total_debt_balance) - Math.abs(b.total_debt_balance)) * flip;

   // The name breaks every tie, and always ascending: two debtors owing the
   // same amount would otherwise reorder between renders for no reason the
   // reader asked for.
   return result !== 0 ? result : a.account_name.localeCompare(b.account_name);
  });

  return {
   rows: sorted,
   matched: sorted.length,
   total: rows.length,
   isFiltered: term.length > 0 || quickFilter !== 'all',
  };
 }, [rows, search, sort, direction, quickFilter]);
}
