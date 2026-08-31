//ListPocket.tsx
//parent: Pocket.tsx
import { Link, useSearchParams } from 'react-router-dom';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents.tsx';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants.ts';
import {
 currencyFormat,
 formatCalendarDate,
} from '../../../helpers/functions.ts';
import { usePocketBoardStore } from '../../../stores/usePocketBoardStore.ts';
import {
 POCKET_STATUS_WORD,
 PocketStatusLevel,
 pocketDateLevel,
 pocketSquareClass,
} from '../../../helpers/pocketStatus.ts';
import { NAME_MAX_LENGTHS } from '../../../validations/utils/inputConstraints/nameMaxLengths.ts';
import {
 DEFAULT_SORT_DIRECTION,
 usePocketListFilter,
 type PocketQuickFilter,
 type PocketSortDirection,
 type PocketSortKey,
} from '../hooks/usePocketListFilter.ts';
import PocketToolbar from './PocketToolbar.tsx';

// A figure the contract withheld. Never 0 and never an empty cell: a dash says
// the answer is absent, where 0 would state an amount.
const DASH = '—';

// The word beside each card's status square is POCKET_STATUS_WORD, imported
// from pocketStatus.ts rather than declared here: the board's own filter
// (PocketToolbar) reads the same map for its options, so a card and the
// control that narrows down to it can never disagree about what a level is
// called.

// Funded and on plan share a bare square — neither has anything to flag — so the
// word is what tells them apart, and it carries its own tone. Colour alone
// survives neither colour blindness nor a monochrome print.
const STATUS_TONE: Record<PocketStatusLevel, string> = {
 funded: 'ok',
 overFunded: 'info',
 onPlan: 'neutral',
 atRisk: 'warning',
 offPlan: 'alert',
};

const plural = (count: number, word: string): string =>
 `${count} ${word}${Math.abs(count) === 1 ? '' : 's'}`;

