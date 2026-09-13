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
//
// TWO DEPTHS, TWO REQUESTS (OVERVIEW_DECISIONS.md, P5-3). The screen paints with
// 'derived', which costs no statement beyond level 1, and asks for 'full' when
// its analysis block comes into view. The full request is separate so its
// failure is the analysis block's state and not the whole screen's.

import { useCallback, useEffect, useRef, useState } from 'react';

import { getOverviewDomain } from '../../../api/overviewApi';
import {
 GetOverviewDomainData,
 OverviewAnalysis,
 OverviewAnalysisLevel,
 OverviewDomain,
} from '../../../types/overviewTypes';

// The first page, and the size of it. Twenty-five and not the teaser's five:
// this screen exists BECAUSE five was not enough, and the reader who opened it
// asked for the whole domain.
export const DEFAULT_DOMAIN_PAGE_SIZE = 25;

// The full request reads the analysis and discards the rows; the validator
// refuses a page of zero, so one row is the smallest page it builds.
const FULL_ANALYSIS_PAGE_SIZE = 1;

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

export type FullAnalysisStatus = 'idle' | 'loading' | 'error';

// An analysis is only valid for the domain and month it was read for, so it is
// held with that scope instead of being cleared by an effect that races the
// request for the new scope.
type HeldAnalysis = {
 scope: string;
 value: OverviewAnalysis;
};

const LEVEL_RANK: Record<OverviewAnalysisLevel, number> = {
 derived: 1,
 full: 2,
};

export const useOverviewDomain = (domain: OverviewDomain, month?: string) => {
 const [query, setQuery] = useState<DomainQueryState>(INITIAL_STATE);

 const [data, setData] = useState<GetOverviewDomainData | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const [held, setHeld] = useState<HeldAnalysis | null>(null);
 const [fullStatus, setFullStatus] = useState<FullAnalysisStatus>('idle');
 const [fullError, setFullError] = useState<string | null>(null);

 // The same analysis, readable inside a request callback without making every
 // held answer re-create the request and fire it again.
 const heldRef = useRef<HeldAnalysis | null>(null);

 // Which request is the current one, per request kind. An answer that arrives
 // after a newer request of its kind went out is discarded.
 const requestId = useRef(0);
 const fullRequestId = useRef(0);
 // The scope whose full request is on the wire, so a second trigger waits on it.
 const fullInFlight = useRef<string | null>(null);

 const scope = `${domain}|${month ?? 'current'}`;

 // THE PAGE RESETS WHEN THE SCOPE CHANGES, and the scope is the domain and the
 // month. Without this, stepping the month while on page 7 asks for page 7 of a
 // month that may have two, and the empty answer reads as "no movements".
 useEffect(() => {
  setQuery(INITIAL_STATE);
  setFullStatus('idle');
  setFullError(null);
  fullRequestId.current += 1;
  fullInFlight.current = null;
 }, [domain, month]);

 const { page, pageSize, category } = query;

 // Keeps the deeper of two answers for the same scope: a derived answer that
 // lands after the full one must not take its sections away.
 const hold = useCallback((forScope: string, value: OverviewAnalysis) => {
  const current = heldRef.current;

  if (
   current?.scope === forScope &&
   LEVEL_RANK[current.value.level] > LEVEL_RANK[value.level]
  ) {
   return;
  }

  const next = { scope: forScope, value };
  heldRef.current = next;
  setHeld(next);
 }, []);

 const load = useCallback(() => {
  const id = requestId.current + 1;
  requestId.current = id;

  setIsLoading(true);
  setError(null);

  // Page steps and narrowings ask for no analysis once one is held: the
  // analysis does not change with the page, and re-reading it is work the
  // server does for nobody.
  const hasAnalysis = heldRef.current?.scope === scope;

  getOverviewDomain(domain, {
   month,
   page,
   pageSize,
   ...(hasAnalysis ? {} : { analysis: 'derived' as const }),
   // Sent for every domain, and null for five of them because nothing can set
   // it there: the screen only offers the control where categories exist.
   ...(category ? { category } : {}),
  })
   .then((answer) => {
    if (requestId.current !== id) return;

    if (answer.analysis) hold(scope, answer.analysis);
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
 }, [domain, month, page, pageSize, category, scope, hold]);

 useEffect(() => {
  load();
 }, [load]);

 // Called by any full section when it reaches the viewport, and by every
 // section's retry. One request per scope serves them all (P5-6): a call while
 // one is in flight, or once the full answer is held, does nothing.
 const requestFullAnalysis = useCallback(() => {
  if (heldRef.current?.scope === scope && heldRef.current.value.level === 'full') {
   return;
  }

  if (fullInFlight.current === scope) return;

  const id = fullRequestId.current + 1;
  fullRequestId.current = id;
  fullInFlight.current = scope;

  setFullStatus('loading');
  setFullError(null);

  getOverviewDomain(domain, {
   month,
   page: 1,
   pageSize: FULL_ANALYSIS_PAGE_SIZE,
   analysis: 'full',
  })
   .then((answer) => {
    if (fullRequestId.current !== id) return;

    fullInFlight.current = null;
    if (answer.analysis) hold(scope, answer.analysis);
    setFullStatus('idle');
   })
   .catch((cause: unknown) => {
    if (fullRequestId.current !== id) return;

    setFullError(
     cause instanceof Error
      ? cause.message
      : 'The domain analysis could not be read.',
    );
    fullInFlight.current = null;
    setFullStatus('error');
   });
 }, [domain, month, scope, hold]);

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
  // Null until an answer for THIS domain and month carries one.
  analysis: held?.scope === scope ? held.value : null,
  isLoading,
  error,
  fullStatus,
  fullError,
  goToPage,
  setPageSize,
  narrowToCategory,
  refetch: load,
  requestFullAnalysis,
 };
};
