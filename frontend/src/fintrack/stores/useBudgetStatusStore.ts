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
 accounts: BudgetAccountStatus[];
 categories: BudgetCategoryStatus[];
 totals: BudgetStatusTotals | null;
 notices: string[];
 // What is in memory, keyed the way it was asked for. 'current' is the omitted
 // month, which is a different key from the current month spelled out.
 loadedMonth: string | null;
 isLoading: boolean;
 error: string | null;
 fetchStatus: (month?: string) => Promise<void>;
 invalidate: () => void;
};

const monthKey = (month?: string) => month ?? 'current';

// ======================================
// 🎯 STORE IMPLEMENTATION
// ======================================
export const useBudgetStatusStore = create<BudgetStatusState>((set, get) => ({
 // Initial state
 referenceMonth: null,
 accounts: [],
 categories: [],
 totals: null,
 notices: [],
 loadedMonth: null,
 isLoading: false,
 error: null,

 // ======================================
 // 🔄 FETCH STATUS FROM BACKEND
 // ======================================
 // month is omitted until the user picks one: the current month resolved by a
 // browser clock lands on the wrong calendar for part of every day.
 fetchStatus: async (month) => {
  const key = monthKey(month);

  // Already answered, or already on the wire. This is what makes the store a
  // carrier rather than a fetch on every mount: walking into a category and
  // back must not ask again.
  if (get().isLoading || get().loadedMonth === key) return;

  set({ isLoading: true, error: null });

  try {
   // No accountIds: the omission is what asks for every budget account owned.
   const data = await getBudgetAccountsStatus(undefined, month);

   set({
    referenceMonth: data.referenceMonth,
    accounts: data.accounts,
    categories: data.categories,
    totals: data.totals,
    notices: data.meta.notices,
    loadedMonth: key,
    isLoading: false,
    error: null,
   });
  } catch (err: unknown) {
   // loadedMonth is left untouched, so a remount retries instead of serving a
   // half-written state as if it were the month's answer.
   const errorMessage =
    err instanceof Error ? err.message : 'Failed to fetch budget status';
   console.error('📊 Error fetching budget status:', errorMessage);
   set({ error: errorMessage, isLoading: false });
  }
 },

 // Drops the memo without clearing what is on screen, so the next fetchStatus
 // asks again. The budget editor calls it after a write.
 invalidate: () => set({ loadedMonth: null }),
}));
