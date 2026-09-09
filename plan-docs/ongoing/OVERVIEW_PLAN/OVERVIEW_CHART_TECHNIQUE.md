# Overview — how a chart is drawn in this module

**Written 2026-09-08.** Every rule below is taken from the one chart that is
built and shipped, `TrendCharts.tsx` with its rules in `overview-styles.css`
:524-593. Nothing here is a proposal: it is the technique that already renders,
written down so the charts still to build come out the same way instead of each
inventing its own.

**Scheduled to fold into `OVERVIEW_LAYOUT.md` on 2026-09-09.** It stays a
separate file until that document is rewritten in English.

It is a technique document, not a design document. What a chart looks like is
decided in the mockups and in `OVERVIEW_DECISIONS.md`. This says how it is made.

---

## 1. The one decision everything else follows from: no chart library

The trend line is a `<polyline>` in an inline `<svg>` and the point markers are
ordinary elements with a position. No dependency was added.

**Why, and when that stops being right.** A library earns its place when there is
a coordinate system to draw — axes with ticks, a legend, zoom, a brush, a
tooltip that follows the pointer across a continuous domain. A six-point line
over named months has none of that. Six numbers do not need a runtime.

Three things are gained and they are the reason to keep the rule:

- **`var(--token)` resolves on an element and on an SVG attribute alike.** A
  library that paints from a JavaScript colour array puts every colour outside
  the design system, and the theme switch stops reaching it.
- **Every value stays a DOM node.** A month can carry a `title`, a link, a focus
  ring. A canvas renderer gives back one rectangle with no parts.
- **The page weighs nothing extra.** Overview is the first screen after login.

**The line at which to reconsider:** a chart that needs hit-testing against a
continuous axis, or more than a few hundred points. Neither exists in this
module today, and the level-2 series is thirteen points.

---

## 2. The plot box: a 0-100 square, stretched

```
viewBox='0 0 100 100'  preserveAspectRatio='none'
```

The plot is authored in a square of 100 by 100 on both axes and then stretched
to whatever the card gives it. Every coordinate the component computes is
therefore a **percentage of the plot**, never a pixel, and the same arithmetic
serves a 320px phone and a 900px card with no breakpoint.

Three consequences, and all three are load-bearing rather than incidental.

**The stroke must not scale.** A stretched box scales the stroke with it, so the
line would be thicker on a wide card than on a narrow one, and thicker
horizontally than vertically. `vectorEffect='non-scaling-stroke'` on the
`polyline` is what keeps it one width. **This attribute is not optional in this
module** — the box is always stretched.

**A round marker cannot be an SVG circle.** A circle in a stretched box comes out
an ellipse. That is why the markers are `<span>` elements positioned over the
plot in percentages, outside the SVG, where `border-radius` still means a circle.

**Nothing may touch the edge of the box.** The stroke and the markers are drawn
in real pixels centred on their coordinate, so a point at 0 or at 100 is cut in
half by the boundary. The band is inset instead:

```ts
const PLOT_PADDING = 10;              // percent of the plot, at each end
const PLOT_BAND = 100 - PLOT_PADDING * 2;
```

Every vertical coordinate is then `PLOT_PADDING + ratio * PLOT_BAND`, never
`ratio * 100`.

---

## 3. Two readings of one ratio, because two axes run opposite ways

A point is computed once as a ratio in 0-1 and then read twice:

```ts
y:      PLOT_PADDING + (1 - ratio) * PLOT_BAND,   // svg, grows DOWNWARD
bottom: PLOT_PADDING + ratio * PLOT_BAND,          // css, placed from the FLOOR
```

The SVG y axis grows down from the top and a CSS `bottom` grows up from the
floor. Deriving one from the other rather than computing two ratios is what
keeps the marker on the line: two independent computations are two chances to
round differently, and the marker would sit a hair off the vertex it marks.

---

## 4. A point sits at the CENTRE of its cell, not at a division of the width

```ts
const positionX = (index, count) => ((index + 0.5) / count) * 100;
```

**Not `index / (count - 1)`.** The axis under the plot is a row of equal cells
with the month name centred in each, so the first point of a divide-by-gaps
layout lands on the left edge of the card with its own month name half a cell
away from it. The `+ 0.5` is what puts the point over its label.

The axis row therefore carries **no `gap`**, and each cell is `flex: 1` with
`text-align: center`. A gap there and the labels drift out from under their
points, progressively, the last one worst.

---

## 5. Scale: per series, from zero

```ts
const peak = Math.max(...points.map((p) => Math.abs(p.value)), 0);
const ratioOf = (value, peak) => (peak <= 0 ? 0 : Math.abs(value) / peak);
```

**Against this series' own peak, not a scale shared across charts.** Income and
expense differ by an order of magnitude for most owners, and a shared scale
flattens the smaller one onto the axis. Each chart answers *how did this domain
move*; *which domain is bigger* is a question the cards above already answer with
figures, and a chart that tries to answer both answers neither well.

**From zero, not from the smallest month.** Starting the band at the minimum
makes the height of a point its rank inside the window rather than its size, so
a flat year renders as dramatic movement.

**`peak <= 0` returns 0 rather than dividing.** An all-zero series is a real flat
line at the floor, and the alternative is a division by zero — the invented
number the money rules forbid.

---

## 6. Accessibility, and why the `title` is not enough

The plot container is the accessible object:

