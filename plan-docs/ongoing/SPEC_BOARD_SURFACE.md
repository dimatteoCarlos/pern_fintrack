# BOARD SURFACE — the frozen values, measured in the browser 2026-08-26

Every figure below was read with `getBoundingClientRect` and `getComputedStyle`
on the running app at 393x852, device scale 2, signed in against `fintrack_dev`.
**None of it is written to the application tree.** The rules were injected into
the page and are gone on reload; this document is the only record.

Root font size is fluid, so px readings are quoted with their rem equivalent, and
the rem value is what goes into the code.

---

## 1. The board's surface

Two cards of one fill, read as a single card cut in two: the hero closes square
at the bottom, the content closes square at the top, a gap of one line separates
them, and the panel that used to frame both disappears.

| declaration | selector | value |
|---|---|---|
| the frame stops painting | `.budgetLayout` | `background-color: transparent` |
| and stops insetting | `.budgetLayout` | `padding-left: 0; padding-right: 0` |
| the cut | `.budgetLayout` | `gap: 1rem` |
| upper half | `.budgetLayout .total__container` | `background-color: <fill>` · `border-radius: 1rem 1rem 0 0` |
| lower half | `.budgetLayout .content__presentation` | `background-color: <fill>` · `border-radius: 0 0 1rem 1rem` · `padding: 0.75rem` |

**Why the frame goes transparent rather than thinner.** Measured before the
change, `.budgetLayout` was 390.7px wide and `.content__presentation` 369.1px, so
its fill showed only as a 10.8px band on each side — and that band, crossing the
hero at the panel's top edge, was the seam the developer reported. Removing the
fill removes the seam; narrowing it would only shorten the line.

The hero keeps `width: 100%` and now measures 390.7px like the content, because
the panel no longer insets either of them.

## 2. Type weight in the cream strip

The strip was the only place on the board where a figure outweighed its own
label: labels at 600, figures at **700**.

| selector | was | is |
|---|---|---|
| `.budgetLayout .displayScreen--result` | 700 | **400** |
| `.budgetLayout .budgetHero__remainWord` | 700 | **400** |
| `.budgetLayout .displayScreen--concept` | 600 | 600, unchanged |

`.total__amount` was already 400 and is not touched — what reads heavy there is
28.8px of pure white, not weight. The face is **Outfit variable with 100–900
loaded**, so any weight in that range is a real cut, never a synthesised one.

`displayScreen--result` is also worn by tracker and pocket, which is why the rule
is scoped to `.budgetLayout`.

## 3. Spacing

| gap | was | is |
|---|---|---|
| between the two cards | — (one panel framed both) | **1rem** |
| figure to its percentage | 0.5rem | **0.25rem** |
| card title to the controls | 0.5rem | **0** |
| controls to the list | 1.5rem | **1rem** |

The title still breathes at zero: `presentation__card--title` carries
`padding-bottom: 1rem` inside its own box, so 14.5px separate the text from the
search field. The 0.5rem removed was `budgetListControls`'s own `margin-top`.

**Usable list height rose from 251px to 267px** across these four changes.

Noted, not fixed here: the four children of `.cards__presentation` are spaced
three different ways — the title by padding, the controls by margin, the other two
by nothing. The rhythm belongs in one `gap` on the parent with no child carrying
its own margin. That is its own commit.

## 4. The percentages

`Spent` showed its share bare and `Remaining` showed it parenthesised
(`BudgetBigBoxResult.tsx:62` against `:71-75`). Both are parenthesised now.

The original asymmetry had a reason, recorded in the comment at `:68-70`: the
remaining share depends on the word before it, since the same number reads as
*2.9% left* or *436.8% over*. But both figures are glosses of the amount beside
them, they sit in the same column with the same class and colour, and only one
carried the mark — which reads as an inconsistency rather than a distinction.

**CLOSED 2026-08-29.** The rule the developer set is about meaning, not about a
literal colour:

> **A row percentage carries the same visual semantics as the matching indicator in
> the hero above it.** The same interpretation, the same range, the same
> signalling. Not necessarily the identical colour.

So a row reading `72%` as progress towards a target is read the same way as the
hero's `72%`, and a reader does not have to learn the figure twice on one screen.
What the rule permits is a different weight or tint for a figure that sits in a
dense list rather than in a hero; what it forbids is the same number meaning one
thing above and another below.

This has to be discharged before the board is closed: today the row percentages are
bare while the hero's carries its mark, which reads as an inconsistency rather than
as a distinction.

**Reverted, and recorded so it is not re-proposed:** dropping the currency symbol
from the rows and declaring it once in the column legend. The developer refused
it on the evidence of commercial products — YNAB and its peers repeat the symbol
beside every figure. The symbol stays in every row.

## 5. The warning colour

Measured on the black card:

| state | token | value | contrast on black |
|---|---|---|---|
| ok | `--color-status-ok` | `#5b8c93` | 5.62 : 1 |
| alert | `--color-status-alert` | `#c97474` | 6.23 : 1 |
| warning, **before** | `--color-status-warning` | `#ffa500` | **10.63 : 1** |
| warning, **candidate** | `--color-status-warning` | `#b8894e` | **6.73 : 1** |
| warning, brighter option | — | `#c9944e` | 7.83 : 1 |

