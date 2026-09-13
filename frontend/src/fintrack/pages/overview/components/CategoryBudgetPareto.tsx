// frontend/src/fintrack/pages/overview/components/CategoryBudgetPareto.tsx
// Level 2 expense: the Pareto of the month against its budget. Bars are spent
// and budget per category in the server's spend ranking; the two lines are the
// served running shares of spending and of budget. Month window only: a YTD
// reading needs its own server field (D40).
//
// Hand-drawn SVG, no chart library: every ink is a class reading a token.

import { useEffect, useRef, useState } from 'react';

import CollapsibleBlock from './CollapsibleBlock';
import { CardTitle } from '../../../general_components/CardTitle';
import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import {
 BUDGET_NEAR_LIMIT_PERCENT,
 budgetStatusLevel,
} from '../../../helpers/budgetStatus';
import { monthLabel } from '../helpers/monthLabel';
import { countNoun, percent } from '../helpers/rankedBreakdown';
import {
 OverviewCategoryBudgetExecution,
 OverviewExpenseCard,
 OverviewExpenseCategory,
} from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// Drawing geometry in SVG user units, drawn 1:1 so text keeps its token size.
const PLOT_HEIGHT = 260;
// Below this a category's labels overlap, so the chart scrolls instead.
const MIN_GROUP_WIDTH = 48;
const MIN_BAR_WIDTH = 15;
const MAX_BAR_WIDTH = 32;
const BAR_SHARE_OF_GROUP = 0.3;
const BAR_GAP = 2;
const PAD_LEFT = 68;
const PAD_RIGHT = 52;
const PAD_TOP = 36;
// Room under the plot for a name written flat, and the cap for rotated ones.
const PAD_BOTTOM_FLAT = 28;
const PAD_BOTTOM_MAX = 160;
// An estimate of one character at --font-size-xs, used only to decide whether
// the names fit flat and how much room a rotated one needs.
const CHAR_WIDTH = 7;
const LABEL_OFFSET = 6;
const POINT_RADIUS = 3;
const MONEY_TICKS = 5;
const SHARE_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];
const CONCENTRATION_MARK = 0.8;

// The axis top: the tallest bar rounded up to 1, 2, 2.5 or 5 times a power of
// ten, so the five ticks land on readable amounts.
const axisCeiling = (value: number) => {
 if (value <= 0) return 1;
 const magnitude = 10 ** Math.floor(Math.log10(value));
 const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
 return step * magnitude;
};

const categoryLabel = (category: OverviewExpenseCategory) =>
 category.isOverBudget === true
  ? `${category.categoryName} · over`
  : category.categoryName;

type CategoryBudgetParetoProps = {
 categories: OverviewExpenseCategory[];
 // Null from a backend older than the field: the rate is then not shown.
 execution: OverviewCategoryBudgetExecution | null;
 card: OverviewExpenseCard;
 // 'YYYY-MM-01', the month the title names.
 referenceMonth: string | null;
};

