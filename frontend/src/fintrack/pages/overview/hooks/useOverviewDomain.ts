// frontend/src/fintrack/pages/overview/hooks/useOverviewDomain.ts
//
// The level-2 request: one domain, one month, one page of its movements.
//
// A hook and not a store, the same reasoning useOverviewActivity.ts states. The
// page payload is in a store because leaving the overview layout and coming back
// would refetch it; this answer belongs to one screen, and a reader who walks
// into a transaction and returns should land on a clean first page rather than
// on page seven of a list they no longer remember narrowing.
//
// THE MONTH IS NOT THIS HOOK'S. OverviewLayout.tsx:47-54 owns it, in the URL,
// because the account and level-3 destinations are routes declared beside that
// layout and a month held in state would die the moment one of them is opened.
// The caller passes what the URL says, and passes undefined when it says
// nothing - which is not the same as computing the current month here, since the
// server resolves it on the owner's calendar.

import { useCallback, useEffect, useRef, useState } from 'react';

import { getOverviewDomain } from '../../../api/overviewApi';
import {
 GetOverviewDomainData,
 OverviewAnalysisLevel,
 OverviewDomain,
} from '../../../types/overviewTypes';

// The first page, and the size of it. Twenty-five and not the teaser's five:
// this screen exists BECAUSE five was not enough, and the reader who opened it
// asked for the whole domain.
export const DEFAULT_DOMAIN_PAGE_SIZE = 25;

type DomainQueryState = {
 page: number;
 pageSize: number;
 // The category the list is narrowed to, or null for the whole domain. null and
 // not '': the request drops an empty value, and the two would read the same on
 // the wire while meaning different things here.
 category: string | null;
};

const INITIAL_STATE: DomainQueryState = {
 page: 1,
 pageSize: DEFAULT_DOMAIN_PAGE_SIZE,
 category: null,
};

export const useOverviewDomain = (
 domain: OverviewDomain,
 month?: string,
 // Absent is the default level-1 answer with no analysis section at all.
 // 'derived' and 'full' are the two depths the endpoint offers, and the caller
 // asks for one only when it is going to draw it.
 analysis?: OverviewAnalysisLevel,
) => {
 const [query, setQuery] = useState<DomainQueryState>(INITIAL_STATE);

 const [data, setData] = useState<GetOverviewDomainData | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 // Which request is the current one. An answer that arrives after a newer
 // request went out is discarded: stepping two pages quickly fires two, and the
 // network is free to return them out of order.
 const requestId = useRef(0);

 // THE PAGE RESETS WHEN THE SCOPE CHANGES, and the scope is the domain and the
 // month. Without this, stepping the month while on page 7 asks for page 7 of a
 // month that may have two, and the empty answer reads as "no movements".
 useEffect(() => {
  setQuery(INITIAL_STATE);
 }, [domain, month]);

 const { page, pageSize, category } = query;

 const load = useCallback(() => {
  const id = requestId.current + 1;
  requestId.current = id;

  setIsLoading(true);
  setError(null);

  getOverviewDomain(domain, {
   month,
   page,
   pageSize,
   analysis,
   // Sent for every domain, and null for five of them because nothing can set
   // it there: the screen only offers the control where categories exist.
   ...(category ? { category } : {}),
  })
   .then((answer) => {
    if (requestId.current !== id) return;

    setData(answer);
   })
   .catch((cause: unknown) => {
    if (requestId.current !== id) return;

    setError(
     cause instanceof Error
      ? cause.message
      : 'The domain detail could not be read.',
    );
   })
   .finally(() => {
    if (requestId.current !== id) return;

    setIsLoading(false);
   });
 }, [domain, month, page, pageSize, analysis, category]);

 useEffect(() => {
  load();
 }, [load]);

 const goToPage = useCallback(
  (next: number) => setQuery((current) => ({ ...current, page: next })),
  [],
 );

 // Changing the size resets the page, for the same reason narrow() does in the
 // activity hook: page 7 of a list at five rows is past the end of the same list
 // at fifty.
 const setPageSize = useCallback(
  (next: number) =>
   setQuery((current) => ({ ...current, page: 1, pageSize: next })),
  [],
 );

 // NARROWING RESETS THE PAGE for the same reason a size change does, and it
 // matters more here: one category is a small fraction of a month, so page 7 of
 // the domain is past the end of nearly every category in it and the empty
 // answer would read as "this category has no movements".
 const narrowToCategory = useCallback(
  (next: string | null) =>
   setQuery((current) => ({ ...current, page: 1, category: next })),
  [],
 );

 return {
  query,
  data,
  isLoading,
  error,
  goToPage,
  setPageSize,
  narrowToCategory,
  refetch: load,
 };
};
