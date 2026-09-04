// SummaryPocketDetailBox.tsx
// The hero of the pocket detail screen: what is committed and against what
// goal. It states one reading and keeps one height.
//
// The two state readings — the date and the coverage warning — are back inside
// this panel as of 2026-09-02, on the developer's call. They had been moved out
// on 2026-08-30 because the panel grew with the number of states a pocket
// happened to be in and the control row under it moved 70px between one pocket
// and another; that cost is accepted, and the reason it was paid is that a
// state read three blocks below the figures it qualifies is read by nobody.
// The pace card stays where it is: it is a block of figures, not a state.
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
import {
 StatusSquare,
 StatusTick,
} from '../../../../general_components/boxComponents/BoxComponents.tsx';
import {
 POCKET_STATUS_WORD,
 pocketMarkIsTick,
 pocketReadingModifier,
 pocketSquareClass,
} from '../../../../helpers/pocketStatus.ts';
import PocketReadingIcon from '../PocketReadingIcon.tsx';
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
  uncovered,
  daysRemaining,
  level: dateLevel,
 } = pocket;

 // The symbol, which is how every amount in the application is denominated.
 // Passing the code turns on Intl's currency style and that is what emits it.
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
   ? `${amount(excess)} over target`
   : funded
     ? 'Nothing left to allocate'
     : `Still to allocate ${amount(remaining)}`;


 // Served, never derived: RULED 2026-09-03 (POCKET_CONTRACT_AUDIT.md,
 // "Contract change 2026-09-03"). The colour of the square and of the
 // reading's border come from this one level, so the two can never state
 // different things about the same pocket.

 // The sign is spent on the word rather than on the number: late is "12 days
 // late", never "-12 days left". Same rule the module applies to every figure
 // whose direction is already stated in words beside it.
 const dayCount = Math.abs(daysRemaining);
 const dayWord = dayCount === 1 ? 'day' : 'days';

 // The word comes from the shared map, not from a literal written here. The
 // square beside it is painted for the LEVEL, so the text has to name that same
 // level: a pocket past its goal lights the over-funded blue, and a band name
 // beside a level's colour disagrees about how precise the reading is.
 const dateText = funded
  ? POCKET_STATUS_WORD[dateLevel]
  : daysRemaining < 0
    ? `${dayCount} ${dayWord} late`
    : daysRemaining === 0
      ? 'Due today'
      : `${dayCount} ${dayWord} away`;

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
     <span className='summaryPocket__figureValue'>{amount(target)}</span>
     <span className='summaryPocket__separator' aria-hidden='true'>
      {' · '}
     </span>
     <span className='summaryPocket__figureLabel'>By</span>{' '}
     <span className='summaryPocket__figureValue'>
      {formatCalendarDate(desiredDate)}
     </span>
    </div>

    {/* Directly above the track it reads, not in the row underneath. Beside
        the shortfall it was one of two figures on a line and the eye had to
        decide which one it belonged to; over the bar there is nothing else it
        could be measuring. Same shape the board hero uses. */}
    <div className='summaryPocket__data--share'>
     {progress.toFixed(1)}% allocated
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

    {/* What is left, alone on its line now that the share sits with the bar.
        The two were separated by a dot and read as one statement, which is how
        a percentage measuring what is COMMITTED came to be read as the share
        still missing. */}
    <div className='summaryPocket__data--status'>
     <span className='summaryPocket__data--subtitle2'>{gapText}</span>
    </div>
   </div>

   {/* What is true about the pocket, under the figures it qualifies.

       Coverage leads when both are present. The criterion is not which hurts
       more but which contradicts the figures above: an account that no longer
       holds what is committed makes the allocated total unbacked, while a
       passed date leaves it true. */}
   <div className='summaryPocket__readings'>
    {uncovered && (
     <p
      className={`summaryPocket__reading ${pocketReadingModifier('overdue')}`}
      role='status'
     >
      <StatusSquare alert={pocketSquareClass('overdue')} />
      <PocketReadingIcon
       level='overdue'
       className='summaryPocket__readingIcon'
      />
      <span className='summaryPocket__readingText'>
       The funding accounts no longer hold what is committed here.
      </span>
     </p>
    )}

    {/* A tick for the one level that is finished rather than pending, a square
        for the other six — asked through the shared helper, so this panel and
        the board card cannot draw the same pocket two different shapes. The
        border beside it keeps its hue: a line cannot be a shape, so colour is
        all that mark has to carry. */}
    <p className={`summaryPocket__reading ${pocketReadingModifier(dateLevel)}`}>
     {pocketMarkIsTick(dateLevel) ? (
      <StatusTick />
     ) : (
      <StatusSquare alert={pocketSquareClass(dateLevel)} />
     )}
     <PocketReadingIcon
      level={dateLevel}
      className='summaryPocket__readingIcon'
     />
     <span className='summaryPocket__readingText'>{dateText}</span>
    </p>
   </div>
  </div>
 );
}

export default SummaryPocketDetailBox;
