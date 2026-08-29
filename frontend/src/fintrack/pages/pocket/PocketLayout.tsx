//frontend\src\fintrack\pages\pocket\PocketLayout.tsx
import { useEffect, useState } from 'react';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import { usePocketBoardStore } from '../../stores/usePocketBoardStore.ts';
import PocketBigBoxResult from './components/PocketBigBoxResult.tsx';

import './styles/pocket-styles.css';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
import { Outlet } from 'react-router-dom';

function PocketLayout() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The module's single request. This header and the list below are both drawn
  // from it, which is why it is issued here and not in either one. It used to be
  // two requests for one screen, and the two could disagree: the header's query
  // grouped by currency and its handler read the first row.
  const summary = usePocketBoardStore((state) => state.summary);
  const notices = usePocketBoardStore((state) => state.notices);
  const isLoading = usePocketBoardStore((state) => state.isLoading);
  const error = usePocketBoardStore((state) => state.error);
  const fetchBoard = usePocketBoardStore((state) => state.fetchBoard);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    if (error) {
      setErrorMessage(error);
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  //--------------------------------------
  // Passed through as they arrive, null included. These used to collapse to 0,
  // which announced a target of zero while the answer was still on the wire, and
  // again in the mixed-currency case where the contract withholds the totals on
  // purpose rather than adding two currencies at an implicit rate of 1:1.
  //
  // Nothing is summed here: the server folds the same rows the list renders, so
  // the header and the list cannot disagree.
  const totalTarget = summary?.totalTarget ?? null;
  const totalRemaining = summary?.totalRemaining ?? null;
  const currency = summary?.currency ?? null;

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

        <PocketBigBoxResult
          totalTarget={totalTarget}
          totalRemaining={totalRemaining}
          currency={currency}
          notice={notice}
        />

        {error && (
          <p
            style={{
              color: 'red',
              position: 'absolute',
              top: '1.5%',
              left: '10%',
              zIndex: '150',
            }}
          >
            {errorMessage}
          </p>
        )}
        <Outlet />
      </div>
    </>
  );
}

export default PocketLayout;
