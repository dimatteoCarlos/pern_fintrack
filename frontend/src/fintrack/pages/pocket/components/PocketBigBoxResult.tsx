//-------PocketBigBoxResult---------
//Parent: PocketLayout.tsx
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { PocketBoardSummary, PocketStatus } from '../../../types/pocketTypes';

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
// purpose: the tile answers what is next, and a deadline that has passed is not
// next. null when nothing is active, and the tile then reads as empty rather
// than promoting a pocket that does not qualify.
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
 const overdueCount = summary === null ? null : summary.overdueCount;
 // Clamped per pocket by the server before folding, so the bar needs no clamp
 // of its own and cannot paint past its track.
 const overallProgress = summary?.overallProgress ?? null;

 return (
  <div className='total__container flex-col-sb'>
   <div className='pocketHero'>
    <div className='pocketHero__tile pocketHero__tile--headline'>
     <span className='pocketHero__label'>Total allocated</span>
     <span className='pocketHero__value'>
      {amount(summary?.totalAllocated)}
     </span>
     <span className='pocketHero__meta'>of {amount(summary?.totalTarget)}</span>
    </div>

    <div
     className={`pocketHero__tile ${activeCount === null ? 'is-empty' : ''}`}
    >
     <span className='pocketHero__label'>Active pockets</span>
     <span className='pocketHero__value'>
      {activeCount === null
       ? MISSING
       : `${activeCount} of ${summary?.pocketCount}`}
     </span>
     <span className='pocketHero__meta'>
      {overdueCount !== null && overdueCount > 0
       ? `${overdueCount} overdue`
       : ''}
     </span>
    </div>

    <div className={`pocketHero__tile ${nextGoal === null ? 'is-empty' : ''}`}>
     {/* Target and not goal. The frozen vocabulary lets the word goal name
         the figure a pocket aims at, never the object itself — and a tile
         headed "next goal" over a pocket's NAME says the opposite, which is
         how two nouns for one object get onto a screen. */}
     <span className='pocketHero__label'>Next target</span>
     <span className='pocketHero__value'>{nextGoal?.name ?? MISSING}</span>
     <span className='pocketHero__meta'>
      {nextGoal === null ? '' : percent(nextGoal.progress)}
     </span>
    </div>

    <div className='pocketHero__tile pocketHero__tile--progress'>
     <span className='pocketHero__label'>Overall progress</span>
     <span className='pocketHero__value'>{percent(overallProgress)}</span>
     <div
      className='pocketHero__bar'
      role='progressbar'
      aria-label='Overall progress'
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
