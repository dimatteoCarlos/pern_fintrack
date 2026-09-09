// frontend/src/fintrack/stores/useOverviewStore.ts
// 📈 OVERVIEW STORE: the page's monthly payload, fetched once per month
//
// GET /overview answers with every figure of the page for one month — the hero
// stocks, the six domain cards, and the window it resolved. One request feeds
// the whole screen, so it is held here instead of being asked for per component.
//
// It is a store and not state on the layout for the same reason the budget one
// is: the level-3 destinations are declared beside <Layout /> rather than inside
// the overview branch (App.tsx:342-354), so walking into an account detail
// unmounts the overview layout and anything hanging off its Outlet.
//
// The month-keying below is copied from useBudgetStatusStore deliberately, down
// to the 'current' key and the obsolete-answer guard. Those two exist because of
// defects that were found on the budget board: a month picked while another was
// on the wire used to be dropped, leaving the badge on a month the user had
// already left, and a request keyed by the spelled-out current month was treated
// as a different month from the omitted one and fetched twice.

import { create } from 'zustand';
import { getOverviewPage } from '../api/overviewApi.ts';
import { onAccountChanged, onTransactionRecorded } from './transactionEvents.ts';
import {
 MonthlySnapshot,
 OverviewActivityRow,
 OverviewCharts,
 OverviewDomainCards,
 OverviewFinancialGoals,
 OverviewHero,
 ServedWindow,
} from '../types/overviewTypes.ts';

// ======================================
// 📦 TYPES
// ======================================
type OverviewState = {
 // The period every figure below is about, as the server resolved it. null until
 // the first answer lands: the month is read, never assumed.
 window: ServedWindow | null;
 // Lifted out of window so the month control binds to two plain strings. They
 // are not the same month and neither substitutes for the other: referenceMonth
 // is what is on screen, currentMonth is the latest that may be asked for.
 referenceMonth: string | null;
 currentMonth: string | null;
 hero: OverviewHero | null;
 domainCards: OverviewDomainCards | null;
 // The saved amount, the target and the remainder, read at the close of the
 // served month like every position on the page.
 financialGoals: OverviewFinancialGoals | null;
 // The six-month series and the month's expense ranking, published verbatim by
 // the page service. No formula runs on the way here, so a chart and the figure
 // beside it cannot disagree.
 charts: OverviewCharts | null;
 // The monthly widget's three movements, held as the server sent them. Kept
 // whole rather than indexed by domain: the array IS the contract's shape, and
 // an index built here would be a second place to keep in step with it.
 monthlySnapshot: MonthlySnapshot[] | null;
 // The five most recent movements across every domain. Held unmapped, the way
 // the server sent them - the one consumer maps at the point of render, so a
 // shape written here would have to be kept in step with the level-2 detail
 // that reads the same rows.
 recentActivity: OverviewActivityRow[] | null;
 // What is in memory, keyed the way it was asked for. 'current' is the omitted
 // month, which is a different key from the current month spelled out.
 loadedMonth: string | null;
 // What is on the wire, same key. It is what lets a month picked during another
 // month's request win: the older answer is discarded on arrival instead of the
 // newer request being refused at the door.
 requestedMonth: string | null;
 isLoading: boolean;
 error: string | null;
 fetchOverview: (month?: string) => Promise<void>;
 // Asks again for the month already on screen, guard and all. A caller passing
 // its own month could refresh a month nobody is looking at.
 refreshOverview: () => Promise<void>;
 invalidate: () => void;
};

const monthKey = (month?: string) => month ?? 'current';

// ======================================
// 🎯 STORE IMPLEMENTATION
// ======================================
export const useOverviewStore = create<OverviewState>((set, get) => ({
 window: null,
 referenceMonth: null,
 currentMonth: null,
 hero: null,
 domainCards: null,
 financialGoals: null,
 charts: null,
 monthlySnapshot: null,
 recentActivity: null,
 loadedMonth: null,
 requestedMonth: null,
 isLoading: false,
 error: null,

 // ======================================
 // 🔄 FETCH THE PAGE
 // ======================================
 // month is omitted until the user picks one. The current month resolved from a
 // browser clock lands on the wrong calendar for part of every day, which is the
 // defect the served window exists to remove — computing it here would put it
 // back.
 fetchOverview: async (month) => {
  const key = monthKey(month);

  // Already answered, or already on the wire FOR THIS MONTH. This is what makes
  // the store a carrier rather than a fetch on every mount.
  if (get().loadedMonth === key || get().requestedMonth === key) return;

  set({ requestedMonth: key, isLoading: true, error: null });

  try {
   const data = await getOverviewPage(month);

   // A month picked while this one was on the wire supersedes it. Writing here
   // would paint one month's figures under another month's badge.
   if (get().requestedMonth !== key) return;

   set({
    window: data.window,
    referenceMonth: data.window.referenceMonth,
    currentMonth: data.window.currentMonth,
    hero: data.hero,
    domainCards: data.domainCards,
    financialGoals: data.financialGoals,
    charts: data.charts,
    monthlySnapshot: data.monthlySnapshot,
    recentActivity: data.recentActivity.transactions,
    loadedMonth: key,
    isLoading: false,
    error: null,
   });
  } catch (err: unknown) {
   if (get().requestedMonth !== key) return;

   // loadedMonth is left untouched, so a remount retries instead of serving a
   // half-written state as the month's answer. requestedMonth IS cleared:
   // otherwise the failed month could never be asked for again.
   //
   // The figures on screen are left in place as well. They belong to the month
   // that did load, and the message says which month failed — clearing them
   // would replace a readable page with a screen of dashes.
   const errorMessage =
    err instanceof Error ? err.message : 'Failed to fetch the overview';
   console.error('📈 Error fetching overview:', errorMessage);
   set({ error: errorMessage, isLoading: false, requestedMonth: null });
  }
 },

 // Drops the memo without clearing what is on screen, so the next fetchOverview
 // asks again. Nulling requestedMonth also discards an answer already on the
 // wire: it was computed before the write that invalidated it.
 invalidate: () => set({ loadedMonth: null, requestedMonth: null }),

 // 'current' is the omitted month, so it maps back to undefined — sending the
 // literal string would be a month the server cannot parse.
 refreshOverview: async () => {
  const key = get().loadedMonth ?? get().requestedMonth;

  set({ loadedMonth: null, requestedMonth: null });

  await get().fetchOverview(key === null || key === 'current' ? undefined : key);
 },
}));

// Every figure on the page is derived from transactions, so any write makes the
// month's answer obsolete. Dropping the memo costs no request: the refetch
// happens only if the user opens overview again.
onTransactionRecorded(() => {
 useOverviewStore.getState().invalidate();
});

// An account created, edited, closed or deleted changes the hero stocks and the
// account sets the cards are computed over, none of which the transaction path
// sees. Both subscriptions exist for that reason rather than one.
onAccountChanged(() => {
 useOverviewStore.getState().invalidate();
});
