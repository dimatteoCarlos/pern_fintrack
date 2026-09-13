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
// THIS FILE IS THE SHELL, AND ONLY WHAT THE SIX SHARE. The guard, the heading,
// the way back, the fetch states and the movement list. What sits between the
// heading and the list is each domain's own composition in domains/, because the
// six analyses are not the same object (OVERVIEW_DECISIONS.md, P5-1).

import { useMemo } from 'react';
import {
 Link,
 useLocation,
 useParams,
 useSearchParams,
} from 'react-router-dom';

import { CardTitle } from '../../general_components/CardTitle';
import { Pagination } from '../../general_components/pagination/Pagination';
import LastMovements, { LastMovementType } from './components/LastMovements';
import PanelState from './components/PanelState';
import {
 FullAnalysisStatus,
 useOverviewDomain,
} from './hooks/useOverviewDomain';
import { currencyFormat } from '../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../helpers/constants';
import { monthLabel } from './helpers/monthLabel';
import { pocketLink } from './helpers/levelThreeLink';
import { DOMAIN_SCREENS } from './domains/domainScreens';
import {
 CardOf,
 DomainScreen,
 isAnalysisOf,
 isCardOf,
} from './domains/domainScreen';
import {
 GetOverviewDomainData,
 OverviewAllocationRow,
 OverviewAnalysis,
 OverviewDomain as OverviewDomainName,
 OverviewTransactionRow,
} from '../../types/overviewTypes';

import './styles/overview-styles.css';
import './styles/overview-domain-styles.css';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// The guard. A path segment is whatever was typed, so a name absent from the
// registry never becomes a request. An own-key test and not `in`, which would
// accept 'constructor' and every other name on Object.prototype.
const isDomain = (value: string | undefined): value is OverviewDomainName =>
 value !== undefined &&
 Object.prototype.hasOwnProperty.call(DOMAIN_SCREENS, value);

// The row shape LastMovements reads, from the server's own column names.
//
// account_name is nullable and the dash is why: transactionRowShape.js joins
// user_accounts LEFT, because closing an account deletes that row while its
// movements survive. An inner join would have dropped those rows from the page
// while the count beside it still counted them.
const toTransactionRow = (row: OverviewTransactionRow): LastMovementType => ({
 accountName: row.account_name ?? 'closed account',
 record: row.amount,
 description: row.description,
 // transaction_local_date and not transaction_actual_date: the other is an
 // instant, and a day rendered from it is the previous day for every reader
 // west of Greenwich.
 date: row.transaction_local_date,
 currency: row.currency_code as LastMovementType['currency'],
 transactionId: row.transaction_id,
});

// The pocket page's row. Mapped as a transaction it read "closed account", since
// an allocation has no account_name, and opened a detail with no transaction id.
const isAllocationRow = (
 row: OverviewTransactionRow | OverviewAllocationRow,
): row is OverviewAllocationRow => 'allocationId' in row;

const toAllocationRow = (
 row: OverviewAllocationRow,
 origin: string,
): LastMovementType => {
 const amount = Number(row.amount);
 // Null only once the source account's row is gone, as in toTransactionRow above.
 const account = row.sourceAccountName ?? 'a closed account';
 // The word beside the sign, as PocketDetail.tsx states it: a negative row
 // released the money back to the account, and a bare minus reads as a spend.
 const source =
  amount < 0 ? `Released to ${account}` : `Committed from ${account}`;

 return {
  accountName: row.pocketName,
  record: amount,
  description: source,
  note: source,
  date: row.allocationDate,
  currency: row.currency as LastMovementType['currency'],
  link: pocketLink(row.pocketId, origin),
  rowKey: row.allocationId,
 };
};

type DomainViewProps<D extends OverviewDomainName> = {
 domain: D;
 card: CardOf<D>;
 answer: GetOverviewDomainData;
 analysis: OverviewAnalysis | null;
 isLoading: boolean;
 fullStatus: FullAnalysisStatus;
 selectedCategory: string | null;
 goToPage: (next: number) => void;
 setPageSize: (next: number) => void;
 narrowToCategory: (next: string | null) => void;
 refetch: () => void;
 requestFullAnalysis: () => void;
};

