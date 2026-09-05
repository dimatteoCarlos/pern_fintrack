# Pocket levels — the reference

The complete definition of how one pocket is classified: what is read, how the
figures are derived, the seven levels with their criteria and their colours, and
one worked example of every level on a single plan.

**Status: ruled, implemented and verified on 2026-09-04.** The classifier
(`backend/src/fintrack_api/services/pocket_services/core/pocketLevel.js`)
carries the seven levels and the tolerance band, and the exported level
order is frozen with seven entries. Ten cases covering the seven levels and
the two special shapes were run against the classifier and land where this
document says.

**The line the classifier reads is continuous in days**, ruled later the same day
and recorded as the ruling that the plan's line is spread evenly across the days
from the day the plan was made to its deadline (`POCKET_DECISIONS.md` section
29). It replaced a line that stepped once per calendar month. **The seven levels
and their thresholds did not move with it** — what moved is the figure they read,
so a pocket can cross a threshold without any threshold changing. The worked
examples of sections 4 and 5 were recomputed onto the daily line by hand and have
not been re-run, so their arithmetic is checkable but not asserted.

The ruling the level scale itself expands — that being ahead of the line, on it
and short of it are three readings rather than one — is `POCKET_DECISIONS.md`
section 24 (2026-09-04); the payload shape is in `POCKET_CONTRACT_AUDIT.md` under
the contract change of the same date. Where the two disagree with this file, they
are the authority and this file is the explanation.

**Where it is decided: one place, on the server.** The client maps a level to a
word and a colour; it never derives one. A level computed twice is two answers to
the same question, and a header disagreeing with the card beneath it is a defect
this module already had once.

---

## 1. What is read, and what is deliberately not

**Four stored values and one date.** Nothing else.

| input | column or source |
| --- | --- |
| the target | `pockets.target_amount` |
| the deadline | `pockets.desired_date` |
| the day the plan was made | `pockets.created_at` |
| what has been committed | the sum of `pocket_allocations.amount`, signed |
| the evaluation date | resolved per request, see below |

**What is NOT read: the sequence of past movements.** No achieved rate, no
projected date. A rate measured over the ledger records how often the owner
changed their mind, not how fast money arrived: a commitment of 500 followed by a
release of 400 and a commitment of 300 is the same 400 as a single deposit, and a
rate would call the first owner three times as active. Decided out three times
and the reason is written into `pocketBoardService.js:18-21`.

**The question this classifier answers is therefore not "how fast is this owner
moving" but "where should this plan be by now, and can it still be met".**

### The evaluation date

One date, and every comparison on the board reads it:

- the selected month is the current month → **today on the owner's calendar**
- the selected month is past → **the last day of that month**

The owner's calendar is the date obtained by reading the current instant in the
IANA zone stored on the user row (`users.timezone`), resolved in SQL. Never the
browser clock and never UTC: a deadline of `2026-09-03` has already passed for an
owner in Auckland while it is still the 2nd in Bogotá, and only the server knows
which.

### An edited target is retroactive

The plan holds one target, the current one, and it is in force from the day the
plan was made. A past month therefore reports one progress before a target is
corrected and another after it. That is the ruling working, not a defect.

---

## 2. The calculation, step by step

All amounts are decimals; the ratio is rounded to two places at the end and
nowhere before.

### Step 1 — the days the plan has

```
planDays = daysBetween(planStart, desiredDate)
```

Both labels are parsed at UTC midnight, deliberately, so the offset cancels and
the result is a count of calendar days rather than a duration that a
daylight-saving hour could round the wrong way. There is one copy of that
arithmetic, exported from `planSchedule.js` and consumed by `makePocketStatus`,
because two copies of date arithmetic is how a board and a card come to disagree
about how many days are left.

**The window is a duration, not a calendar shape.** Nothing here asks which month
a date falls in. The day the plan was made is the day the line starts at zero,
not a month written off: a plan made on the 20th and due on the 25th has five
days, and a plan made on the 30th is charged for the days of that month it
actually had rather than for the whole of it.

