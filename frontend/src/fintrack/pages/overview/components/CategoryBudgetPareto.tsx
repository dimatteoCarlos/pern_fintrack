// frontend/src/fintrack/pages/overview/components/CategoryBudgetPareto.tsx
// Level 2 expense: the Pareto of the month against its budget. Bars are spent
// and budget per row in the server's spend ranking; the two lines are the
// served running shares of spending and of budget. Month window only: a YTD
// reading needs its own server field (D40).
//
// IT NO LONGER KNOWS WHAT A ROW IS. The screen ranks categories, then the
// budget accounts inside one of them, then every account of the month, and the
// arithmetic is identical at all three — so the level passes rows already
// labelled and this file draws them. A second copy of the drawing would fork the
// colour decisions, the label rotation and the tspan that restates its own size.
//
// A ROW THAT STANDS FOR A GROUP OPENS; A ROW THAT STANDS FOR ONE ACCOUNT DOES
// NOT. That is the whole interaction rule, and it is carried by the row's own
// openable flag rather than by the level, so two kinds of bar can sit in one
// ranking (owner decision 2026-09-17).
//
// Hand-drawn SVG, no chart library: every ink is a class reading a token.

import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react';

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
} from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// Drawing geometry in SVG user units, drawn 1:1 so text keeps its token size.
const PLOT_HEIGHT = 260;
// Below this a row's labels overlap, so the chart scrolls instead.
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
// How far a cut bar's zigzag rises above the axis top, and how wide one tooth
// is. Only a folded row is ever cut, which is one more thing no account does.
const BREAK_INSET = 10;
const BREAK_TOOTH = 6;

// The axis top: the tallest bar rounded up to 1, 2, 2.5 or 5 times a power of
// ten, so the five ticks land on readable amounts.
const axisCeiling = (value: number) => {
 if (value <= 0) return 1;
 const magnitude = 10 ** Math.floor(Math.log10(value));
 const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
 return step * magnitude;
};

// One drawn bar pair, already named by the level that owns it.
export type ParetoRow = {
 // Unique within the ranking. Not the label: two accounts can share one.
 key: string;
 label: string;
 actualSpent: number | null;
 budgetAmount: number | null;
 isOverBudget: boolean;
 cumulativeActual: number;
 cumulativePercentage: number;
 cumulativeBudget: number;
 cumulativeBudgetPercentage: number;
 hasSkippedBudget: boolean;
 // Whether clicking it opens what it holds. False for a row that is one
 // account, which is the leaf.
 openable: boolean;
 // A fold of the rows below the cut, drawn so it cannot be read as an account:
 // hatched, countable, and the only bar allowed to run past the axis top.
 isFold?: boolean;
};

type CategoryBudgetParetoProps = {
 rows: ParetoRow[];
 // What the foot counts in, plural: 'categories', 'budget accounts'.
 rowNoun: string;
 // Null from a backend older than the field: the rate is then not shown.
 execution: OverviewCategoryBudgetExecution | null;
 card: OverviewExpenseCard;
 // 'YYYY-MM-01', the month the title names.
 referenceMonth: string | null;
 title: string;
 // The name the reader drilled into, kept out of `title` so the card can write
 // it in the subject colour. A node would do it too, but `title` also builds
 // the chart's aria-label below, and a node cannot go in an attribute.
 titleSubject?: string;
 // What the rate block is a rate OF, named so a reader who scrolled past the
 // trail still knows which figures are on screen.
 rateScope: string;
 // The level trail and the way back, drawn above the total. Absent at the top
 // level, where there is nothing to go back to.
 trail?: ReactNode;
 // Lines the level adds to the figure's foot, after the shared ones.
 notes?: string[];
 // Called with the row the reader opened. Rows say whether they can be.
 onOpen?: (row: ParetoRow) => void;
 // Drawn under the figure and inside the same block, so closing the chart
 // closes what belongs to it.
 children?: ReactNode;
};

