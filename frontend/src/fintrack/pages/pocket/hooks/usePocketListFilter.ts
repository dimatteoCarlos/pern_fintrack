// frontend/src/fintrack/pages/pocket/hooks/usePocketListFilter.ts
// 🔎 POCKET LIST FILTER: shortening the board without moving a figure
//
// One request already carries every pocket, so filtering and sorting happen
// here, in memory, over rows the store is holding. No request is issued and
// none is saved by not issuing it — the payload was going to arrive anyway.
// Same shape as useBudgetListFilter, and the reason is identical: the header
// above this list keeps the server's own counts, and this hook never changes
// them — it only changes which of the rows already counted are listed.
//
// The five filters are the same partition the hero's own tallies read
// (PocketBigBoxResult.tsx: funded, overFunded, onPlan, atRisk, offPlan) and
// the word each one carries on screen is POCKET_STATUS_WORD — the shared map
// ListPocket's own cards read. Nothing here invents a sixth word: an earlier
// draft filtered on a private "Active" bucket that folded onPlan and atRisk
// together, and pocketStatus.ts's own header already records why that word
// was retired once — it appeared on a filter and nowhere else on the screen
// it was filtering.

import { useMemo } from 'react';
import { PocketStatus } from '../../../types/pocketTypes';
import { PocketStatusLevel, pocketDateLevel } from '../../../helpers/pocketStatus';

export type PocketSortKey = 'date' | 'name' | 'remaining';
export type PocketSortDirection = 'asc' | 'desc';

// Where each key starts before the reader touches the direction toggle. Date
// and name both lead with the earliest/first entry; remaining leads with the
// pocket furthest from its target, which is the one row most likely to need
// acting on.
export const DEFAULT_SORT_DIRECTION: Record<PocketSortKey, PocketSortDirection> = {
 date: 'asc',
 name: 'asc',
 remaining: 'desc',
};

// 'uncovered' is orthogonal to the five date-partition levels — a pocket can
// be funded and still uncovered — so it is not a sixth PocketStatusLevel, it
// is its own filter value beside them.
export type PocketQuickFilter = PocketStatusLevel | 'all' | 'uncovered';

type PocketListFilterInput = {
 rows: PocketStatus[];
 search: string;
 sort: PocketSortKey;
 direction: PocketSortDirection;
 quickFilter: PocketQuickFilter;
};

type PocketListFilterResult = {
 rows: PocketStatus[];
 matched: number;
 total: number;
 isFiltered: boolean;
};

// Accent- and case-insensitive, the same fold budget's search uses: a reader
// typing "presupuesto" has to find "Presupuesto" and one typing "viajes" has
// to find "Viajés".
const fold = (value: string) =>
 value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .trim();

const passesQuickFilter = (
 pocket: PocketStatus,
 quickFilter: PocketQuickFilter,
): boolean => {
 if (quickFilter === 'all') return true;
 if (quickFilter === 'uncovered') return pocket.uncovered;

 return pocketDateLevel(pocket) === quickFilter;
};

export function usePocketListFilter({
 rows,
 search,
 sort,
 direction,
 quickFilter,
}: PocketListFilterInput): PocketListFilterResult {
 return useMemo(() => {
  const term = fold(search);

  const filtered = rows.filter((pocket) => {
   if (!passesQuickFilter(pocket, quickFilter)) return false;
   if (!term) return true;

   return fold(pocket.name).includes(term);
  });

  // Sorted on a copy: `rows` is the store's own array, shared with the hero
  // that tallies it, and Array.prototype.sort mutates in place.
  const sorted = [...filtered].sort((a, b) => {
   const flip = direction === 'desc' ? -1 : 1;

   let result: number;

   switch (sort) {
    case 'name':
     result = a.name.localeCompare(b.name) * flip;
     break;
    case 'remaining':
     result = (a.remaining - b.remaining) * flip;
     break;
    case 'date':
    default:
     // daysRemaining, not desiredDate: the two board rows farthest apart in
     // calendar time are also the two farthest apart in days left, and the
     // figure is already a number — no second date parse to keep in step
     // with formatCalendarDate's own reading of the same field.
     result = (a.daysRemaining - b.daysRemaining) * flip;
   }

   // The name breaks every tie, and always ascending: a tiebreaker that
   // turned with the direction would reorder rows sharing a figure for no
   // reason the reader asked for.
   return result !== 0 ? result : a.name.localeCompare(b.name);
  });

  return {
   rows: sorted,
   matched: sorted.length,
   total: rows.length,
   isFiltered: term.length > 0 || quickFilter !== 'all',
  };
 }, [rows, search, sort, direction, quickFilter]);
}
