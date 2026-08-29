// frontend/src/fintrack/stores/usePocketDetailStore.ts
// 🐷 POCKET DETAIL STORE: one pocket, one payload
//
// GET /pocket/:pocketId answers with the pocket, the accounts funding it and
// its allocation history in one body. The hero, the sources table and the
// history are three readings of that one answer, so it is fetched here rather
// than in each of them — which is what stops the headline figure from
// disagreeing with the rows that make it up.
//
// A store and not component state, because four writes are going to land on
// this screen and every one of them answers with exactly this payload. A write
// hands its own response here and the screen repaints without a second request.
//
// It holds ONE pocket at a time, and the id it holds travels with it. Two
// pockets are two screens the user reaches one after the other, never at once,
// so a map keyed by id would cache answers nobody is going to ask for again —
// and the stale one it would serve on the way back is precisely what the id
// field below refuses.

import { create } from 'zustand';
import { getPocketDetail } from '../api/pocketApi.ts';
import { onAccountChanged, onTransactionRecorded } from './transactionEvents.ts';
import {
 PocketAllocationEntry,
 PocketDetailPayload,
 PocketDetailPocket,
 PocketSource,
} from '../types/pocketTypes.ts';

// ======================================
// 📦 TYPES
// ======================================
type PocketDetailState = {
 // Which pocket is in memory. Read before serving: without it, opening pocket 2
 // from pocket 1 renders pocket 1's figures under pocket 2's title for as long
 // as the request is in flight.
 pocketId: number | null;
 // null until the first answer lands. Never a shape of zeroes: a hero of zeroes
 // on screen while the request is on the wire is a pocket reporting that
 // nothing was ever committed to it.
 pocket: PocketDetailPocket | null;
 sources: PocketSource[];
 history: PocketAllocationEntry[];
 notices: string[];
 isLoaded: boolean;
 isLoading: boolean;
 error: string | null;
 // Asks for a pocket. Serves what is in memory when the id matches and an
 // answer already landed; asks otherwise.
 fetchDetail: (pocketId: number) => Promise<void>;
 // Asks again for what is already on screen. A write knows its own answer is
 // obsolete.
 refreshDetail: () => Promise<void>;
 // Takes a write's own response as the new truth. The four writes answer with
 // exactly this payload, so a create, an edit, an allocation or a release
 // repaints the screen without a second round trip.
 setDetail: (detail: PocketDetailPayload) => void;
 // Drops the memo without clearing the screen, so the next fetchDetail asks
 // again.
 invalidate: () => void;
 // Empties it. Called when the screen unmounts, so the next pocket opened
 // cannot flash this one's figures under its title.
 clear: () => void;
};

const emptyDetail = {
 pocketId: null,
 pocket: null,
 sources: [],
 history: [],
 notices: [],
 isLoaded: false,
 isLoading: false,
 error: null,
};

// ======================================
// 🎯 STORE IMPLEMENTATION
// ======================================
export const usePocketDetailStore = create<PocketDetailState>((set, get) => ({
 ...emptyDetail,

 fetchDetail: async (pocketId: number) => {
  const state = get();

  // Already answered, for this pocket. Walking back from a write and returning
  // to the same screen must not ask again.
  if (state.isLoaded && state.pocketId === pocketId) return;

  // Already on the wire, for this pocket. Guards the double fetch two mounted
  // consumers would issue.
  if (state.isLoading && state.pocketId === pocketId) return;

  // The id is claimed before the request goes out, and what is on screen is
  // dropped with it: from here on the screen is showing a different pocket, and
  // holding the previous one's figures under the new title is worse than
  // holding none.
  set({ ...emptyDetail, pocketId, isLoading: true });

  try {
   const detail = await getPocketDetail(pocketId);

   // The user navigated away, or on to another pocket, while this was in
   // flight. Writing now would paint an answer over the screen that replaced
   // the one that asked for it.
   if (get().pocketId !== pocketId) return;

   set({
    pocket: detail.pocket,
    sources: detail.sources,
    history: detail.history,
    notices: detail.meta.notices,
    isLoaded: true,
    isLoading: false,
    error: null,
   });
  } catch (err: unknown) {
   if (get().pocketId !== pocketId) return;

   // isLoaded is left false, so a remount retries rather than serving a
   // half-written state as the pocket's answer.
   const errorMessage =
    err instanceof Error ? err.message : 'Failed to fetch the pocket';
   console.error('🐷 Error fetching the pocket detail:', errorMessage);
   set({ error: errorMessage, isLoading: false, isLoaded: false });
  }
 },

 refreshDetail: async () => {
  const { pocketId } = get();
  if (pocketId === null) return;

  set({ isLoaded: false, isLoading: false });
  await get().fetchDetail(pocketId);
 },

 setDetail: (detail: PocketDetailPayload) =>
  set({
   pocketId: detail.pocket.pocketId,
   pocket: detail.pocket,
   sources: detail.sources,
   history: detail.history,
   notices: detail.meta.notices,
   isLoaded: true,
   isLoading: false,
   error: null,
  }),

 invalidate: () => set({ isLoaded: false }),

 clear: () => set({ ...emptyDetail }),
}));

// An allocation never moves money, but this payload reports the funding
// accounts' own balances and what each of them has left uncommitted — and those
// do move on any transaction. Dropping the memo costs no request: the refetch
// happens only if the pocket is opened again.
onTransactionRecorded(() => {
 usePocketDetailStore.getState().invalidate();
});

// An account edit changes the names this payload prints and can change which
// accounts it can resolve at all, none of which the transaction path ever sees.
// That is why both subscriptions exist rather than one.
onAccountChanged(() => {
 usePocketDetailStore.getState().invalidate();
});
