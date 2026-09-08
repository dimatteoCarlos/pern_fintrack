// frontend/src/fintrack/pages/overview/components/MonthlySnapshot.tsx
// Block 05: the month measured against its own history, one card per domain.
// Built to propuesta-snapshot-mensual.html, which this replaces MonthlyAverage
// with - the same three figures the old tile printed, plus the two baselines and
// the deviation square it did not.
//
// THE SQUARE IS THE SIGNATURE INDICATOR and it carries a THREE-state reading,
// not two. Without a dead band any cent of difference lights it and the mark
// stops meaning anything, so a month inside 15% of its own twelve-month mean is
// normal, 15% to 40% is worth a look, and past 40% is loud.
//
// POLARITY IS PER DOMAIN. Spending more than usual is the bad direction;
// earning more and saving more are the good one. A favourable month is calm at
// any size, because there is nothing to warn about in a good month - the band
// only grades the unfavourable side.
//
// NO NEW TOKENS. The three tiers are --color-status-ok, --color-status-warning
// and --color-status-alert, which measure 5.13:1, 6.15:1 and 5.70:1 against
// --color-surface-app, so each is legible as text and not only as a square. The
// sketch drew two further ochres of its own; the system already has one
// calibrated for exactly this meaning and a second would be an unmeasured value
// carrying the same intent.

import { currencyFormat } from '../../../helpers/functions';
import { CardTitle } from '../../../general_components/CardTitle';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import {
 MonthlySnapshot as MonthlySnapshotRow,
 MonthlySnapshotDomain,
} from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

const NO_FIGURE = '—';

// Inside this share of the twelve-month mean the month is ordinary. Below it
// the indicator would fire on rounding.
const NORMAL_BAND = 0.15;
// Past this share the deviation stops being worth a look and becomes loud.
const LOUD_BAND = 0.4;

// How many months each window holds, which is what the active count is read
// against: an average over one active month out of twelve is a different claim
// from one over twelve, and the two print the same number.
const WINDOW_MONTHS = { m3: 3, m12: 12 };

// Spending above the typical month is the bad direction; earning and saving
// above it are the good one. Nothing else about the three domains differs here.
const FAVOURABLE_WHEN_ABOVE: Record<MonthlySnapshotDomain, boolean> = {
 income: true,
 expense: false,
 pocket: true,
};

const DOMAIN_LABEL: Record<MonthlySnapshotDomain, string> = {
 income: 'Income',
 expense: 'Expense',
 pocket: 'Saving',
};

const money = (currency: string, value: number) =>
 currencyFormat(currency, value, formatNumberCountry);

// 'YYYY-MM-01' to 'Sep 2026'. Split and rebuilt rather than passed to the Date
// constructor: 'YYYY-MM-01' parses as UTC midnight, which is the previous month
// for every reader west of Greenwich.
const monthLabel = (month: string | null) => {
 if (!month) return NO_FIGURE;

 const [year, monthNumber] = month.split('-').map(Number);

 return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
  month: 'short',
  year: 'numeric',
 });
};

type Tier = 'calm' | 'watch' | 'alert' | 'unknown';

// The tier is read against the TWELVE-month mean and never the three: a month
// compared to a mean that already moves fast cannot say whether it is unusual.
const tierOf = (row: MonthlySnapshotRow): Tier => {
 const { varianceVsAverage, activeMonthAverage12m } = row;

 // Null and 0 are different answers. Null is no comparable month, which the
 // square says by being empty rather than by being calm - painting it calm
 // would assert something nobody measured.
 if (varianceVsAverage === null || !activeMonthAverage12m) return 'unknown';

 const favourable =
  varianceVsAverage === 0 ||
  varianceVsAverage > 0 === FAVOURABLE_WHEN_ABOVE[row.domain];

 if (favourable) return 'calm';

 const share = Math.abs(varianceVsAverage) / Math.abs(activeMonthAverage12m);

 if (share <= NORMAL_BAND) return 'calm';
 if (share <= LOUD_BAND) return 'watch';

 return 'alert';
};

