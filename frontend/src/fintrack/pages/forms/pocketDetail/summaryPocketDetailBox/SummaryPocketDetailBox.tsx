// SummaryPocketDetailBox.tsx
// The hero of the pocket detail screen: what is committed and against what
// goal. It states one reading and keeps one height.
//
// The state readings — the date, the pace and the coverage warning — left this
// panel on 2026-08-30. Inside it they made the panel grow with the number of
// states a pocket happened to be in, which moved the control row 70px between
// one pocket and another. They now sit under the controls, in PocketDetail.
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

import {
 formatCalendarDate,
 numberFormatCurrency,
} from '../../../../helpers/functions';
import { PocketDetailPocket } from '../../../../types/pocketTypes';
// '?react' and not the bare form: only that door carries a React type, so the
// glyph can take a className and inherit the panel's ink through currentColor.
import PiggyCoinSvg from '../../../../../assets/pocketSvg/PiggyUniversalCoinSvg.svg?react';
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
  funded,
  currency,
  desiredDate,
 } = pocket;

 const amount = (value: number) => numberFormatCurrency(value, 2, currency);

 // The bar never runs past its track, while the figure beside it is free to
 // read over 100%. Clamping the number too would hide an over-funded pocket.
 const barWidth = Math.min(Math.max(progress, 0), 100);

 // Negative remaining is over-funding, which is a fact and not an error.
 const excess = remaining < 0 ? Math.abs(remaining) : null;

 // One statement of the gap, where there were three. "of $25.50", "0.0%" and
 // "$25.50 to go" all said the same thing while nothing was committed, and the
 // percentage restates the bar, which exists so the number does not have to be
 // read at all.
 const gapText =
  excess !== null
   ? `${amount(excess)} over`
   : funded
     ? 'Nothing left to commit'
     : `Still to commit ${amount(remaining)}`;

 return (
  <div className='summaryPocket__container'>
   {/* One figure is headlined, so the label names that one. */}
   <div className='summaryPocket__title'>allocated</div>

   <PiggyCoinSvg className='summaryPocket__glyph' aria-hidden='true' />

   <div className='summaryPocket__data'>
    <div className='summaryPocket__data--amount'>{amount(allocated)}</div>

    {/* Two labelled figures, not a sentence. What was here read "committed to
        this goal, of $25.50": the phrase named neither quantity, and the date
        the plan is measured against was three blocks further down the page. */}
    <div className='summaryPocket__data--subtitle1'>
     <span className='summaryPocket__figureLabel'>Target</span>{' '}
     <span className='summaryPocket__figureValue'>{amount(target)}</span>{' '}
     {/* The code, which used to sit three blocks down as a metadata field of
         its own. It belongs against the figure it denominates. */}
     <span className='summaryPocket__figureLabel'>
      {currency.toUpperCase()}
     </span>
     <span className='summaryPocket__separator' aria-hidden='true'>
      {' · '}
     </span>
     <span className='summaryPocket__figureLabel'>By</span>{' '}
     <span className='summaryPocket__figureValue'>
      {formatCalendarDate(desiredDate)}
     </span>
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

    {/* The share leads, because it is the bar's own reading: below the bar and
        after a sentence it was a bare "0.0%" with nothing naming what it
        measured. The amount follows as the figure the share resolves to. */}
    <div className='summaryPocket__data--status'>
     <span className='summaryPocket__data--share'>{progress.toFixed(1)}%</span>

     <span className='summaryPocket__separator' aria-hidden='true'>
      ·
     </span>

     <span className='summaryPocket__data--subtitle2'>{gapText}</span>
    </div>
   </div>
  </div>
 );
}

export default SummaryPocketDetailBox;