### Step 2 — the guard: a plan with no window

```
if planDays ≤ 0
    → planInstalment, scheduledByNow, aheadOfPlan and paceRatio are all null
```

**One shape reaches it: a deadline on or before the day the plan was made.** Two
kinds of pocket hold it and both are legacy — one created and dated the same day,
and the one carried over by migration 020, whose creation stamp is the
migration's own date. A deadline already past is refused at creation with a 422,
so no new pocket arrives here.

Such a pocket **has no line**, so it can be neither ahead of one nor short of
one. It falls to *On track* and the card states that the plan has no window
rather than printing a pace built on nothing.

**A window of one day publishes a line.** The rule this replaced needed a full
calendar month to exist and withheld all four schedule fields otherwise, so a
plan made and due inside one month was measured by nothing at all — the owner had
made a commitment for that month and the board had no figure to hold it against.

### Step 3 — the daily rate

```
dailyRate = target ÷ planDays
```

This is the plan's own pace: what it committed to per day, on the day it was
made. It does not round — the division stays exact until the payload boundary,
where the amounts derived from it are taken to two places.

**The monthly figure is presentation, and it is derived from this one:**

```
planInstalment = dailyRate × 30.44
```

30.44 is the mean length of a Gregorian month; 30 would overstate a pace by half
a percent every month. It is served because a month is the unit an owner thinks
in, and **no screen renders it today**. It classifies nothing and it cannot
disagree with the line, because it is the line's own rate in another unit.

### Step 4 — the days already elapsed

```
elapsedDays = clamp(daysBetween(planStart, evaluationDate), 0, planDays)
```

**Clamped at both ends.** The upper bound is what stops a plan read past its
deadline from being asked for more than its target. The lower one guards a board
read at a month that closed before the plan existed — the repository already
filters those out, but the line must not go negative if one ever arrives.

**Why the line is continuous rather than step-wise.** A line that stepped once
per calendar month was tried first and it has the worse of the two defects: it
jumps a whole instalment at midnight on the 1st, so an owner who contributes on
the 5th of every month reads *Behind* from the 1st to the 5th, every month,
having changed nothing and having done precisely what the plan asks. The same
step billed a plan made on the 30th for a full instalment on its first day and
for two of them on its second. A daily line moves by one day's rate at the turn
of the month, which is the smallest step the stored data supports, and the
tolerance band below is what absorbs it.

The objection that was put against a continuous line — that it climbs every day,
so the same pocket reads *On track* on the 2nd and *Behind* on the 28th with no
change in behaviour — describes a pocket that has contributed nothing for
twenty-six days. That is a real change in behaviour and the reading should show
it. What the step-wise version bought instead was a reading that stayed flat
while an owner fell behind and then moved a whole instalment on a date that says
nothing about that owner at all.

### Step 5 — where the plan should be, and where it actually is

```
scheduledByNow = dailyRate × elapsedDays
aheadOfPlan    = committed − scheduledByNow        (signed)
```

`aheadOfPlan` is signed on purpose: positive is committed beyond the line,
negative is short of it. The screen states the direction in words; the payload
states the amount once, so no consumer derives the other half and disagrees.

### Step 6 — the days still to come

```
daysRemaining = daysBetween(evaluationDate, desiredDate)
daysLeft      = max(daysRemaining, 1)
```

**Floored at one.** When the deadline is the evaluation date itself and a
remainder survives, the plan has a day or less to close it; dividing by zero
there would lose exactly the case the ratio exists to catch.

### Step 7 — the ratio

```
remainder = target − committed

paceRatio = null                                  if the deadline has passed
          = 0                                     if remainder ≤ 0
          = (remainder ÷ daysLeft) ÷ dailyRate    otherwise
```

**In words: what is now needed per day, over what the plan set per day.**

It is dimensionless — a day against a day — which is why it works the same on a
three-month plan and a five-year one. That is what it replaced: a fixed threshold
of thirty days treated both identically, and the question the owner is actually
asking is not *how long is left* but *can I still cover it*.

