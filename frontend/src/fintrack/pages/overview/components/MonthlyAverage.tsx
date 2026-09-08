// frontend/src/fintrack/pages/overview/components/MonthlyAverage.tsx
// One card per movement: the monthly average, the months it averages over, the
// calendar year to date and how the month compares against the average.
//
// The four figures are read from the monthly snapshot the /overview payload
// already carries. They used to be computed in the browser from a second
// request to url_monthly_TotalAmount_ByType, which was that endpoint's only
// caller, so the page now issues one request fewer and the card cannot disagree
// with the cards above it: both are cut against the same resolved month.
//
// The factor of -1 the previous version applied to income is deliberately NOT
// carried over. It belonged to the other endpoint, whose income rows come off
// the source account and therefore arrive negative. MONTHLY_INCOME_QUERY sums
// the destination leg over the owner's money accounts, so income arrives
// positive here and negating it would invert the card.

import { currencyFormat } from '../../../helpers/functions';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import {
 MonthlySnapshot,
 MonthlySnapshotDomain,
} from '../../../types/overviewTypes';

// The locale is the reader's, never the amount's. Taken from the amount's own
// currency, Intl leaves every currency unmarked and the dollar, the Colombian
// peso and the Mexican peso all narrow to '$'.
const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// Rendered when a figure did not arrive. Never a 0: a withheld average is one
// the server refused to invent, not one that came to nothing.
const NO_FIGURE = '—';

// The three cards, in render order, each with the word it carries on screen.
// 'saving' is the label and 'pocket' is the domain: the figure is the month's
// net committed to pockets, which the pocket board names after the pocket while
// this page has always labelled it saving.
const CARDS: { domain: MonthlySnapshotDomain; label: string }[] = [
 { domain: 'income', label: 'income' },
 { domain: 'expense', label: 'expense' },
 { domain: 'pocket', label: 'saving' },
];

// Which direction of the variance asks something of the owner. Spending more
// than usual does; earning less than usual and committing less to pockets than
// usual do. There is no threshold in play, so the square is binary against the
// mean rather than graded — that is what separates it from the budget squares,
// which read a threshold crossed.
const ADVERSE_ABOVE_AVERAGE: Record<MonthlySnapshotDomain, boolean> = {
 income: false,
 expense: true,
 pocket: false,
};

const varianceSquare = (
 domain: MonthlySnapshotDomain,
 variance: number | null,
) => {
 // No average to compare against, or a month exactly on it. Neither is a
 // reading, and the square says so instead of picking a side.
 if (variance === null || variance === 0) return 'neutral';

 return variance > 0 === ADVERSE_ABOVE_AVERAGE[domain] ? 'alert' : 'ahead';
};

// Intl marks the negative and leaves the positive bare, and a variance is read
// by its sign before its digits. Without the plus, a month above the average
// and a month at the average print alike but for the figure.
const signedAmount = (value: number, currency: string) => {
 const formatted = currencyFormat(currency, value, formatNumberCountry);

 return value > 0 ? `+${formatted}` : formatted;
};

function MonthlyAverage() {
 const monthlySnapshot = useOverviewStore((state) => state.monthlySnapshot);

 const renderCard = (domain: MonthlySnapshotDomain, label: string) => {
  const snapshot: MonthlySnapshot | null =
   monthlySnapshot?.find((entry) => entry.domain === domain) ?? null;

  // The card names its currency in the title, so it needs one before the
  // payload lands. The application's own choice stands in until then.
  const currency = snapshot?.currency ?? DEFAULT_CURRENCY;
  const variance = snapshot?.varianceVsAverage ?? null;

  return (
   <div
    className='monthly__card tile__container tile__container__col tile__container__col--goalInfo '
    key={domain}
   >
    <article className=''>
     <div className='tile__subtitle letterSpaceSmall '>
      {`Monthly ${label} (Avg.) (${currency})`}
     </div>

     {/* The twelve-month average and not the three-month one, because the
         variance below it is measured against the twelve. Putting one window's
         average over another window's comparison would be two figures on one
         card that do not relate. */}
     <div className='tile__title '>
      {snapshot === null || snapshot.activeMonthAverage12m === null
       ? NO_FIGURE
       : `${currencyFormat(
          currency,
          snapshot.activeMonthAverage12m,
          formatNumberCountry,
         )} (m:${snapshot.activeMonths12m})`}
     </div>

     <div className='monthlyAverage__year'>
      <span className='monthlyAverage__year-label'>Year to date</span>
      <span className='monthlyAverage__year-amount'>
       {snapshot === null
        ? NO_FIGURE
        : currencyFormat(currency, snapshot.yearToDate, formatNumberCountry)}
      </span>
     </div>

     <div className='tile__status__container flx-row-start '>
      <StatusSquare alert={varianceSquare(domain, variance)} />
      <span className='tile__subtitle tile__status--goal'>
       {variance === null
        ? NO_FIGURE
        : `${signedAmount(variance, currency)} vs 12m avg.`}
      </span>
     </div>
    </article>
   </div>
  );
 };

 return (
  <div className='tiles__container flx-row-sb '>
   {CARDS.map(({ domain, label }) => renderCard(domain, label))}
  </div>
 );
}

export default MonthlyAverage;
