// frontend/src/fintrack/api/overviewApi.ts
// The only way into /overview from the frontend.
//
// It sits beside budgetApi.ts and follows it in every respect but one: the
// overview handlers wrap their result as { status, message, data }, so the
// envelope is unwrapped here. Doing it in the store instead would put the same
// `.data.data` in every future caller, and the first one to forget it reads
// undefined without an error.
//
// Errors propagate untouched, for the same reason budgetApi.ts gives: the 422
// the month resolver raises carries a message naming the ceiling, and flattening
// it to a generic string here would throw away the one thing the reader needs.

import { authFetch } from '../../auth/auth_utils/authFetch.ts';
import {
 url_get_overview,
 url_get_overview_activity,
 url_get_overview_domain,
} from '../../urlConfig.ts';
import {
 GetOverviewActivityData,
 GetOverviewActivityResponse,
 GetOverviewData,
 GetOverviewDomainData,
 GetOverviewDomainResponse,
 GetOverviewResponse,
 OverviewActivityQuery,
 OverviewAnalysisLevel,
 OverviewDomain,
} from '../types/overviewTypes.ts';

// What the level-2 endpoint narrows by. The domain is not here: it is the path
// segment that selects the calculator, so it is a separate argument.
export type OverviewDomainQuery = {
 month?: string;
 page?: number;
 pageSize?: number;
 analysis?: OverviewAnalysisLevel;
};

// month is optional and past-only. Omitting it is not the same as computing the
// current month here: the server resolves it from the account owner's timezone,
// which is the calendar every figure in the payload is cut against. Only a month
// the user navigated to is ever sent.
//
// Sent as a query parameter and not in a body: this is a GET, and the route
// declares no body.
export const getOverviewPage = async (
 month?: string,
): Promise<GetOverviewData> => {
 const { data } = await authFetch<GetOverviewResponse>(url_get_overview, {
  method: 'GET',
  ...(month ? { params: { month } } : {}),
 });

 return data.data;
};

// One domain, one month, one page of its movements, and optionally the analysis
// section for that domain.
//
// ANALYSIS IS OMITTED AND NOT SENT EMPTY, the same rule the activity request
// follows: an absent section is absent rather than null, and the level-1 shape
// of this answer is the one with no analysis key at all. A caller asks for a
// depth only when it is going to draw it.
export const getOverviewDomain = async (
 domain: OverviewDomain,
 query: OverviewDomainQuery = {},
): Promise<GetOverviewDomainData> => {
 const params: Record<string, string> = {};

 if (query.month) params.month = query.month;
 if (query.page) params.page = String(query.page);
 if (query.pageSize) params.pageSize = String(query.pageSize);
 if (query.analysis) params.analysis = query.analysis;

 const { data } = await authFetch<GetOverviewDomainResponse>(
  url_get_overview_domain(domain),
  { method: 'GET', params },
 );

 return data.data;
};

// One page of the activity list, for the reader's own period and narrowings.
//
// Absent keys are dropped rather than sent empty, and that is the contract and
// not a nicety: the schema is strict and takes no '' for search, so sending the
// key with an empty value answers 400. Omitting it is how "no search" is said.
export const getOverviewActivity = async (
 query: OverviewActivityQuery = {},
): Promise<GetOverviewActivityData> => {
 const params: Record<string, string> = {};

 if (query.from) params.from = query.from;
 if (query.to) params.to = query.to;
 if (query.search) params.search = query.search;
 if (query.movementType) params.movementType = query.movementType;
 if (query.page) params.page = String(query.page);
 if (query.pageSize) params.pageSize = String(query.pageSize);

 const { data } = await authFetch<GetOverviewActivityResponse>(
  url_get_overview_activity,
  { method: 'GET', params },
 );

 return data.data;
};