// Generic over the domain so the registry entry, the card and the analysis are
// proven to belong to the same one before the composition receives them.
function DomainView<D extends OverviewDomainName>({
 domain,
 card,
 answer,
 analysis,
 isLoading,
 fullStatus,
 selectedCategory,
 goToPage,
 setPageSize,
 narrowToCategory,
 refetch,
 requestFullAnalysis,
}: DomainViewProps<D>) {
 const screen: DomainScreen<D> = DOMAIN_SCREENS[domain];
 const { Composition } = screen;
 const served = answer.window;
 const { pathname, search } = useLocation();
 // The search keeps the month, so the pocket's back arrow returns to it.
 const origin = `${pathname}${search}`;

 const rows = useMemo(() => {
  const pageRows: Array<OverviewTransactionRow | OverviewAllocationRow> =
   answer.transactions.rows;

  return pageRows.map((row) =>
   isAllocationRow(row) ? toAllocationRow(row, origin) : toTransactionRow(row),
  );
 }, [answer.transactions.rows, origin]);

 return (
  <section className='overviewDomain'>
   {/* The month is the layout's and is stated here anyway: this screen can be
       opened directly by its url, and a page of movements with no period named
       on it is a page of movements from an unknown month. */}
   <CardTitle
    legend={
     <span className='overviewDomain__amount'>
      {currencyFormat(
       card.currency,
       screen.headline.amountOf(card),
       formatNumberCountry,
      )}
     </span>
    }
    subtitle={monthLabel(served.referenceMonth)}
    subLegend={screen.headline.nature}
   >
    {screen.label}
   </CardTitle>

   <Link className='overviewDomain__back' to='/fintrack/overview'>
    Back to the overview
   </Link>

   <Composition
    card={card}
    analysis={isAnalysisOf(analysis, domain) ? analysis : null}
    answer={answer}
    isLoading={isLoading}
    onRetry={refetch}
    fullStatus={fullStatus}
    onRequestFullAnalysis={requestFullAnalysis}
    selectedCategory={selectedCategory}
    onSelectCategory={narrowToCategory}
   />

   {/* The count is the SERVER'S and follows the narrowing, so the subtitle
       states what the pager is actually paging. Naming the category in it is
       the only place the selection appears in words - a pressed chip is the
       state, and a reader who scrolled past it needs the list to say so. */}
   <LastMovements
    data={rows}
    title={screen.list.title}
    subtitle={`${answer.transactions.totalRows} in ${monthLabel(
     served.referenceMonth,
    )}${selectedCategory ? ` · ${selectedCategory}` : ''}`}
    listHeader={
     <Pagination
      page={answer.transactions.page}
      pageSize={answer.transactions.pageSize}
      totalRows={answer.transactions.totalRows}
      onPageChange={goToPage}
      onPageSizeChange={setPageSize}
      itemLabel={screen.list.itemLabel}
      isBusy={isLoading}
     />
    }
   />
  </section>
 );
}

function OverviewDomain() {
 const { domain } = useParams();
 const [searchParams] = useSearchParams();
 const monthParam = searchParams.get('month') ?? undefined;

 // Narrowed before the hook, so the request is never composed from a segment
 // the registry does not know. The fallback is never rendered: a hook cannot be
 // called conditionally, and the guard below returns first.
 const domainName: OverviewDomainName = isDomain(domain) ? domain : 'expense';

 const {
  query,
  data,
  analysis,
  isLoading,
  error,
  fullStatus,
  goToPage,
  setPageSize,
  narrowToCategory,
  refetch,
  requestFullAnalysis,
 } = useOverviewDomain(domainName, monthParam);

 if (!isDomain(domain)) {
  return (
   <section className='overviewDomain'>
    <CardTitle>Not a domain</CardTitle>

    <p className='overviewDomain__note'>
     {/* The six are named rather than left for the reader to guess, because a
         mistyped segment is the only way to arrive here. */}
     The overview breaks down into{' '}
     {Object.values(DOMAIN_SCREENS)
      .map((screen) => screen.label)
      .join(', ')
      .toLowerCase()}
     .
    </p>

    <Link className='overviewDomain__back' to='/fintrack/overview'>
     Back to the overview
    </Link>
   </section>
  );
 }

 const label = DOMAIN_SCREENS[domain].label;

 // An answer for another domain is still in hand for one request after the
 // segment changes; it is not this screen's, so it counts as not arrived.
 const hasAnswer = data !== null && isCardOf(data.card, domain);

 // The skeleton is only for the FIRST answer. A page step with rows already on
 // screen keeps them and marks the pager busy, because replacing a list with a
 // skeleton on every step is the block jumping under the reader's hand.
 const isFirstLoad = isLoading && !hasAnswer;

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

 if (!data || !isCardOf(data.card, domain)) return null;

 return (
  <DomainView
   domain={domain}
   card={data.card}
   answer={data}
   analysis={analysis}
   isLoading={isLoading}
   fullStatus={fullStatus}
   selectedCategory={query.category}
   goToPage={goToPage}
   setPageSize={setPageSize}
   narrowToCategory={narrowToCategory}
   refetch={refetch}
   requestFullAnalysis={requestFullAnalysis}
  />
 );
}

export default OverviewDomain;
