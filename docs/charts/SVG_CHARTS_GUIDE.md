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

- **Redundancy:** do not label a point that does not move the line. The tail of
  a Pareto sits at 100%, and printing "100.0%" on every zero-spend category adds
  nothing.
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

A categorical chart cannot shrink below `GROUP_WIDTH` per category without
overlapping labels. The chart keeps its natural width and scrolls sideways inside
its own box:

```tsx
<div className='budgetPareto__scroll' tabIndex={0} role='region' aria-label='… scrolls sideways'>
 <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>…</svg>
</div>
```

```css
.overviewLayout .budgetPareto__scroll { overflow-x: auto; max-width: 100%; }
```

`tabIndex={0}` lets a keyboard user focus the box and scroll it with the arrow
keys. Give it a `:focus-visible` ring.

## 9. Why it is dynamic

Nothing in the drawing is fixed to one month:

- **Data:** the component re-renders whenever `GET /overview/expense?month=` answers.
  Changing the month in the picker refetches, and the chart redraws.
- **Width:** it follows `categories.length`.
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
- [ ] Wide charts scroll inside their own focusable box.
- [ ] `role="img"` and `aria-label` are set; no state is conveyed by colour alone.
- [ ] Empty data (`categories.length === 0`) renders nothing, not an empty axis.
- [ ] A null figure (mixed currency) draws no mark, never a zero-height bar.
