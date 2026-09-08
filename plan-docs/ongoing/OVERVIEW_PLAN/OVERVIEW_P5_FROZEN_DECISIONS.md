# Overview — the decisions frozen for P5

Ruled by Carlos on 2026-09-08, after reading the three sketches and the two block
proposals. This is the authority for the frontend stage: a question answered here
is not reopened by a plan document that predates it, and a plan document that
contradicts it is the one that is wrong.

It records what was decided, what the decision binds, and — for the one decision
that was changed rather than approved — what the change was, so the difference
between what was proposed and what was ruled stays readable.

---

## 1. Six level-2 screens, separate from the three management boards

**Approved as proposed.**

The three boards that exist today and a level-2 screen share physical structure
and do not share function. `Budget`, `Pocket` and `Debts` administer entities. A
level-2 screen explains one domain over one period, with a series, an analysis
and the month's movements. The overlap is a layout, not a purpose, so level 2 is
not absorbed into them.

| surface | the question it answers |
|---|---|
| Overview, level 1 | what is my situation |
| Overview, level 2, one domain | why am I in it this month |
| level 3, one entity | which concrete entity explains it |
| `Budget`, `Pocket`, `Debts` | administer the entity |

**The precision Carlos added to the wording, and it is not cosmetic.** The
formulation is *build the six level-2 screens; the level-1 cards link to their
level-2, and the management boards keep their function and their own access to
their own entities.* Not "link the boards". The two paths stay independent:

```
Overview → level 2 of a domain → level 3 of an entity
Budget → the category
```

A reader who starts at the board reaches the entity without passing through
Overview, and `Budget → Overview Budget → Budget` never becomes an obligatory
circuit.

**No single `DomainOverviewPage` with six behaviour switches.** The six responses
do not carry the same analyses — debt publishes two series, investment a
reconciliation, pocket a progress figure per pocket — so each domain declares its
own composition. What is shared is shared because it is genuinely the same
object: the layout, the month picker, the domain header, the transaction list,
the series, and an analysis component only where the analysis is actually the
same one.

## 2. `ListContent` becomes Overview's

**Approved as proposed, with one condition.**

The component moves from `frontend/src/fintrack/general_components/listContent/`
to `frontend/src/fintrack/pages/overview/components/`, and ownership moves with
it. The measurement behind the move: it has exactly one consumer,
`LastMovements.tsx`, which is inside Overview, and it imports its own row type
`LastMovementType` upward from that same page component. A component in
`general_components/` taking its row type from a page component is a page
component filed in the wrong folder.

**The condition.** The permission covers this component and its minimum
dependencies. It is not authorisation to reorganise `general_components/`, and
nothing else moves for tidiness.

**The order of work, which is itself part of the ruling.**

1. move the component and its stylesheet
2. key the row on the transaction id
3. make the row a real button, which closes the keyboard focus, the
   `:focus-visible` anchor and the missing role in one change
4. remove the fabricated empty-state row
5. only then reuse it in the level-2 list

Step 2 before any accumulating list. Carlos: *primero corregir `ListContent`;
después implementar acumulación. No al revés.*

## 3. Analysis depth — MODIFIED, not approved as proposed

**What was proposed:** `derived` when the screen opens, `full` when the reader
expands the expensive block.

**What was ruled:** `derived` for the first response, `full` **when the analysis
block needs its data** — which is not necessarily a click.

**Why the change is right, and it is a defect in the proposal rather than a
preference.** The level-2 sketch draws the analyses as part of the screen, not as
collapsed content. Card, trend, decomposition, distribution and movements are all
visible. So "`full` only after a click" contradicts the screen it was written
for: it would put a click in front of content the design has already committed to
showing.

**The resulting sequence.**

```
open level 2
  → GET /overview/:domain?analysis=derived
  → paint immediately
  → the analysis block comes into need of data
  → GET /overview/:domain?analysis=full
  → complete the analysis
```

**What triggers the second request.** Explicit expansion if the block is
collapsible; entry into the viewport if the block is always part of the page.
Since the sketch keeps the analyses visible, the trigger is viewport entry. The
reader perceives *the page appeared immediately*, not *I have to click to see the
analysis*.

**What the two depths actually are**, because the names do not say it.
`derived` reshapes what the request already fetched and runs no additional
statement: the long series is the same monthly query over a wider bound, the
expense decomposition is a subtraction over two figures the card publishes, the
investment reconciliation is arithmetic over four of them. `full` runs the
statements that have to be run for the first time, and there are exactly four
gated sites: income by source, the investment balance per account and
contribution history, the pocket bank balance and free cash, and the debt
analysis rows.

Absent is neither depth and stays the default, so a client that has not been
updated receives the payload it received before the parameter existed. An
unrecognised value answers 400 naming the key rather than being read as "no
analysis", because silently serving a shallower payload would look like an empty
result.

---

## 4. The mockup rulings

| subject | ruling | what it binds |
|---|---|---|
| level-1 hero | approved | the position figures read at the close of the chosen month and the flows during it; cash and free cash stay separate figures and pocket is not folded into cash |
| liquid net worth | approved, with a boundary | `netWorth - liquidNetWorth == receivable` is a **validation identity, never the production formula** — liquid net worth is not derived from net worth |
| monthly snapshot | approved | the four values, the three fetch states, and no `0` standing in for an absent baseline |
| the 15 % / 40 % thresholds | frozen as V1 | **named constants, not numbers in the JSX**; revisited against real data once twelve months are loaded |
| year to date | moved out of the snapshot | it is an accumulation of the year and the snapshot compares a month against its history; one figure, one temporal nature |
| level-2 structure | approved | card, then series, then analysis, then the movement list — the list last because it is the block that grows |
| level-2 transactions | approved, with a precondition | the row key is the transaction id **before** accumulation is implemented |
| the expense distribution | approved | the legend is the accessible table, no reordering in the frontend, colour encodes magnitude and never rank, 80 % as the reference line, and no red for magnitude |
| the ochre ramp | **not an architectural requirement** | what is binding is *colour represents magnitude, not identity or state*. The concrete ramp and its token name close with the visual system and block neither the backend nor level-2 routing |
| level-3 navigation | approved | the routing table and the four row states are sufficiently defined |
| the pocket figure | **changed** | it is no longer presented as a share of the total — see below |

**The pocket change, applied to `bosquejo-overview-nivel-3.html` in this same
commit.** The other breakdowns put a share of the total in that column. Pocket's
figure is the progress of each pocket against its own target, and those do not
sum to 100. It now leaves the share column entirely: a progress bar plus the
figure labelled *de su meta*, which is a different object from a percentage
number and cannot be read as a part of the sum. The gap that recorded this as an
open question is now recorded as settled.

---

## 5. What is still open after this document

- **The route for a level-2 screen.** The recommendation on the table is
  `overview/:domain` as a child of the overview layout, so the screen inherits
  the month picker and the header instead of repeating them. Not ruled.
- **No app token is assigned to any block of any sketch.** The colours in all
  three sketches are reading colours. The design system supplies the real ones
  before any of it becomes a stylesheet.
- **There is no frontend test in this repository.** The row key, the
  accumulation and the viewport trigger are verified by hand until there is.
