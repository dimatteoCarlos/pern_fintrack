//ListPocket.tsx
//parent: Pocket.tsx
//
// The board's rows, the toolbar that narrows them, and the three fetch states.
// It no longer draws a pocket: the card moved to PocketCard.tsx on 2026-09-04,
// when the hero's Next target needed the same shape and was hand-building a
// weaker copy of it. What is left here is the LIST — which rows, in what order,
// and what to show when there are none.
import { useSearchParams } from 'react-router-dom';
import { usePocketBoardStore } from '../../../stores/usePocketBoardStore.ts';
import { NAME_MAX_LENGTHS } from '../../../validations/utils/inputConstraints/nameMaxLengths.ts';
import {
 DEFAULT_SORT_DIRECTION,
 usePocketListFilter,
 type PocketQuickFilter,
 type PocketSortDirection,
 type PocketSortKey,
} from '../hooks/usePocketListFilter.ts';
import PocketCard from './PocketCard.tsx';
import PocketToolbar from './PocketToolbar.tsx';

// How many placeholder rows the loading state draws. Enough to occupy the list
// so the page does not jump when the real rows land, few enough not to claim a
// count the answer has not given yet.
const SKELETON_ROWS = 3;

// The bars one placeholder card draws, widest first, so the shape reads as the
// card it stands in for rather than as a stack of equal blocks.
const SKELETON_BARS = ['title', 'note', 'bar', 'facts'];

// A URL is typed by anyone. An unrecognised key would leave the select
// matching no option and showing an empty box, so both fall back to the
// value that changes nothing — the order the rows already arrive in, and no
// filter at all.
const SORT_KEYS: PocketSortKey[] = ['date', 'name', 'remaining'];
const toSortKey = (value: string | null): PocketSortKey =>
 SORT_KEYS.includes(value as PocketSortKey) ? (value as PocketSortKey) : 'date';

const FILTER_KEYS: PocketQuickFilter[] = [
 'all',
 'completed',
 'aboveTarget',
 'ahead',
 'onTrack',
 'behind',
 'atRisk',
 'overdue',
 'uncovered',
];
const toQuickFilter = (value: string | null): PocketQuickFilter =>
 FILTER_KEYS.includes(value as PocketQuickFilter)
  ? (value as PocketQuickFilter)
  : 'all';

const toSortDirection = (
 value: string | null,
 sort: PocketSortKey,
): PocketSortDirection =>
 value === 'asc' || value === 'desc' ? value : DEFAULT_SORT_DIRECTION[sort];

//============================================
function ListPocket({ previousRoute }: { previousRoute: string }) {
 // The board is fetched by PocketLayout, which needs the same answer for its
 // header. This reads it; it does not ask for it again.
 const pockets = usePocketBoardStore((state) => state.pockets);
 const isLoading = usePocketBoardStore((state) => state.isLoading);
 // An answer is in memory, keyed by the month it was asked for. While a new
 // month is on the wire this still names the previous one, and isLoading below
 // is what sends the list to its skeleton rather than to stale rows.
 const loadedMonth = usePocketBoardStore((state) => state.loadedMonth);
 const error = usePocketBoardStore((state) => state.error);
 const refreshBoard = usePocketBoardStore((state) => state.refreshBoard);
 const isLoaded = loadedMonth !== null;

 // The toolbar's own state lives in the URL, not in a useState here, for the
 // reason ListCategory's header states for the same choice: a pocket's detail
 // is declared beside <Layout/> (PLAN_POCKET_FE.md §5), so opening one
 // unmounts this whole list, and a term held in component state would not
 // survive the trip back from it.
 const [searchParams, setSearchParams] = useSearchParams();
 const search = (searchParams.get('q') ?? '').slice(
  0,
  NAME_MAX_LENGTHS.pocket_name,
 );
 const sort = toSortKey(searchParams.get('sort'));
 const direction = toSortDirection(searchParams.get('dir'), sort);
 const quickFilter = toQuickFilter(searchParams.get('status'));

 const setListParams = (values: Record<string, string>) => {
  setSearchParams(
   (previous) => {
    const next = new URLSearchParams(previous);
    Object.entries(values).forEach(([key, value]) => {
     if (value) next.set(key, value);
     else next.delete(key);
    });
    return next;
   },
   { replace: true },
  );
 };

 // Read unconditionally, ahead of the state guards below: a hook cannot sit
 // behind an early return. Filtering an empty or stale array while the board
 // is still loading costs nothing — the guards decide what actually renders.
 const {
  rows: visiblePockets,
  matched,
  total,
  isFiltered,
 } = usePocketListFilter({
  rows: pockets,
  search,
  sort,
  direction,
  quickFilter,
 });

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

     {/* The served reason, which the store has been holding and this screen
         was discarding. Same change as the summary's own error state above
         it: one sentence for every possible failure is a dead end. */}
     <p className='pocketList__stateDetail'>{error}</p>

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
      className='pocketCard pocketList__skeleton'
      key={`pocket-skeleton-${index}`}
      aria-hidden='true'
     >
      {SKELETON_BARS.map((bar) => (
       <div
        className={`pocketList__skeletonBar pocketList__skeletonBar--${bar}`}
        key={`pocket-skeleton-${index}-${bar}`}
       ></div>
      ))}
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
      No pockets yet. Create one to plan towards a target.
     </p>
    </div>
   </article>
  );
 }

 //--------------------------------------------
 return (
  <>
   <PocketToolbar
    search={search}
    onSearchChange={(value) => setListParams({ q: value })}
    sort={sort}
    // The direction is cleared, not carried: each key opens on its own
    // default (DEFAULT_SORT_DIRECTION), and keeping the previous one would
    // open Remaining, whose default is descending, sorted ascending instead.
    onSortChange={(value) =>
     setListParams({ sort: value === 'date' ? '' : value, dir: '' })
    }
    direction={direction}
    onDirectionChange={(value) => setListParams({ dir: value })}
    quickFilter={quickFilter}
    onQuickFilterChange={(value) =>
     setListParams({ status: value === 'all' ? '' : value })
    }
    matched={matched}
    total={total}
    isFiltered={isFiltered}
   />

   <article className='list__main__container pocketList'>
    {visiblePockets.map((pocket) => (
     <PocketCard
      pocket={pocket}
      previousRoute={previousRoute}
      key={`pocket-${pocket.pocketId}`}
     />
    ))}
   </article>
  </>
 );
}

export default ListPocket;
