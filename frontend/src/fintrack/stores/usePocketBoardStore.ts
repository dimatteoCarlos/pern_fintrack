// frontend/src/fintrack/stores/usePocketBoardStore.ts
// 🐷 POCKET BOARD STORE: the module's payload, fetched once per month
//
// GET /pocket/board answers with every pocket of the user and the totals folded
// over them, both bound to one month. The header and the list are two readings
// of that one answer, so it is fetched here rather than in either of them —
// which is what stops the big number on top from disagreeing with the rows
// underneath.
//
// A store and not a route context, for the reason the budget one is: the pocket
// detail is a route declared beside the layout, not inside it, so opening a
// pocket unmounts the layout and anything hanging from its Outlet. A store
// survives that and the walk back costs no request.
//
// The answer comes from the endpoint as of 2026-09-04. It came from the
// contract's example payload while the month-aware route was being written, and
// that stand-in outlived its reason: the detail screen was already calling the
// real endpoint, so the board listed pockets the database does not hold while
// every card opened onto one that it does. Two screens describing two different
// populations is worse than a board that cannot load.

import axios from 'axios';
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
 // The month every figure above is about, as the server resolved it on the
 // owner's calendar. It is the stepper's label and it is NOT what was asked
 // for: the first request asks for nothing.
 referenceMonth: string | null;
 // The latest month that may be asked for, same calendar. Not referenceMonth:
 // reading August does not make August the latest month there is.
 currentMonth: string | null;
 // The one date every figure on the payload was computed at. Served, never
 // derived: printed if a screen needs it.
 evaluationDate: string | null;
 // The back arrow's floor: the month the earliest plan was made in, as YYYY-MM.
 //
 // DERIVED, because the payload carries no floor — see the note on the reducer
 // below. It only ever moves EARLIER and is never cleared: the board's
 // population is bound by month, so a month before the first plan answers with
 // no rows at all, and recomputing from those rows would drop the floor exactly
 // when it is the thing stopping the reader walking backwards forever.
 earliestPlanMonth: string | null;
 // What is in memory, keyed the way it was asked for. 'current' is the omitted
 // month, which is a different key from the current month spelled out.
 loadedMonth: string | null;
 // What is on the wire, same key. It is what lets a month picked during
 // another month's request win: the older answer is discarded on arrival
 // instead of the newer request being refused at the door. An arrow held down
 // fires several requests and the LAST ASKED must win, not the last to arrive.
 requestedMonth: string | null;
 isLoading: boolean;
 error: string | null;
 fetchBoard: (month?: string) => Promise<void>;
 // Asks again for the month already on screen, guard and all. A write knows
 // its own answer is obsolete, and routing that through invalidate() plus a
 // call fetchBoard is free to refuse would make correctness depend on the
 // caller getting two statements in the right order.
 refreshBoard: () => Promise<void>;
 invalidate: () => void;
};

const monthKey = (month?: string) => month ?? 'current';

// What actually went wrong, in the most specific words available.
//
// axios sets `message` to "Request failed with status code 500" and leaves the
// server's own sentence in the response body, so an unwrapped Error carries the
// number and never the reason. Every route of this API answers with
// { status, message, data }, which is where the reason lives; the status line is
// kept beside it because a 401 and a 500 need opposite responses from the reader
// and the message alone rarely says which arrived.
const failureText = (err: unknown): string => {
 if (axios.isAxiosError(err)) {
  const served = (err.response?.data as { message?: string } | undefined)
   ?.message;
  const status = err.response?.status;

  // No response at all: the request never reached an answer. It is not a
  // server error and must not be reported as one — the server is unreachable,
  // refusing the origin, or the request was cancelled.
  if (status === undefined) return `No answer from the server (${err.message})`;

  return served ? `${status} · ${served}` : `${status} · ${err.message}`;
 }

 return err instanceof Error ? err.message : 'Failed to fetch the pocket board';
};

