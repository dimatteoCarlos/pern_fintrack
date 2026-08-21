//ListPocket.tsx
//parent: Pocket.tsx
import { Link } from 'react-router-dom';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents.tsx';
import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';
import {
  currencyFormat,
  formatCalendarDate,
  numberFormatCurrency,
} from '../../../helpers/functions.ts';
import { usePocketBoardStore } from '../../../stores/usePocketBoardStore.ts';

// A figure the contract withheld. Never 0 and never an empty cell: a dash says
// the answer is absent, where 0 would state an amount.
const DASH = '—';

// How many placeholder rows the loading state draws. Enough to occupy the list
// so the page does not jump when the real rows land, few enough not to claim a
// count the answer has not given yet.
const SKELETON_ROWS = 3;

//============================================
function ListPocket({ previousRoute }: { previousRoute: string }) {
  // The board is fetched by PocketLayout, which needs the same answer for its
  // header. This reads it; it does not ask for it again.
  const pockets = usePocketBoardStore((state) => state.pockets);
  const isLoading = usePocketBoardStore((state) => state.isLoading);
  const isLoaded = usePocketBoardStore((state) => state.isLoaded);
  const error = usePocketBoardStore((state) => state.error);
  const refreshBoard = usePocketBoardStore((state) => state.refreshBoard);

  // Three states, and they are not degrees of one another. A failed request is
  // not an empty board, and neither is a request still in flight — all three
  // used to render the same blank list.
  if (error) {
    return (
      <article className='list__main__container pocketList'>
        <div className='pocketList__state'>
          <p className='pocketList__stateText'>
            The pocket board could not be loaded.
          </p>

          <button
            type='button'
            className='pocketList__retry'
            onClick={() => {
              void refreshBoard();
            }}
          >
            Try again
          </button>
        </div>
      </article>
    );
  }

  if (isLoading || !isLoaded) {
    return (
      <article className='list__main__container pocketList'>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div
            className='card__tile__pocket line__container pocketList__skeleton'
            key={`pocket-skeleton-${index}`}
            aria-hidden='true'
          >
            <div className='tile__left'>
              <div className='pocketList__skeletonBar pocketList__skeletonBar--title'></div>
              <div className='pocketList__skeletonBar'></div>
            </div>

            <div className='tile__right'>
              <div className='pocketList__skeletonBar pocketList__skeletonBar--title'></div>
              <div className='pocketList__skeletonBar'></div>
            </div>
          </div>
        ))}
      </article>
    );
  }

  if (pockets.length === 0) {
    return (
      <article className='list__main__container pocketList'>
        <div className='pocketList__state'>
          <p className='pocketList__stateText'>
            No pockets yet. Create one to start saving towards a goal.
          </p>
        </div>
      </article>
    );
  }

  //--------------------------------------------
  return (
    <article className='list__main__container pocketList'>
      {pockets.map((pocket) => {
        const {
          accountId,
          accountName,
          note,
          saved,
          target,
          remaining,
          desiredDate,
          currency,
        } = pocket;

        const currency_code = currency ?? DEFAULT_CURRENCY;

        // Built from the parts of a YYYY-MM-DD label the server resolved on the
        // owner's calendar. new Date() on one of these is UTC midnight and
        // renders as the previous day west of UTC.
        const deadlineText = formatCalendarDate(desiredDate);

        // Nullable column: a pocket is allowed to have no goal, and the row
        // says so instead of printing a goal of zero.
        const goalText =
          target === null
            ? DASH
            : numberFormatCurrency(target, 2, currency_code);

        return (
          <Link
            to={`pockets/${accountId}`}
            state={{ previousRoute }}
            className='card__tile__pocket line__container'
            key={`pocket-${accountId}`}
          >
            {/* <PocketLeftTile> */}
            <div className='tile__left'>
              <div className='tile__title'>{accountName}</div>
              <div className='tile__subtitle'>{note ?? DASH}</div>
              <div className='tile__subtitle'>{`(${deadlineText})`}</div>
            </div>

            {/* <PocketRightTile> */}
            <div className='tile__right'>
              <div className='tile__title'>
                saved: {currencyFormat(currency_code, saved)}
              </div>
              <div className='tile__subtitle flx-row-sb'>
                <span className='tile__subtitle tile__subtitle--opc'>
                  goal: {goalText}
                  &nbsp;
                </span>

                {/* Served, not subtracted here. The rule itself is unchanged and
                    still marks every unfinished pocket — that is P-4, and it is
                    replaced when the status arrives with the pace figures. */}
                <StatusSquare
                  alert={remaining !== null && remaining > 0 ? 'alert' : ''}
                />
              </div>
            </div>
          </Link>
        );
      })}
    </article>
  );
}

export default ListPocket;
