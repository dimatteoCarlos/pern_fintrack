//-------PocketBigBoxResult---------
//Parent: PocketLayout.tsx
import { Link } from 'react-router-dom';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { PocketBoardSummary, PocketStatus } from '../../../types/pocketTypes';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents';
import { pocketDateLevel, pocketSquareClass } from '../../../helpers/pocketStatus';
// Decorative only, and drawn at --size-glyph-hero: the set is a 0.26 pen on a
// 24 unit grid and stops resolving below 4rem. Each file already carries
// aria-hidden, so none of them reaches the accessibility tree.
import BarChartSvg from '../../../../assets/pocketSvg/barChartSvg.svg?react';
import BullsEyeSvg from '../../../../assets/pocketSvg/bullsEyeSvg.svg?react';
import WalletSvg from '../../../../assets/pocketSvg/walletSvg.svg?react';

// The whole summary and the rows it was folded from, not four figures picked
// out of ten. The parent used to narrow the payload before handing it over,
// which is what kept the committed amount — the figure this module exists to
// report — served and discarded while the goal total stood in its place.
//
// Every amount inside is nullable because the contract withholds them in three
// cases: the answer is still on the wire, the user owns no pocket, or the
// pockets are kept in more than one currency and the module refuses to add them
// at an implicit 1:1. None of those is an amount of zero.
type PocketHeroPropType = {
 summary: PocketBoardSummary | null;
 pockets: PocketStatus[];
 // Why the figures read as dashes, in the server's own words. null when there
 // is nothing to explain.
 notice: string | null;
};

const MISSING = '—';

// The three states partition the board. Overdue requires the committed amount
// to be below the goal and funded requires the opposite, so no pocket is in
// both and none is outside all three — which is what makes this subtraction
// exact rather than an estimate the server would have to confirm.
// How many rows sit at each level of the date partition, which is what replaces
// the single "active" figure this tile used to print. "Active" was never a
// state: it was the residue of the two the server folds, and it hid the one
// reading that asks for action by lumping a pocket thirty days out together
// with one that has a year.
//
// Funded and overdue are taken from the server, which folds them; only the
// split of the remainder is counted here, because the thirty-day threshold is
// a presentation rule the model has nothing to read it from. The four add up to
// pocketCount by construction: the two served counts are mutually exclusive and
// the level helper sends everything else to one of the other two.
const countByLevel = (
 summary: PocketBoardSummary,
 pockets: PocketStatus[],
) => {
 const at = (level: string) =>
  pockets.filter((pocket) => pocketDateLevel(pocket) === level).length;

 const overFunded = at('overFunded');

 return {
  // The served count, whole. A pocket past its target IS funded — the flag is
  // set at committed above OR EQUAL — so taking the over-target rows out of it
  // left "funded" meaning "landed on the cent", a case one cent wide that read
  // as zero beside two pockets that had plainly reached their targets.
  funded: summary.fundedCount,
  overFunded,
  overdue: summary.overdueCount,
  atRisk: at('atRisk'),
  onPlan: at('onPlan'),
 };
};

// A level with nothing in it stays on screen and steps back. Dropping it breaks
// the partition its heading counts, and a reader cannot tell a level that is
// absent from one with nothing in it; printing it at full ink gives an empty
// level the same call on the eye as a populated one. On a board where four of
// the five are empty, this is what leaves the fifth as the only thing lit.
const markClass = (count: number): string =>
 count === 0 ? 'pocketHero__mark pocketHero__mark--empty' : 'pocketHero__mark';

