//frontend\src\fintrack\pages\pocket\PocketLayout.tsx
import { useCallback, useEffect } from 'react';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import { usePocketBoardStore } from '../../stores/usePocketBoardStore.ts';
import PocketBigBoxResult from './components/PocketBigBoxResult.tsx';
import MonthPicker from '../../general_components/monthPicker/MonthPicker.tsx';

import './styles/pocket-styles.css';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
import { Outlet, useSearchParams } from 'react-router-dom';

function PocketLayout() {
 // The module's single request. This header and the list below are both drawn
 // from it, which is why it is issued here and not in either one. It used to be
 // two requests for one screen, and the two could disagree: the header's query
 // grouped by currency and its handler read the first row.
 const summary = usePocketBoardStore((state) => state.summary);
 const notices = usePocketBoardStore((state) => state.notices);
 const referenceMonth = usePocketBoardStore((state) => state.referenceMonth);
 const currentMonth = usePocketBoardStore((state) => state.currentMonth);
 // The back arrow's floor. Held by the store and never recomputed from the
 // rows on screen: a month before the first plan answers with no rows, and
 // folding those would drop the floor exactly where it is needed.
 const earliestPlanMonth = usePocketBoardStore(
  (state) => state.earliestPlanMonth,
 );
 const isLoading = usePocketBoardStore((state) => state.isLoading);
 const error = usePocketBoardStore((state) => state.error);
 const fetchBoard = usePocketBoardStore((state) => state.fetchBoard);

 // The month lives in the URL, which is the convention the three screens that
 // already step months use. There is no month context in the app and this does
 // not introduce one: the pocket detail is a route declared BESIDE this layout,
 // so a month held in state here would die the moment a pocket is opened.
 const [searchParams, setSearchParams] = useSearchParams();
 const monthParam = searchParams.get('month');

 // Absent, nothing is sent and the server resolves the current month on the
 // owner's calendar. Only a month the reader stepped back to ever travels.
 useEffect(() => {
  fetchBoard(monthParam ?? undefined);
 }, [fetchBoard, monthParam]);

 // Replaced, not pushed: the month is the scope of the board, not a step the
 // back button should walk through one month at a time.
 //
 // Merged rather than written whole: the list below keeps its search term, its
 // sort key and its filter in this same query string, and a plain object
 // overwrites it — the month would silently clear what the reader just typed.
 const selectMonth = useCallback(
  (month: string) => {
   setSearchParams(
    (previous) => {
     const next = new URLSearchParams(previous);
     next.set('month', month);
     return next;
    },
    { replace: true },
   );
  },
  [setSearchParams],
 );

 // The same argument the effect above sends, so pressing the button asks for
 // the month on screen and not for whatever the server would resolve today.
 const retry = useCallback(() => {
  fetchBoard(monthParam ?? undefined);
 }, [fetchBoard, monthParam]);

 //--------------------------------------
 // The summary goes through whole, nulls included. Narrowing it to three fields
 // here is what left six of the ten figures the server folds unreachable by the
 // header, the committed amount among them.
 //
 // Nothing is summed here either: the server folds the same rows the list
 // renders, so the header and the list cannot disagree.

 // Raised only when the board holds pockets it could not fold. An empty board
 // also serves a null currency, and that is not a mix — it is the empty state
 // the list below renders.
 const notice =
  summary !== null && summary.pocketCount > 0 && summary.currency === null
   ? notices[0] ?? null
   : null;

 return (
  <>
   <div className='pocketLayout'>
    <div className='layout__header'>
     <div className='headerContent__container'>
      <TitleHeader></TitleHeader>

      {/* Same level Budget uses: alongside the title rather than between the
          header and the summary, floated out of the header's flow by CSS —
          the header is positioned from a constant height, so a child that
          added to it would move every absolute box below. The arrows are the
          shared selector's, behind its opt-in prop, so the bounds are held
          once: a local wrapper would carry a second copy of them and the
          forward arrow would eventually step past the current month. */}
      <MonthPicker
       month={referenceMonth}
       currentMonth={currentMonth}
       minMonth={earliestPlanMonth}
       surface='dark'
       withSteppers
       isLoading={isLoading}
       onSelect={selectMonth}
      />
     </div>
    </div>

    {isLoading && (
     <div
      className='loader__container'
      style={{
       position: 'absolute',
       left: '50%',
       top: '20%',
       zIndex: '1',
      }}
     >
      <CoinSpinner />
     </div>
    )}

    {/* The failure takes the hero's own place, the way the debts board
        already answers. It used to be a red line floated over the box at
        top: 1.5%, which erased itself after three seconds while the totals
        it contradicted stayed on screen -- and since the guard tested
        `error` and the text read a separate `errorMessage`, what stayed
        behind for the life of the view was an empty paragraph.
        No figure survives a failed request, so no figure is drawn. */}
    {error ? (
     <div className='total__container flex-col-sb boardState' role='alert'>
      <p className='boardState__text'>
       The pocket summary could not be loaded.
      </p>

      {/* The reason, in whatever words the failure arrived with. The store has
          held it since the request rejected and the screen was throwing it
          away, so every failure of this board — a route that does not answer,
          a session that expired, a payload that will not parse — read as the
          same sentence and left the owner nothing to act on and nobody
          anything to diagnose. */}
      <p className='boardState__detail'>{error}</p>

      <button type='button' className='boardState__retry' onClick={retry}>
       Try again
      </button>
     </div>
    ) : (
     <PocketBigBoxResult
      summary={summary}
      referenceMonth={referenceMonth}
      currentMonth={currentMonth}
      notice={notice}
     />
    )}

    <Outlet />
   </div>
  </>
 );
}

export default PocketLayout;