// How the deadline reads against today. Negative days are a deadline already
// passed, and the day it falls on is neither left nor overdue.
const deadlineReading = (days: number): string => {
 if (days === 0) return 'Due today';

 return days > 0
  ? `${plural(days, 'day')} left`
  : `${plural(Math.abs(days), 'day')} overdue`;
};

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
 'funded',
 'overFunded',
 'onPlan',
 'atRisk',
 'offPlan',
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
 const isLoaded = usePocketBoardStore((state) => state.isLoaded);
 const error = usePocketBoardStore((state) => state.error);
 const refreshBoard = usePocketBoardStore((state) => state.refreshBoard);

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
 } = usePocketListFilter({ rows: pockets, search, sort, direction, quickFilter });

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
   {visiblePockets.map((pocket) => {
    const {
     pocketId,
     name,
     note,
     allocated,
     target,
     remaining,
     progress,
     desiredDate,
     daysRemaining,
     requiredMonthly,
     sourceCount,
     uncovered,
     currency,
    } = pocket;

    const currency_code = currency ?? DEFAULT_CURRENCY;
    const formatNumberCountry = CURRENCY_OPTIONS[currency_code];

    const amount = (value: number) =>
     currencyFormat(currency_code, value, formatNumberCountry);

    // Built from the parts of a YYYY-MM-DD label the server resolved on the
    // owner's calendar. new Date() on one of these is UTC midnight and
    // renders as the previous day west of UTC.
    const deadlineText = formatCalendarDate(desiredDate);

    const level = pocketDateLevel(pocket);
    const tone = STATUS_TONE[level];

    // The row's percentage is not clamped and passes 100 when the goal is
    // passed, which is a fact the label prints. The track is clamped instead,
    // because a fill wider than its rail is a paint error and not a reading.
    const barWidth = Math.min(Math.max(progress, 0), 100);

    // A shortfall and an excess are the same subtraction with opposite signs
    // and they are not the same news, so each gets its own word. Exactly zero
    // is a real answer — nothing is missing — and prints as the amount.
    const isExcess = remaining < 0;

    // null and 0 are different answers on this field: null is a deadline
    // already passed, so no pace exists to state, and 0 is a goal already
    // met, so none is required. Neither is an amount of money per month.
    const paceText =
     requiredMonthly === null
      ? DASH
      : requiredMonthly === 0
        ? 'Not needed'
        : amount(requiredMonthly);

    return (
     <Link
      to={`pockets/${pocketId}`}
      state={{ previousRoute }}
      className={`pocketCard ${uncovered ? 'pocketCard--uncovered' : ''}`.trim()}
      key={`pocket-${pocketId}`}
     >
      <div className='pocketCard__head'>
       <h3 className='pocketCard__name'>{name}</h3>

       {/* The level comes from the shared helper: the two served flags decide
           funded and overdue, and the thirty-day threshold splits what is
           left. Derived from the shortfall instead, this square once marked a
           pocket three months ahead of schedule identically to one whose
           deadline had passed, since both are short of the goal. */}
       <span className={`pocketCard__status pocketCard__status--${tone}`}>
        <StatusSquare alert={pocketSquareClass(level)} />
        {POCKET_STATUS_WORD[level]}
       </span>
      </div>

      <p className='pocketCard__note'>{note ?? DASH}</p>

      <div
       className='pocketCard__bar'
       role='progressbar'
       aria-label={`${name} progress`}
       aria-valuemin={0}
       aria-valuemax={100}
       aria-valuenow={Math.round(progress)}
      >
       <div
        className={`pocketCard__barFill pocketCard__barFill--${tone}`}
        style={{ width: `${barWidth}%` }}
       />
      </div>

      <p className='pocketCard__amounts'>
       <span className='pocketCard__allocated'>{amount(allocated)}</span>
       <span className='pocketCard__target'>of {amount(target)}</span>
       <span className={`pocketCard__percent pocketCard__percent--${tone}`}>
        {Math.round(progress)}%
       </span>
      </p>

      <dl className='pocketCard__facts'>
       <div className='pocketCard__fact'>
        {/* The same words the board hero and the detail panel use for this
            figure. "Remaining" was a fourth name for it, and the card sits in
            a list the hero heads. */}
        <dt className='pocketCard__factLabel'>
         {isExcess ? 'Over target' : 'Still to allocate'}
        </dt>
        <dd
         className={`pocketCard__factValue ${
          isExcess ? 'pocketCard__factValue--ok' : ''
         }`.trim()}
        >
         {amount(Math.abs(remaining))}
        </dd>
       </div>

       <div className='pocketCard__fact'>
        <dt className='pocketCard__factLabel'>Monthly pace</dt>
        <dd className='pocketCard__factValue'>{paceText}</dd>
       </div>

       <div className='pocketCard__fact'>
        <dt className='pocketCard__factLabel'>Deadline</dt>
        <dd className='pocketCard__factValue'>{deadlineText || DASH}</dd>
       </div>

       <div className='pocketCard__fact'>
        <dt className='pocketCard__factLabel'>Time</dt>
        <dd
         className={`pocketCard__factValue ${
          daysRemaining < 0 ? 'pocketCard__factValue--alert' : ''
         }`.trim()}
        >
         {deadlineReading(daysRemaining)}
        </dd>
       </div>
      </dl>

      {/* A count, not names: the detail screen lists the accounts one by one
          and the card has no room for two of them. */}
      <p className='pocketCard__sources'>
       {sourceCount === 0
        ? 'No funding account yet'
        : `Funded by ${plural(sourceCount, 'account')}`}
      </p>

      {/* Orthogonal to the three readings above and louder than any of them:
          a funded pocket can still be uncovered. Folded by the server across
          the accounts, so nothing here derives it. */}
      {uncovered && (
       <p className='pocketCard__uncovered'>
        Funding accounts no longer hold what this pocket committed
       </p>
      )}
     </Link>
    );
   })}
  </article>
  </>
 );
}

export default ListPocket;
