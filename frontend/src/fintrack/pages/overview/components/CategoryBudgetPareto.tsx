// frontend/src/fintrack/pages/overview/components/CategoryBudgetPareto.tsx
// Level 2 expense: the Pareto of the month against its budget. Bars are spent
// and budget per category in the server's spend ranking; the two lines are the
// served running shares of spending and of budget. Month window only: a YTD
// reading needs its own server field (D40).
//
// Hand-drawn SVG, no chart library: every ink is a class reading a token.

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
 OverviewExpenseCard,
 OverviewExpenseCategory,
} from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// Drawing geometry in SVG user units, drawn 1:1 so text keeps its token size.
const PLOT_HEIGHT = 260;
const GROUP_WIDTH = 48;
const BAR_WIDTH = 15;
const BAR_GAP = 2;
const PAD_LEFT = 68;
const PAD_RIGHT = 52;
const PAD_TOP = 36;
const PAD_BOTTOM = 120;
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

type CategoryBudgetParetoProps = {
 categories: OverviewExpenseCategory[];
 card: OverviewExpenseCard;
 // 'YYYY-MM-01', the month the title names.
 referenceMonth: string | null;
};

function CategoryBudgetPareto({
 categories,
 card,
 referenceMonth,
}: CategoryBudgetParetoProps) {
 if (categories.length === 0) return null;

 const money = (value: number) =>
  currencyFormat(card.currency, value, formatNumberCountry);

 // null on a category whose accounts span currencies: no bar is drawn.
 const spentOf = (c: OverviewExpenseCategory) =>
  c.actualSpent as number | null;
 const budgetOf = (c: OverviewExpenseCategory) =>
  c.budgetAmount as number | null;

 const ceiling = axisCeiling(
  Math.max(
   ...categories.map((c) => Math.max(spentOf(c) ?? 0, budgetOf(c) ?? 0)),
  ),
 );

 const width = PAD_LEFT + categories.length * GROUP_WIDTH + PAD_RIGHT;
 const height = PAD_TOP + PLOT_HEIGHT + PAD_BOTTOM;
 const plotBottom = PAD_TOP + PLOT_HEIGHT;
 const plotRight = width - PAD_RIGHT;

 const yMoney = (value: number) =>
  PAD_TOP + PLOT_HEIGHT * (1 - value / ceiling);
 const yShare = (share: number) => PAD_TOP + PLOT_HEIGHT * (1 - share);
 const xCenter = (index: number) =>
  PAD_LEFT + GROUP_WIDTH * index + GROUP_WIDTH / 2;

 const spentLine = categories
  .map((c, i) => `${xCenter(i)},${yShare(c.cumulativePercentage)}`)
  .join(' ');
 const budgetLine = categories
  .map((c, i) => `${xCenter(i)},${yShare(c.cumulativeBudgetPercentage)}`)
  .join(' ');

 // The last row's running figures are the month's totals over the ranked set.
 const last = categories[categories.length - 1];
 const spentTotal = last.cumulativeActual;
 const budgetTotal = last.cumulativeBudget;
 const overCount = categories.filter((c) => c.isOverBudget === true).length;

 // PROVISIONAL: the rate and the gap are client arithmetic over the two figures
 // the head prints. They move to server fields once the reading is settled.
 const executionRate =
  budgetTotal > 0 ? (spentTotal / budgetTotal) * 100 : null;
 // The same three levels and threshold the budget screens paint.
 const rateLevel = budgetStatusLevel(executionRate, spentTotal > budgetTotal);

 const finding =
  rateLevel === 'over'
   ? `Spending passed the month's budget by ${money(spentTotal - budgetTotal)}.`
   : rateLevel === 'near'
    ? `Spending reached ${BUDGET_NEAR_LIMIT_PERCENT}% or more of the budget, with ${money(budgetTotal - spentTotal)} left.`
    : `Spending is within the budget, with ${money(budgetTotal - spentTotal)} left.`;

 const uncategorized = card.hasUncategorizedExpense
  ? currencyFormat(
     card.currency,
     card.totalAmount - card.categorizedExpense,
     formatNumberCountry,
    )
  : null;

 return (
  <>
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

      {/* Wider than a phone at any real category count, so it scrolls inside
          its own box and never the page. */}
      <div
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
        aria-label={`Spent and budget for ${categories.length} categories, ranked by spending`}
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

        {categories.map((category, index) => {
         const cx = xCenter(index);
         const spent = spentOf(category);
         const budget = budgetOf(category);
         const spentX = cx - BAR_GAP / 2 - BAR_WIDTH;
         const budgetX = cx + BAR_GAP / 2;
         const labelY = plotBottom + LABEL_OFFSET * 2;
         const isOver = category.isOverBudget === true;

         return (
          <g key={category.categoryName}>
           {spent !== null && spent > 0 && (
            <>
             <rect
              className='budgetPareto__bar budgetPareto__bar--spent'
              x={spentX}
              y={yMoney(spent)}
              width={BAR_WIDTH}
              height={plotBottom - yMoney(spent)}
             />
             <text
              className='budgetPareto__valueText'
              x={spentX + BAR_WIDTH / 2}
              y={yMoney(spent) - LABEL_OFFSET}
              dominantBaseline='middle'
              transform={`rotate(-90 ${spentX + BAR_WIDTH / 2} ${
               yMoney(spent) - LABEL_OFFSET
              })`}
             >
              {money(spent)}
             </text>
            </>
           )}

           {budget !== null && budget > 0 && (
            <>
             <rect
              className='budgetPareto__bar budgetPareto__bar--budget'
              x={budgetX}
              y={yMoney(budget)}
              width={BAR_WIDTH}
              height={plotBottom - yMoney(budget)}
             />
             <text
              className='budgetPareto__valueText budgetPareto__valueText--budget'
              x={budgetX + BAR_WIDTH / 2}
              y={yMoney(budget) - LABEL_OFFSET}
              dominantBaseline='middle'
              transform={`rotate(-90 ${budgetX + BAR_WIDTH / 2} ${
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
            textAnchor='end'
            dominantBaseline='middle'
            transform={`rotate(-45 ${cx} ${labelY})`}
           >
            {isOver
             ? `${category.categoryName} · over`
             : category.categoryName}
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

        {categories.map((category, index) => (
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
          {/* A row that spent nothing does not move the line, so repeating its
              share would print the same 100.0% down the tail. */}
          {category.actualSpent !== 0 && (
           <text
            className='budgetPareto__shareText'
            x={xCenter(index)}
            y={yShare(category.cumulativePercentage) - LABEL_OFFSET * 1.5}
            textAnchor='middle'
           >
            {percent(category.cumulativePercentage)}
           </text>
          )}
         </g>
        ))}
       </svg>
      </div>

      <figcaption className='budgetPareto__foot'>
       <span>
        {`${overCount} of ${categories.length} ${countNoun(
         categories.length,
         'categories',
        )} over budget · the dotted line marks 80%`}
       </span>
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
