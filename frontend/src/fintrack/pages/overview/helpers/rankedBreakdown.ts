// frontend/src/fintrack/pages/overview/helpers/rankedBreakdown.ts
// What every ranked breakdown of the overview has in common, held in one place
// because two components now draw the SAME array: ParetoBar.tsx reads it as a
// ranking with a running total, DonutChart.tsx reads it as parts of a whole.
// OVERVIEW_LAYOUT.md:500 says so in as many words - the expense donut is the
// Pareto's rows read as parts of a whole - and a row that is one thing in two
// drawings has to be one type and one colour.
//
// THE RAMP IS THE REASON THIS FILE EXISTS. A copy of rampPosition in each
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

// Where this row sits on the colour ramp, 0-1, and the only ratio these
// components compute.
//
// BY RANK AND NOT BY AMOUNT. It was amount / largest amount until Carlos read
// the first render on 2026-09-10: "no distingo los colores entre las
// categorias". He is right, and the arithmetic says why. A month's spending is
// skewed by nature, so with a leader at 118 and the next four at 41, 27, 19 and
// 8, the ramp positions come out 1.00, 0.35, 0.23, 0.16 and 0.07 - four of the
// five crushed into the bottom seventh of the scale, indistinguishable at the
// twelve pixels the track is tall. A ramp that cannot separate its own rows
// encodes nothing.
//
// EVENLY SPACED, so N rows get N distinct steps whatever the figures are, and
// the brightest is always rank 1. What the hue gives up is magnitude - and the
// hue was never what carried it: the WIDTH of a bar segment and the ANGLE of a
// donut arc are the share, exactly, and both are read off the screen with no
// legend at all. Colour does the job neither can, which is telling one part
// from the next and tying it to its name in the legend.
//
// A STRING AND NOT A NUMBER. React sets a custom property with setProperty and
// appends no unit, but that is the one rule with a version-dependent exception,
// and a '0.42px' landing inside calc() would fail silently and paint every part
// the same colour.
export const rampPosition = (index: number, count: number) => {
 if (count <= 1) return '1';

 return (1 - index / (count - 1)).toFixed(3);
};