**A note on the denominator.** Both operands are daily rates read off the same
three stored values, so the two figures the payload serves in monthly terms are
this ratio's own halves in another unit: the forward pace (`requiredMonthly` in
`makePocketStatus.js`, the remainder over the days left, expressed per mean
month) over the plan's own instalment (`planInstalment`, the daily rate over the
same mean month). The mean month cancels, and `paceRatio` is `requiredMonthly ÷
planInstalment` exactly.

The rule this replaced divided the remainder by days on one side and the target
by whole calendar months on the other, so two denominators described one plan: a
pocket sitting exactly on its line rated **1.14 instead of 1**, and the code
carried a comment telling consumers not to mix the two. **A pocket sitting
exactly on its line now rates exactly 1.** The two served figures agree by
construction rather than by warning, which is what lets the level boundary and
the money figure describe one fact instead of two.

### Step 8 — the classification, top down

The first condition that holds decides. Evaluating top down is what makes the
seven levels mutually exclusive by construction rather than by a rule written in
a comment.

```
1.  committed  >  target                                    → aboveTarget
2.  committed  ≥  target                                    → completed
3.  deadline has passed                                     → overdue
4.  paceRatio is null (no window)                           → onTrack
5.  paceRatio  ≥  2                                         → atRisk
6.  paceRatio  >  1.05                                      → behind
7.  paceRatio  <  0.95  AND  aheadOfPlan  >  0              → ahead
8.  paceRatio  <  0.95  AND  aheadOfPlan  ≤  0              → behind
9.  otherwise                                               → onTrack
```

**Why the order puts the finished states first.** `aheadOfPlan` is also positive
on a pocket that has already met its goal, so a pocket reading *Completed* would
otherwise be caught by the *ahead* test. Placing the two finished states above it
keeps *ahead* to pockets still in progress, which is the only place the word
means anything.

**Why *ahead* needs the money as well as the ratio.** See the worked example in
section 5: on the deadline day itself the days left are floored at one, and the
ratio can read low while the pocket is short of its whole target. Without the
second condition the card would print *"30.00 behind the plan"* under a level
word saying *Ahead*.

### The tolerance band

*On track* is the ratio within **five hundredths either side of 1**, not the
point where it equals 1 exactly.

**Why a band is required at all.** The daily rate is a division that rarely
terminates — 12,000 over 351 days is 34.188034… — so exact equality is reached by
almost no pocket on almost no day. Split at the point and *On track* becomes a
level that is defined and never fires, which is the same defect as the retired
*Active* bucket that appeared on a filter and nowhere else on the screen it
filtered.

**Why the band is on the ratio and not on a sum of money.** A ratio tolerance is
worth more money early in a plan and less money late in it, which is the property
the ratio was chosen for when the thirty-day threshold was rejected. Half a
month's worth of the plan short with eleven months left is noise; the same sum
short with one month left is not. A fixed sum would call both by the same word.

**Why it is symmetric.** *On track* has to mean the plan is being met as written,
and a pocket two hundredths over its line is meeting it exactly as much as one
two hundredths under. The asymmetry belongs in the colour, not in the boundary.

**The value is a recommendation, still open** until a real board is read at it.

---

## 3. The seven levels

Listed in evaluation order. The colours are measured against
`--color-surface-deep` (`#000000`), which is what the board cards paint.

