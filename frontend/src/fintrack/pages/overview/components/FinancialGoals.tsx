// frontend/src/fintrack/pages/overview/components/FinancialGoals.tsx
// Block 05 of level 1: what is saved towards the owner's goals, the goal, and
// what is left.
//
// EXACTLY THREE FIGURES AND NO PERCENTAGE. makeFinancialGoals publishes the
// saved amount, the target and the remainder and nothing else. A "64% reached"
// would have to be divided here, which means the browser deciding what to do
// when the target is null or zero — the two cases the server already answers by
// withholding the target.
//
// No progress bar either. The level-1 rule is a figure per cell, and a bar
// would turn the block into the miniature dashboard that rule exists to stop.
//
// It is a POSITION at the close of the served month, not a figure as of today:
// getSavingGoals takes the reference month, so this reads at the same cut as
// every card above it.

import { currencyFormat } from '../../../helpers/functions';
import { CardTitle } from '../../../general_components/CardTitle';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// An ABSENT TARGET IS NOT A TARGET OF ZERO. When no pocket carries one the
// server sends null for the target and for the remainder, and a 0 here would
// state that the owner set a goal and reached it.
const NO_FIGURE = '—';

// 'YYYY-MM-01' to 'September 2026'. Rebuilt from the parts rather than parsed:
// 'YYYY-MM-01' is read as UTC midnight, which is the previous month for every
// reader west of Greenwich.
const monthLabel = (month: string | null) => {
 if (!month) return NO_FIGURE;

 const [year, monthNumber] = month.split('-').map(Number);

 return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
  month: 'long',
  year: 'numeric',
 });
};

function FinancialGoals() {
 const financialGoals = useOverviewStore((state) => state.financialGoals);
 const referenceMonth = useOverviewStore((state) => state.referenceMonth);

 // The layout above owns the skeleton, the error and its retry, so nothing is
 // drawn here until the payload lands.
 if (!financialGoals) return null;

 const { goalsTotalBalance, goalsTotalTarget, goalsTotalRemaining, currency } =
  financialGoals;

 const amount = (value: number | null) =>
  value === null
   ? NO_FIGURE
   : currencyFormat(currency, value, formatNumberCountry);

 return (
  <>
   <div className='presentation__card__title__container flx-row-sb'>
    {/* All three cards read the same nature at the same close, so the scope
        is stated once here instead of three times inside the grid, where it
        was the longest line on every card and wrapped to two. */}
    <CardTitle
     subtitle={`Position at the close of ${monthLabel(referenceMonth)}`}
    >
     Financial Goals
    </CardTitle>
   </div>

   <section className='domainCards'>
    <article className='domainCard'>
     <div className='domainCard__head'>
      <span className='domainCard__label'>Saved</span>
     </div>
     {/* Always a number: it counts every pocket, including the ones with no
         target, because money set aside is set aside whether or not it was
         promised to a goal. */}
     <div className='domainCard__figure'>{amount(goalsTotalBalance)}</div>
    </article>

    <article className='domainCard'>
     <div className='domainCard__head'>
      <span className='domainCard__label'>Target</span>
     </div>
     <div className='domainCard__figure'>{amount(goalsTotalTarget)}</div>
    </article>

    <article className='domainCard'>
     <div className='domainCard__head'>
      <span className='domainCard__label'>Remaining</span>
     </div>
     {/* Not floored at zero. It is a plain subtraction, so an owner who saved
         past the goal reads a negative remainder, which is the true answer;
         clamping it would report the goal as exactly met. */}
     <div className='domainCard__figure'>{amount(goalsTotalRemaining)}</div>
    </article>
   </section>
  </>
 );
}

export default FinancialGoals;
