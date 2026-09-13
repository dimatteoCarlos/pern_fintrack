// frontend/src/fintrack/pages/overview/domains/DebtLegsChart.tsx
//
// The two debt legs at each month close, as two charts on ONE scale and one ink
// (P5-6). Not TrendChart: that scales each series to its own peak, inked for the dark ground.

import { monthLabel } from '../helpers/monthLabel';
import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { OverviewDebtLegsPoint } from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// Percent of the plot box, inset as TrendCharts.tsx does so no stroke is cut at the edge.
const PLOT_PADDING = 10;
const PLOT_BAND = 100 - PLOT_PADDING * 2;
const FLOOR_Y = PLOT_PADDING + PLOT_BAND;

const NO_FIGURE = '—';

// Receivable first, as the mockup draws them; the words are the level-1 card's.
// The tone colours the figure only, as on the counterparty rows; the plots keep one ink.
const LEGS: {
 key: 'receivable' | 'payable';
 label: string;
 spoken: string;
 tone: 'positive' | 'negative';
}[] = [
 { key: 'receivable', label: 'You’re owed', spoken: 'Money owed to you', tone: 'positive' },
 { key: 'payable', label: 'You owe', spoken: 'Money you owe', tone: 'negative' },
];

// A point at the centre of its cell, so it sits over its month name.
const positionX = (index: number, count: number) => ((index + 0.5) / count) * 100;

type DebtLegsChartProps = {
 // Null while pending: the words and the boxes are drawn and only the figures wait.
 legs: OverviewDebtLegsPoint[] | null;
 currency: string;
};

function DebtLegsChart({ legs, currency }: DebtLegsChartProps) {
 const formatAmount = (value: number | undefined) =>
  value === undefined || !Number.isFinite(value)
   ? NO_FIGURE
   : currencyFormat(currency, value, formatNumberCountry);

 // SHARED peak, from zero: the question is whether one leg outgrew the other,
 // which per-series scales would hide (OVERVIEW_CHART_TECHNIQUE.md §11).
 const peak = Math.max(
  ...(legs ?? []).flatMap((point) => [Math.abs(point.receivable), Math.abs(point.payable)]),
  0,
 );

 const last = legs?.[legs.length - 1];
 const middleIndex = legs === null ? 0 : Math.floor((legs.length - 1) / 2);
 const isNamed = (index: number, count: number) =>
  index === 0 || index === middleIndex || index === count - 1;

 return (
  <div className='debtLegs'>
   <p className='debtLegs__lede'>Same scale on both charts. Never netted.</p>

   <div className='debtLegs__grid'>
    {LEGS.map((leg) => {
     const plotted = (legs ?? []).map((point, index, points) => {
      const ratio = peak <= 0 ? 0 : Math.abs(point[leg.key]) / peak;

      return {
       month: point.month,
       x: positionX(index, points.length),
       y: PLOT_PADDING + (1 - ratio) * PLOT_BAND,
       bottom: PLOT_PADDING + ratio * PLOT_BAND,
       title: `${monthLabel(point.month, 'short')}: ${formatAmount(point[leg.key])}`,
      };
     });

     return (
      <div className='debtLegs__leg' key={leg.key}>
       <div className='debtLegs__head'>
        <span className='debtLegs__label'>{leg.label}</span>
        {legs === null ? (
         <span className='domainAnalysis__skeleton domainAnalysis__skeleton--amount' />
        ) : (
         <span className={`debtLegs__value debtLegs__value--${leg.tone}`}>
          {formatAmount(last?.[leg.key])}
         </span>
        )}
       </div>

       {legs === null ? (
        <span className='domainAnalysis__skeleton debtLegs__pending' />
       ) : (
        // The plot names every figure: the markers' titles reach only a pointer.
        <div
         className='debtLegs__plot'
         role='img'
         aria-label={`${leg.spoken} at each month close, last ${legs.length} months, on the same scale as the other chart. ${plotted
          .map((point) => point.title)
          .join('. ')}`}
        >
         <svg
          className='debtLegs__line'
          viewBox='0 0 100 100'
          preserveAspectRatio='none'
          aria-hidden='true'
          focusable='false'
         >
          <line
           className='debtLegs__baseline'
           vectorEffect='non-scaling-stroke'
           x1='0'
           x2='100'
           y1={FLOOR_Y}
           y2={FLOOR_Y}
          />
          <polyline
           className='debtLegs__stroke'
           vectorEffect='non-scaling-stroke'
           points={plotted.map((point) => `${point.x},${point.y}`).join(' ')}
          />
         </svg>

         {/* Elements and not svg circles: the stretched box would draw ellipses. */}
         <div className='debtLegs__markers'>
          {plotted.map((point) => (
           <span
            className='debtLegs__marker'
            key={point.month}
            style={{ left: `${point.x}%`, bottom: `${point.bottom}%` }}
            title={point.title}
           />
          ))}
         </div>
        </div>
       )}

       {/* First, middle and last month named; every cell stays so names keep their point. */}
       <div className='debtLegs__axis' aria-hidden='true'>
        {legs === null ? (
         <span className='debtLegs__month'>{' '}</span>
        ) : (
         legs.map((point, index) => (
          <span className='debtLegs__month' key={point.month}>
           {isNamed(index, legs.length) ? monthLabel(point.month, 'short') : null}
          </span>
         ))
        )}
       </div>
      </div>
     );
    })}
   </div>
  </div>
 );
}

export default DebtLegsChart;