All five row percentages measured **font-weight 400, 10.87px, letter-spacing
0.5px, opacity 1, no text-stroke**. Nothing is bold. What read as bold was the
warning colour carrying nearly twice the contrast of its siblings.

`#ffa500` is the CSS keyword `orange` — full saturation, the only one of the three
not chosen alongside the others. Its effect was backwards: the warning shouted
louder than the alert.

On the cream strip the change also improves: `#b8894e` on `#e8e4da` gives 2.7 : 1
against the keyword's 1.8 : 1.

**This is a token, so it moves every screen that uses it.** It was probed scoped
to `.budgetLayout` alone so the rest of the app held still while it was judged.

---

## 6. Two values with no token — both are the developer's to name

- **The card fill.** Applied as `#000`, which sits 1.09 : 1 *below* the body's
  `#0d0f12` — the elevation is inverted, a well rather than a raised sheet. The
  nearest existing token is `--color-surface-sunken: #0c0c0c`, semantically right
  and **1.01 : 1** against the body, which is invisible. So the token that fits
  cannot be seen, and the value that can be seen has no token.
- **The warning colour**, `#b8894e` above.

Nothing is written until the developer names them.

## 7. What the four boards share — shipped 2026-08-26

All four heroes are anchored by one rule in `generalStyles.css`, scoped by layout
to hold specificity (0,2,0):

```css
.budgetLayout .total__container,
.pocketLayout .total__container,
.debtsLayout .bigBox__container,
.overviewLayout .bigBox__container {
 position: static;
 transform: none;
 height: auto;
 margin-top: calc(var(--header-total-height) - var(--header-height));
 min-height: calc(
  var(--header-height) - var(--header-total-height) + var(--space-4)
 );
}
```

It lives there and not in each page because the anchor is built entirely from the
two header tokens, and four copies of it drifted. The selectors carry layout names
for the specificity: each page stylesheet is imported by its own layout component,
so their injection order depends on the route the session entered by, and a
class-level rule would win or lose that race against the absolute positioning in
`tracker-style.css`.

**Measured after the commit, with a hard reload and no injected probes:**

| ventana | arranque | izquierda | ancho | separación |
| --- | --- | --- | --- | --- |
| 360×650 · 360×568 | 95.2 | 21.6 | 316.8 | 1rem |
| 393×852 | 135.3 | 23.6 | 346.4 | 1rem |
| 480×800 | 139.4 | 28.8 | 422.4 | 1rem |
| 768×1024 | 152.8 | 102.4 | 563.2 | 1rem |

Identical on all four boards in every row. No horizontal overflow anywhere.

**What is deliberately not uniform: how far each hero crosses the white header.**
It runs from 14px on Pocket to 146px on Debts, because each hero carries a
different amount of content. Equalising it would mean padding Pocket's single row
out to the height of Debts' three blocks. The start and the width are the contract;
the bottom edge is content.

**Pocket takes the treatment**, plus two faults only it had: it floated 23.1px
down the taller band, because the shell spreads its three children with
`space-between` and this board is shorter than the screen; and its one-row hero
stopped 9.8px short of the header's bottom edge, so the seam fell on white. The
shared `min-height` is what crosses it.

**Debts and Overview keep a cream hero of a different component**,
`.bigBox__container`, so neither is the top half of a cut card. Debts gets a card
of its own, closed on all four corners. Overview gets none: it is a feed of
thirteen already-carded sections in three fills — `#141414`, `#1b1b1b` and cream.
**Unifying those three with `--color-surface-deep` is open and unscheduled.**

**The width is uniform but its mechanism is not.** Budget and Pocket reach 88% of
the shell through a layout at 88% with the hero at `width: 100%`; Debts and
Overview through a layout at 100% with the hero at `width: 88%`. Both give the
same number at every breakpoint measured. Writing it once would mean moving
Budget's and Pocket's whole board off its layout width, starting with
`.content__presentation`. **Open, and not worth a commit on its own.**

## 8. Dead declarations removed

`top: 7.5rem` was declared on `.budgetLayout` and on `.pocketLayout`, and neither
element is ever positioned — both measure `position: static`, so `top` did
nothing. Removed with the panel's fill.

`padding: 0.75rem 0` on the same two layouts was breathing room for a fill that no
longer paints. All it did was displace the hero, and it is what forced those two
boards' anchor to carry a `- var(--space-3)` the other two did not. Removed.

Overview's hero carried `z-index: 2` to clear `.layout__header`. `z-index` is
ignored on a static box, and the hero now starts 17.5px after that header ends.
Removed.

## 9. Found, recorded, not acted on

**The MonthPicker's wrapper is `position: absolute; top: 62px`** — a literal in
pixels inside a header whose height changes between the two viewport bands. It
overflows `.headerContent__container` by 7px, which is why Budget's gap under the
header content is 10.5px where the other three are 17.5px. Out of scope for this
work and left untouched.

**`.layout__header` measures 5.55rem while `--header-content-height` reserves
6.8rem** — the box is 17.5px shorter than its own token. Setting it to the token
brings Pocket, Debts and Overview to one identical gap; Budget stays 7px tighter
until the picker above is dealt with. Measured, not applied.
