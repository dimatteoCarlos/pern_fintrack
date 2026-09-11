// frontend/src/fintrack/pages/overview/helpers/rankedBreakdown.ts
// What every ranked breakdown of the overview has in common, held in one place
// because two components now draw the SAME array: ParetoBar.tsx reads it as a
// ranking with a running total, DonutChart.tsx reads it as parts of a whole.
// OVERVIEW_LAYOUT.md:500 says so in as many words - the expense donut is the
// Pareto's rows read as parts of a whole - and a row that is one thing in two
// drawings has to be one type and one colour.
//
// THE COLOUR IS THE REASON THIS FILE EXISTS. A copy of categoryInk in each
// component is two rules for one colour, and the first edit to either one paints
// the same category two colours on one screen, which is the single defect a
// shared legend cannot survive.

// One row of a ranked breakdown, in the figures every ranking publishes.
//
// The domain's own field names are NOT here: five domains name the same figure
// five ways, and a component that read categoryName would only ever serve one of
// them. The adapter that owns the domain does the renaming, once.
export type RankedRow = {
 // Stable across renders and never the array index: the ranking reorders when
 // the month changes, and an index key would carry one row's state onto
 // another's. The adapter supplies the domain's own identifier.
 key: string;
 label: string;
 amount: number;
 // 0-1, this row's own share of the total.
 share: number;
 // Drawn as a word beside the amount and never as a colour alone. The ramp
 // already spends the ochre family on rank, so a second meaning carried only in
 // colour would be two colour systems on one row.
 isFlagged?: boolean;
};

// 0-1 to '12.3%'. One decimal because the server rounds the ratio to four
// places (makeCategoryBreakdown.js:30), so a second decimal here would print
// resolution the figure does not carry.
export const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

// The mark for a running share that has no answer. The same dash PanelTotal
// prints for a figure that did not arrive, because a reader learns one mark for
// "there is no number here" and not two.
export const NO_SHARE = '—';

// How many hues the categorical scale declares before it repeats.
const CATEGORY_INKS = 8;

// The colour this row wears, in both drawings of the block.
//
// A CATEGORICAL SCALE AND NO LONGER A RAMP. It was one ochre mixed between two
// ends - first by amount, then evenly by rank - and Carlos read both renders.
// The second, on 2026-09-11: "para donuts vamos a escoger un arco iris, porque
// no es facil distinguir la variacion entre una y otro %". The measurement
// agrees with him. Eight evenly spaced steps of ONE hue differ from their
// neighbours by about an eighth of that hue's lightness range, which is a
// smaller perceptual step than any two of the eight hues now declared: the
// tightest adjacent pair of those measures 38 in CIE Lab, where two adjacent
// steps of the old ramp measured under 10.
//
// THE HUE ANSWERS WHICH AND NEVER HOW MUCH. The width of a bar segment and the
// angle of a donut arc are the share, exactly, and both are read off the screen
// with no legend at all. Colour does the job neither can, which is telling one
// part from the next and tying it to its name in the legend.
//
// BY RANK, so the colour is stable inside one screen and the same category is
// one colour in the bar and in the ring. It is NOT stable across months: a
// category that changes places changes hue, and its legend square changes with
// it on the same render, which is the only place the two are ever compared.
//
// RETURNS A var() REFERENCE AND NOT A HEX. The component writes it into a
// custom property and the stylesheet consumes it, so the eight values stay in
// tokens.css and a change to any of them reaches both drawings.
export const categoryInk = (index: number) =>
 `var(--color-scale-category-${(index % CATEGORY_INKS) + 1})`;
