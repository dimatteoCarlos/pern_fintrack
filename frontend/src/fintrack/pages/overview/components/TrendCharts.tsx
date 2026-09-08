// frontend/src/fintrack/pages/overview/components/TrendCharts.tsx
// The first half of block 07: the six-month trend, one small column chart per
// domain that has a series.
//
// ONLY THREE DOMAINS HAVE ONE. Income, expense and pocket. The other three do
// not carry the key at all, and that is the difference the render respects:
// an absent key says the domain has no series, where an empty array would say
// it has one and it is blank.
//
// NO CHART LIBRARY. The columns are elements with a height, so var(--token)
// resolves on them, the values stay in the accessibility tree, and the page
// adds no dependency for a figure that is six numbers long. A library earns its
// place when there is a coordinate system to draw; there is none here.
//
// The distribution bar the sketch draws beside this is NOT here. It needs a
// five-step categorical ramp, and the design system has no ramp token — the
// rule is to ask rather than invent one, so that half waits on the answer.

import { currencyFormat } from '../../../helpers/functions';
import { CardTitle } from '../../../general_components/CardTitle';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import { OverviewTrendPoint } from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// The floor a column is drawn at when its month is zero. Not 0%: a column of no
// height is indistinguishable from a month the series does not cover, and the
// series covers every month it publishes.
const EMPTY_COLUMN_HEIGHT = 2;

const SERIES: { key: 'income' | 'expense' | 'pocket'; label: string }[] = [
 { key: 'income', label: 'Income' },
 { key: 'expense', label: 'Expense' },
 { key: 'pocket', label: 'Saving' },
];

// 'YYYY-MM' to 'Apr'. The trend months are month-precision, unlike the card
// windows, so there is no day to drop.
const shortMonth = (month: string) => {
 const [year, monthNumber] = month.split('-').map(Number);

 return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
  month: 'short',
 });
};

// Scaled against the largest month IN THIS SERIES, not against a scale shared
// across the three: income and expense differ by an order of magnitude for most
// owners, and a shared scale would flatten the smaller one into the axis. Each
// chart therefore answers "how did this domain move", never "which domain is
// bigger" — a question the three cards above already answer with figures.
const columnHeight = (value: number, peak: number) => {
 if (peak <= 0) return EMPTY_COLUMN_HEIGHT;

 return Math.max(EMPTY_COLUMN_HEIGHT, (Math.abs(value) / peak) * 100);
};

const TrendChart = ({
 label,
 points,
 currency,
}: {
 label: string;
 points: OverviewTrendPoint[];
 currency: string;
}) => {
 const peak = Math.max(...points.map((point) => Math.abs(point.value)), 0);

 return (
  <article className='trendChart'>
   <div className='domainCard__label'>{label} · 6 months</div>

   <div className='trendChart__plot'>
    {points.map((point) => (
     <div
      className='trendChart__column'
      key={point.month}
      style={{ height: `${columnHeight(point.value, peak)}%` }}
      /* The figure a column stands for, for a reader who cannot see the
         height. The chart is not decoration, so it is not aria-hidden. */
      title={`${shortMonth(point.month)}: ${currencyFormat(
       currency,
       point.value,
       formatNumberCountry,
      )}`}
     />
    ))}
   </div>

   <div className='trendChart__axis'>
    {points.map((point) => (
     <span key={point.month}>{shortMonth(point.month)}</span>
    ))}
   </div>
  </article>
 );
};

function TrendCharts() {
 const charts = useOverviewStore((state) => state.charts);
 const domainCards = useOverviewStore((state) => state.domainCards);

 if (!charts) return null;

 // Every figure on the page is stored in the accounting currency, and the cards
 // publish it per domain. Taken from the income card rather than hard-coded so
 // the tooltip cannot name a currency the figures are not in.
 const currency = domainCards?.income.currency ?? DEFAULT_CURRENCY;

 const drawn = SERIES.filter(({ key }) => charts.trend[key] !== undefined);

 if (drawn.length === 0) return null;

 return (
  <>
   <div className='presentation__card__title__container flx-row-sb'>
    <CardTitle>Trend</CardTitle>
   </div>

   <section className='domainCards'>
    {drawn.map(({ key, label }) => (
     <TrendChart
      key={key}
      label={label}
      points={charts.trend[key] as OverviewTrendPoint[]}
      currency={currency}
     />
    ))}
   </section>
  </>
 );
}

export default TrendCharts;
