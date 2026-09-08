// frontend/src/fintrack/pages/overview/components/FinancialGoals.tsx
// Block 06: what was promised to a goal and how much of it is set aside.
//
// ONE CARD AND NOT THREE. Saved, Target and Remaining are three parts of one
// statement, not three readings that stand on their own: Remaining is the plain
// subtraction of the other two, so three cards side by side invited the reader
// to compare figures that cannot disagree. The card carries the saved figure as
// its headline and the other two under the rule, which is the shape the monthly
// snapshot already uses for a figure and the baselines behind it.
//
// THE SQUARE HAS NO ALERT TIER HERE and the absence is deliberate. A goal that
// is not reached yet is not late, because financialGoals publishes no due date -
// nothing in it can be overdue. What CAN be late is a pocket commitment, and
// that reading is already on the Pocket domain card, which grades overdueCount.
// Painting an unreached goal red would put urgency on the page that nobody
// measured.

import { currencyFormat } from '../../../helpers/functions';
import { CardTitle } from '../../../general_components/CardTitle';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import { OverviewFinancialGoals } from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

const NO_FIGURE = '—';

// Below this share of the target the card says so. Above it the goals are under
// way and the mark stays calm - a permanent ochre square on every set of goals
// in progress would train the reader to ignore it.
const COVERAGE_LIMIT = 0.5;

const money = (currency: string, value: number) =>
 currencyFormat(currency, value, formatNumberCountry);

// 'YYYY-MM-01' to 'September 2026'. Split and rebuilt rather than passed to the
// Date constructor: 'YYYY-MM-01' parses as UTC midnight, which is the previous
// month for every reader west of Greenwich.
const monthLabel = (month: string | null) => {
 if (!month) return NO_FIGURE;

 const [year, monthNumber] = month.split('-').map(Number);

 return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
  month: 'long',
  year: 'numeric',
 });
};

type Tier = 'calm' | 'watch' | 'unknown';

const tierOf = (goals: OverviewFinancialGoals): Tier => {
 // No pocket carries a target, so there is nothing to be short of. An absent
 // target is not a target of zero, which would state that a goal was set and
 // reached.
 if (!goals.goalsTotalTarget) return 'unknown';

 // Not floored, so a negative remainder is an owner who saved past the goal.
 if (goals.goalsTotalRemaining !== null && goals.goalsTotalRemaining <= 0) {
  return 'calm';
 }

 const coverage = goals.goalsTotalBalance / goals.goalsTotalTarget;

 return coverage < COVERAGE_LIMIT ? 'watch' : 'calm';
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

 const tier = tierOf(financialGoals);

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
      <span className='snapshot__domain'>Saved</span>
      <span className='snapshot__period'>Position</span>
     </div>

     {/* Always a number: it counts every pocket, including the ones with no
         target, because money set aside is set aside whether or not it was
         promised to a goal. */}
     <div className='snapshot__actual'>{money(currency, goalsTotalBalance)}</div>

     <div className='snapshot__variance'>
      <span className={`statusSquare statusSquare--${tier}`} />
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
