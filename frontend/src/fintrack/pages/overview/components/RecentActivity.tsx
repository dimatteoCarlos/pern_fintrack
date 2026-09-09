// frontend/src/fintrack/pages/overview/components/RecentActivity.tsx
//
// The activity block of level 1: every movement the owner made, over a period
// the READER chooses, with its own search, its own filter and its own pager.
//
// It composes LastMovements rather than replacing it. That component is the
// teaser - a title, a subtitle and the list - and it is still exactly that; what
// this adds is the controls above it and the pager below it. Rewriting the list
// here would have been a second renderer for one row shape.
//
// EVERY NARROWING IS SERVED. Nothing on this screen filters an array: the search
// and the filter are parameters on the request, so the count under the list
// answers for the whole set. A client-side filter over one page would say
// "3 of 5" while the account holds two thousand movements.

import { useMemo } from 'react';

import ChevronDownSvg from '../../../../assets/debtsSvg/ChevronDownSvg.svg?react';
import ClearSvg from '../../../../assets/debtsSvg/ClearSvg.svg?react';
import SearchSvg from '../../../../assets/debtsSvg/SearchSvg.svg?react';

import { Pagination } from '../../../general_components/pagination/Pagination';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import {
 OVERVIEW_ACTIVITY_MOVEMENT_TYPES,
 OverviewActivityMovementType,
} from '../../../types/overviewTypes';
import { useOverviewActivity } from '../hooks/useOverviewActivity';
import LastMovements, { LastMovementType } from './LastMovements';
import PanelState from './PanelState';

import '../styles/recentActivity-styles.css';

// The endpoint's own ceiling, so the field cannot compose a term the schema will
// refuse. 80 in overviewValidators.js; a longer one answers 400.
const SEARCH_MAX_LENGTH = 80;

// The catalog, with the words a reader uses for it. The values are the wire's
// and the labels are not: 'pnl' is a column name and 'account-opening' is a
// hyphenated identifier, and neither is what a person calls the thing.
const MOVEMENT_LABELS: Record<OverviewActivityMovementType, string> = {
 expense: 'Expenses',
 income: 'Income',
 investment: 'Investments',
 debt: 'Debt',
 pocket: 'Pockets',
 transfer: 'Transfers',
 receive: 'Received',
 'account-opening': 'Account openings',
 pnl: 'Realised results',
 'account-closure': 'Account closures',
 'balance-reversal': 'Balance reversals',
};

// The four periods, and 'all' is the default because this section answers what
// happened LAST rather than what happened in the month on screen. A reader
// studying last August still wants to know what moved yesterday.
type PeriodKey = 'all' | 'month' | 'quarter' | 'year';

const PERIOD_LABELS: Record<PeriodKey, string> = {
 all: 'All time',
 month: 'This month',
 quarter: 'Last 3 months',
 year: 'Last 12 months',
};

// 'YYYY-MM-01' minus n months, as the 'YYYY-MM' the endpoint takes.
//
// Built from the parts and not through the Date constructor: 'YYYY-MM-01'
// parses as UTC midnight, which is the previous month for every reader west of
// Greenwich - the same trap monthLabel in DomainCards.tsx names.
const monthsBefore = (month: string, count: number) => {
 const [year, monthNumber] = month.split('-').map(Number);
 const zeroBased = year * 12 + (monthNumber - 1) - count;

 return `${Math.floor(zeroBased / 12)}-${String((zeroBased % 12) + 1).padStart(2, '0')}`;
};

// The bounds a period resolves to, both inclusive and both 'YYYY-MM'.
//
// currentMonth is the ceiling the server published, not a month computed here:
// the owner's calendar is what every figure of this page is cut against, and a
// month built from the browser clock would disagree with it for readers whose
// timezone has already turned over.
const periodBounds = (period: PeriodKey, currentMonth: string | null) => {
 if (period === 'all' || !currentMonth) return { from: null, to: null };

 const to = currentMonth.slice(0, 7);
 const back = period === 'month' ? 0 : period === 'quarter' ? 2 : 11;

 return { from: monthsBefore(currentMonth, back), to };
};

