# Hand-drawn SVG charts in FinTrack

How the overview charts are built without a chart library, using
`frontend/src/fintrack/pages/overview/components/CategoryBudgetPareto.tsx` as
the worked example: a Pareto of spent vs budget, with grouped bars, two
cumulative lines, two axes and a dotted mark at 80%.

## 1. Why no library

- **Tokens.** Every ink is `var(--token)`. A canvas-based library cannot read CSS
  custom properties, and most SVG libraries write colours as attributes. Drawing
  our own SVG lets a class carry `fill: var(--color-scale-category-1)`.
- **Size.** A bar-and-line chart is about 300 lines of TSX. A library adds
  tens of kilobytes to render the same rectangles and polylines.
- **Control.** Label collisions, halos, the Others fold, the currency format:
  each one is a few lines here, and a fight with a library's options API.

A library earns its place when the chart needs zoom, brushing, animated
transitions between datasets, or hundreds of thousands of points. None of the
overview charts do.

## 2. The data contract comes first

The server computes every financial figure; the client computes only geometry.

| Figure | Who computes it | Field |
|---|---|---|
| Ranking by spend | Server | order of `categories[]`, `rank` |
| Running share of spending (0-1) | Server | `cumulativePercentage` |
| Running share of budget (0-1) | Server | `cumulativeBudgetPercentage` |
| Over budget | Server | `isOverBudget` |
| Pixel position of a bar | Client | `yMoney(value)` |
| Axis top | Client | `axisCeiling(max)` |

Summing months, dividing amounts or re-ranking in the component creates a second
arithmetic for a figure the server already publishes, and the two drift apart at
the rounding (decision D40). The execution rate and the over/left amount under
the Pareto are the exception, marked PROVISIONAL in the code until they become
server fields.

## 3. The coordinate system

SVG's origin is the top-left corner, and y grows downwards. A chart is a plot
rectangle inside padding that holds the axis labels:

```
 0,0 ┌──────────────────────────────────────────────┐
     │            PAD_TOP (labels above bars)       │
     │ PAD_LEFT ┌──────────── plot ──────────┐ PAD_RIGHT
     │ $ axis   │                            │ % axis│
     │          └────────────────────────────┘       │
     │            PAD_BOTTOM (rotated names)        │
     └──────────────────────────────────────────────┘ width,height
```

```ts
const width = PAD_LEFT + categories.length * GROUP_WIDTH + PAD_RIGHT;
const height = PAD_TOP + PLOT_HEIGHT + PAD_BOTTOM;
const plotBottom = PAD_TOP + PLOT_HEIGHT;
```

**Draw 1:1.** Give the `<svg>` `width`, `height` and a `viewBox` of the same
numbers. One user unit is then one CSS pixel, so `font-size: var(--font-size-xs)`
renders at its token size and strokes keep their width. The alternative,
`viewBox="0 0 100 100"` stretched to the container (as in `TrendCharts.tsx`), is
good for a sparkline but scales text and strokes with it.

## 4. Scales: a value to a pixel

A scale is a linear map from the data domain to the pixel range. Because y is
inverted, the value 0 goes to the bottom of the plot:

```ts
const yMoney = (value: number) => PAD_TOP + PLOT_HEIGHT * (1 - value / ceiling);
const yShare = (share: number) => PAD_TOP + PLOT_HEIGHT * (1 - share); // 0-1
const xCenter = (index: number) => PAD_LEFT + GROUP_WIDTH * index + GROUP_WIDTH / 2;
```

- **Two y scales, one plot:** that is a dual axis. Money bars use `yMoney`; the
  cumulative lines use `yShare`. Each axis prints its own ticks on its own side.
- **Categorical x:** each category gets a fixed-width group, and the index is
  the position. That is why the chart's width grows with the category count.

### A readable axis top

Scaling to the raw maximum ($200.07) puts ticks at $40.01, $80.03 and so on.
Round the maximum up to 1, 2, 2.5 or 5 times a power of ten:

```ts
const axisCeiling = (value: number) => {
 if (value <= 0) return 1; // an all-zero month still needs a non-zero divisor
 const magnitude = 10 ** Math.floor(Math.log10(value));
 const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
 return step * magnitude;
};
// 200.07 -> 250, ticks every 50; 87 -> 100, ticks every 20
```

## 5. The marks

| Mark | SVG element | Geometry |
|---|---|---|
| Bar | `<rect>` | `x`, `y = yMoney(v)`, `height = plotBottom - yMoney(v)` |
| Outlined bar | `<rect>` with `fill: none; stroke: …` | same |
| Line | `<polyline points="x1,y1 x2,y2 …">` | one `x,y` pair per category |
| Point | `<circle cx cy r>` | same pair as the line |
| Gridline or mark | `<line x1 x2 y1 y2>` | constant y across the plot |
| Label | `<text x y text-anchor dominant-baseline>` | anchored to the mark |

