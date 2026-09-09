// frontend/src/fintrack/pages/overview/components/FinancialGoals.tsx
// Block 06: what was promised to a goal and how much of it is set aside.
//
// THE HEADLINE FIGURE IS NOT "SAVED". It is goalsTotalBalance, the money that
// sits in pockets, and a pocket is a commitment rather than a container: the
// balance never left the bank account it was promised from
// (makeHeroSection.js:16-30). "Saved" put a second savings figure on a page
// whose hero already publishes what is spendable and what of it is unpromised -
// cashPosition and freeCash - and a reader adding this one to those was adding
// the same money twice. "Committed to pockets" is what freeCash subtracts.
//
// ONE CARD AND NOT THREE. The headline, Target and Remaining are three parts of one
// statement, not three readings that stand on their own: Remaining is the plain
// subtraction of the other two, so three cards side by side invited the reader
// to compare figures that cannot disagree. The card carries the saved figure as
// its headline and the other two under the rule, which is the shape the monthly
// snapshot already uses for a figure and the baselines behind it.
//
// THE SQUARE HAS NO ALERT LEVEL HERE and the absence is deliberate. A goal that
// is not reached yet is not late, because financialGoals publishes no due date -
// nothing in it can be overdue. What CAN be late is a pocket commitment, and
// that reading is already on the Pocket domain card, which grades overdueCount.
// Painting an unreached goal red would put urgency on the page that nobody
// measured.
//
// The scale is the pocket module's (helpers/pocketStatus.ts) and not one of this
// file's own, because the question is the same one: how far a saved figure is
// against a target it was promised to. That scale inverts the budget's -
// approaching the target is the point - and this block is the other place in
// the app where that inversion applies.

import { currencyFormat } from '../../../helpers/functions';
import { CardTitle } from '../../../general_components/CardTitle';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import { monthLabel } from '../helpers/monthLabel';
import { OverviewFinancialGoals } from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

const NO_FIGURE = '—';

const money = (currency: string, value: number) =>
 currencyFormat(currency, value, formatNumberCountry);

// The class the shared StatusSquare appends, from the pocket module's
// vocabulary. Only two of its seven levels are reachable from this block and
// the rest are not, which is a property of what financialGoals publishes rather
// than a simplification: without a due date nothing can be overdue or at risk,
// and without a pace nothing can be ahead or behind. What is left is at the
// target and short of it.
//
// The share the level is read from stays a comparison and never becomes a
// published rate - see coverageLine below.
type SquareClass = 'neutral' | 'info' | 'unknown';

const squareOf = (goals: OverviewFinancialGoals): SquareClass => {
 // No pocket carries a target, so there is nothing to be short of. An absent
 // target is not a target of zero, which would state that a goal was set and
 // reached.
 if (!goals.goalsTotalTarget) return 'unknown';

 // Not floored, so a negative remainder is an owner who saved past the goal.
 // 'info' and not the bare square: the pocket module calls being past the
 // target notable rather than merely fine, because it is the one reading that
 // points at money the owner can move.
 if (goals.goalsTotalRemaining !== null && goals.goalsTotalRemaining <= 0) {
  return 'info';
 }

 // Under way, which asks nothing of the owner. The invented half-target
 // threshold this replaces was a rule nothing in the app or the contract
 // declared, and it painted an ochre square on every set of goals in its first
 // half - a mark the reader would learn to ignore.
 return 'neutral';
};

// The two labels the pocket module already prints for this figure, measured off
// the screens that print it: PocketCard.tsx:241 labels the remainder 'Still to
// allocate' when there is one and 'Over target' when the goal was passed.
//
// Carlos, 2026-09-09: "hay toda una convencion de mensajes usados en el modulo
// pocket". This card had three wordings of one figure - 'still to set aside',
// 'past the target' and 'target less saved' - and none of them was the module's.
//
// The sign lives in the LABEL and the figure is absolute, which is the module's
// own rule (PocketCard.tsx:249): a negative amount printed beside 'Over target'
// is the same negation twice.
const remainderLabel = (goalsTotalRemaining: number | null) => {
 if (goalsTotalRemaining === null) return 'Remaining';

 return goalsTotalRemaining <= 0 ? 'Over target' : 'Still to allocate';
};