function RecentActivity() {
 const currentMonth = useOverviewStore((state) => state.currentMonth);

 const { query, data, isLoading, error, narrow, goToPage, refetch } =
  useOverviewActivity();

 // Read back off the bounds rather than held as a second piece of state. Two
 // states for one choice is two places for the select and the request to
 // disagree, and the bounds are what the request actually carries.
 const period: PeriodKey = useMemo(() => {
  if (!query.from) return 'all';
  if (query.from === query.to) return 'month';

  return query.from === periodBounds('quarter', currentMonth).from ? 'quarter' : 'year';
 }, [query.from, query.to, currentMonth]);

 const rows: LastMovementType[] | null = useMemo(
  () =>
   data
    ? data.transactions.rows.map((row) => ({
       accountName: row.account_name,
       record: row.amount,
       description: row.description,
       note: row.note,
       date: row.transaction_actual_date,
       currency: row.currency_code as LastMovementType['currency'],
       transactionId: row.transaction_id,
      }))
    : null,
  [data],
 );

 // What the list is bounded by, in the reader's own terms. It replaces the fixed
 // sentence the teaser carried, which named a row count this block no longer
 // has: the size is the reader's now.
 const subtitle = `${PERIOD_LABELS[period]}${
  query.movementType === 'all' ? '' : ` · ${MOVEMENT_LABELS[query.movementType]}`
 }`;

 // PanelState draws its own heading, and so does LastMovements: whichever of
 // the two is on screen, the block keeps one title and never two.
 const isFirstLoad = isLoading && data === null;
 const showPanel = isFirstLoad || error !== null;

 return (
  <article className='recentActivity'>
   <div className='recentActivity__controls'>
    <div className='recentActivity__query'>
     <SearchSvg className='recentActivity__icon' />

     <input
      type='search'
      className='recentActivity__search'
      value={query.search}
      onChange={(event) => narrow({ search: event.target.value })}
      placeholder='Search movements'
      aria-label='Search movements'
      autoComplete='off'
      maxLength={SEARCH_MAX_LENGTH}
     />

     {query.search && (
      <button
       type='button'
       className='recentActivity__reset'
       onClick={() => narrow({ search: '' })}
       aria-label='Clear search'
      >
       <ClearSvg />
      </button>
     )}
    </div>

    <div className='recentActivity__selectBox'>
     <select
      className='recentActivity__select'
      value={query.movementType}
      onChange={(event) =>
       narrow({
        movementType: event.target.value as OverviewActivityMovementType | 'all',
       })
      }
      aria-label='Filter by kind of movement'
     >
      <option value='all'>All movements</option>

      {OVERVIEW_ACTIVITY_MOVEMENT_TYPES.map((value) => (
       <option key={value} value={value}>
        {MOVEMENT_LABELS[value]}
       </option>
      ))}
     </select>

     <ChevronDownSvg className='recentActivity__icon recentActivity__icon--trailing' />
    </div>

    <div className='recentActivity__selectBox'>
     <select
      className='recentActivity__select'
      value={period}
      onChange={(event) =>
       narrow(periodBounds(event.target.value as PeriodKey, currentMonth))
      }
      aria-label='Period'
     >
      {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((value) => (
       <option key={value} value={value}>
        {PERIOD_LABELS[value]}
       </option>
      ))}
     </select>

     <ChevronDownSvg className='recentActivity__icon recentActivity__icon--trailing' />
    </div>
   </div>

   {/* The three fetch states are the panel's, not this block's: the skeleton
       and the error with its retry are PanelState's, and empty is ListContent's
       own - an owner with no movement in the period is a real answer.

       The skeleton is only for the FIRST answer. A page step or a new term with
       a list already on screen keeps the rows and marks the pager busy, because
       replacing a list with a skeleton on every keystroke is the block jumping
       under the reader's hand. */}
   {showPanel ? (
    <PanelState
     title='Recent activity'
     subject='The activity list'
     isLoading={isFirstLoad}
     error={error}
     onRetry={refetch}
    />
   ) : (
    <LastMovements
     data={rows}
     title='Recent activity'
     subtitle={subtitle}
     /* Above the rows and not below them. The count frames the list before it
        is read, and the page-size control belongs with the search and the
        filter rather than fifty rows under them. It goes through the list
        component because the heading is drawn in there. */
     listHeader={
      data && (
       <Pagination
        page={data.transactions.page}
        pageSize={data.transactions.pageSize}
        totalRows={data.transactions.totalRows}
        onPageChange={goToPage}
        onPageSizeChange={(pageSize) => narrow({ pageSize })}
        itemLabel='movements'
        isBusy={isLoading}
       />
      )
     }
    />
   )}
  </article>
 );
}

export default RecentActivity;
