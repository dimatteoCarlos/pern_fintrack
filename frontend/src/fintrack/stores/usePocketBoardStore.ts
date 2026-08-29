// frontend/src/fintrack/stores/usePocketBoardStore.ts
// 🐷 POCKET BOARD STORE: the module's payload, fetched once
//
// GET /pocket/board answers with every pocket of the user and the totals folded
// over them. The header and the list are two readings of that one answer, so it
// is fetched here rather than in either of them — which is what stops the big
// number on top from disagreeing with the rows underneath.
//
// A store and not a route context, for the reason the budget one is: the pocket
// detail is a route declared beside the layout, not inside it, so opening a
// pocket unmounts the layout and anything hanging from its Outlet. A store
// survives that and the walk back costs no request.

import { create } from 'zustand';
import { getPocketBoard } from '../api/pocketApi.ts';
import { onAccountChanged, onTransactionRecorded } from './transactionEvents.ts';
import { PocketBoardSummary, PocketStatus } from '../types/pocketTypes.ts';

// ======================================
// 📦 TYPES
// ======================================
type PocketBoardState = {
 // null until the first answer lands. It is read, never assumed: a summary of
 // zeroes on screen while the request is in flight is a board reporting that
 // the user has saved nothing.
 summary: PocketBoardSummary | null;
 pockets: PocketStatus[];
 notices: string[];
 // Whether an answer is in memory. Separate from summary !== null so a failed
 // request cannot be mistaken for a loaded empty board.
 isLoaded: boolean;
 // Whether one is on the wire. Guards against the double fetch two mounted
 // consumers would otherwise issue.
 isRequested: boolean;
 isLoading: boolean;
 error: string | null;
 fetchBoard: () => Promise<void>;
 // Asks again for what is already on screen, guard and all. A write knows its
 // own answer is obsolete, and routing that through invalidate() plus a call
 // fetchBoard is free to refuse would make correctness depend on the caller
 // getting two statements in the right order.
 refreshBoard: () => Promise<void>;
 invalidate: () => void;
};

// ======================================
// 🎯 STORE IMPLEMENTATION
// ======================================
export const usePocketBoardStore = create<PocketBoardState>((set, get) => ({
 summary: null,
 pockets: [],
 notices: [],
 isLoaded: false,
 isRequested: false,
 isLoading: false,
 error: null,

 fetchBoard: async () => {
  // Already answered, or already on the wire. This is what makes the store a
  // carrier rather than a fetch on every mount: opening a pocket and coming
  // back must not ask again.
  if (get().isLoaded || get().isRequested) return;

  set({ isRequested: true, isLoading: true, error: null });

  try {
   // The payload, not the envelope: the client unwraps the transport layer so
   // the store never reaches through a status and a message to find pockets.
   const board = await getPocketBoard();

   set({
    summary: board.summary,
    pockets: board.pockets,
    notices: board.meta.notices,
    isLoaded: true,
    isLoading: false,
    error: null,
   });
  } catch (err: unknown) {
   // isLoaded is left false, so a remount retries instead of serving a
   // half-written state as the board's answer. isRequested IS cleared:
   // otherwise the board could never be asked for again.
   const errorMessage =
    err instanceof Error ? err.message : 'Failed to fetch the pocket board';
   console.error('🐷 Error fetching the pocket board:', errorMessage);
   set({ error: errorMessage, isLoading: false, isRequested: false });
  }
 },

 // Drops the memo without clearing what is on screen, so the next fetchBoard
 // asks again. Clearing isRequested also discards an answer already on the
 // wire: it was computed before the write that invalidated it.
 invalidate: () => set({ isLoaded: false, isRequested: false }),

 refreshBoard: async () => {
  set({ isLoaded: false, isRequested: false });
  await get().fetchBoard();
 },
}));

// Every pocket figure is derived from a balance, and a balance moves on any
// transaction. Dropping the memo costs no request: the refetch happens only if
// the user opens the board again.
onTransactionRecorded(() => {
 usePocketBoardStore.getState().invalidate();
});

// An account edit changes what this payload reports about — the pocket's name,
// its note, its target, its deadline — none of which the transaction path ever
// sees. That is why both subscriptions exist rather than one.
onAccountChanged(() => {
 usePocketBoardStore.getState().invalidate();
});