Grouped bars sit side by side around the group centre:

```ts
const spentX = cx - BAR_GAP / 2 - BAR_WIDTH; // left of centre
const budgetX = cx + BAR_GAP / 2;            // right of centre
```

A line is a string of points:

```ts
const spentLine = categories
 .map((c, i) => `${xCenter(i)},${yShare(c.cumulativePercentage)}`)
 .join(' ');
```

**Paint order is document order.** Later elements draw on top. Gridlines go
first, then bars, then lines, then points and their labels.

## 6. Labels

- **Rotation:** `transform={`rotate(-90 ${x} ${y})`}` rotates about the label's
  own anchor. Without the `x y` pair it rotates about the SVG origin and the
  label flies off the chart. Category names use `-45` with
  `text-anchor="end"` so the text ends under its bar.
- **Collisions:** a label over a bar or a line becomes unreadable. The fix is a
  halo in the background ink, painted under the glyphs:

  ```css
  paint-order: stroke;
  stroke: var(--color-surface-app);
  stroke-width: var(--border-width-thick);
  stroke-linejoin: round;
  ```

- **Redundancy:** do not draw what does not move the reading. The expense Pareto
  stops at the last category with spending: a zero-spend tail adds no bar and
  repeats "100.0%" on a flat line. The totals still read every category, and
  the foot states how many were left out.
- **The font-size trap:** `index.css` sets `font-size` on the universal
  selector, which reaches `<text>` too. Every text class restates its size.

## 7. Colour and state

- Put inks on classes, never on attributes: `.budgetPareto__bar--spent { fill:
  var(--color-scale-category-1); }`.
- The categorical scale `--color-scale-category-1..8` answers "which series".
  Status tokens (`--color-status-alert`) answer "is it wrong". Do not carry two
  meanings in one hue: an over-budget category also gets the word "over".
- The legend is HTML, above the SVG: swatches are `<span>`s with the same
  classes' inks, so it wraps on a phone.

## 8. Responsive behaviour

A 1:1 SVG has a fixed size in pixels, so CSS alone cannot make it responsive:
`width: 100%` on the `<svg>` would stretch text and strokes along with the
bars. The chart has to be told how much room it has and redraw its geometry for
that room. There are four steps.

### 8.1 A first version that is NOT responsive

The first cut of the Pareto gave every category a fixed `GROUP_WIDTH = 48` and
wrapped the SVG in a scroll box. That does not overflow the page, but it
does not use the page either: three categories drew a 144 px plot inside a
600 px card, with 120 px of empty room reserved under it for rotated names.
Scrolling is the fallback for too many categories, not the layout.

### 8.2 Measure the box

A `ResizeObserver` on the scroll box reports its content width on mount and on
every change: window resize, phone rotation, a sidebar opening.

```tsx
import { useEffect, useRef, useState } from 'react';

const scrollRef = useRef<HTMLDivElement>(null);
const [availableWidth, setAvailableWidth] = useState(0);

useEffect(() => {
 const box = scrollRef.current;
 if (!box) return;
 const observer = new ResizeObserver(([entry]) =>
  setAvailableWidth(entry.contentRect.width),
 );
 observer.observe(box);
 return () => observer.disconnect(); // no observer outlives the component
}, [categories]);

// …
<div ref={scrollRef} className='budgetPareto__scroll'>…</div>
```

- **Hooks before any early return.** `if (categories.length === 0) return null`
  sits after the hooks. A hook placed after it would run on some renders and not
  others, which React refuses.
- **The dependency is the data, not `[]`.** The box renders only when there is
  something to draw. With `[]` the effect runs once, finds no box on an empty
  month, and never observes the box that appears when the month changes.
- **The first frame measures 0.** Until the observer reports, the geometry falls
  back to the minimum widths, so the first paint is valid rather than broken.
- **`contentRect` excludes padding.** Keep the box free of padding, or subtract it.

A `ResizeObserver` beats `window.addEventListener('resize')`: it reports the
box, not the window, so it also reacts when the container changes size without
the window changing.

### 8.3 Share the width, with a floor

```ts
const MIN_GROUP_WIDTH = 48;   // below this, labels of neighbours overlap
const MIN_BAR_WIDTH = 15;
const MAX_BAR_WIDTH = 32;     // a single category must not draw a slab
const BAR_SHARE_OF_GROUP = 0.3;

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
const width = PAD_LEFT + drawn.length * groupWidth + PAD_RIGHT;
```

- **Few categories:** each group takes an equal share of the box, so the chart
  fills it exactly.
- **Many categories:** the share falls under 48, the floor wins, `width` exceeds
  the box, and the box scrolls.
- **`Math.floor`:** a fractional group width can sum a fraction of a pixel past
  the box and raise a scrollbar that scrolls nothing.