// The pocket to send the owner to, which is not the same question as which
// deadline falls first on the calendar.
//
// Excluding the late ones outright, as this did, blanked the card on exactly
// the board where direction matters most: every unfinished pocket past its
// date meant nothing upcoming, so four pockets could be raising an alert while
// the tile said there was nothing pending. A deadline that has passed is not
// next by the calendar, but it is very much what to do next.
//
// So: the nearest deadline among those still running, and only when none is
// still running, the one furthest past its date. daysRemaining goes negative
// once the deadline passes, so one comparison answers both.
//
// null when every pocket has reached its target, or there are none at all.
// The tile is then absent rather than empty: the bands above already say
// "in progress 0", and a card whose only message is that it has nothing to say
// spends the width of the hero to repeat it.
const findNextGoal = (pockets: PocketStatus[]): PocketStatus | null => {
 const unfinished = pockets.filter((pocket) => !pocket.funded);
 const running = unfinished.filter((pocket) => !pocket.overdue);
 const pool = running.length > 0 ? running : unfinished;

 return pool.reduce<PocketStatus | null>(
  (nearest, pocket) =>
   nearest === null || pocket.daysRemaining < nearest.daysRemaining
    ? pocket
    : nearest,
  null,
 );
};

// Three levels, and they answer three different questions: where the board
// stands as a whole, which pocket the owner has to act on next, and how far
// along everything is together.
//
// Rewritten 2026-08-30 against the reference. Four defects were carried over
// from it and are fixed here rather than reproduced:
//
//   - Two progress bars for one figure. The reference drew a bar under the top
//     row AND a bar inside the overall-progress block. Only the second exists
//     now, which is the one that carries a label saying what it measures.
//   - The row under that first bar printed "0.0%" on the left and
//     "0.0% · $25.50 to go" on the right: the same percentage twice in one
//     line, beside a shortfall belonging to a single pocket rather than to the
//     board. It went with the bar.
//   - The ring in the middle stated the overall progress a third time, in a
//     third form. The bar keeps it: a bar reads at 360px and a ring has to be
//     read against its own circumference.
//   - The three coloured squares beside the tiles carried no state. The square
//     here is the shared StatusSquare and its colour means what it means
//     everywhere else on the board.
function PocketBigBoxResult({ summary, pockets, notice }: PocketHeroPropType) {
 const currency_code = summary?.currency ?? DEFAULT_CURRENCY;
 const formatNumberCountry = CURRENCY_OPTIONS[currency_code];

 const amount = (value: number | null | undefined) =>
  value === null || value === undefined
   ? MISSING
   : currencyFormat(currency_code, value, formatNumberCountry);

 const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? MISSING : `${Math.round(value)}%`;

 // The server withheld the totals and said why. The sentence is the answer, so
 // it stands where the figures would: printing dashes above it repeats in
 // symbols what the line below is about to say in words, and a dash cannot
 // tell the reader which of the absences it is. Same shape as the budget hero.
 if (notice) {
  return (
   <div className='total__container flex-col-sb'>
    <p className='displayScreen__notice'>{notice}</p>
   </div>
  );
 }

 const levels = summary === null ? null : countByLevel(summary, pockets);
 const nextGoal = findNextGoal(pockets);
 const uncoveredCount = summary?.uncoveredCount ?? null;
 // Clamped per pocket by the server before folding, so the bar needs no clamp
 // of its own and cannot paint past its track.
 const overallProgress = summary?.overallProgress ?? null;

 return (
  <div className='total__container flex-col-sb'>
   <div className='pocketHero'>
    {/* LEVEL 1 — where the board stands, as three peer figures rather than one
        headline with the other two demoted into its footnotes: the goal, what
        is committed against it, and the gap between them.

        They reconcile as allocated − excess + remaining = target, NOT as a
        plain subtraction: the shortfall is clamped per pocket before the server
        sums it. The excess is printed under the gap whenever it is not zero,
        because without it the three figures look like an arithmetic error.

        The two meta lines are gone with the demotion. "of a $X target" and "to
        reach every target" existed only because the target had no tile of its
        own to be stated in; each now repeats the line above or below it. */}
    <div className='pocketHero__equation'>
     <div className='pocketHero__tile pocketHero__tile--target'>
      <span className='pocketHero__label'>Target</span>
      <span className='pocketHero__value'>
       {amount(summary?.totalTarget)}
      </span>
     </div>

     <div className='pocketHero__tile pocketHero__tile--committed'>
      <span className='pocketHero__label'>Total allocated</span>
      <span className='pocketHero__value'>
       {amount(summary?.totalAllocated)}
      </span>
     </div>

     <div className='pocketHero__tile pocketHero__tile--remaining'>
      {/* Allocated is the figure's word — POCKET_DECISIONS 18.1 freezes it —
          and commit is the event's. This names a figure, so it takes the
          figure's word and pairs with "Total allocated" beside it. */}
      <span className='pocketHero__label'>Still to allocate</span>
      <span className='pocketHero__value'>
       {amount(summary?.totalRemaining)}
      </span>

      {/* The figure that makes the three above reconcile, and the reason they
          do not without it: the shortfall is clamped per pocket BEFORE the
          server sums it, so that one over-funded pocket cannot cancel another
          that is behind. The excess travels separately for the same reason.
          The identity is therefore
              allocated − excess + remaining = target
          and not the subtraction it looks like. Printed only when it is not
          zero, because on a board where nothing passed its goal there is no
          discrepancy to explain. */}
      {summary !== null &&
       summary.totalExcess !== null &&
       summary.totalExcess > 0 && (
        <span className='pocketHero__meta'>
         {amount(summary.totalExcess)} committed above target
        </span>
       )}
     </div>
    </div>

    {/* LEVEL 1b — the same three figures as a ratio, directly under them.
        The bar is what is committed over what was targeted, so it belongs
        beside the amounts it divides; two cards further down, the reader
        had to carry three figures in mind to know what it measured. The
        hero now reads in two movements: the money, then the pockets. */}
    <div className='pocketHero__progress'>
     <div className='pocketHero__progressRow'>
      <span className='pocketHero__progressHead'>
       <BarChartSvg className='pocketHero__glyph' />
       <span className='pocketHero__label'>Overall progress</span>
      </span>
      <span className='pocketHero__pct'>{percent(overallProgress)}</span>
     </div>

     <div
      className='pocketHero__bar'
      role='progressbar'
      aria-label='Overall progress across every pocket'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={overallProgress ?? undefined}
     >
      {/* No fill at all while the figure is missing. A width of zero would be
          the same paint as a board that has committed nothing, and those are
          two different answers. */}
      {overallProgress !== null && (
       <div
        className='pocketHero__barFill'
        style={{ width: `${overallProgress}%` }}
       />
      )}
     </div>
    </div>

    {/* LEVEL 2 — what to act on.
        Two readings of the board's population rather than of its money. Only
        the second is a door, so only the second carries a chevron: the first
        counts rows that are listed in full immediately below this block, and a
        chevron on a tile that leads nowhere is an affordance that lies. */}
    <div className='pocketHero__cards'>
     <div className='pocketHero__card'>
      <WalletSvg className='pocketHero__glyph' />

      {/* The word and its count on one line, in the shape the group headings
          below already use. On a line of its own the total read as a third
          element sitting between the label that names it and the partition
          that adds up to it, rather than as the heading of both.

          "Pocket status" and not "Pockets": what follows is the partition by
          level, and the count is the total it adds up to. The old word named
          the objects and left the reader to discover that the lines beneath
          were states rather than a list. */}
      <span className='pocketHero__label'>
       Pocket status (total: <b>{summary === null ? MISSING : summary.pocketCount}</b>)
      </span>

      {/* Three headings, each with the count it heads, and its readings
          beneath. The pockets that reached their target, the ones still inside
          their deadline and the ones past it are the top-level split; how a
          pocket got there is the detail under each.

          The three counts add up to pocketCount and nothing overlaps: funded
          and overdue are folded by the server and are mutually exclusive by
          construction, and the level helper sends every remaining row to on
          plan or at risk.

          Every reading prints even at zero: a partition that drops its empty
          members stops adding up to the list below it, and a reader cannot tell
          an absent level from a level with nothing in it.
          Never colour alone — each square carries its word. */}
      {/* One column per GROUP, not one per reading, with a hairline between
          columns. The distinction decides whether the strip can be read: on
          plan and at risk are not peers of "not funded", they are the two ways
          of being it, so a column per reading forces the middle heading to be
          restated and "not funded" then appears twice, each time with its own
          count. The three headings add up to the total in the label above. */}
      {levels !== null && (
       <div className='pocketHero__strip'>
        <span className='pocketHero__group'>
         {/* Named for the outcome, not the mechanism, so the heading rhymes
             with the two readings under it. Nobody reads this board asking how
             a pocket was financed. */}
         <span className='pocketHero__groupLabel'>
          Target reached <b>{levels.funded}</b>
         </span>

         <span className='pocketHero__marks'>
          {/* The level that had no reading at all. The heading counted it and
              nothing spelled it out, so a pocket that landed exactly on its
              target was visible only as the difference between two figures the
              reader had to subtract. Derived rather than served: the flag is
              set at committed above OR EQUAL, so the served count holds both
              and only the excess half is counted here. */}
          <span className={markClass(levels.funded - levels.overFunded)}>
           {/* A tick, not a square, and that is the whole argument: this is the
               one level on the strip that is FINISHED rather than pending, so
               its mark is off the semaphore entirely. A shape also survives
               every kind of colour blindness, which no green beside an amber
               does — measured, the two ambers and the red on this strip sit
               within 1.08 to 1.30 of each other in luminance and are told
               apart by hue alone. */}
           <span className='pocketHero__tick' aria-hidden='true'></span>
           <span>{levels.funded - levels.overFunded} at target</span>
          </span>

          <span className={markClass(levels.overFunded)}>
           <StatusSquare alert={pocketSquareClass('overFunded')} />
           <span>{levels.overFunded} above target</span>
          </span>
         </span>
        </span>

        {/* "In progress" states what these pockets ARE. "Not funded"
            defined the group by negation, which forced the reader to hold the
            other band in mind to understand this one.

            The late ones are counted here, and the reason is a domain call
            rather than a display one: a pocket past its date has not reached
            its target and has not been closed. It is late, not finished. That
            is what makes the two headings add up to the total above them. */}
        <span className='pocketHero__group'>
         <span className='pocketHero__groupLabel'>
          In progress <b>{levels.onPlan + levels.atRisk + levels.overdue}</b>
         </span>

         <span className='pocketHero__marks'>
          <span className={markClass(levels.onPlan)}>
           <StatusSquare alert={pocketSquareClass('onPlan')} />
           <span>{levels.onPlan} on plan</span>
          </span>

          <span className={markClass(levels.atRisk)}>
           <StatusSquare alert={pocketSquareClass('atRisk')} />
           <span>{levels.atRisk} at risk</span>
          </span>

          {/* Named inside the band that counts it. Without this reading the
              heading declared a figure its own readings could not account for:
              on a board where every pocket is late, "in progress 4" sat over
              "0 on plan" and "0 at risk". */}
          <span className={markClass(levels.overdue)}>
           <StatusSquare alert={pocketSquareClass('offPlan')} />
           <span>{levels.overdue} overdue</span>
          </span>
         </span>
        </span>

       </div>
      )}

      {/* The exceptions, on a row of their own behind a rule. Not a third
          column of the partition, and the heading carries no count on purpose:
          every figure here is ALREADY counted in the two bands above — the
          late ones inside "in progress", and a pocket short of backing inside
          whichever band its own progress puts it in. A number on this heading
          would invite an addition that does not hold. It is a spotlight, not a
          bucket.

          Coverage earns its place here and nowhere else. It is the other axis
          entirely: a pocket whose funding accounts no longer hold what it says
          is committed can be at any level, so the fact says nothing about
          which band it belongs to and it cannot join either.

          Absent when there is nothing to raise, unlike the readings inside a
          band, which print at zero because a partition has to keep adding up.
          Nothing is partitioned here, so nothing breaks by leaving. */}
      {levels !== null &&
       (levels.overdue > 0 ||
        levels.atRisk > 0 ||
        (uncoveredCount ?? 0) > 0) && (
        <div className='pocketHero__alerts'>
         <span className='pocketHero__group'>
          <span className='pocketHero__groupLabel'>Alerts</span>

          <span className='pocketHero__marks'>
           {levels.overdue > 0 && (
            <span className='pocketHero__mark'>
             <StatusSquare alert={pocketSquareClass('offPlan')} />
             <span>{levels.overdue} overdue</span>
            </span>
           )}

           {/* Amber inside a row of reds, and the difference is the point: a
               deadline closing in is the one thing here that can still be
               prevented, while a date already missed and an account short of
               what it promised are facts about now. The row grades what it
               raises instead of only listing it. */}
           {levels.atRisk > 0 && (
            <span className='pocketHero__mark'>
             <StatusSquare alert={pocketSquareClass('atRisk')} />
             <span>{levels.atRisk} at risk</span>
            </span>
           )}

           {/* The wording names what failed rather than labelling the pocket.
               "Uncovered" sat one line under "not funded" and read as the same
               thing; it is not. Not funded is the pocket against its own
               target. This is whether the money it says it holds still exists:
               an account it draws on now promises its pockets more than its
               balance. A pocket can be at its target AND short of backing. */}
           {(uncoveredCount ?? 0) > 0 && (
            <span className='pocketHero__mark'>
             <StatusSquare alert={pocketSquareClass('offPlan')} />
             <span>{uncoveredCount} with funding not covered</span>
            </span>
           )}
          </span>
         </span>
        </div>
       )}
     </div>

     {/* Target and not goal. The frozen vocabulary lets the word goal name the
         figure a pocket aims at, never the object itself — and a tile headed
         "next goal" over a pocket's NAME says the opposite, which is how two
         nouns for one object get onto a screen.

         Absent, not empty, when there is nothing to point at: a control that
         can only refuse is worse than one that is absent, and the bands above
         have already said there is nothing in progress.

         One line rather than a stack. Three readings trail the name, each
         carrying its own word instead of a heading above it, which is what
         lets the row collapse; below the container's breakpoint they wrap
         under the name rather than scrolling sideways. */}
     {nextGoal !== null && (
      <Link
       to={`pockets/${nextGoal.pocketId}`}
       className='pocketHero__card pocketHero__card--link pocketHero__card--row'
      >
       <BullsEyeSvg className='pocketHero__glyph' />

       <span className='pocketHero__label'>Next target</span>

       <span className='pocketHero__inline'>
        <span className='pocketHero__cardValue pocketHero__cardValue--name'>
         {nextGoal.name}
        </span>

        {/* The figure the owner acts ON, which the card did not carry: a
            percentage and a date say how it is going, not how much to put in.
            Clamped at zero because this card only ever shows a pocket short of
            its target, and a negative shortfall belongs to the over-funded
            reading in the band above. */}
        <span className='pocketHero__inlineItem'>
         {amount(Math.max(nextGoal.remaining, 0))} still to allocate
        </span>

        <span className='pocketHero__inlineItem'>
         {percent(nextGoal.progress)} committed
        </span>

        {/* The square is the level this pocket already computes, so the card
            and the bands above cannot disagree about the same pocket. Late is
            not "minus twelve days left" — the sign is spent on the word. */}
        <span className='pocketHero__inlineItem'>
         <StatusSquare alert={pocketSquareClass(pocketDateLevel(nextGoal))} />
         {nextGoal.daysRemaining < 0
          ? `${Math.abs(nextGoal.daysRemaining)} days late`
          : nextGoal.daysRemaining === 1
            ? '1 day left'
            : `${nextGoal.daysRemaining} days left`}
        </span>
       </span>

       <span className='pocketHero__chevron' aria-hidden='true'></span>
      </Link>
     )}
    </div>

   </div>
  </div>
 );
}

export default PocketBigBoxResult;
