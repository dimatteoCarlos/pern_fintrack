// 📄 frontend/src/fintrack/editionAndDeletion/hooks/useClosedAccounts.ts

import { useCallback, useMemo, useState } from 'react';

import { useFetch } from '../../hooks/useFetch.ts';
import { url_closed_accounts } from '../../../urlConfig.ts';

import {
 ClosedAccountOrderType,
 ClosedAccountQueryType,
 ClosedAccountSortKeyType,
 ClosedAccountsResponseType,
} from '../types/closedAccountsTypes.ts';

//==================================
// 🎣 CUSTOM HOOK: THE CLOSED-ACCOUNT REGISTRY
// useClosedAccounts (useClosedAccounts.ts)
//
// THE WHOLE TOOLBAR IS ONE PIECE OF STATE, and the URL is derived from it.
// Search, type, sort, order and page are not five independent values that each
// trigger a fetch: they are one query, and `useFetch` re-runs on the url it is
// handed, so composing the url from that one object is what makes every control
// on the screen a one-line setter with no effect of its own to write.
//
// THREE OF THE FIVE RESET THE PAGE AND TWO DO NOT. Changing the search, the
// type filter or the sort changes WHICH rows match, so page 4 of the old result
// is meaningless against the new one and the owner lands on an empty screen
// holding rows that exist. Changing the page obviously does not reset it, and
// neither does the page size, which is handled with the same care in
// `setLimit`: the row the owner was looking at is kept in view by returning to
// page 1 rather than by arithmetic, because the arithmetic is only right when
// the sort is stable and the caller cannot know that it is.
// =================================

const DEFAULT_QUERY: ClosedAccountQueryType = {
 search: '',
 type: '',
 sort: 'closed_at',
 order: 'desc',
 page: 1,
 limit: 20,
};

export const useClosedAccounts = () => {
 const [query, setQuery] = useState<ClosedAccountQueryType>(DEFAULT_QUERY);

 // Only the parameters that differ from the server's own defaults are sent. A
 // url carrying every default is a different string on every render of the same
 // request, and `useFetch` keys its effect on the url.
 const requestUrl = useMemo(() => {
  const params = new URLSearchParams();

  if (query.search.trim()) params.set('search', query.search.trim());
  if (query.type) params.set('type', query.type);
  if (query.sort !== DEFAULT_QUERY.sort) params.set('sort', query.sort);
  if (query.order !== DEFAULT_QUERY.order) params.set('order', query.order);
  if (query.page !== 1) params.set('page', String(query.page));
  if (query.limit !== DEFAULT_QUERY.limit) {
   params.set('limit', String(query.limit));
  }

  return url_closed_accounts(params.toString());
 }, [query]);

 const {
  apiData,
  isLoading,
  error,
  refetch,
 } = useFetch<ClosedAccountsResponseType>(requestUrl);

 const data = apiData?.data ?? null;

 // ---------------------------------
 // 🎛 TOOLBAR SETTERS
 // ---------------------------------
 const setSearch = useCallback((search: string) => {
  setQuery((previous) => ({ ...previous, search, page: 1 }));
 }, []);

 const setType = useCallback((type: string) => {
  setQuery((previous) => ({ ...previous, type, page: 1 }));
 }, []);

 // Choosing the column already sorted flips the direction, which is what a
 // column header does everywhere else. Choosing a different column starts it
 // descending: every sortable column here is a date or a name, and the useful
 // first answer is the most recent or the last alphabetically, not the first.
 const setSort = useCallback((sort: ClosedAccountSortKeyType) => {
  setQuery((previous) => ({
   ...previous,
   sort,
   order:
    previous.sort === sort && previous.order === 'desc' ? 'asc' : 'desc',
   page: 1,
  }));
 }, []);

 const setOrder = useCallback((order: ClosedAccountOrderType) => {
  setQuery((previous) => ({ ...previous, order, page: 1 }));
 }, []);

 // Clamped against the page count the LAST response reported, not against a
 // figure computed here: the registry can grow between two requests, and a page
 // number the screen invented would ask for rows the server never promised.
 const setPage = useCallback(
  (page: number) => {
   setQuery((previous) => ({
    ...previous,
    page: Math.max(1, page),
   }));
  },
  [],
 );

 const setLimit = useCallback((limit: number) => {
  setQuery((previous) => ({ ...previous, limit, page: 1 }));
 }, []);

 const resetFilters = useCallback(() => {
  setQuery(DEFAULT_QUERY);
 }, []);

 // TRUE ONLY WHEN A FILTER IS THE REASON THE LIST IS EMPTY, which is a
 // different screen from an owner who has closed nothing: one offers a way back,
 // the other explains what the page is for.
 const isFiltered = Boolean(query.search.trim() || query.type);

 return {
  // the request
  query,
  isFiltered,
  // the answer
  accountList: data?.accountList ?? [],
  total: data?.total ?? 0,
  pageCount: data?.pageCount ?? 0,
  isLoading,
  error,
  refetch,
  // the controls
  setSearch,
  setType,
  setSort,
  setOrder,
  setPage,
  setLimit,
  resetFilters,
 };
};

export type UseClosedAccountsReturnType = ReturnType<typeof useClosedAccounts>;
