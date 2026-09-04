# Pocket levels — the reference

The complete definition of how one pocket is classified: what is read, how the
figures are derived, the seven levels with their criteria and their colours, and
one worked example of every level on a single plan.

**Status: ruled, implemented and verified on 2026-09-04.** The classifier
(`backend/src/fintrack_api/services/pocket_services/core/pocketLevel.js`)
carries the seven levels and the tolerance band, and the exported level
order is frozen with seven entries. Ten cases covering the seven levels and
the two special shapes were run against the worked examples of section 4 and
land where this document says. The ruling it expands is
`POCKET_DECISIONS.md` section 24 (2026-09-04); the payload shape is in
`POCKET_CONTRACT_AUDIT.md` under the contract change of the same date. Where the
two disagree with this file, they are the authority and this file is the
explanation.

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

### Step 1 — the months the plan has

```
planMonths = month(deadline) − month(planStart)
```

Months are compared as a single integer, `year × 12 + month`, sliced from the
text of the date and never parsed into a `Date` — a date built from `YYYY-MM-DD`
is UTC midnight and reading it back through a local getter can land in the
previous month.

**The creation month does not count.** A plan made on the 20th did not have that
month to fund, so its first instalment falls due at the close of the first full
month after it. Applied uniformly and not only to plans made mid-month: a rule
that behaved differently on the 1st and the 2nd would put a discontinuity in the
reading for no fact that justifies one.

### Step 2 — the guard: a plan with no window

```
if planMonths < 1  OR  close(planStart month + 1) > deadline
    → planInstalment, scheduledByNow, aheadOfPlan and paceRatio are all null
```

Two shapes reach it: a deadline at or before the creation month, and a plan made
days before its own deadline — created on the 20th and due on the 2nd of the next
month crosses a month boundary but contains no full month, so counting boundaries
alone would hand it an instalment it never had a month to pay.

Such a pocket **has no line**, so it can be neither ahead of one nor short of
one. It falls to *On track* and the card states that the plan has no window
rather than printing a pace built on nothing.

### Step 3 — the instalment

```
instalment = target ÷ planMonths
```

This is the plan's own pace: what it committed to per month, on the day it was
made.

### Step 4 — the instalments already due

```
lastClosedMonth = month(evaluationDate)      if evaluationDate is a month end
                  month(evaluationDate) − 1  otherwise

dueMonths = clamp(lastClosedMonth − month(planStart), 0, planMonths)
```

**The current month's instalment is not yet due.** Inside September what is owed
is the instalments through August. A past month selected on the stepper resolves
to that month's close, which is a month end, so its own instalment is counted.

**This is what makes the line step-wise rather than continuous.** A continuous
line would climb every day, so the same pocket would read *On track* on the 2nd
and *Behind* on the 28th with no change in behaviour. Here the amount due moves
only when a month closes, which is the boundary every other figure on this board
uses.

### Step 5 — where the plan should be, and where it actually is

```
scheduledByNow = instalment × dueMonths
aheadOfPlan    = committed − scheduledByNow        (signed)
```

`aheadOfPlan` is signed on purpose: positive is committed beyond the line,
negative is short of it. The screen states the direction in words; the payload
states the amount once, so no consumer derives the other half and disagrees.

### Step 6 — the instalments still to come

```
instalmentsLeft = max(planMonths − dueMonths, 1)
```

**Floored at one.** When every instalment has fallen due and a remainder
survives, the plan has one month or less to close it; dividing by zero there
would lose exactly the case the ratio exists to catch.

### Step 7 — the ratio

```
remainder = target − committed

paceRatio = null                                     if the deadline has passed
          = 0                                        if remainder ≤ 0
          = (remainder ÷ instalmentsLeft) ÷ instalment   otherwise
```

**In words: what is now needed per month, over what the plan set per month.**

It is dimensionless — a month against a month — which is why it works the same on
a three-month plan and a five-year one. That is what it replaced: a fixed
threshold of thirty days treated both identically, and the question the owner is
actually asking is not *how long is left* but *can I still cover it*.

**A note on the denominator.** The numerator is derived from the instalments
left, NOT from the served `requiredMonthly`, and the difference is load-bearing:
that figure divides the remainder by days over the mean length of a month, while
the instalment divides the target by whole calendar months. Two denominators that
disagree would put a pocket sitting exactly on its line at 1.14 instead of 1.
Both figures ship — they answer different questions — but only one of them may
set a level.

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
section 5: at the close of the deadline's own month the instalments left are
floored at one, and the ratio can read low while the pocket is short of its whole
target. Without the second condition the card would print *"180.00 behind the
plan"* under a level word saying *Ahead*.

### The tolerance band

*On track* is the ratio within **five hundredths either side of 1**, not the
point where it equals 1 exactly.

**Why a band is required at all.** The instalment is a division that rarely
terminates — 12,000 over eleven months is 1,090.909… — so exact equality is
reached by almost no pocket after its first month. Split at the point and *On
track* becomes a level that is defined and never fires, which is the same defect
as the retired *Active* bucket that appeared on a filter and nowhere else on the
screen it filtered.