- **Every x position reads `groupWidth` and `barWidth`,** never a constant. One
  leftover `GROUP_WIDTH` puts bars and points on two different grids.

### 8.4 Fit the labels, then size the room under the plot

Rotated names are only needed when they do not fit. Decide per render:

```ts
const CHAR_WIDTH = 7; // estimate at --font-size-xs (0.75rem, 14-16px root)
const PAD_BOTTOM_FLAT = 28;
const PAD_BOTTOM_MAX = 160;

const longestLabel =
 Math.max(0, ...drawn.map((c) => categoryLabel(c).length)) * CHAR_WIDTH;
const rotateLabels = longestLabel > groupWidth - LABEL_OFFSET;
const padBottom = rotateLabels
 ? Math.min(PAD_BOTTOM_MAX, Math.ceil(longestLabel * Math.SQRT1_2) + LABEL_OFFSET * 4)
 : PAD_BOTTOM_FLAT;
const height = PAD_TOP + PLOT_HEIGHT + padBottom;
```

```tsx
<text
 x={cx}
 y={labelY}
 textAnchor={rotateLabels ? 'end' : 'middle'}
 transform={rotateLabels ? `rotate(-45 ${cx} ${labelY})` : undefined}
>
 {categoryLabel(category)}
</text>
```

- **Why √½:** a name rotated 45° drops by its length × sin 45°.
- **Why an estimate:** measuring real text needs the text rendered first
  (`getComputedTextLength`) and a second render. Seven pixels a character errs
  wide, so the worst case is a name rotated that would have fit flat, never one
  that overlaps.

### 8.5 The scroll box stays as the fallback

```tsx
<div ref={scrollRef} className='budgetPareto__scroll' tabIndex={0} role='region' aria-label='… scrolls sideways'>
 <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>…</svg>
</div>
```

```css
.overviewLayout .budgetPareto__scroll { overflow-x: auto; max-width: 100%; }
```

`tabIndex={0}` lets a keyboard user focus the box and scroll it with the arrow
keys. Give it a `:focus-visible` ring.

### 8.6 How to check it

- A month with 2 or 3 categories on a desktop: the plot spans the card, names
  are flat, no empty band under the axis.
- The same month narrowed to 360 px: groups shrink, then names rotate, then the
  box scrolls. The page itself never scrolls sideways.
- A month with 20+ categories: groups sit at 48, the box scrolls from the start.
- Rotate a phone or resize the window: the chart redraws without a reload.

## 9. Why it is dynamic

Nothing in the drawing is fixed to one month:

- **Data:** the component re-renders whenever `GET /overview/expense?month=` answers.
  Changing the month in the picker refetches, and the chart redraws.
- **Width:** it follows the box's measured width and the count of categories
  with spending.
- **Axis top:** it follows the tallest bar of that month.
- **Colours and labels:** they follow `isOverBudget`, `actualSpent` and
  `hasSkippedBudget` per row.

## 10. Accessibility

- The `<svg>` carries `role="img"` and an `aria-label` that summarises it.
- The figures the bars encode must also exist as text somewhere: in the labels,
  in a legend table, or in the list below. A screen reader does not read
  rectangles.
- Never convey a state only by colour.

## 11. Other chart types, same method

| Chart | Marks | Scale notes |
|---|---|---|
| Line or area over months | `<polyline>`, or `<path d="M … L … Z">` for the filled area | x by month index, y from zero or signed |
| Stacked horizontal bar | flex row of `<span>` widths (see `ParetoBar.tsx`) | the width is the server's share; no SVG needed |
| Donut | `<path>` arcs or `<circle>` with `stroke-dasharray` | angle = share × 2π; start at −π/2 for 12 o'clock |
| Sparkline | one `<polyline>`, `viewBox="0 0 100 100"`, `preserveAspectRatio="none"` | add `vector-effect="non-scaling-stroke"` so the stroke does not stretch |
| Progress track | two nested `<span>`s | width = min(served percentage, 100)% |

## 12. Checklist before a chart ships

- [ ] Every financial figure is a served field; the client computes only geometry.
- [ ] `width`, `height` and `viewBox` match (1:1), or `vector-effect` is set.
- [ ] Rotations carry their own centre point.
- [ ] Labels have a halo, or cannot collide.
- [ ] Every ink is a token on a class; no hex, no pixel font size.
- [ ] Every text class restates `font-size`.
- [ ] The chart measures its box (`ResizeObserver`) and fills it; it scrolls inside
      its own focusable box only past the minimum group width.
- [ ] Labels rotate only when they do not fit, and the room under the plot follows them.
- [ ] `role="img"` and `aria-label` are set; no state is conveyed by colour alone.
- [ ] Empty data (`categories.length === 0`) renders nothing, not an empty axis.
- [ ] A null figure (mixed currency) draws no mark, never a zero-height bar.