<table>
 <tr>
  <th align="left">mark</th><th align="left">level</th><th align="left">value</th>
  <th align="left">on the card</th><th align="left">on the cream panel</th>
 </tr>
 <tr>
  <td style="background:#000000"><span style="color:#5faa78">&#9632;&#9632;&#9632;</span></td>
  <td>Completed</td><td><code>#5faa78</code></td><td>7.51</td><td>2.20</td>
 </tr>
 <tr>
  <td style="background:#000000"><span style="color:#60b1d6">&#9632;&#9632;&#9632;</span></td>
  <td>Above target</td><td><code>#60b1d6</code></td><td>8.76</td><td>1.89</td>
 </tr>
 <tr>
  <td style="background:#000000"><span style="color:#c97474">&#9632;&#9632;&#9632;</span></td>
  <td>Overdue</td><td><code>#c97474</code></td><td>6.23</td><td>2.65</td>
 </tr>
 <tr>
  <td style="background:#000000"><span style="color:#b8894e">&#9632;&#9632;&#9632;</span></td>
  <td>At risk</td><td><code>#b8894e</code></td><td>6.73</td><td>2.46</td>
 </tr>
 <tr>
  <td style="background:#000000"><span style="color:#9c75d1">&#9632;&#9632;&#9632;</span></td>
  <td><strong>Behind</strong></td><td><code>#9c75d1</code></td><td>5.88</td><td>2.81</td>
 </tr>
 <tr>
  <td style="background:#000000"><span style="color:#3db87a">&#9632;&#9632;&#9632;</span></td>
  <td><strong>Ahead</strong></td><td><code>#3db87a</code></td><td>8.34</td><td>1.98</td>
 </tr>
 <tr>
  <td style="background:#000000"><span style="color:#5b8c93">&#9632;&#9632;&#9632;</span></td>
  <td>On track</td><td><code>#5b8c93</code></td><td>5.62</td><td>2.94</td>
 </tr>
</table>

The swatches above are the token values themselves, painted on the black
the board card uses. **They need the Markdown preview** — as raw text this
is a block of HTML. The same strip drawn at the true 12px, on all three
surfaces and with the deuteranopia row, is the mockup at
`plan-docs/design-refs/pocket-status-scale.html`, which opens in a browser
and is the one to look at before deciding anything. `pocket-levels-scale.svg`
beside this file holds the same strip as an image; VS Code's Markdown
preview refuses to render SVG, which is why the table above exists.


| level | word on screen | criterion | token | value | contrast |
| --- | --- | --- | --- | --- | --- |
| `completed` | Completed | committed **reaches** the target | `--color-status-complete` | `#5faa78` | 7.51 |
| `aboveTarget` | Above target | committed **passes** the target | `--color-status-info` | `#60b1d6` | 8.76 |
| `overdue` | Overdue | not complete, and the deadline **has passed** | `--color-status-alert` | `#c97474` | 6.23 |
| `atRisk` | At risk | not complete, deadline ahead, **ratio ≥ 2** | `--color-status-warning` | `#b8894e` | 6.73 |
| `behind` | Behind | not complete, deadline ahead, **ratio above the band** | `--color-status-behind` | `#9c75d1` | 5.88 |
| `ahead` | Ahead | not complete, deadline ahead, **ratio below the band** and `aheadOfPlan` above zero | `--color-status-ahead` | `#3db87a` | 8.34 |
| `onTrack` | On track | not complete, deadline ahead, **ratio inside the band**, or the plan has no window | `--color-status-ok` | `#5b8c93` | 5.62 |

**On the palette's constraint.** Contrast is loudness: a mark with a much higher
ratio than its siblings dominates the screen whatever it means. The palette
records the failure it is guarding against — the warning token was the CSS
keyword `orange` at 10.63:1 while healthy read 5.62 and alert read 6.23, so the
warning was the loudest mark on the board and shouted over the alert. It was
muted to 6.73 to sit between its siblings.

**The band is a rule about outliers, NOT a severity ordering.** The
informational blue already measures 8.76 and is the loudest mark in the set while
being the least urgent. That disorder predates this ruling and is not opened
here.

**Ahead is a saturated green, not a pale one.** A pale green measured 11.53:1 —
the level that asks least of the owner would have been the strongest mark on the
board, repeating the orange defect exactly. Saturation rather than lightness is
also what separates it from the desaturated teal of *On track*, so it reads as a
different hue and not as a lighter version of the same one.

**Behind is violet at half saturation.** Every warm hue is taken by a level above
it in severity, and a second amber was already tried and rejected for sitting
seven hundredths of lightness from the warning amber — indistinguishable at the
size of a status square. The whole palette is desaturated, so a vivid violet
would enter as a foreign body.