const againstLine = (variance: number | null) => {
 if (variance === null) return 'no comparable month yet';
 if (variance === 0) return 'at the typical active month';

 return variance > 0
  ? 'above the typical active month'
  : 'below the typical active month';
};

const Baseline = ({
 label,
 value,
 currency,
 activeMonths,
 windowMonths,
}: {
 label: string;
 value: number | null;
 currency: string;
 activeMonths: number;
 windowMonths: number;
}) => (
 <div className='snapshot__baseline'>
  <span className='snapshot__label'>{label}</span>
  <span className='snapshot__figure'>
   {value === null ? NO_FIGURE : money(currency, value)}
  </span>
  {/* The denominator, because the mean hides it. An average over one active
      month and one over twelve print the same way and are not the same claim. */}
  <span className='snapshot__weight'>
   {activeMonths} of {windowMonths} active
  </span>
 </div>
);

const SnapshotCard = ({
 row,
 month,
}: {
 row: MonthlySnapshotRow;
 month: string | null;
}) => {
 const tier = tierOf(row);

 return (
  <article className='snapshot'>
   <div className='snapshot__head'>
    <span className='snapshot__domain'>{DOMAIN_LABEL[row.domain]}</span>
    <span className='snapshot__period'>{monthLabel(month)}</span>
   </div>

   <div className='snapshot__actual'>
    {money(row.currency, row.domainMonthlyActual)}
   </div>

   {/* The square and the figure are one statement, so they share a row and the
       square never appears without it. Both take the tier, unlike the sketch
       which gave them different ones: one reading gets one colour. */}
   <div className='snapshot__variance'>
    <span className={`statusSquare statusSquare--${tier}`} />
    <span className={`snapshot__delta snapshot__delta--${tier}`}>
     {row.varianceVsAverage === null
      ? NO_FIGURE
      : `${row.varianceVsAverage > 0 ? '+' : ''}${money(
         row.currency,
         row.varianceVsAverage,
        )}`}
    </span>
    <span className='snapshot__against'>
     {againstLine(row.varianceVsAverage)}
    </span>
   </div>

   <div className='snapshot__baselines'>
    <Baseline
     label='Active mean · 3m'
     value={row.activeMonthAverage3m}
     currency={row.currency}
     activeMonths={row.activeMonths3m}
     windowMonths={WINDOW_MONTHS.m3}
    />
    <Baseline
     label='Active mean · 12m'
     value={row.activeMonthAverage12m}
     currency={row.currency}
     activeMonths={row.activeMonths12m}
     windowMonths={WINDOW_MONTHS.m12}
    />
    <div className='snapshot__baseline'>
     <span className='snapshot__label'>Year to date</span>
     <span className='snapshot__figure'>
      {money(row.currency, row.yearToDate)}
     </span>
     {/* Opposite rule to the two means on purpose: every month of the year
         counts, active or not, because a total has no denominator to protect. */}
     <span className='snapshot__weight'>every month counted</span>
    </div>
   </div>
  </article>
 );
};

function MonthlySnapshot() {
 const monthlySnapshot = useOverviewStore((state) => state.monthlySnapshot);
 const referenceMonth = useOverviewStore((state) => state.referenceMonth);

 // Nothing has arrived yet. The layout above owns the skeleton and the error
 // with its retry, so an empty block here is the whole of this component's
 // loading state rather than a second spinner beside that one.
 if (!monthlySnapshot || monthlySnapshot.length === 0) return null;

 return (
  <>
   <div className='presentation__card__title__container flx-row-sb'>
    <CardTitle subtitle='Each month against the months that had activity, its own year to date beside it'>
     Monthly snapshot
    </CardTitle>
   </div>

   <section className='domainCards'>
    {monthlySnapshot.map((row) => (
     <SnapshotCard key={row.domain} row={row} month={referenceMonth} />
    ))}
   </section>
  </>
 );
}

export default MonthlySnapshot;
