// frontend/src/fintrack/pages/overview/components/TrendCharts.tsx
// The first half of block 07: the six-month trend, one small line chart per
// domain that has a series.
//
// ONLY THREE DOMAINS HAVE ONE. Income, expense and pocket. The other three do
// not carry the key at all, and that is the difference the render respects:
// an absent key says the domain has no series, where an empty array would say
// it has one and it is blank.
//
// NO CHART LIBRARY. The line is one polyline in an inline svg and the markers
// are elements with a position, so var(--token) resolves on both, the values
// stay reachable per month, and the page adds no dependency for a figure that
// is six numbers long. A library earns its place when there is a coordinate
// system to draw; there is none here.
//
// The distribution bar the sketch draws beside this is ParetoBar.tsx, mounted
// under this block by ExpenseByCategory.tsx, with DonutChart.tsx beside it. Both
// waited on a colour scale the design system did not carry;
// --color-scale-category-1..8 now declares one, so the hues are tokens and not
// invented hexes.

import { currencyFormat } from '../../../helpers/functions';
import { CardTitle } from '../../../general_components/CardTitle';
import CollapsibleBlock from './CollapsibleBlock';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import { monthLabel } from '../helpers/monthLabel';
import { OverviewTrendPoint } from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// The plot is drawn in a 0-100 box on both axes and stretched to the card, so
// these are percentages of the plot height, not lengths. The band leaves room
// at both ends for the stroke and the marker, which are drawn in real pixels
// and would otherwise be cut in half by the edge of the box.
const PLOT_PADDING = 10;
const PLOT_BAND = 100 - PLOT_PADDING * 2;

// THE THREE ARE NOT THE SAME KIND OF QUANTITY, and the nature says so on each
// chart the way it does on each domain card above. Income and expense are sums
// over the month; the pocket series is the committed total AT THE CLOSE of each
// month, cumulative by construction (MONTHLY_ALLOCATED_QUERY), so its line rises
// with the ledger rather than tracking a month's decisions. A reader comparing
// three curves has to be told which one is a running total.
//
// The pocket label was 'Saving' and named neither the figure nor its nature.
// Money in a pocket is not saved anywhere: a pocket is a plan, the balance never
// leaves the bank account it was promised from, and the goals card states the
// same figure under the same words.
const SERIES: {
 key: 'income' | 'expense' | 'pocket';
 label: string;
 nature: 'flow' | 'position';
}[] = [
 { key: 'income', label: 'Income', nature: 'flow' },
 { key: 'expense', label: 'Expense', nature: 'flow' },
 { key: 'pocket', label: 'Committed to pockets', nature: 'position' },
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
//
// The scale starts at zero rather than at the smallest month, so the height of
// a point is the size of the figure and not its rank inside the window.
const ratioOf = (value: number, peak: number) => {
 if (peak <= 0) return 0;

 return Math.abs(value) / peak;
};

// The signed scale runs from the lowest month to the highest with zero always
// inside it, so a loss sits under the zero line instead of at a gain's height.
const signedRatioOf = (value: number, floor: number, ceiling: number) => {
 const span = ceiling - floor;

 if (span <= 0) return 0;

 return (value - floor) / span;
};

// 'Aug 25'. Thirteen months name the same month at both ends, so a sparse axis
// carries the year.
const shortMonthYear = (month: string) => {
 const [year, monthNumber] = month.split('-').map(Number);

 return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
  month: 'short',
  year: '2-digit',
 });
};

// A month sits at the CENTRE of its share of the width, not at a division of
// it. The axis below is a row of equal cells with the name centred in each, so
// dividing the width by the gaps instead would put the first point on the left
// edge of the card and its month name half a cell away from it.
const positionX = (index: number, count: number) =>
 ((index + 0.5) / count) * 100;