### Two colour defects recorded, not fixed here

- **On track carries two colours.** Its square class is empty so the board paints
  the base teal `#5b8c93`, while its reading modifier is `--neutral` and the
  detail paints grey `#5b5b5b`. One level, two colours, on two screens. It is
  also the weakest pair in the set on hue: `#5b8c93` and the informational
  `#60b1d6` are twelve degrees apart and separated only by saturation and
  lightness. Giving *On track* an explicit grey square closes both, frees the
  green family entirely for *ahead*, and matches the meaning — *On track* is the
  one level that asks for nothing, and grey is the absence of a signal. The grey
  in use measures 3.09:1 against the card, at the floor for a graphic object, so
  it cannot be adopted at that value.
- **The whole series fails on the cream panel.** Against
  `--color-surface-panel` (`#e8e4da`) every mark measures under the 3:1 floor —
  ahead 1.98, behind 2.81, and the five already shipped between 1.89 and 2.94.
  The pocket detail summary is that surface. It needs an `-on-panel` set of its
  own, the way the amount tokens already have one. Separate work.
- **Under deuteranopia the seven marks collapse into two families**, and
  the mockup at `plan-docs/design-refs/pocket-status-scale.html` draws it.
  A grey-violet group holds completed, above target, ahead, on track and
  behind; an olive group holds at risk and overdue. Two pairs are one
  colour: **behind against above target at 1.11:1**, which the violet
  introduces, and **at risk against overdue at 1.11:1**, which predates
  every decision here — the two most urgent readings on the board are
  already the same olive for a colour-blind reader.
- **What the violet does buy**, measured rather than argued: the tightest
  pair in normal vision is behind against overdue at 1.06:1, separated by
  hue alone, and it opens cleanly under deuteranopia. A second amber
  would not have survived that, so the ground for refusing the amber
  holds even though the ground for praising the violet is halved. An
  earlier reading in this file called on track against above target the
  weakest pair; it is the loosest of the four at 1.56:1, and the twelve
  degrees of hue between them are backed by a real difference in
  lightness.
- **The conclusion the measurement forces:** colour alone cannot carry
  seven levels for any reader, so its job on this board is scanning and
  not identification — the word printed beside every mark is what
  identifies. The tick on completed is the only difference in the whole
  strip that survives both the cream panel and the deuteranopia
  transform, which makes it the strongest single result of the exercise
  and no longer a detail of taste.

---

## 4. One example of every level

**All examples share one plan**, so every difference below comes from the state
being read and never from a different plan:

| | |
| --- | --- |
| target | **12,000.00** |
| plan made | **2025-12-14** |
| deadline | **2026-11-30** |
| days of the plan | 2026-11-30 − 2025-12-14 = **351** |
| daily rate | 12,000 ÷ 351 = **34.188034…** |
| the monthly presentation | 34.188034… × 30.44 = **1,040.68**, rendered by no screen |

Evaluated at the **close of August 2026**, `2026-08-31`, unless the example says
otherwise. At that date:

| | |
| --- | --- |
| days elapsed | 2026-08-31 − 2025-12-14 = **260** |
| the plan's line | 34.188034… × 260 = **8,888.89** |
| days remaining | 351 − 260 = **91** |

**A pocket committing exactly 8,888.89 rates exactly 1** and sits at the centre
of the band. Every example below is a distance from that figure.

---

### On track

**Committed 8,800.00.**

```
remainder   = 12,000.00 − 8,800.00     = 3,200.00
needed/day  = 3,200.00 ÷ 91            =    35.164835…
paceRatio   = 35.164835… ÷ 34.188034…  = 1.03        inside 1 ± 0.05
aheadOfPlan = 8,800.00 − 8,888.89      =   −88.89
```

**Reading: On track.** Short of the line by 88.89, which is under three days of
the plan's own rate — the plan is being met as written and the shortfall is a
rounding of behaviour, not a slippage. This is precisely the case the band exists
to keep out of *Behind*.

