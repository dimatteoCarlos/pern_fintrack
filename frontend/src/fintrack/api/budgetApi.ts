// frontend/src/fintrack/api/budgetApi.ts
// The only way into /budget from the frontend. Every screen that reads or writes
// a budget calls one of these three functions, so the URLs, the request shapes
// and the response types are stated once instead of once per component.
//
// It sits outside pages/ on purpose: the account editor and the budget page are
// in different trees, and a client living inside either one would make the other
// import from a page that is not its own.
//
// Errors are propagated untouched. The §7.5 envelope carries status, message and
// errors[] with a field and a code per issue, and a component that shows the
// offending field needs all three — normalizeError flattens them to a string,
// which is the right call at the point of display, not here.

import { authFetch } from '../../auth/auth_utils/authFetch.ts';
import {
 url_budget_account_current,
 url_budget_account_series,
 url_budget_accounts_status,
} from '../../urlConfig.ts';
import {
 BudgetAccountsStatusResponse,
 BudgetSeriesResponse,
 BudgetWriteResponse,
} from '../types/budgetTypes.ts';

// The month is not a parameter: the server resolves it from the account owner's
// timezone, so every caller gets the same month the write path uses.
export const getBudgetAccountsStatus = async (
 accountIds: number[],
): Promise<BudgetAccountsStatusResponse> => {
 const { data } = await authFetch<BudgetAccountsStatusResponse>(
  url_budget_accounts_status,
  { method: 'POST', data: { accountIds } },
 );

 return data;
};

// onlyThisMonth is the one-month exception, and it defaults to false because a
// budget is recurring by definition: it stays in force until a later month
// replaces it.
export const setCurrentBudget = async (
 accountId: number,
 amount: number,
 onlyThisMonth = false,
): Promise<BudgetWriteResponse> => {
 const { data } = await authFetch<BudgetWriteResponse>(
  url_budget_account_current(accountId),
  { method: 'PUT', data: { amount, onlyThisMonth } },
 );

 return data;
};

// Both bounds are optional and are omitted from the query when absent: the
// server defaults to the last twelve months, and a client-side default would be
// a second calendar to keep in agreement with that one.
export const getBudgetAccountSeries = async (
 accountId: number,
 range: { from?: string; to?: string } = {},
): Promise<BudgetSeriesResponse> => {
 const { data } = await authFetch<BudgetSeriesResponse>(
  url_budget_account_series(accountId),
  {
   method: 'GET',
   params: {
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
   },
  },
 );

 return data;
};