```tsx
<div className='trendChart__plot' role='img'
     aria-label={`${label}, last 6 months. ${plotted.map(p => p.title).join('. ')}`}>
```

- **The whole series goes in the label.** A screen reader and a keyboard user
  both get every figure, which is the same information the pointer gets by
  hovering.
- **The `<svg>` is `aria-hidden`.** It is the same information a second time.
- **The markers keep their `title`** for the pointer, and that is all a `title`
  is: it is not announced on its own and the markers are not focusable. A chart
  whose only reading is a `title` has no reading for half its audience.
- **The chart is never `aria-hidden` as a whole.** It carries figures; it is not
  decoration.

---

## 7. Tokens, and the two exceptions that are declared

Every colour, radius and size comes from `var(--token)`: `--color-accent` for
the stroke and the marker, `--space-1` for the marker size, `--radius-full`,
`--color-border-subtle`, `--font-size-xs`.

Two values in the shipped chart are not tokens, and both say so in the
stylesheet where they sit:

- **`stroke-width: 2`** — there is no stroke-width token. The card border above
  it is declared at `1px` the same way, so the line is set at twice that and
  follows whatever that border becomes.
- **`letter-spacing: 0.65px`** on the axis labels.

**The rule when a chart needs a value with no token** (Carlos, 2026-09-08): add
the token the component needs and normalise later. Do not stall, and do not
hardcode a raw value inside a rule — declare the token, use it, and say in the
commit that it is awaiting normalisation.

**The one categorical ramp still missing.** The distribution bar needs a
five-step ramp and the design system has no ramp token. That is the same
situation, and under the amended rule it is now unblocked.

---

## 8. The trap that costs an hour if it is not known

`index.css` sets `font-size` on the **universal selector**. An inline element
therefore does not inherit the size of the line it sits in — it takes 16px from
the universal rule instead. Every text node inside a chart that should take its
parent's size must restate:

```css
font-size: inherit;
```

`overview-styles.css:592` carries it on the axis span, with the note that without
it the six month names render at twice their size and touch each other.

---

## 9. Fetch states, said in the shape of the data

`TrendCharts` reads the absence of a key as the statement:

```ts
const drawn = SERIES.filter(({ key }) => charts.trend[key] !== undefined);
if (drawn.length === 0) return null;
```

- **An absent key means the domain has no series.** Three of the six domains
  never carry one.
- **An empty array would mean something else** — it has a series and the months
  came back blank — and the two must not render alike.
- **A month with a value of 0 is a real point** and is drawn. Dropping it bends
  the line between the two months around it.
- **A missing figure is a skeleton or a dash, never `0` and never `NaN`.**

---

## 10. Currency comes off the card, never from a constant

```ts
const currency = domainCards?.income.currency ?? DEFAULT_CURRENCY;
```

Every figure is stored in the accounting currency and the cards publish it per
domain. Read from the payload so a tooltip cannot name a currency the figures are
not in.

---

## 11. Applying the technique to the shapes still to build

Nothing below needs a new mechanism. Each is the same box, the same band, the
same per-cell centring.

| shape | what it adds | the one thing to get right |
|---|---|---|
| **a second line over the first** — the plan's cumulative curve over the spend's | a second `<polyline>` in the SAME `<svg>`, its own class | the two curves must differ by **two** codes, not one. Colour plus dash pattern, or value plus texture. `OVERVIEW_DECISIONS.md` records that the pair currently distinguishes by value and texture because the data-series palette does not exist yet |
| **a bar per category** — the distribution | elements, not SVG. A row whose width is `${share * 100}%` | a sub-pixel segment still has to be visible. Give the bar a `min-width` so a 0.2% category is a sliver and not nothing |
| **an outlined bar behind a filled one** — plan behind spend | two absolutely positioned children in one track | both bars share **one origin and one scale**, or the overshoot stops being readable as a length. The outline is `background: transparent` with a border, never a pale fill |
| **two series side by side** — the debt legs | two independent charts sharing a peak, or one chart with two polylines | this is the one case where a **shared** peak is right: the question is precisely whether one leg is bigger than the other, which is the opposite of §5's case. State it in the component |
| **a cumulative percentage axis** | a second scale, 0-100, on the right | a cumulative curve is a ratio and always ends at 1, so it does NOT share the money scale. Two scales in one plot need the second one labelled or the reader takes the curve for money |

**What none of them gets.** No animation on first paint of a figure — a number
that counts up is unreadable while it moves. No gradient fill under a line. No
axis gridlines behind a six-point series; there is nothing to align against.

---

## 12. Checklist before a chart is called done

- The `viewBox` is `0 0 100 100` with `preserveAspectRatio='none'`, and every
  stroke carries `vectorEffect='non-scaling-stroke'`.
- No round marker is an SVG circle.
- Every coordinate is inset by the padding band; nothing sits at 0 or 100.
- Points are centred in their cells and the axis row has no `gap`.
- The scale starts at zero, and the choice of shared or per-series peak is
  stated in the component with its reason.
- The plot carries `role='img'` and an `aria-label` holding every figure; the
  `<svg>` inside it is `aria-hidden`.
- Every colour and size is a `var(--token)`; any exception is declared in the
  rule where it sits.
- Every text node inside the chart restates `font-size: inherit`.
- An absent series and an empty series render differently, and neither renders
  as `0`.
- The currency is read from the payload.