### Ahead

**Committed 9,200.00.**

```
remainder   = 12,000.00 − 9,200.00     = 2,800.00
needed/day  = 2,800.00 ÷ 91            =    30.769231…
paceRatio   = 30.769231… ÷ 34.188034…  = 0.90        below 0.95
aheadOfPlan = 9,200.00 − 8,888.89      = +311.11     above zero
```

**Reading: Ahead.** Both conditions hold. The card prints *311.11 ahead of the
plan*, and this pocket is a source the owner can release from without breaking
its own schedule — releasing that amount drops it to exactly its line.

**The boundary, for contrast:** committed 9,044.44 gives a ratio of exactly 0.95
and `aheadOfPlan` of +155.56. Anything between 8,888.89 and 9,044.44 is
positively ahead in money and still reads *On track*. That is the band doing its
job: a pocket a rounding above its line has not outperformed anything.

### Behind

**Committed 6,888.89.**

```
remainder   = 12,000.00 − 6,888.89     = 5,111.11
needed/day  = 5,111.11 ÷ 91            =    56.166056…
paceRatio   = 56.166056… ÷ 34.188034…  = 1.64        above 1.05, under 2
aheadOfPlan = 6,888.89 − 8,888.89      = −2,000.00
```

**Reading: Behind.** Two thousand short, and the pace needed is a bit over one
and a half times what the plan set. Recoverable over the remaining three months
at a rate slightly better than planned.

### At risk

**The same shortfall of 2,000, read two months later.** Committed 8,974.36,
evaluated at the **close of October 2026**, `2026-10-31`.

```
days elapsed    = 2026-10-31 − 2025-12-14   =        321
the plan's line = 34.188034… × 321          =  10,974.36
days remaining  = 351 − 321                 =         30
remainder       = 12,000.00 − 8,974.36      =   3,025.64
needed/day      = 3,025.64 ÷ 30             =     100.854666…
paceRatio       = 100.854666… ÷ 34.188034…  = 2.95            at or above 2
aheadOfPlan     = 8,974.36 − 10,974.36      =  −2,000.00
```

**Reading: At risk.** The identical shortfall of 2,000 that read *Behind* in
August. **What separates the two is not the size of the gap but whether the time
left still closes it** — and this is the whole argument for a ratio over a day
count.

### Completed

**Committed 12,000.00**, at the close of August.

```
committed ≥ target      → the first two tests decide it
paceRatio = 0           (remainder ≤ 0), and it is never consulted
```

**Reading: Completed.** Reached seven months before the deadline; the deadline
and the ratio no longer say anything about it. The mark for this level is a tick
rather than a square, because it is the one outcome on the strip that is finished
rather than pending.

### Above target

**Committed 12,500.00**, at the close of August.

```
committed > target      → decided by the first test
surplus = 12,500.00 − 12,000.00 = 500.00
```

**Reading: Above target.** The 500 over the goal can be released at no cost to
any plan, which is what separates this surplus from being *ahead of the line* —
money that is still needed by its plan, only not yet. Two amounts, two
consequences, two sentences on screen.

### Overdue

**Committed 9,000.00**, evaluated at **2026-12-05**.

```
deadline 2026-11-30 has passed, target not met
paceRatio = null        (never consulted; the level above it decided)
shortfall = 12,000.00 − 9,000.00 = 3,000.00
```

**Reading: Overdue.** No pace is printed. A required monthly figure over a window
that no longer exists is a number answering a question nobody asked.

---

## 5. The two special cases

### A plan with no window

**A different plan:** target 1,500, made **2026-08-20**, deadline **2026-08-20** —
the deadline is the day the plan was made.

```
planDays = 2026-08-20 − 2026-08-20 = 0
0 ≤ 0                                      → the guard fires
planInstalment, scheduledByNow, aheadOfPlan, paceRatio = null
```