function CategoryBudgetPareto({
 rows,
 rowNoun,
 execution,
 card,
 referenceMonth,
 title,
 titleSubject,
 rateScope,
 trail,
 notes,
 onOpen,
 children,
}: CategoryBudgetParetoProps) {
 // The width the chart may fill. 0 until the box is measured, which draws at
 // the minimum group width for one frame.
 const scrollRef = useRef<HTMLDivElement>(null);
 const [availableWidth, setAvailableWidth] = useState(0);
 // The one tab stop of the ranking. Thirty-four openable columns must not
 // become thirty-four tab stops, so the arrows move between them instead.
 const [focusedKey, setFocusedKey] = useState<string | null>(null);
 const hitRefs = useRef(new Map<string, SVGRectElement>());

 useEffect(() => {
  const box = scrollRef.current;
  if (!box) return;
  const observer = new ResizeObserver(([entry]) =>
   setAvailableWidth(entry.contentRect.width),
  );
  observer.observe(box);
  return () => observer.disconnect();
 }, [rows]);

 if (rows.length === 0) return null;

 const money = (value: number) =>
  currencyFormat(card.currency, value, formatNumberCountry);

 // The chart ends where spending reaches 100%: a row with no spending adds no
 // bar and no step to the line. Mixed-currency rows (null) have no spending to
 // draw either. The totals below still read every row.
 const drawn = rows.filter((row) => (row.actualSpent ?? 0) > 0);
 const notDrawnCount = rows.length - drawn.length;

 // The fold is left out of the ceiling on purpose: it holds every row below the
 // cut, so letting it set the top would flatten the bars the chart exists to
 // rank. It is cut at the top instead, with its amount written inside it.
 const ceiling = axisCeiling(
  Math.max(
   0,
   ...drawn
    .filter((row) => row.isFold !== true)
    .map((row) => Math.max(row.actualSpent ?? 0, row.budgetAmount ?? 0)),
  ),
 );

 // Few rows share the box's width; many keep the minimum and scroll.
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
 const labelOf = (row: ParetoRow) =>
  row.isOverBudget ? `${row.label} · over` : row.label;
 const longestLabel =
  Math.max(0, ...drawn.map((row) => labelOf(row).length)) * CHAR_WIDTH;
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

 // Clamped at the axis top: only a fold can exceed it, and it is drawn cut.
 const yMoney = (value: number) =>
  Math.max(
   PAD_TOP + BREAK_INSET,
   PAD_TOP + PLOT_HEIGHT * (1 - value / ceiling),
  );
 const isCut = (value: number) => value > ceiling;
 const yShare = (share: number) => PAD_TOP + PLOT_HEIGHT * (1 - share);
 const xCenter = (index: number) =>
  PAD_LEFT + groupWidth * index + groupWidth / 2;
 // Where a bar's rotated amount ends upwards, its length estimated per character.
 const amountTop = (value: number) =>
  yMoney(value) - LABEL_OFFSET - money(value).length * CHAR_WIDTH;

 const spentLine = drawn
  .map((row, i) => `${xCenter(i)},${yShare(row.cumulativePercentage)}`)
  .join(' ');
 // Ends below 100% when rows with budget and no spending exist: the gap is the
 // budget they hold, and the foot states it in money.
 const budgetLine = drawn
  .map((row, i) => `${xCenter(i)},${yShare(row.cumulativeBudgetPercentage)}`)
  .join(' ');

 // The last row's running figures are the totals over the whole ranked set.
 const last = rows[rows.length - 1];
 const spentTotal = last.cumulativeActual;
 const budgetTotal = last.cumulativeBudget;
 const overCount = rows.filter((row) => row.isOverBudget).length;
 // What the budget curve is short by, in money rather than left to the reader:
 // the plan of the rows that were not drawn.
 const drawnBudget = drawn.reduce((sum, row) => sum + (row.budgetAmount ?? 0), 0);
 const undrawnBudget = budgetTotal - drawnBudget;

 const openableKeys = drawn.filter((row) => row.openable).map((row) => row.key);
 const isInteractive = onOpen !== undefined && openableKeys.length > 0;
 const tabStopKey = focusedKey ?? openableKeys[0] ?? null;

 const moveFocus = (to: number) => {
  const key = openableKeys[to];
  if (key === undefined) return;
  setFocusedKey(key);
  hitRefs.current.get(key)?.focus();
 };

 const onHitKeyDown = (event: KeyboardEvent<SVGRectElement>, row: ParetoRow) => {
  const at = openableKeys.indexOf(row.key);

  if (event.key === 'Enter' || event.key === ' ') {
   event.preventDefault();
   onOpen?.(row);
   return;
  }
  if (event.key === 'ArrowRight') {
   event.preventDefault();
   moveFocus(Math.min(at + 1, openableKeys.length - 1));
   return;
  }
  if (event.key === 'ArrowLeft') {
   event.preventDefault();
   moveFocus(Math.max(at - 1, 0));
   return;
  }
  if (event.key === 'Home') {
   event.preventDefault();
   moveFocus(0);
   return;
  }
  if (event.key === 'End') {
   event.preventDefault();
   moveFocus(openableKeys.length - 1);
  }
 };

 // Served: categorized spending over the same rows' budget.
 const executionRate = execution?.executionPercentage ?? null;
 // The same three levels and threshold the budget screens paint.
 const rateLevel = budgetStatusLevel(
  executionRate,
  execution?.isOverBudget ?? false,
 );
 const remaining = execution?.remainingBudget ?? 0;

 const finding =
  rateLevel === 'over'
   ? `${rateScope} passed its budget by ${money(-remaining)}.`
   : rateLevel === 'near'
    ? `${rateScope} reached ${BUDGET_NEAR_LIMIT_PERCENT}% or more of its budget, with ${money(remaining)} left.`
    : `${rateScope} is within its budget, with ${money(remaining)} left.`;

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
       {title}
       {titleSubject && (
        <>
         {' · '}
         <span className='budgetPareto__titleSubject'>{titleSubject}</span>
        </>
       )}
      </CardTitle>
     }
     isRuled
    >
     <section className='domainCards domainCards--single'>
      <figure className='budgetPareto'>
       {trail}

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
        {drawn.some((row) => row.isFold) && (
         <li className='budgetPareto__key'>
          <span className='budgetPareto__swatch budgetPareto__swatch--fold' />
          {`Rest: every ${countNoun(1, rowNoun)} below the cut, summed`}
         </li>
        )}
        <li className='budgetPareto__key'>
         <span className='budgetPareto__stroke budgetPareto__stroke--spent' />
         Cumulative % of spending
        </li>
        <li className='budgetPareto__key'>
         <span className='budgetPareto__stroke budgetPareto__stroke--budget' />
         Cumulative % of budget
        </li>
       </ul>

       {/* Fills its box; scrolls inside it only when the rows need more than
           the box has. */}
       <div
        ref={scrollRef}
        className='budgetPareto__scroll'
        tabIndex={0}
        role='region'
        aria-label={`${title}${
         titleSubject ? ` · ${titleSubject}` : ''
        } chart, scrolls sideways`}
       >
        <svg
         className='budgetPareto__chart'
         width={width}
         height={height}
         viewBox={`0 0 ${width} ${height}`}
         // A group and not an image WHEN A COLUMN CAN BE OPENED: role='img'
         // hides every descendant from assistive technology, so a control drawn
         // inside would exist for the pointer and not for a screen reader.
         role={isInteractive ? 'group' : 'img'}
         aria-label={`Spent and budget for the ${drawn.length} ${countNoun(
          drawn.length,
          rowNoun,
         )} with spending, ranked by spending`}
        >
         <defs>
          <pattern
           id='budgetPareto-foldHatch'
           width='8'
           height='8'
           patternUnits='userSpaceOnUse'
           patternTransform='rotate(45)'
          >
           <line className='budgetPareto__hatchLine' x1='0' y1='0' x2='0' y2='8' />
          </pattern>
         </defs>

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

         {drawn.map((row, index) => {
          const cx = xCenter(index);
          const spent = row.actualSpent ?? 0;
          const budget = row.budgetAmount;
          const spentX = cx - BAR_GAP / 2 - barWidth;
          const budgetX = cx + BAR_GAP / 2;
          const labelY = plotBottom + LABEL_OFFSET * 2;
          const spentIsCut = isCut(spent);

          return (
           <g
            key={row.key}
            className={`budgetPareto__group${
             row.openable ? ' budgetPareto__group--openable' : ''
            }`}
           >
            <rect
             className={`budgetPareto__bar budgetPareto__bar--${
              row.isFold ? 'fold' : 'spent'
             }`}
             x={spentX}
             y={yMoney(spent)}
             width={barWidth}
             height={plotBottom - yMoney(spent)}
             fill={row.isFold ? 'url(#budgetPareto-foldHatch)' : undefined}
            />
            {/* The tooth line a cut bar wears, so a bar that runs past the top
                is never read as one that stops there. */}
            {spentIsCut && (
             <polyline
              className='budgetPareto__break'
              points={`${spentX},${yMoney(spent) + BREAK_TOOTH} ${
               spentX + barWidth / 2
              },${yMoney(spent)} ${spentX + barWidth},${
               yMoney(spent) + BREAK_TOOTH
              }`}
             />
            )}
            <text
             className={`budgetPareto__valueText${
              spentIsCut ? ' budgetPareto__valueText--inside' : ''
             }`}
             x={spentX + barWidth / 2}
             y={spentIsCut ? yMoney(spent) + BREAK_INSET * 4 : yMoney(spent) - LABEL_OFFSET}
             dominantBaseline='middle'
             transform={`rotate(-90 ${spentX + barWidth / 2} ${
              spentIsCut ? yMoney(spent) + BREAK_INSET * 4 : yMoney(spent) - LABEL_OFFSET
             })`}
            >
             {money(spent)}
            </text>

            {budget !== null && budget > 0 && (
             <>
              <rect
               className={`budgetPareto__bar budgetPareto__bar--budget${
                row.isFold ? ' budgetPareto__bar--budgetFold' : ''
               }`}
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
              row.openable ? ' budgetPareto__categoryText--openable' : ''
             }`}
             x={cx}
             y={labelY}
             textAnchor={rotateLabels ? 'end' : 'middle'}
             dominantBaseline='middle'
             transform={
              rotateLabels ? `rotate(-45 ${cx} ${labelY})` : undefined
             }
            >
             {row.label}
             {/* Only the word carries the alert ink; the name keeps its own. */}
             {row.isOverBudget && (
              <tspan className='budgetPareto__overText'>{' · over'}</tspan>
             )}
            </text>

            {/* The target is the whole column and not the bar: a bar at the
                tail of the ranking is fifteen units wide and twenty tall. */}
            {row.openable && onOpen !== undefined && (
             <rect
              ref={(node) => {
               if (node) hitRefs.current.set(row.key, node);
               else hitRefs.current.delete(row.key);
              }}
              className='budgetPareto__hit'
              x={cx - groupWidth / 2 + 2}
              y={PAD_TOP + 2}
              width={groupWidth - 4}
              height={PLOT_HEIGHT + LABEL_OFFSET * 2}
              role='button'
              tabIndex={row.key === tabStopKey ? 0 : -1}
              aria-label={`${row.label}, spent ${money(spent)}${
               budget !== null && budget > 0 ? `, of ${money(budget)} budgeted` : ''
              }${row.isOverBudget ? ', over budget' : ''}, ${percent(
               row.cumulativePercentage,
              )} of the running total. Open it.`}
              onClick={() => onOpen(row)}
              onFocus={() => setFocusedKey(row.key)}
              onKeyDown={(event) => onHitKeyDown(event, row)}
             />
            )}
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

         {drawn.map((row, index) => {
          const budget = row.budgetAmount;
          // Centred between the group's two bars, the label crosses both, so
          // it rises above their amounts whenever the point sits among them.
          const shareY = Math.min(
           yShare(row.cumulativePercentage) - LABEL_OFFSET * 1.5,
           amountTop(row.actualSpent ?? 0) - LABEL_OFFSET,
           budget !== null && budget > 0
            ? amountTop(budget) - LABEL_OFFSET
            : Infinity,
          );

          return (
           <g key={`points-${row.key}`}>
            <circle
             className='budgetPareto__point budgetPareto__point--budget'
             cx={xCenter(index)}
             cy={yShare(row.cumulativeBudgetPercentage)}
             r={POINT_RADIUS}
            />
            <circle
             className='budgetPareto__point budgetPareto__point--spent'
             cx={xCenter(index)}
             cy={yShare(row.cumulativePercentage)}
             r={POINT_RADIUS}
            />
            <text
             className='budgetPareto__shareText'
             x={xCenter(index)}
             y={shareY}
             textAnchor='middle'
            >
             {percent(row.cumulativePercentage)}
            </text>
           </g>
          );
         })}
        </svg>
       </div>

       <figcaption className='budgetPareto__foot'>
        <span>
         {`${overCount} of ${rows.length} ${countNoun(
          rows.length,
          rowNoun,
         )} over budget · the dotted line marks 80%`}
        </span>
        {notDrawnCount > 0 && undrawnBudget > 0 && (
         <span>
          {`${notDrawnCount} ${countNoun(
           notDrawnCount,
           rowNoun,
          )} spent nothing and ${
           notDrawnCount === 1 ? 'is' : 'are'
          } not drawn, so the budget curve ends at ${percent(
           drawn[drawn.length - 1].cumulativeBudgetPercentage,
          )} instead of 100%, short by the ${money(undrawnBudget)} budgeted to ${
           notDrawnCount === 1 ? 'it' : 'them'
          }`}
         </span>
        )}
        {last.hasSkippedBudget && (
         <span className='budgetPareto__caption'>
          {`A ${countNoun(1, rowNoun)} with mixed currencies is left out of the running budget`}
         </span>
        )}
        {uncategorized && (
         <span className='budgetPareto__caption'>
          {`${uncategorized} more was spent without a category and is not ranked here`}
         </span>
        )}
        {notes?.map((note) => (
         <span className='budgetPareto__caption' key={note}>
          {note}
         </span>
        ))}
       </figcaption>
      </figure>

      {children}
     </section>
    </CollapsibleBlock>
   )}

   {/* Outside the fold, so closing the chart does not hide the finding. */}
   {executionRate !== null && (
    <section className='budgetRate' aria-label={`${rateScope} execution rate`}>
     <div className='budgetRate__head'>
      <span className='budgetRate__label'>{`Execution rate · ${rateScope}`}</span>
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
