//-------PocketBigBoxResult---------
//Parent: PocketLayout.tsx
import { Link } from 'react-router-dom';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { PocketBoardSummary, PocketStatus } from '../../../types/pocketTypes';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents';
import { pocketSquareClass } from '../../../helpers/pocketStatus';

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
const countActive = (summary: PocketBoardSummary): number =>
 summary.pocketCount - summary.fundedCount - summary.overdueCount;

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

 const activeCount = summary === null ? null : countActive(summary);
 const nextGoal = findNextGoal(pockets);
 const overdueCount = summary?.overdueCount ?? null;
 const uncoveredCount = summary?.uncoveredCount ?? null;
 // Clamped per pocket by the server before folding, so the bar needs no clamp
 // of its own and cannot paint past its track.
 const overallProgress = summary?.overallProgress ?? null;

 return (
  <div className='total__container flex-col-sb'>
   <div className='pocketHero'>
    {/* LEVEL 1 — where the board stands.
        The two halves of one statement, with a rule between them: committed
        plus remaining is the target. The middle column of the reference is
        gone, and with it the third printing of the percentage. */}
    <div className='pocketHero__equation'>
     <div className='pocketHero__tile pocketHero__tile--committed'>
      <span className='pocketHero__label'>Total allocated</span>
      <span className='pocketHero__value'>
       {amount(summary?.totalAllocated)}
      </span>
      <span className='pocketHero__meta'>
       of a {amount(summary?.totalTarget)} target
      </span>
     </div>

     <div className='pocketHero__tile pocketHero__tile--remaining'>
      <span className='pocketHero__label'>Still to commit</span>
      <span className='pocketHero__value'>
       {amount(summary?.totalRemaining)}
      </span>
      <span className='pocketHero__meta'>to reach every target</span>
     </div>
    </div>

    {/* LEVEL 2 — what to act on.
        Two readings of the board's population rather than of its money. Only
        the second is a door, so only the second carries a chevron: the first
        counts rows that are listed in full immediately below this block, and a
        chevron on a tile that leads nowhere is an affordance that lies. */}
    <div className='pocketHero__cards'>
     <div className='pocketHero__card'>
      <span className='pocketHero__label'>Active pockets</span>

      <span className='pocketHero__cardValue'>
       {activeCount === null
        ? MISSING
        : `${activeCount} of ${summary?.pocketCount}`}
      </span>

      {/* The exception counts, each with its square, and each present only
          when it is not zero: a mark reading "0 overdue" warns about nothing.
          The count is never colour alone — it carries the word beside it. */}
      <span className='pocketHero__marks'>
       {overdueCount !== null && overdueCount > 0 && (
        <span className='pocketHero__mark'>
         <StatusSquare alert={pocketSquareClass('offPlan')} />
         <span>{overdueCount} overdue</span>
        </span>
       )}

       {uncoveredCount !== null && uncoveredCount > 0 && (
        <span className='pocketHero__mark'>
         <StatusSquare alert={pocketSquareClass('atRisk')} />
         <span>{uncoveredCount} uncovered</span>
        </span>
       )}
      </span>
     </div>

     {/* Target and not goal. The frozen vocabulary lets the word goal name the
         figure a pocket aims at, never the object itself — and a tile headed
         "next goal" over a pocket's NAME says the opposite, which is how two
         nouns for one object get onto a screen.

         A Link when there is a pocket to open and a plain block when there is
         not: a control that can only refuse is worse than one that is absent. */}
     {nextGoal === null ? (
      <div className='pocketHero__card pocketHero__card--empty'>
       <span className='pocketHero__label'>Next target</span>
       <span className='pocketHero__cardValue'>{MISSING}</span>
       <span className='pocketHero__meta'>Nothing pending a date</span>
      </div>
     ) : (
      <Link
       to={`pockets/${nextGoal.pocketId}`}
       className='pocketHero__card pocketHero__card--link'
      >
       <span className='pocketHero__label'>Next target</span>

       <span className='pocketHero__cardValue pocketHero__cardValue--name'>
        {nextGoal.name}
       </span>

       <span className='pocketHero__meta'>
        {percent(nextGoal.progress)} committed ·{' '}
        {nextGoal.daysRemaining === 1
         ? '1 day left'
         : `${nextGoal.daysRemaining} days left`}
       </span>

       <span className='pocketHero__chevron' aria-hidden='true'></span>
      </Link>
     )}
    </div>

    {/* LEVEL 3 — how far along, all together. The board's one progress bar. */}
    <div className='pocketHero__progress'>
     <div className='pocketHero__progressRow'>
      <span className='pocketHero__label'>Overall progress</span>
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