**Reading: On track**, and the card states that the plan has no window instead of
printing a pace. Only two kinds of pocket hold this shape and both are legacy: one
created and dated the same day, and the one carried over by migration 020, whose
creation stamp is the migration's own date. A deadline already past is refused at
creation, so the population cannot grow.

**The shape that used to land here and no longer does.** The same target of 1,500
made on `2026-08-20` with a deadline of `2026-09-02` crosses a month boundary and
contains no full calendar month, which was the second clause of the guard this
replaced. It now has thirteen days of window and a line to be read against:

```
planDays    = 2026-09-02 − 2026-08-20 = 13
dailyRate   = 1,500.00 ÷ 13           = 115.384615…
elapsedDays = 2026-08-31 − 2026-08-20 = 11
line        = 115.384615… × 11        = 1,269.23
```

The commitment its owner made for that month is now measured against 1,269.23
instead of against nothing.

### The edge the money guard exists for

**On the line is now exactly a ratio of 1, so the two figures cannot point in
opposite directions while the deadline is still ahead.** Write the target as `T`
over `D` days, the days elapsed as `e` and the committed amount as `A`. The line
is `T × e / D`, the days left are `D − e`, and the ratio is
`(T − A) ÷ ((D − e) × T / D)`. Reducing, `ratio ≤ 1` holds exactly when
`A ≥ T × e / D`, which is `aheadOfPlan ≥ 0`.

**What separates them is the floor on the days left.** On the deadline day itself
the days remaining are zero and the divisor is floored at one, so a remainder
smaller than a single day of the plan's rate reads as a low ratio while the
pocket stands short of its whole target.

**Back to the main plan.** Committed **11,970.00**, evaluated at `2026-11-30` —
the deadline itself, so it has not passed and the pocket is not overdue.

```
days elapsed    = 351 = planDays                clamped at the window
the plan's line = 34.188034… × 351 = 12,000.00  the whole target
days left       = max(0, 1) = 1                 floored
remainder       = 12,000.00 − 11,970.00 =   30.00
needed/day      = 30.00 ÷ 1             =   30.00
paceRatio       = 30.00 ÷ 34.188034…    =    0.88   below 0.95
aheadOfPlan     = 11,970.00 − 12,000.00 =  −30.00   BELOW zero
```

**The ratio says ahead and the money says short.** The ratio is low only because
the floor put a single day in the denominator, not because the pocket is doing
well — it is 30 short of its entire goal on the last day it has.

**Reading: Behind**, because the *ahead* test requires `aheadOfPlan` above zero
and it is negative. Without that second condition the card would print *"30.00
behind the plan"* directly under a level word saying *Ahead*.

**Where the larger version of this case went.** The same pocket 180 short on the
same day — committed 11,820.00 — divides that remainder by one day and needs
`180.00 ÷ 34.188034… = 5.265` times the plan's own rate, **5.27** to two places.
It is caught by the at-risk test five conditions above and never reaches the
money guard at all. Under the monthly line the same figures put a whole
instalment in the denominator and gave `180.00 ÷ 1,090.909… = 0.17`, where the
guard was the only thing keeping the card honest. The daily reading is the
stricter one and the right one: the plan has a day left and needs five times the
pace it set.

**The band the guard still covers is narrow, and it is still required.** Under
the monthly line any remainder below 0.95 instalments reached it — on this plan
about 1,036. Under the daily line it is any remainder below 0.95 of one day's
rate, about 32.48 here, on exactly one date per plan: the deadline itself. It
costs one condition and it is the only place the ratio and the money can
disagree about direction.

---

## 6. What the board folds from these levels

| field | meaning |
| --- | --- |
| `levelCounts` | one count per level, seven keys, every one always present with at least a zero |
| `totalAheadOfPlan` | the slack held by the pockets reading `ahead`, so the readings row states a count and an amount describing the same rows |

`aheadCount` is retired: it counted pockets whose `aheadOfPlan` was positive,
which is now `levelCounts.ahead` minus a rounding — two answers to one question.

The empty-board rule is unchanged: every amount null and never zero, every count
a real zero.
