// frontend/src/fintrack/pages/overview/OverviewDomain.tsx
//
// Level 2: one domain, for the month the layout above is already showing.
//
// IT MOUNTS INSIDE OverviewLayout, as a sibling of the level-1 index route, and
// that is the whole reason the month works without a line of code here. The
// layout owns the month in the URL (OverviewLayout.tsx:47-54), draws the picker
// and the hero, and renders this through its Outlet - so stepping the month on
// this screen steps it on both, and walking back to level 1 lands on the month
// the reader was studying.
//
// NO SECOND IMPLEMENTATION OF ANYTHING. The curve is TrendChart from the level-1
// block, the ranking and the ring are ExpenseBreakdown from it, the rows are
// LastMovements and the pager is Pagination. What this file adds is the request,
// the heading and the order the pieces sit in.
//
// THE ANALYSIS SECTION IS NOT ASKED FOR YET. The endpoint offers two depths and
// this screen requests neither, because a request for a section nothing draws is
// work the server does for nobody. The four distributions the contract lists for
// level 2 are the next commit, and they arrive by passing a depth to the hook.

import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { CardTitle } from '../../general_components/CardTitle';
import { Pagination } from '../../general_components/pagination/Pagination';
import CollapsibleBlock from './components/CollapsibleBlock';
import { ExpenseBreakdown } from './components/ExpenseByCategory';
import LastMovements, { LastMovementType } from './components/LastMovements';
import PanelState from './components/PanelState';
import { TrendChart } from './components/TrendCharts';
import { useOverviewDomain } from './hooks/useOverviewDomain';
import { currencyFormat } from '../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../helpers/constants';
import { monthLabel } from './helpers/monthLabel';
import {
 OverviewDomain as OverviewDomainName,
 OverviewDomainCard,
 OverviewTransactionRow,
} from '../../types/overviewTypes';

import './styles/overview-styles.css';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// The six the controller has a calculator for, and the words a reader uses for
// each. The wire names are not the labels: 'pnl' is a column name and nobody
// calls a domain that.
//
// It is also the guard. A path segment is whatever was typed, so a name absent
// from this map never becomes a request - the screen says so instead of sending
// one and rendering the server's 400.
const DOMAIN_LABELS: Record<OverviewDomainName, string> = {
 income: 'Income',
 expense: 'Expense',
 investment: 'Investment',
 debt: 'Debt',
 pocket: 'Pockets',
 pnl: 'Realised result',
};

// Which domains have a series at all. The other three do not carry the key, and
// an absent key says the domain has no series where an empty array would say it
// has one and it is blank - the same distinction TrendCharts.tsx:5-8 makes.
const SERIES_NATURE: Partial<
 Record<OverviewDomainName, 'flow' | 'position'>
> = {
 income: 'flow',
 expense: 'flow',
 pocket: 'position',
};

const isDomain = (value: string | undefined): value is OverviewDomainName =>
 value !== undefined && value in DOMAIN_LABELS;

// The headline figure of a card, and what kind of quantity it is.
//
// FIVE OF THE SIX SHARE A SHAPE AND INVESTMENT DOES NOT. The five publish
// totalAmount, a sum over the month. Investment publishes ledgerBalance, the
// position at the month's close, and carries no totalAmount at all - printing
// one under the other's label would state that a balance is a month's activity.
const headline = (card: OverviewDomainCard) =>
 card.domain === 'investment'
  ? { amount: card.ledgerBalance, nature: 'at month end' }
  : { amount: card.totalAmount, nature: 'this month' };

// The row shape LastMovements reads, from the server's own column names.
//
// account_name is nullable and the dash is why: transactionRowShape.js joins
// user_accounts LEFT, because closing an account deletes that row while its
// movements survive. An inner join would have dropped those rows from the page
// while the count beside it still counted them.
const toRows = (rows: OverviewTransactionRow[]): LastMovementType[] =>
 rows.map((row) => ({
  accountName: row.account_name ?? 'closed account',
  record: row.amount,
  description: row.description,
  // transaction_local_date and not transaction_actual_date: the other is an
  // instant, and a day rendered from it is the previous day for every reader
  // west of Greenwich.
  date: row.transaction_local_date,
  currency: row.currency_code as LastMovementType['currency'],
  transactionId: row.transaction_id,
 }));

