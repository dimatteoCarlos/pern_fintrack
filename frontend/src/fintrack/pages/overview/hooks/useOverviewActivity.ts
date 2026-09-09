// frontend/src/fintrack/pages/overview/hooks/useOverviewActivity.ts
//
// The activity list's own query, and the request it produces.
//
// A hook and not a store, unlike the page payload beside it. useOverviewStore
// exists because walking into an account detail unmounts the overview layout and
// the payload would be refetched on the way back; this state is a reader's
// transient choice - a term they typed, a page they stepped to - and coming back
// to a clean list is the right behaviour rather than a defect to work around.
//
// NOTHING IS FILTERED HERE. Every narrowing is a parameter on the request, so
// the page count and the row count answer for the whole set and not for the
// rows that happen to be in hand. A client-side filter over one page would
// report "3 of 5" while the account holds two thousand movements.

import { useCallback, useEffect, useRef, useState } from 'react';

import { getOverviewActivity } from '../../../api/overviewApi';
import {
 GetOverviewActivityData,
 OverviewActivityMovementType,
} from '../../../types/overviewTypes';

// The default page, and it is Carlos's: five, the size of the teaser the page
// already publishes, so a reader who touches nothing sees what they saw before.
export const DEFAULT_ACTIVITY_PAGE_SIZE = 5;

// How long the reader has to stop typing before the term travels. Short enough
// that the list feels live, long enough that a nine-letter word is one request
// and not nine.
const SEARCH_DEBOUNCE_MS = 350;

// What the endpoint takes, in the shape the controls bind to. '' and 'all' are
// the two "no narrowing" values because a select and a text input cannot hold
// undefined; they are translated at the edge, in the request builder below.
export type ActivityQueryState = {
 search: string;
 movementType: OverviewActivityMovementType | 'all';
 // 'YYYY-MM' both, or null for an unbounded end. Unbounded is the default: the
 // section answers what happened last, not what happened in the month on screen.
 from: string | null;
 to: string | null;
 page: number;
 pageSize: number;
};

const INITIAL_STATE: ActivityQueryState = {
 search: '',
 movementType: 'all',
 from: null,
 to: null,
 page: 1,
 pageSize: DEFAULT_ACTIVITY_PAGE_SIZE,
};

export const useOverviewActivity = () => {
 const [query, setQuery] = useState<ActivityQueryState>(INITIAL_STATE);
 // The term the REQUEST uses, which trails the one the input shows by the
 // debounce above. Two values and not one, so the field never lags the keyboard.
 const [debouncedSearch, setDebouncedSearch] = useState('');

 const [data, setData] = useState<GetOverviewActivityData | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 // Which request is the current one. An answer that comes back after a newer
 // request was sent is discarded: typing "netflix" fires several, and the
 // network is free to return them out of order - without this, a stale answer
 // for "netfl" can land last and paint a list the reader has moved past.
 const requestId = useRef(0);

 useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(query.search.trim()), SEARCH_DEBOUNCE_MS);

  return () => clearTimeout(timer);
 }, [query.search]);

 const { movementType, from, to, page, pageSize } = query;

 // The request itself, named so the error state can ask for it again. A
 // callback and not a counter in the dependency list: the effect below keys on
 // this identity, which changes exactly when the query does, and retrying is
 // then the same call the effect makes rather than a second path to it.
 const load = useCallback(() => {
  const id = requestId.current + 1;
  requestId.current = id;

  setIsLoading(true);
  setError(null);

  getOverviewActivity({
   // Omitted and not sent empty: the schema is strict and takes no '' for
   // search, so the way to say "no search" is for the key not to be there.
   ...(debouncedSearch ? { search: debouncedSearch } : {}),
   ...(movementType === 'all' ? {} : { movementType }),
   ...(from ? { from } : {}),
   ...(to ? { to } : {}),
   page,
   pageSize,
  })
   .then((answer) => {
    if (requestId.current !== id) return;

    setData(answer);
   })
   .catch((cause: unknown) => {
    if (requestId.current !== id) return;

    setError(
     cause instanceof Error ? cause.message : 'The activity list could not be read.',
    );
   })
   .finally(() => {
    if (requestId.current !== id) return;

    setIsLoading(false);
   });
 }, [debouncedSearch, movementType, from, to, page, pageSize]);

 useEffect(() => {
  load();
 }, [load]);

 // Every narrowing resets the page, and none of the page controls do. Kept in
 // one place because forgetting it on one control is how a reader lands on page
 // 7 of a list that now has 2 and reads the empty answer as "no matches".
 const narrow = useCallback(
  (change: Partial<Omit<ActivityQueryState, 'page'>>) =>
   setQuery((current) => ({ ...current, ...change, page: 1 })),
  [],
 );

 const goToPage = useCallback(
  (next: number) => setQuery((current) => ({ ...current, page: next })),
  [],
 );

 const reset = useCallback(() => setQuery(INITIAL_STATE), []);

 return { query, data, isLoading, error, narrow, goToPage, reset, refetch: load };
};