**Why the band is on the ratio and not on a sum of money.** A ratio tolerance is
worth more money early in a plan and less money late in it, which is the property
the ratio was chosen for when the thirty-day threshold was rejected. Half an
instalment short with eleven months left is noise; half an instalment short with
one month left is not. A fixed sum would call both by the same word.

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
| months of the plan | Nov 2026 − Dec 2025 = **11** |
| instalment | 12,000 ÷ 11 = **1,090.909090…** |

Evaluated at the **close of August 2026** unless the example says otherwise. At
that date:

| | |
| --- | --- |
| last closed month | August (the evaluation date is a month end) |
| instalments due | Aug − Dec = **8** |
| the plan's line | 8 × 1,090.909… = **8,727.27** |
| instalments left | 11 − 8 = **3** |

---

### On track

**Committed 8,600.00.**

```
remainder    = 12,000.00 − 8,600.00 = 3,400.00
needed/month = 3,400.00 ÷ 3         = 1,133.33
paceRatio    = 1,133.33 ÷ 1,090.91  = 1.04        inside 1 ± 0.05
aheadOfPlan  = 8,600.00 − 8,727.27  = −127.27
```

**Reading: On track.** Short of the line by 127.27, which is a ninth of one
instalment — the plan is being met as written and the shortfall is a rounding of
behaviour, not a slippage. This is precisely the case the band exists to keep out
of *Behind*.

### Ahead

**Committed 9,200.00.**

```
remainder    = 12,000.00 − 9,200.00 = 2,800.00
needed/month = 2,800.00 ÷ 3         =   933.33
paceRatio    =   933.33 ÷ 1,090.91  = 0.86        below 0.95
aheadOfPlan  = 9,200.00 − 8,727.27  = +472.73     above zero
```

**Reading: Ahead.** Both conditions hold. The card prints *472.73 ahead of the
plan*, and this pocket is a source the owner can release from without breaking
its own schedule — releasing that amount drops it to exactly its line.

**The boundary, for contrast:** committed 8,890.91 gives a ratio of exactly 0.95
and `aheadOfPlan` of +163.64. Anything between 8,727.27 and 8,890.91 is
positively ahead in money and still reads *On track*. That is the band doing its
job: a pocket a rounding above its line has not outperformed anything.

### Behind

**Committed 6,727.27.**

```
remainder    = 12,000.00 − 6,727.27 = 5,272.73
needed/month = 5,272.73 ÷ 3         = 1,757.58
paceRatio    = 1,757.58 ÷ 1,090.91  = 1.61        above 1.05, under 2
aheadOfPlan  = 6,727.27 − 8,727.27  = −2,000.00
```

**Reading: Behind.** Two thousand short, and the pace needed is a bit over one
and a half times what the plan set. Recoverable by three months slightly better
than planned.

### At risk

**The same shortfall of 2,000, read two months later.** Committed 8,909.09,
evaluated at the **close of October 2026**.

```
instalments due  = Oct − Dec        = 10
the plan's line  = 10 × 1,090.909…  = 10,909.09
instalments left = 11 − 10          = 1
remainder        = 12,000.00 − 8,909.09 = 3,090.91
needed/month     = 3,090.91 ÷ 1         = 3,090.91
paceRatio        = 3,090.91 ÷ 1,090.91  = 2.83     at or above 2
aheadOfPlan      = 8,909.09 − 10,909.09 = −2,000.00
```

**Reading: At risk.** The identical shortfall of 2,000 that read *Behind* in
August. **What separates the two is not the size of the gap but whether an
ordinary month still closes it** — and this is the whole argument for a ratio
over a day count.

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

**A different plan:** target 1,500, made **2026-08-20**, deadline
**2026-09-02**. Evaluated at the close of August.

```
planMonths     = Sep − Aug = 1
first due date = close of the month after creation = 2026-09-30
2026-09-30 > 2026-09-02                    → the guard fires
planInstalment, scheduledByNow, aheadOfPlan, paceRatio = null
```

**Reading: On track**, and the card states that the plan has no window instead of
printing a pace. The window crosses a month boundary but contains no full month,
so counting boundaries alone would hand it an instalment it never had a month to
pay. The one legacy pocket carried over by migration 020 lands here too, because
its creation stamp is the migration's own date.

### The edge the money guard exists for

**Back to the main plan.** Committed **11,820.00**, evaluated at the **close of
November 2026** — which is also the deadline, `2026-11-30`, so the deadline has
not passed and the pocket is not overdue.

```
instalments due  = Nov − Dec = 11 = planMonths     every instalment has fallen due
instalments left = max(11 − 11, 1) = 1             floored
the plan's line  = 11 × 1,090.909… = 12,000.00     the whole target
remainder        = 12,000.00 − 11,820.00 =   180.00
needed/month     =   180.00 ÷ 1          =   180.00
paceRatio        =   180.00 ÷ 1,090.91   = 0.17    below 0.95
aheadOfPlan      = 11,820.00 − 12,000.00 = −180.00 BELOW zero
```

**The ratio says ahead and the money says short.** The ratio is low only because
the floor put a single instalment in the denominator, not because the pocket is
doing well — it is 180 short of its entire goal on the last day it has.

**Reading: Behind**, because the *ahead* test requires `aheadOfPlan` above zero
and it is negative. Without that second condition the card would print *"180.00
behind the plan"* directly under a level word saying *Ahead*.

It is reachable on exactly one date per plan, and only when the deadline falls on
the last day of a month — which is a common way to write a deadline.

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
