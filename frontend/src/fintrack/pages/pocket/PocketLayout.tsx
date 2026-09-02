//frontend\src\fintrack\pages\pocket\PocketLayout.tsx
import { useEffect } from 'react';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import { usePocketBoardStore } from '../../stores/usePocketBoardStore.ts';
import PocketBigBoxResult from './components/PocketBigBoxResult.tsx';

import './styles/pocket-styles.css';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
import { Outlet } from 'react-router-dom';

function PocketLayout() {
  // The module's single request. This header and the list below are both drawn
  // from it, which is why it is issued here and not in either one. It used to be
  // two requests for one screen, and the two could disagree: the header's query
  // grouped by currency and its handler read the first row.
  const summary = usePocketBoardStore((state) => state.summary);
  const pockets = usePocketBoardStore((state) => state.pockets);
  const notices = usePocketBoardStore((state) => state.notices);
  const isLoading = usePocketBoardStore((state) => state.isLoading);
  const error = usePocketBoardStore((state) => state.error);
  const fetchBoard = usePocketBoardStore((state) => state.fetchBoard);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  //--------------------------------------
  // The summary and the rows go through whole, nulls included. Narrowing them
  // to three fields here is what left six of the ten figures the server folds
  // unreachable by the header, the committed amount among them.
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

            <button
              type='button'
              className='boardState__retry'
              onClick={fetchBoard}
            >
              Try again
            </button>
          </div>
        ) : (
          <PocketBigBoxResult
            summary={summary}
            pockets={pockets}
            notice={notice}
          />
        )}

        <Outlet />
      </div>
    </>
  );
}

export default PocketLayout;
