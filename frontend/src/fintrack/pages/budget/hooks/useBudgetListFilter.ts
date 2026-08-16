// frontend/src/fintrack/pages/budget/hooks/useBudgetListFilter.ts
// 🔎 BUDGET LIST FILTER: shortening a long list without moving a figure
//
// One request already carries the whole inventory, so filtering and sorting
// happen here, in memory, over rows the screen is holding. No request is issued
// and none is saved by not issuing it: the payload was going to arrive anyway.
//
// The rule this obeys, and the reason the hook returns counts as well as rows:
// filtering must NEVER change the totals. The header keeps the server's figures
// and the list states that it is showing a subset. There is no arrangement of
// these controls where the two can disagree.
//
// Generic over the row shape because level 1 lists categories and level 2 lists
// accounts, and the two share their figures but not their names. The caller
// supplies the two accessors that differ.

import { useMemo } from 'react';

// Sorted by what the reader is looking for, not by the field name. `execution`
// is the served percentage; `remaining` is what is left, so it ascends and puts
// the overspent rows first.
export type BudgetSortKey =
 | 'name'
 | 'subcategory'
 | 'spent'
 | 'remaining'
 | 'execution';

export type BudgetQuickFilter = 'all' | 'over';

// Every figure is nullable for one case: the server withholds the totals of a
// set holding more than one currency rather than adding them at an implicit
// 1:1. A withheld figure is not a zero and never sorts as one.
type BudgetFilterableRow = {
 actualSpent: number | null;
 remainingBudget: number | null;
 executionPercentage: number | null;
 isOverBudget: boolean | null;
};

type BudgetListFilterInput<Row extends BudgetFilterableRow> = {
 rows: Row[];
 search: string;
 sort: BudgetSortKey;
 quickFilter: BudgetQuickFilter;
 // What a search term is matched against. Level 1 gives the category name,
 // level 2 gives the account name and its subcategory.
 searchableText: (row: Row) => (string | null)[];
 // What a name sort orders by, and the tiebreaker of every other sort.
 sortName: (row: Row) => string;
};

type BudgetListFilterResult<Row> = {
 rows: Row[];
 // What the list is showing against what it holds. The caller says so on
 // screen; a filtered list that does not announce itself reads as a short one.
 matched: number;
 total: number;
 isFiltered: boolean;
};

// Accent- and case-insensitive: a user typing "aseo" must find "Aseo Hogar",
// and one typing "energia" must find "Energía". Both normalise to the same
// decomposed form and the combining marks are dropped.
const fold = (value: string) =>
 value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .trim();

// A withheld figure sorts last in every direction. Comparing it as 0 would put
// a category whose total could not be computed among the healthy ones.
const compareNullable = (
 a: number | null,
 b: number | null,
 direction: 'asc' | 'desc',
) => {
 if (a === null && b === null) return 0;
 if (a === null) return 1;
 if (b === null) return -1;
 return direction === 'asc' ? a - b : b - a;
};

const compareText = (a: string | null, b: string | null) => {
 if (!a && !b) return 0;
 if (!a) return 1;
 if (!b) return -1;
 return a.localeCompare(b);
};

export function useBudgetListFilter<Row extends BudgetFilterableRow>({
 rows,
 search,
 sort,
 quickFilter,
 searchableText,
 sortName,
}: BudgetListFilterInput<Row>): BudgetListFilterResult<Row> {
 return useMemo(() => {
  const term = fold(search);

  const filtered = rows.filter((row) => {
   if (quickFilter === 'over' && row.isOverBudget !== true) return false;
   if (!term) return true;

   return searchableText(row).some(
    (text) => text !== null && fold(text).includes(term),
   );
  });

  // Sorted on a copy: the store's array is shared with every other reader of
  // this slice, and Array.prototype.sort mutates in place.
  const sorted = [...filtered].sort((a, b) => {
   let result = 0;

   switch (sort) {
    case 'spent':
     result = compareNullable(a.actualSpent, b.actualSpent, 'desc');
     break;
    case 'remaining':
     result = compareNullable(a.remainingBudget, b.remainingBudget, 'asc');
     break;
    case 'execution':
     result = compareNullable(
      a.executionPercentage,
      b.executionPercentage,
      'desc',
     );
     break;
    case 'subcategory':
     result = compareText(searchableText(a)[1] ?? null, searchableText(b)[1] ?? null);
     break;
    case 'name':
    default:
     result = 0;
   }

   // The name breaks every tie, so two rows carrying the same figure keep the
   // same order between renders instead of swapping.
   return result !== 0 ? result : compareText(sortName(a), sortName(b));
  });

  return {
   rows: sorted,
   matched: sorted.length,
   total: rows.length,
   isFiltered: term.length > 0 || quickFilter !== 'all',
  };
 }, [rows, search, sort, quickFilter, searchableText, sortName]);
}
