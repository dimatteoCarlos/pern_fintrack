// frontend/src/fintrack/pages/overview/components/DonutChart.tsx
// The other half of the distribution reading: one ranked total drawn as parts of
// a whole. OVERVIEW_LAYOUT.md:500 states what this is - "la dona de gasto son
// las filas del Pareto leidas como partes de un todo" - so it takes the SAME
// rows ParetoBar.tsx takes and adds no field and no request.
//
// GENERIC FOR THE SAME REASON THE BAR IS. OVERVIEW_LAYOUT.md:456-460 lists four
// more donuts the server already builds at level 2: income by source, investment
// by account, debt by counterparty and pocket by pocket. Each is a rank and a
// share, which is what this reads, so those screens mount this component instead
// of growing a ring apiece.
//
// NO CHART LIBRARY, the same rule TrendCharts.tsx:10-14 and ParetoBar.tsx state.
// A ring is one circle per part with a dash pattern on it, and var(--token)
// resolves on an element where it does not reach into a drawing context.
//
// THE SHARES ARE THE SERVER'S. Nothing here divides one amount by another. The
// caller hands over the shares the server published, so the angle of an arc and
// the figure printed beside it come from the same arithmetic and cannot
// disagree. The only ratio computed here is the ramp position, which is a
// drawing rule and never a figure on screen.

import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { RankedRow, percent, rampPosition } from '../helpers/rankedBreakdown';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// The drawing box. A square viewBox in its own units, so the ring scales with
// whatever width the card gives it and nothing here is a pixel.
const BOX = 100;
const CENTRE = BOX / 2;

// The ring's radius and its thickness, in those same units. The radius is the
// CENTRE LINE of the stroke, so the outer edge is radius + width / 2 and both
// together have to stay inside the box: 38 + 7 is 45, five units of margin for
// the focus ring a level-2 screen may add to a clickable arc.
const RADIUS = 38;
const RING_WIDTH = 14;

const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// The cut between two arcs, in path units. It is the ring's own version of the
// one-pixel inset the bar draws between segments: without it two adjacent arcs
// of similar colour read as one arc.
const ARC_GAP = 1.2;

// What a part is drawn at when its share is smaller than the gap. A category
// that spent something must never be drawn as nothing - the same floor the bar
// puts on a segment's width.
const MIN_ARC = 0.6;

type DonutChartProps = {
 rows: RankedRow[];
 currency: string;
 // The figure the shares are shares OF, printed in the hole. Without it the
 // percentages have no denominator on screen.
 total: number;
 totalLabel: string;
 // Rendered under the legend when the caller has something the ring cannot
 // draw. For expense that is the spending that carries no category, which by
 // decision D48 is an advisory line and never a slice: it sits outside the set
 // the server ranked, so a slice for it would make every drawn angle a share of
 // one total while the percentage beside it stays a share of another.
 caption?: string;
};

function DonutChart({
 rows,
 currency,
 total,
 totalLabel,
 caption,
}: DonutChartProps) {
 const money = (value: number) =>
  currencyFormat(currency, value, formatNumberCountry);

 // Where each arc starts, in path units, accumulated over the rows BEFORE it.
 // Taken over every row and not only the drawn ones, so a row that spent
 // nothing contributes zero and moves nothing.
 let travelled = 0;

 return (
  <figure className='donutChart'>
   {/* THE RING SAYS NOTHING TO A SCREEN READER, deliberately. The legend below
       is already a table of every figure the ring encodes, and exposing both
       would recite each share twice. */}
   <div className='donutChart__ring'>
    <svg
     className='donutChart__svg'
     viewBox={`0 0 ${BOX} ${BOX}`}
     aria-hidden='true'
    >
     {/* Rotated so the first part starts at twelve o'clock. A ranking read
         clockwise from the top is the convention every reader already has; a
         ring that starts at three o'clock puts the largest part where the eye
         arrives second. */}
     <g transform={`rotate(-90 ${CENTRE} ${CENTRE})`}>
      {/* The track, under the parts. It is what the gaps show through, and it
          is what an owner whose parts do not close the circle sees instead of
          a hole in the drawing. */}
      <circle
       className='donutChart__track'
       cx={CENTRE}
       cy={CENTRE}
       r={RADIUS}
       fill='none'
       strokeWidth={RING_WIDTH}
      />

      {rows.map((row, index) => {
       const start = travelled;
       travelled += row.share * CIRCUMFERENCE;

       // Filtered AFTER the start is accumulated and AFTER the index is taken:
       // the index IS the rank and the rank is where the colour comes from, so
       // a row that spent nothing must leave the ring without renumbering the
       // rows under it or shifting where they begin.
       if (row.amount <= 0) return null;

       const length = Math.max(row.share * CIRCUMFERENCE - ARC_GAP, MIN_ARC);

       return (
        <circle
         className='donutChart__arc'
         key={row.key}
         cx={CENTRE}
         cy={CENTRE}
         r={RADIUS}
         fill='none'
         strokeWidth={RING_WIDTH}
         strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
         // Negative, because the offset runs against the direction the dash
         // pattern is laid out: -start puts this arc's dash where the rows
         // above it stopped.
         strokeDashoffset={-start}
         style={{
          // Read by the ramp in the stylesheet. A position and not a colour:
          // both ends of the ramp are tokens, and mixing them belongs in CSS
          // where a change to either one reaches this.
          ['--donutChart-ramp' as string]: rampPosition(index, rows.length),
         }}
        />
       );
      })}
     </g>
    </svg>

    {/* The hole carries the denominator. HTML over the drawing and not an svg
        text element, so the figure takes the same type tokens and the same
        currencyFormat every other amount on the page takes. */}
    <div className='donutChart__hole'>
     <span className='donutChart__total'>{money(total)}</span>
     <span className='donutChart__totalLabel'>{totalLabel}</span>
    </div>
   </div>

   <ul className='donutChart__legend'>
    {rows.map((row, index) => (
     <li className='donutChart__row' key={row.key}>
      {/* The same square the bar's legend draws, off the same ramp function,
          so a category carries one colour across both drawings of the block.
          A row that spent nothing keeps its square: the row is in the ranking
          and absent from the ring, and the square is what says so. */}
      <span
       className='donutChart__swatch'
       aria-hidden='true'
       style={{
        ['--donutChart-ramp' as string]: rampPosition(index, rows.length),
       }}
      />

      <span className='donutChart__name'>{row.label}</span>

      <span className='donutChart__share'>{percent(row.share)}</span>
     </li>
    ))}
   </ul>

   {caption && <figcaption className='donutChart__foot'>{caption}</figcaption>}
  </figure>
 );
}

export default DonutChart;