function OverviewDomain() {
 const { domain } = useParams();
 const [searchParams] = useSearchParams();
 const monthParam = searchParams.get('month') ?? undefined;

 // Narrowed before the hook, so the request is never composed from a segment
 // the map does not know. The fallback is 'expense' and it is never reached:
 // the render below returns early when the guard fails, and the constant only
 // exists because a hook cannot be called conditionally.
 const domainName: OverviewDomainName = isDomain(domain) ? domain : 'expense';

 const { data, isLoading, error, goToPage, setPageSize, refetch } =
  useOverviewDomain(domainName, monthParam);

 const rows = useMemo(
  () => (data ? toRows(data.transactions.rows) : null),
  [data],
 );

 if (!isDomain(domain)) {
  return (
   <section className='overviewDomain'>
    <CardTitle>Not a domain</CardTitle>

    <p className='overviewDomain__note'>
     {/* The six are named rather than left for the reader to guess, because a
         mistyped segment is the only way to arrive here. */}
     The overview breaks down into{' '}
     {Object.values(DOMAIN_LABELS).join(', ').toLowerCase()}.
    </p>

    <Link className='overviewDomain__back' to='/fintrack/overview'>
     Back to the overview
    </Link>
   </section>
  );
 }

 const label = DOMAIN_LABELS[domain];
 const nature = SERIES_NATURE[domain];

 // The skeleton is only for the FIRST answer. A page step with rows already on
 // screen keeps them and marks the pager busy, because replacing a list with a
 // skeleton on every step is the block jumping under the reader's hand.
 const isFirstLoad = isLoading && data === null;

 if (isFirstLoad || error !== null) {
  return (
   <section className='overviewDomain'>
    <PanelState
     title={label}
     subject={`The ${label.toLowerCase()} detail`}
     isLoading={isFirstLoad}
     error={error}
     onRetry={refetch}
    />
   </section>
  );
 }

 if (!data) return null;

 const { card, window: served } = data;
 const figure = headline(card);

 return (
  <section className='overviewDomain'>
   {/* The month is the layout's and is stated here anyway: this screen can be
       opened directly by its url, and a page of movements with no period named
       on it is a page of movements from an unknown month. */}
   <CardTitle
    legend={
     <span className='overviewDomain__amount'>
      {currencyFormat(card.currency, figure.amount, formatNumberCountry)}
     </span>
    }
    subtitle={monthLabel(served.referenceMonth)}
    subLegend={figure.nature}
   >
    {label}
   </CardTitle>

   <Link className='overviewDomain__back' to='/fintrack/overview'>
    Back to the overview
   </Link>

   {/* Absent for three of the six domains, and absent is not empty. */}
   {nature && data.trend.length > 0 && (
    <CollapsibleBlock head={<CardTitle>Trend</CardTitle>}>
     <section className='domainCards domainCards--single'>
      <TrendChart
       label={label}
       nature={nature}
       points={data.trend}
       currency={card.currency}
      />
     </section>
    </CollapsibleBlock>
   )}

   {/* The expense domain's alone, and the same two drawings level 1 mounts -
       from this answer's own categories rather than from the page payload. */}
   {data.categories && card.domain === 'expense' && (
    <ExpenseBreakdown categories={data.categories} card={card} />
   )}

   <LastMovements
    data={rows}
    title='Movements'
    subtitle={`${data.transactions.totalRows} in ${monthLabel(
     served.referenceMonth,
    )}`}
    listHeader={
     <Pagination
      page={data.transactions.page}
      pageSize={data.transactions.pageSize}
      totalRows={data.transactions.totalRows}
      onPageChange={goToPage}
      onPageSizeChange={setPageSize}
      itemLabel='movements'
      isBusy={isLoading}
     />
    }
   />
  </section>
 );
}

export default OverviewDomain;
