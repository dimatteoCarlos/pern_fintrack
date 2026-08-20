// frontend/src/fintrack/stores/useBudgetStatusStore.ts
// 📊 BUDGET STATUS STORE: the module's monthly payload, fetched once
//
// POST /budget/accounts/status answers with every budget account of the user,
// the same rows folded by category, and the totals over both. The three budget
// levels read different slices of that one answer, so it is fetched once and
// held here.
//
// It is a store and not a route context because the levels do not share a route
// branch: budget/category/:categoryName is declared beside <Layout />, not
// inside it (App.tsx:345), so entering a category unmounts the budget layout
// and any state hanging from its Outlet. A store survives that.

import { create } from 'zustand';
import { getBudgetAccountsStatus } from '../api/budgetApi.ts';
import { onAccountChanged, onTransactionRecorded } from './transactionEvents.ts';
import {
 BudgetAccountStatus,
 BudgetCategoryStatus,
 BudgetStatusTotals,
} from '../types/budgetTypes.ts';

// ======================================
// 📦 TYPES
// ======================================
type BudgetStatusState = {
 // The month every figure below is about, as the server resolved it from the
 // owner's timezone. null until the first answer lands: it is read, not assumed.
 referenceMonth: string | null;
 // The latest month that may be asked for, on that same calendar. It is the
 // month selector's upper bound, and it is not referenceMonth: looking at May
 // does not make May the latest month there is.
 currentMonth: string | null;
 accounts: BudgetAccountStatus[];
 categories: BudgetCategoryStatus[];
 totals: BudgetStatusTotals | null;
 notices: string[];
 // What is in memory, keyed the way it was asked for. 'current' is the omitted
 // month, which is a different key from the current month spelled out.
 loadedMonth: string | null;
 // What is on the wire, same key. It is what lets a month picked during another
 // month's request win: the older answer is discarded on arrival instead of the
 // newer request being refused at the door.
 requestedMonth: string | null;
 isLoading: boolean;
 error: string | null;
 fetchStatus: (month?: string) => Promise<void>;
 // Asks again for the month already on screen, guard and all. A write knows its
 // own answer is obsolete, and laundering that through invalidate() + a call
 // fetchStatus is free to refuse made correctness depend on the caller getting
 // two statements in the right order.
 refreshStatus: () => Promise<void>;
 invalidate: () => void;
};

const monthKey = (month?: string) => month ?? 'current';

// ======================================
// 🎯 STORE IMPLEMENTATION
// ======================================
export const useBudgetStatusStore = create<BudgetStatusState>((set, get) => ({
 // Initial state
 referenceMonth: null,
 currentMonth: null,
 accounts: [],
 categories: [],
 totals: null,
 notices: [],
 loadedMonth: null,
 requestedMonth: null,
 isLoading: false,
 error: null,

 // ======================================
 // 🔄 FETCH STATUS FROM BACKEND
 // ======================================
 // month is omitted until the user picks one: the current month resolved by a
 // browser clock lands on the wrong calendar for part of every day.
 fetchStatus: async (month) => {
  const key = monthKey(month);

  // Already answered, or already on the wire FOR THIS MONTH. This is what makes
  // the store a carrier rather than a fetch on every mount: walking into a
  // category and back must not ask again.
  //
  // The guard used to refuse any call while one was in flight, which dropped a
  // month picked during another month's request and left the badge on a month
  // the user had already moved off.
  if (get().loadedMonth === key || get().requestedMonth === key) return;

  set({ requestedMonth: key, isLoading: true, error: null });

  try {
   // No accountIds: the omission is what asks for every budget account owned.
   const data = await getBudgetAccountsStatus(undefined, month);

   // A month picked while this one was on the wire supersedes it. Writing here
   // would paint one month's figures under another month's badge.
   if (get().requestedMonth !== key) return;

   set({
    referenceMonth: data.referenceMonth,
    currentMonth: data.meta.currentMonth,
    accounts: data.accounts,
    categories: data.categories,
    totals: data.totals,
    notices: data.meta.notices,
    loadedMonth: key,
    isLoading: false,
    error: null,
   });
  } catch (err: unknown) {
   if (get().requestedMonth !== key) return;

   // loadedMonth is left untouched, so a remount retries instead of serving a
   // half-written state as if it were the month's answer. requestedMonth IS
   // cleared: otherwise the failed month could never be asked for again.
   const errorMessage =
    err instanceof Error ? err.message : 'Failed to fetch budget status';
   console.error('📊 Error fetching budget status:', errorMessage);
   set({ error: errorMessage, isLoading: false, requestedMonth: null });
  }
 },

 // Drops the memo without clearing what is on screen, so the next fetchStatus
 // asks again. Nulling requestedMonth also discards an answer already on the
 // wire: it was computed before the write that invalidated it.
 invalidate: () => set({ loadedMonth: null, requestedMonth: null }),

 // The month to ask for is the one already loaded, not one the caller passes:
 // a write changes the month on screen, and a caller that guessed a different
 // key would refresh a month nobody is looking at.
 //
 // 'current' is the omitted month, so it maps back to undefined — sending the
 // literal string would be a month the server cannot parse.
 refreshStatus: async () => {
  const key = get().loadedMonth ?? get().requestedMonth;

  set({ loadedMonth: null, requestedMonth: null });

  await get().fetchStatus(key === null || key === 'current' ? undefined : key);
 },
}));

// Spending is derived from transactions, so any write makes this month's answer
// obsolete. Dropping the memo costs no request: the refetch happens only if the
// user opens budget again.
onTransactionRecorded(() => {
 useBudgetStatusStore.getState().invalidate();
});

// An account edit changes what this payload reports about — the row's name, its
// category, its nature — none of which the amount path ever sees. The editor's
// budget block invalidates on its own after writing an amount; this covers every
// other field it can change, which is why both exist rather than one.
onAccountChanged(() => {
 useBudgetStatusStore.getState().invalidate();
});