function CategoryBudgetPareto({
 categories,
 execution,
 card,
 referenceMonth,
}: CategoryBudgetParetoProps) {
 // The width the chart may fill. 0 until the box is measured, which draws at
 // the minimum group width for one frame.
 const scrollRef = useRef<HTMLDivElement>(null);
 const [availableWidth, setAvailableWidth] = useState(0);

 useEffect(() => {
  const box = scrollRef.current;
  if (!box) return;
  const observer = new ResizeObserver(([entry]) =>
   setAvailableWidth(entry.contentRect.width),
  );
  observer.observe(box);
  return () => observer.disconnect();
 }, [categories]);

 if (categories.length === 0) return null;

 const money = (value: number) =>
  currencyFormat(card.currency, value, formatNumberCountry);

 // The chart ends where spending reaches 100%: a category with no spending
 // adds no bar and no step to the line. Mixed-currency rows (null) have no
 // spending to draw either. The totals below still read every category.
 const drawn = categories.filter((c) => (c.actualSpent ?? 0) > 0);
 const notDrawnCount = categories.length - drawn.length;

 const ceiling = axisCeiling(
  Math.max(
   0,
   ...drawn.map((c) => Math.max(c.actualSpent ?? 0, c.budgetAmount ?? 0)),
  ),
 );

 // Few categories share the box's width; many keep the minimum and scroll.
 const groupWidth = Math.max(
  MIN_GROUP_WIDTH,
  drawn.length > 0
   ? Math.floor((availableWidth - PAD_LEFT - PAD_RIGHT) / drawn.length)
   : 0,
 );
 const barWidth = Math.min(
  MAX_BAR_WIDTH,
  Math.max(MIN_BAR_WIDTH, groupWidth * BAR_SHARE_OF_GROUP),
 );

 // Names are written flat when the longest fits its group, rotated otherwise,
 // and the room under the plot follows the longest name either way.
 const longestLabel =
  Math.max(0, ...drawn.map((c) => categoryLabel(c).length)) * CHAR_WIDTH;
 const rotateLabels = longestLabel > groupWidth - LABEL_OFFSET;
 const padBottom = rotateLabels
  ? Math.min(
     PAD_BOTTOM_MAX,
     Math.ceil(longestLabel * Math.SQRT1_2) + LABEL_OFFSET * 4,
    )
  : PAD_BOTTOM_FLAT;

 const width = PAD_LEFT + drawn.length * groupWidth + PAD_RIGHT;
 const height = PAD_TOP + PLOT_HEIGHT + padBottom;
 const plotBottom = PAD_TOP + PLOT_HEIGHT;
 const plotRight = width - PAD_RIGHT;

 const yMoney = (value: number) =>
  PAD_TOP + PLOT_HEIGHT * (1 - value / ceiling);
 const yShare = (share: number) => PAD_TOP + PLOT_HEIGHT * (1 - share);
 const xCenter = (index: number) =>
  PAD_LEFT + groupWidth * index + groupWidth / 2;
 // Where a bar's rotated amount ends upwards, its length estimated per character.
 const amountTop = (value: number) =>
  yMoney(value) - LABEL_OFFSET - money(value).length * CHAR_WIDTH;

 const spentLine = drawn
  .map((c, i) => `${xCenter(i)},${yShare(c.cumulativePercentage)}`)
  .join(' ');
 // Ends below 100% when categories with budget and no spending exist: the
 // gap is the budget they hold.
 const budgetLine = drawn
  .map((c, i) => `${xCenter(i)},${yShare(c.cumulativeBudgetPercentage)}`)
  .join(' ');

 // The last row's running figures are the month's totals over the ranked set.
 const last = categories[categories.length - 1];
 const spentTotal = last.cumulativeActual;
 const budgetTotal = last.cumulativeBudget;
 const overCount = categories.filter((c) => c.isOverBudget === true).length;

 // Served: categorized spending over the same categories' budget.
 const executionRate = execution?.executionPercentage ?? null;
 // The same three levels and threshold the budget screens paint.
 const rateLevel = budgetStatusLevel(
  executionRate,
  execution?.isOverBudget ?? false,
 );
 const remaining = execution?.remainingBudget ?? 0;

 const finding =
  rateLevel === 'over'
   ? `Categorized spending passed the month's budget by ${money(-remaining)}.`
   : rateLevel === 'near'
    ? `Categorized spending reached ${BUDGET_NEAR_LIMIT_PERCENT}% or more of the budget, with ${money(remaining)} left.`
    : `Categorized spending is within the budget, with ${money(remaining)} left.`;

 const uncategorized = card.hasUncategorizedExpense
  ? currencyFormat(
     card.currency,
     card.totalAmount - card.categorizedExpense,
     formatNumberCountry,
    )
  : null;

 return (
  <>
   {drawn.length > 0 && (
    <CollapsibleBlock
     head={
      <CardTitle subtitle={monthLabel(referenceMonth, 'long')}>
       Spending against budget
      </CardTitle>
     }
     isRuled
    >
     <section className='domainCards domainCards--single'>
      <figure className='budgetPareto'>
       <div className='budgetPareto__head'>
        <span className='budgetPareto__total'>{money(spentTotal)}</span>
        <span className='budgetPareto__totalLabel'>
         {`spent of ${money(budgetTotal)} budgeted`}
        </span>
       </div>

       <ul className='budgetPareto__legend'>
        <li className='budgetPareto__key'>
         <span className='budgetPareto__swatch budgetPareto__swatch--spent' />
         Spent
        </li>
        <li className='budgetPareto__key'>
         <span className='budgetPareto__swatch budgetPareto__swatch--budget' />
         Budget
        </li>
        <li className='budgetPareto__key'>
         <span className='budgetPareto__stroke budgetPareto__stroke--spent' />
         Cumulative % of spending
        </li>
        <li className='budgetPareto__key'>
         <span className='budgetPareto__stroke budgetPareto__stroke--budget' />
         Cumulative % of budget
        </li>
       </ul>

       {/* Fills its box; scrolls inside it only when the categories need more
           than the box has. */}
       <div
        ref={scrollRef}
        className='budgetPareto__scroll'
        tabIndex={0}
        role='region'
        aria-label='Spending against budget chart, scrolls sideways'
       >
        <svg
         className='budgetPareto__chart'
         width={width}
         height={height}
         viewBox={`0 0 ${width} ${height}`}
         role='img'
         aria-label={`Spent and budget for the ${drawn.length} categories with spending, ranked by spending`}
        >
         {Array.from({ length: MONEY_TICKS + 1 }, (_, i) => {
          const value = (ceiling / MONEY_TICKS) * i;
          const y = yMoney(value);
          return (
           <g key={`money-${i}`}>
            <line
             className='budgetPareto__grid'
             x1={PAD_LEFT}
             x2={plotRight}
             y1={y}
             y2={y}
            />
            <text
             className='budgetPareto__axisText'
             x={PAD_LEFT - LABEL_OFFSET}
             y={y}
             textAnchor='end'
             dominantBaseline='middle'
            >
             {money(value)}
            </text>
           </g>
          );
         })}

         {SHARE_TICKS.map((share) => (
          <text
           key={`share-${share}`}
           className='budgetPareto__axisText'
           x={plotRight + LABEL_OFFSET}
           y={yShare(share)}
           dominantBaseline='middle'
          >
           {`${share * 100}%`}
          </text>
         ))}

         <line
          className='budgetPareto__mark'
          x1={PAD_LEFT}
          x2={plotRight}
          y1={yShare(CONCENTRATION_MARK)}
          y2={yShare(CONCENTRATION_MARK)}
         />

         {drawn.map((category, index) => {
          const cx = xCenter(index);
          const spent = category.actualSpent;
          const budget = category.budgetAmount as number | null;
          const spentX = cx - BAR_GAP / 2 - barWidth;
          const budgetX = cx + BAR_GAP / 2;
          const labelY = plotBottom + LABEL_OFFSET * 2;
          const isOver = category.isOverBudget === true;

          return (
           <g key={category.categoryName}>
            <rect
             className='budgetPareto__bar budgetPareto__bar--spent'
             x={spentX}
             y={yMoney(spent)}
             width={barWidth}
             height={plotBottom - yMoney(spent)}
            />
            <text
             className='budgetPareto__valueText'
             x={spentX + barWidth / 2}
             y={yMoney(spent) - LABEL_OFFSET}
             dominantBaseline='middle'
             transform={`rotate(-90 ${spentX + barWidth / 2} ${
              yMoney(spent) - LABEL_OFFSET
             })`}
            >
             {money(spent)}
            </text>

            {budget !== null && budget > 0 && (
             <>
              <rect
               className='budgetPareto__bar budgetPareto__bar--budget'
               x={budgetX}
               y={yMoney(budget)}
               width={barWidth}
               height={plotBottom - yMoney(budget)}
              />
              <text
               className='budgetPareto__valueText budgetPareto__valueText--budget'
               x={budgetX + barWidth / 2}
               y={yMoney(budget) - LABEL_OFFSET}
               dominantBaseline='middle'
               transform={`rotate(-90 ${budgetX + barWidth / 2} ${
                yMoney(budget) - LABEL_OFFSET
               })`}
              >
               {money(budget)}
              </text>
             </>
            )}

            {/* A word and not a colour alone marks the overrun. */}
            <text
             className={`budgetPareto__categoryText${
              isOver ? ' budgetPareto__categoryText--over' : ''
             }`}
             x={cx}
             y={labelY}
             textAnchor={rotateLabels ? 'end' : 'middle'}
             dominantBaseline='middle'
             transform={
              rotateLabels ? `rotate(-45 ${cx} ${labelY})` : undefined
             }
            >
             {categoryLabel(category)}
            </text>
           </g>
          );
         })}

         <polyline
          className='budgetPareto__line budgetPareto__line--budget'
          points={budgetLine}
         />
         <polyline
          className='budgetPareto__line budgetPareto__line--spent'
          points={spentLine}
         />

         {drawn.map((category, index) => {
          const budget = category.budgetAmount as number | null;
          // Centred between the group's two bars, the label crosses both, so
          // it rises above their amounts whenever the point sits among them.
          const shareY = Math.min(
           yShare(category.cumulativePercentage) - LABEL_OFFSET * 1.5,
           amountTop(category.actualSpent) - LABEL_OFFSET,
           budget !== null && budget > 0
            ? amountTop(budget) - LABEL_OFFSET
            : Infinity,
          );

          return (
           <g key={`points-${category.categoryName}`}>
            <circle
             className='budgetPareto__point budgetPareto__point--budget'
             cx={xCenter(index)}
             cy={yShare(category.cumulativeBudgetPercentage)}
             r={POINT_RADIUS}
            />
            <circle
             className='budgetPareto__point budgetPareto__point--spent'
             cx={xCenter(index)}
             cy={yShare(category.cumulativePercentage)}
             r={POINT_RADIUS}
            />
            <text
             className='budgetPareto__shareText'
             x={xCenter(index)}
             y={shareY}
             textAnchor='middle'
            >
             {percent(category.cumulativePercentage)}
            </text>
           </g>
          );
         })}
        </svg>
       </div>

       <figcaption className='budgetPareto__foot'>
        <span>
         {`${overCount} of ${categories.length} ${countNoun(
          categories.length,
          'categories',
         )} over budget · the dotted line marks 80%`}
        </span>
        {notDrawnCount > 0 && (
         <span>
          {`${notDrawnCount} ${countNoun(
           notDrawnCount,
           'categories',
          )} with no spending not drawn; the budget line ends short of 100% by their budget`}
         </span>
        )}
        {last.hasSkippedBudget && (
         <span className='budgetPareto__caption'>
          A category with mixed currencies is left out of the running budget
         </span>
        )}
        {uncategorized && (
         <span className='budgetPareto__caption'>
          {`${uncategorized} more was spent without a category and is not ranked here`}
         </span>
        )}
       </figcaption>
      </figure>
     </section>
    </CollapsibleBlock>
   )}

   {/* Outside the fold, so closing the chart does not hide the finding. */}
   {executionRate !== null && (
    <section className='budgetRate' aria-label='Execution rate'>
     <div className='budgetRate__head'>
      <span className='budgetRate__label'>Execution rate</span>
      <span className={`budgetRate__value budgetRate__value--${rateLevel}`}>
       {`${executionRate.toFixed(1)}%`}
      </span>
     </div>

     <p className='budgetRate__finding'>{finding}</p>

     <ul className='budgetRate__legend'>
      <li className='budgetRate__key'>
       <span className='budgetRate__swatch budgetRate__swatch--ok' />
       {`under ${BUDGET_NEAR_LIMIT_PERCENT}% on track`}
      </li>
      <li className='budgetRate__key'>
       <span className='budgetRate__swatch budgetRate__swatch--near' />
       {`${BUDGET_NEAR_LIMIT_PERCENT}% to 100% near the limit`}
      </li>
      <li className='budgetRate__key'>
       <span className='budgetRate__swatch budgetRate__swatch--over' />
       over 100% over budget
      </li>
     </ul>
    </section>
   )}
  </>
 );
}

export default CategoryBudgetPareto;