// The earliest month any plan on this answer was made in, never later than what
// is already held. The rows carry planStart as YYYY-MM-DD on the owner's
// calendar, so the month is a slice and never a parsed Date — new Date() on one
// of these reads UTC midnight and lands in the previous month west of UTC.
//
// The server should serve this bound rather than the client folding it; until
// it does, the fold is honest because the first answer is the current month,
// which is the month that holds every pocket the owner has.
//
// A row without the field is SKIPPED, not read. The type says planStart is
// always present and the payload disagreed: `.slice` on the missing value threw
// INSIDE the try that wraps the request, so a 200 the server answered correctly
// was caught and reported as a failed fetch, and the whole board — every figure,
// every card — went to its error state over a back arrow's floor.
//
// The guard is not a type check but a statement about consequence: this bound
// only decides how far back the month stepper may walk, so a row that cannot
// answer for it must cost that row's contribution and nothing else. No
// client-side convenience folded over a served payload may be able to take the
// payload down with it.
const earliestPlan = (held: string | null, rows: PocketStatus[]) =>
 rows.reduce((earliest, row) => {
  const planStart: string | undefined = row.planStart;
  if (!planStart) return earliest;

  const month = planStart.slice(0, 7);

  return earliest === null || month < earliest ? month : earliest;
 }, held);

// ======================================
// 🎯 STORE IMPLEMENTATION
// ======================================
export const usePocketBoardStore = create<PocketBoardState>((set, get) => ({
 summary: null,
 pockets: [],
 notices: [],
 referenceMonth: null,
 currentMonth: null,
 evaluationDate: null,
 earliestPlanMonth: null,
 loadedMonth: null,
 requestedMonth: null,
 isLoading: false,
 error: null,

 // month is omitted until the reader steps back: the current month resolved by
 // a browser clock lands on the wrong calendar for part of every day.
 fetchBoard: async (month) => {
  const key = monthKey(month);

  // Already answered, or already on the wire FOR THIS MONTH. This is what
  // makes the store a carrier rather than a fetch on every mount: opening a
  // pocket and coming back must not ask again.
  if (get().loadedMonth === key || get().requestedMonth === key) return;

  set({ requestedMonth: key, isLoading: true, error: null });

  try {
   // The payload, not the envelope: the client unwraps the transport layer so
   // the store never reaches through a status and a message to find pockets.
   const board = await getPocketBoard(month);

   // A month stepped to while this one was on the wire supersedes it. Writing
   // here would paint one month's figures under another month's badge.
   if (get().requestedMonth !== key) return;

   set({
    summary: board.summary,
    pockets: board.pockets,
    notices: board.meta.notices,
    referenceMonth: board.meta.referenceMonth,
    currentMonth: board.meta.currentMonth,
    evaluationDate: board.meta.evaluationDate,
    earliestPlanMonth: earliestPlan(get().earliestPlanMonth, board.pockets),
    loadedMonth: key,
    isLoading: false,
    error: null,
   });
  } catch (err: unknown) {
   if (get().requestedMonth !== key) return;

   // loadedMonth is left untouched, so a remount retries instead of serving a
   // half-written state as the month's answer. requestedMonth IS cleared:
   // otherwise the failed month could never be asked for again.
   const errorMessage = failureText(err);
   console.error('🐷 Error fetching the pocket board:', errorMessage, err);
   set({ error: errorMessage, isLoading: false, requestedMonth: null });
  }
 },

 // Drops the memo without clearing what is on screen, so the next fetchBoard
 // asks again. Nulling requestedMonth also discards an answer already on the
 // wire: it was computed before the write that invalidated it.
 invalidate: () => set({ loadedMonth: null, requestedMonth: null }),

 // The month to ask for is the one already loaded, not one the caller passes:
 // a write changes the month on screen, and a caller that guessed a different
 // key would refresh a month nobody is looking at.
 //
 // 'current' is the omitted month, so it maps back to undefined — sending the
 // literal string would be a month the server cannot parse.
 refreshBoard: async () => {
  const key = get().loadedMonth ?? get().requestedMonth;

  set({ loadedMonth: null, requestedMonth: null });
  await get().fetchBoard(key === null || key === 'current' ? undefined : key);
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