// The sentence beside the square: the READING and no longer the amount. The
// amount lives once, in the baseline row under the rule, where it is labelled.
//
// It carried the amount until the two were aligned to one vocabulary on
// 2026-09-09, and the alignment is what made the duplication visible: the card
// printed "$1,581.00 still to allocate" twice, three lines apart. A square
// grades a reading, so this states the reading; the figures below state the
// figures.
//
// No rate here either. The server publishes no percentage for this block, and
// one divided in the browser would be a figure the page states and nothing else
// can reproduce.
const coverageLine = (goals: OverviewFinancialGoals) => {
 const { goalsTotalTarget, goalsTotalRemaining } = goals;

 if (!goalsTotalTarget || goalsTotalRemaining === null) {
  return 'no pocket carries a target yet';
 }

 return goalsTotalRemaining <= 0
  ? 'every target is covered'
  : 'some targets are still short';
};

function FinancialGoals() {
 const financialGoals = useOverviewStore((state) => state.financialGoals);
 const referenceMonth = useOverviewStore((state) => state.referenceMonth);

 // Nothing has arrived yet. The layout above owns the skeleton and the error
 // with its retry, so an empty block here is the whole of this component's
 // loading state rather than a second spinner beside that one.
 if (!financialGoals) return null;

 const { goalsTotalBalance, goalsTotalTarget, goalsTotalRemaining, currency } =
  financialGoals;

 const square = squareOf(financialGoals);

 const amount = (value: number | null) =>
  value === null ? NO_FIGURE : money(currency, value);

 return (
  <>
   <div className='presentation__card__title__container flx-row-sb'>
    {/* The nature and the close, said once. It is the same for every figure in
        the card, so it is not repeated inside it. */}
    <CardTitle
     subtitle={`Position at the close of ${monthLabel(referenceMonth)}`}
    >
     Financial Goals
    </CardTitle>
   </div>

   <section className='domainCards domainCards--single'>
    <article className='snapshot'>
     <div className='snapshot__head'>
      <span className='snapshot__domain'>Committed to pockets</span>
      <span className='snapshot__period'>Position</span>
     </div>

     {/* Always a number: it counts every pocket, including the ones with no
         target, because money set aside is set aside whether or not it was
         promised to a goal. */}
     <div className='snapshot__actual'>{money(currency, goalsTotalBalance)}</div>

     <div className='snapshot__variance'>
      <StatusSquare alert={square} />
      <span className='snapshot__against'>{coverageLine(financialGoals)}</span>
     </div>

     <div className='snapshot__baselines'>
      <div className='snapshot__baseline'>
       <span className='snapshot__label'>Target</span>
       <span className='snapshot__figure'>{amount(goalsTotalTarget)}</span>
       <span className='snapshot__weight'>
        {goalsTotalTarget === null ? 'none set' : 'promised to a goal'}
       </span>
      </div>

      {/* THE LABEL IS THE READING and the caption says what the figure is a
          part of. It was 'Remaining' over the caption 'target less saved',
          which Carlos read on 2026-09-09 and could not decode: the phrase was
          invented here, it described the arithmetic rather than the figure, and
          it carried 'saved' - the word this card's headline retired, because a
          pocket holds nothing and the balance never leaves the bank account it
          was promised from.

          Not floored, but the sign is spent on the word rather than printed on
          the figure, the way the pocket card states the same pair
          (PocketCard.tsx:241-249): an owner past the goal reads 'Over target'
          and a positive amount, which is the true answer stated once. */}
      <div className='snapshot__baseline'>
       <span className='snapshot__label'>
        {remainderLabel(goalsTotalRemaining)}
       </span>
       <span className='snapshot__figure'>
        {goalsTotalRemaining === null
         ? amount(null)
         : amount(Math.abs(goalsTotalRemaining))}
       </span>
       <span className='snapshot__weight'>
        {goalsTotalTarget === null ? 'no target set' : 'of that target'}
       </span>
      </div>
     </div>
    </article>
   </section>
  </>
 );
}

export default FinancialGoals;