// Exported for the level-2 screen, which draws one domain's curve where this
// block draws three against each other. It was prop-driven already, so the
// export is the whole of the change: a second implementation of the same
// polyline is how two screens end up disagreeing about the same six numbers.
export const TrendChart = ({
 label,
 nature,
 points,
 currency,
 isSigned = false,
 axis = 'every',
}: {
 label: string;
 nature: 'flow' | 'position';
 points: OverviewTrendPoint[];
 currency: string;
 // Draws the value with its sign and a dashed zero line. Off by default, so the
 // level-1 block keeps plotting magnitudes.
 isSigned?: boolean;
 // 'sparse' names the first, middle and last month only: thirteen names do not
 // fit a 360px row.
 axis?: 'every' | 'sparse';
}) => {
 const peak = Math.max(...points.map((point) => Math.abs(point.value)), 0);
 const floor = Math.min(...points.map((point) => point.value), 0);
 const ceiling = Math.max(...points.map((point) => point.value), 0);

 const zeroY = PLOT_PADDING + (1 - signedRatioOf(0, floor, ceiling)) * PLOT_BAND;

 const middleIndex = Math.floor((points.length - 1) / 2);
 const isNamed = (index: number) =>
  axis === 'every' ||
  index === 0 ||
  index === middleIndex ||
  index === points.length - 1;

 const plotted = points.map((point, index) => {
  const ratio = isSigned
   ? signedRatioOf(point.value, floor, ceiling)
   : ratioOf(point.value, peak);

  return {
   month: point.month,
   x: positionX(index, points.length),
   // The svg y axis grows downward and the marker is placed from the bottom,
   // so the same ratio is read from opposite ends of the band.
   y: PLOT_PADDING + (1 - ratio) * PLOT_BAND,
   bottom: PLOT_PADDING + ratio * PLOT_BAND,
   title: `${shortMonth(point.month)}: ${currencyFormat(
    currency,
    point.value,
    formatNumberCountry,
   )}`,
  };
 });

 return (
  <article className='trendChart'>
   {/* The same head the domain cards carry: the name on the left and the
       nature on the right. Its own label class and not .domainCard__label,
       which capitalises every word - correct for a one-word domain name and
       wrong for a phrase. */}
   <div className='domainCard__head'>
    <span className='trendChart__label'>{label}</span>
    <span className='domainCard__scope'>{nature}</span>
   </div>

   {/* The markers carry the figure as a title, which only a pointer can reach:
       they are not focusable and a title is not announced on its own. So the
       plot names itself with the whole series, which is the one reading a
       screen reader and a keyboard both get. */}
   <div
    className='trendChart__plot'
    role='img'
    aria-label={`${label}, ${
     nature === 'flow' ? 'per month' : 'at each month end'
    }, last ${points.length} months${
     isSigned ? ', months under the dashed line are below zero' : ''
    }. ${plotted.map((point) => point.title).join('. ')}`}
   >
    {/* Stretched to the card on both axes, which is why the stroke is drawn
        at a fixed width instead of in box units: a scaled stroke would be
        thicker on a wide card than on a narrow one. */}
    <svg
     className='trendChart__line'
     viewBox='0 0 100 100'
     preserveAspectRatio='none'
     aria-hidden='true'
    >
     {isSigned && (
      <line
       className='trendChart__zero'
       vectorEffect='non-scaling-stroke'
       x1='0'
       x2='100'
       y1={zeroY}
       y2={zeroY}
      />
     )}
     <polyline
      className='trendChart__stroke'
      vectorEffect='non-scaling-stroke'
      points={plotted.map((point) => `${point.x},${point.y}`).join(' ')}
     />
    </svg>

    {/* The markers are elements and not svg circles because the box is
        stretched: a circle in box units would come out as an ellipse. They
        also carry the figure a point stands for, for a reader who cannot see
        the line. The chart is not decoration, so it is not aria-hidden. */}
    <div className='trendChart__markers'>
     {plotted.map((point) => (
      <span
       className='trendChart__marker'
       key={point.month}
       style={{ left: `${point.x}%`, bottom: `${point.bottom}%` }}
       title={point.title}
      />
     ))}
    </div>
   </div>

   {/* Every cell stays in a sparse axis, so a name keeps sitting under its point. */}
   <div
    className={`trendChart__axis${
     axis === 'sparse' ? ' trendChart__axis--sparse' : ''
    }`}
   >
    {points.map((point, index) => (
     <span key={point.month}>
      {!isNamed(index)
       ? null
       : axis === 'sparse'
       ? shortMonthYear(point.month)
       : shortMonth(point.month)}
     </span>
    ))}
   </div>
  </article>
 );
};

function TrendCharts() {
 const charts = useOverviewStore((state) => state.charts);
 const domainCards = useOverviewStore((state) => state.domainCards);
 const referenceMonth = useOverviewStore((state) => state.referenceMonth);

 if (!charts) return null;

 // Every figure on the page is stored in the accounting currency, and the cards
 // publish it per domain. Taken from the income card rather than hard-coded so
 // the tooltip cannot name a currency the figures are not in.
 const currency = domainCards?.income.currency ?? DEFAULT_CURRENCY;

 const drawn = SERIES.filter(({ key }) => charts.trend[key] !== undefined);

 if (drawn.length === 0) return null;

 // The window's length as served, never a literal 6: the subtitle names the
 // months the charts actually draw.
 const monthCount = Math.max(
  ...drawn.map(({ key }) => (charts.trend[key] as OverviewTrendPoint[]).length),
 );

 // The block folds WHOLE and the three charts inside it do not fold one by
 // one, which is the difference Carlos drew between this and the domain cards:
 // three curves are read against each other, and a reader who closed one of
 // them would be comparing two things while looking at a block that says three.
 return (
  <CollapsibleBlock
   head={
    <CardTitle
     subtitle={`${monthCount} months to ${monthLabel(referenceMonth)}`}
    >
     Trend
    </CardTitle>
   }
   isRuled
  >
   <section className='domainCards'>
    {drawn.map(({ key, label, nature }) => (
     <TrendChart
      key={key}
      label={label}
      nature={nature}
      points={charts.trend[key] as OverviewTrendPoint[]}
      currency={currency}
     />
    ))}
   </section>
  </CollapsibleBlock>
 );
}

export default TrendCharts;
