// frontend/src/fintrack/pages/overview/components/ParetoBar.tsx
// The second half of block 07: one ranked total, drawn as a single stacked bar
// with the legend that reads it. TrendCharts.tsx:16-18 recorded this half as
// waiting on a colour ramp the design system did not have; the ramp now exists
// as --color-scale-magnitude-high / -low and the wait is over.
//
// GENERIC ON PURPOSE, because the server ranks five of the six domains and not
// one. makeCategoryBreakdown ranks expense by category, makeDistribution ranks
// income by source, investment by account, debt by counterparty and pocket by
// progress. All five arrive already ranked and already carrying a running
// share, so a component that takes a rank and a share renders every one of them
// and the level-2 screens reuse it instead of growing a bar apiece.
//
// NO CHART LIBRARY, the same rule TrendCharts.tsx:9-14 states: the bar is a
// flex row of segments with a width, so var(--token) resolves on each and the
// figures stay reachable per row. A library earns its place when there is a
// coordinate system to draw, and a single axis of percentages is not one.
//
// THE SHARES ARE THE SERVER'S. Nothing here divides one amount by another to
// get a percentage. The caller hands over the shares the server published, so
// the width of a segment and the figure printed beside it come from the same
// arithmetic and cannot disagree. The only ratio computed here is the colour
// ramp's position, which is a drawing rule and never a figure on screen.

import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import {
 NO_SHARE,
 RankedRow,
 percent,
 rampPosition,
} from '../helpers/rankedBreakdown';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// Where the Pareto reading is taken. 0.8 is the reading's own definition rather
// than a preference, so it is a default and not a required prop; a caller with
// a different convention still passes its own.
const CONCENTRATION_MARK = 0.8;

// A ranked row plus the one figure only this reading needs.
//
// THE SHARED PART IS SHARED AND NOT COPIED. DonutChart.tsx draws the same array
// as parts of a whole (OVERVIEW_LAYOUT.md:500), so the row it takes and the row
// this takes are the same row, and the colour each gives a category comes from
// one rampPosition rather than two copies of it.
export type ParetoRow = RankedRow & {
 // 0-1, this row plus every row above it. The running total is what makes the
 // reading a Pareto rather than a ranking, and it is what the donut has no use
 // for - a part of a whole has no running total.
 cumulativeShare: number;
};

type ParetoBarProps = {
 rows: ParetoRow[];
 currency: string;
 // The figure the shares are shares OF, stated once above the bar. Without it
 // the percentages have no denominator on screen.
 total: number;
 totalLabel: string;
 // The noun the foot counts, in the plural: 'categories', 'sources',
 // 'accounts'. The sentence is unreadable with a generic word in it.
 unitLabel: string;
 // Rendered under the foot when the caller has something the bar cannot draw -
 // today, the expense that carries no category.
 caption?: string;
 concentrationMark?: number;
};

function ParetoBar({
 rows,
 currency,
 total,
 totalLabel,
 unitLabel,
 caption,
 concentrationMark = CONCENTRATION_MARK,
}: ParetoBarProps) {
 const money = (value: number) =>
  currencyFormat(currency, value, formatNumberCountry);

 // The denominator of the reading, and it is NOT rows.length. The sentence
 // counted seven categories on Carlos's screen when four of them had spent
 // nothing: a category with a plan and no spending belongs in the list, and
 // does not belong in "how few categories carry the month".
 const spendingCount = rows.filter((row) => row.amount > 0).length;

 // The last row inside the reading, by index. -1 when no row reaches the mark,
 // which happens when the ranking is flat enough that the whole set is needed.
 const concentrationIndex = rows.findIndex(
  (row) => row.cumulativeShare >= concentrationMark,
 );

 return (
  <figure className='paretoBar'>
   <div className='paretoBar__head'>
    <span className='paretoBar__total'>{money(total)}</span>
    <span className='paretoBar__totalLabel'>{totalLabel}</span>
   </div>

   {/* THE BAR SAYS NOTHING TO A SCREEN READER, deliberately. The legend below
       is already a table of every figure the bar encodes, and exposing both
       would recite each amount twice. */}
   <div className='paretoBar__track' aria-hidden='true'>
    {/* Filtered AFTER the index is taken and not before: the index IS the rank
        and the rank is where the colour comes from, so a row that spent nothing
        has to leave the bar without renumbering the rows under it. */}
    {rows.map((row, index) =>
     row.amount > 0 ? (
      <span
       className='paretoBar__segment'
       key={row.key}
       style={{
        width: percent(row.share),
        // Read by the ramp in the stylesheet. A position and not a colour:
        // both ends of the ramp are tokens, and mixing them belongs in CSS
        // where a change to either one reaches this.
        ['--paretoBar-ramp' as string]: rampPosition(index, rows.length),
       }}
      />
     ) : null,
    )}

    {/* Drawn over the segments rather than between them: the mark falls inside
        the row that crosses it, which is the row that carries the reading. */}
    {concentrationIndex !== -1 && (
     <span
      className='paretoBar__mark'
      style={{ left: percent(concentrationMark) }}
     />
    )}
   </div>

   <ul className='paretoBar__legend'>
    {rows.map((row, index) => (
     <li
      className={
       index === concentrationIndex
        ? 'paretoBar__row paretoBar__row--concentration'
        : 'paretoBar__row'
      }
      key={row.key}
     >
      {/* The same square the bar draws, at the same size and from the same
          ramp, so the legend identifies a segment instead of repeating one
          colour down the column. A zero row keeps its empty square: the row
          is in the list and absent from the bar, and the empty square is what
          says so. */}
      <span
       className='paretoBar__swatch'
       aria-hidden='true'
       style={{
        ['--paretoBar-ramp' as string]: rampPosition(index, rows.length),
       }}
      />

      <span className='paretoBar__name'>{row.label}</span>

      {row.isFlagged && (
       <span className='paretoBar__flag'>over budget</span>
      )}

      <span className='paretoBar__amount'>{money(row.amount)}</span>

      {/* A ROW THAT SPENT NOTHING PRINTS NO RUNNING SHARE. September showed
          four categories at $0.00 each reporting 100.0% - arithmetic that is
          true, since the running total stops moving once the last spending row
          is counted, and a column that says the same thing four times beside
          four zeroes. The dash says what is actually the case: this row adds
          nothing, so there is no share of it to report. */}
      <span className='paretoBar__cumulative'>
       {row.amount > 0 ? percent(row.cumulativeShare) : NO_SHARE}
      </span>
     </li>
    ))}
   </ul>

   <figcaption className='paretoBar__foot'>
    {/* THE LINE IS NAMED IN WORDS. Carlos, 2026-09-10: "que significa la barra
        vertical blanco en la barra de progreso?". A mark whose meaning is
        written nowhere on the block is a mark the reader has to guess, and the
        sentence that explains it was already here, missing only its subject. */}
    {concentrationIndex !== -1 && (
     <span>
      the white line marks {percent(concentrationMark)}:{' '}
      {concentrationIndex + 1} of {spendingCount} {unitLabel} reach it
     </span>
    )}

    {caption && <span className='paretoBar__caption'>{caption}</span>}
   </figcaption>
  </figure>
 );
}

export default ParetoBar;
