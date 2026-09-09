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

// The sentence beside the square, in money and never as a rate. The share the
// tier is read from stays internal: the server publishes no percentage for this
// block, and one divided in the browser would be a figure the page states and
// nothing else can reproduce.
const coverageLine = (goals: OverviewFinancialGoals) => {
 const { goalsTotalTarget, goalsTotalRemaining, currency } = goals;

 if (!goalsTotalTarget || goalsTotalRemaining === null) {
  return 'no pocket carries a target yet';
 }

 if (goalsTotalRemaining <= 0) {
  return `${money(currency, Math.abs(goalsTotalRemaining))} past the target`;
 }

 return `${money(currency, goalsTotalRemaining)} still to set aside`;
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

      <div className='snapshot__baseline'>
       <span className='snapshot__label'>Remaining</span>
       <span className='snapshot__figure'>{amount(goalsTotalRemaining)}</span>
       {/* Not floored at zero. It is a plain subtraction, so an owner who saved
           past the goal reads a negative remainder, which is the true answer;
           clamping it would report the goal as exactly met. */}
       <span className='snapshot__weight'>target less saved</span>
      </div>
     </div>
    </article>
   </section>
  </>
 );
}

export default FinancialGoals;
