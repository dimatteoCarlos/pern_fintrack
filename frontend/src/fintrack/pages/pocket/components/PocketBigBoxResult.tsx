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

// The active pocket whose deadline falls first. Overdue ones are excluded on
// purpose: the tile answers what is NEXT, and a deadline that has passed is not
// next — it is a state the marks row already reports. null when nothing is
// active, and the tile then reads as empty rather than promoting a pocket that
// does not qualify.
const findNextGoal = (pockets: PocketStatus[]): PocketStatus | null =>
 pockets
  .filter((pocket) => !pocket.funded && !pocket.overdue)
  .reduce<PocketStatus | null>(
   (nearest, pocket) =>
    nearest === null || pocket.daysRemaining < nearest.daysRemaining
     ? pocket
     : nearest,
   null,
  );

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
      <span className='pocketHero__label'>Still to commit</span>
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
         <span className='pocketHero__groupLabel'>
          Funded <b>{levels.funded}</b>
         </span>

         <span className='pocketHero__marks'>
          {/* The level that had no reading at all. The heading counted it and
              nothing spelled it out, so a pocket that landed exactly on its
              target was visible only as the difference between two figures the
              reader had to subtract. Derived rather than served: the flag is
              set at committed above OR EQUAL, so the served count holds both
              and only the excess half is counted here. */}
          <span className={markClass(levels.funded - levels.overFunded)}>
           <StatusSquare alert={pocketSquareClass('funded')} />
           <span>{levels.funded - levels.overFunded} at target</span>
          </span>

          <span className={markClass(levels.overFunded)}>
           <StatusSquare alert={pocketSquareClass('overFunded')} />
           <span>{levels.overFunded} above target</span>
          </span>
         </span>
        </span>

        {/* Overdue is out of this count now, so the heading means what it says:
            not funded AND still inside its deadline. */}
        <span className='pocketHero__group'>
         <span className='pocketHero__groupLabel'>
          Not funded <b>{levels.onPlan + levels.atRisk}</b>
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
         </span>
        </span>

        {/* A peer of the two above and not a reading under the second one. In
            an overdue pocket the date has already passed, so there is no pace
            left to compute: the monthly contribution it would need is null
            rather than zero, which is why pocketDateLevel sends it to a level
            of its own. It is not "not funded and running" — it is "no deadline
            left". The only level that asks for action today, and it sat two
            levels down.

            Its group and its level are the same fact, so the heading and the
            reading below it carry the same figure. That repetition is the
            price of the strip reading as one grid: giving this column a single
            centred line instead put the only level that asks for action today
            at heading weight, which is the board upside down. */}
        <span className='pocketHero__group'>
         <span className='pocketHero__groupLabel'>
          Overdue <b>{levels.overdue}</b>
         </span>

         <span className='pocketHero__marks'>
          <span className={markClass(levels.overdue)}>
           <StatusSquare alert={pocketSquareClass('offPlan')} />
           <span>{levels.overdue} overdue</span>
          </span>
         </span>
        </span>
       </div>
      )}

      {/* Under neither heading, because coverage is the other axis entirely: a
          pocket whose funding accounts stopped backing what it says is
          committed can be funded or short, and the fact says nothing about
          either. It hides at zero, where the readings above never do. */}
      {uncoveredCount !== null && uncoveredCount > 0 && (
       <span className='pocketHero__aside'>
        <StatusSquare alert={pocketSquareClass('offPlan')} />
        <span>{uncoveredCount} uncovered</span>
       </span>
      )}
     </div>

     {/* Target and not goal. The frozen vocabulary lets the word goal name the
         figure a pocket aims at, never the object itself — and a tile headed
         "next goal" over a pocket's NAME says the opposite, which is how two
         nouns for one object get onto a screen.

         A Link when there is a pocket to open and a plain block when there is
         not: a control that can only refuse is worse than one that is absent. */}
     {nextGoal === null ? (
      <div className='pocketHero__card pocketHero__card--empty'>
       <BullsEyeSvg className='pocketHero__glyph' />

       <span className='pocketHero__label'>Next target</span>
       <span className='pocketHero__cardValue'>{MISSING}</span>
       <span className='pocketHero__meta'>Nothing pending a date</span>
      </div>
     ) : (
      <Link
       to={`pockets/${nextGoal.pocketId}`}
       className='pocketHero__card pocketHero__card--link'
      >
       <BullsEyeSvg className='pocketHero__glyph' />

       <span className='pocketHero__label'>Next target</span>

       <span className='pocketHero__cardValue pocketHero__cardValue--name'>
        {nextGoal.name}
       </span>

       {/* The same two rows the status strip uses, so the card and the strip
           read as one screen rather than two blocks that happen to sit
           together. It replaces a single grey line that joined both facts with
           a dot, at the size of a footnote.

           The square is the level this pocket already computes. It is the one
           the owner is being sent to act on, so the reading that says how
           urgent that is belongs on the card and not only in the tally above. */}
       <div className='pocketHero__strip'>
        <span className='pocketHero__group'>
         <span className='pocketHero__groupLabel'>Committed</span>
         <span className='pocketHero__reading'>
          {percent(nextGoal.progress)}
         </span>
        </span>

        <span className='pocketHero__group'>
         <span className='pocketHero__groupLabel'>
          <StatusSquare alert={pocketSquareClass(pocketDateLevel(nextGoal))} />
          Time left
         </span>
         <span className='pocketHero__reading'>
          {nextGoal.daysRemaining === 1
           ? '1 day'
           : `${nextGoal.daysRemaining} days`}
         </span>
        </span>
       </div>

       <span className='pocketHero__chevron' aria-hidden='true'></span>
      </Link>
     )}
    </div>

    {/* LEVEL 3 — how far along, all together. The board's one progress bar. */}
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
   </div>
  </div>
 );
}

export default PocketBigBoxResult;
