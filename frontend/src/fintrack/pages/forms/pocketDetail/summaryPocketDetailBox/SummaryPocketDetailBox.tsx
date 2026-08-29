// SummaryPocketDetailBox.tsx
// The hero of the pocket detail screen: what is committed, against what goal,
// and whether the plan is on pace.
//
// Rewritten 2026-08-29 against the server that answers. The previous version
// read an account — it destructured account_balance and subtracted the goal
// from it by hand — on a screen that was fetching an account by a pocket's id.
// Every figure it computed is now served: the shortfall, the progress and the
// monthly pace are folded by the server precisely so no component derives them
// twice and disagrees with the board about the same pocket.
//
// It says "allocated", never "saved": no money moved and nothing was set aside.
// The cash is still in the funding account, claimed by a plan.

import { numberFormatCurrency } from '../../../../helpers/functions';
import { PocketDetailPocket } from '../../../../types/pocketTypes';
import './styles/summaryDetailBox-style.css';

type SummaryPocketDetailPropType = {
 pocket: PocketDetailPocket;
};

function SummaryPocketDetailBox({ pocket }: SummaryPocketDetailPropType) {
 const {
  target,
  allocated,
  remaining,
  progress,
  requiredMonthly,
  daysRemaining,
  funded,
  overdue,
  uncovered,
  currency,
 } = pocket;

 const amount = (value: number) => numberFormatCurrency(value, 2, currency);

 // The bar never runs past its track, while the figure beside it is free to
 // read over 100%. Clamping the number too would hide an over-funded pocket.
 const barWidth = Math.min(Math.max(progress, 0), 100);

 // Three outcomes, and the null is not the zero. A monthly pace of exactly 0
 // means the goal is already covered; null means the deadline passed, so there
 // is no pace left to state. Branching on falsiness collapses the two, because
 // 0 is falsy in JavaScript.
 const paceText =
  funded
   ? 'Goal covered'
   : requiredMonthly === null
     ? `${amount(remaining)} short, deadline passed`
     : `${amount(requiredMonthly)} per month to stay on pace`;

 // Negative remaining is over-funding, which is a fact and not an error.
 const excess = remaining < 0 ? Math.abs(remaining) : null;

 return (
  <div className='summaryPocket__container'>
   <div className='summaryPocket__title'>allocated of goal</div>

   <div className='summaryPocket__data'>
    <div className='summaryPocket__data--amount'>{amount(allocated)}</div>

    <div className='summaryPocket__data--subtitle1'>
     of {amount(target)}
    </div>

    <div
     className='summaryPocket__track'
     role='progressbar'
     aria-valuenow={Math.round(progress)}
     aria-valuemin={0}
     aria-valuemax={100}
     aria-label='Progress towards the goal'
    >
     <div
      className='summaryPocket__fill'
      style={{ width: `${barWidth}%` }}
     ></div>
    </div>

    <div className='summaryPocket__data--status'>
     <span className='summaryPocket__data--subtitle2'>
      {progress.toFixed(1)}%
     </span>

     <span className='summaryPocket__separator' aria-hidden='true'>
      ·
     </span>

     <span className='summaryPocket__data--subtitle2'>
      {excess === null
       ? `${amount(remaining)} to go`
       : `${amount(excess)} over`}
     </span>
    </div>
   </div>

   {/* The deadline reading. Its own line rather than a badge, because it is a
       sentence in every one of its three states and none of them fits a chip. */}
   <div className='summaryPocket__pace'>{paceText}</div>

   {/* Days are printed only while they are still a countdown. Once the date has
       passed the line above already says so, and a negative day count beside it
       would state the same fact twice in a unit nobody plans in. */}
   {!overdue && !funded && (
    <div className='summaryPocket__days'>
     {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
    </div>
   )}

   {/* The accounts funding this pocket no longer hold what they committed to
       it. Folded by the server across accounts, because no single account's row
       can answer it. */}
   {uncovered && (
    <div className='summaryPocket__warning' role='status'>
     The funding accounts no longer cover what is committed here.
    </div>
   )}
  </div>
 );
}

export default SummaryPocketDetailBox;
