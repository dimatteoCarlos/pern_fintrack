// PocketCard.tsx
// One pocket as a card, and the only place that shape is written.
//
// It lived inline inside ListPocket until 2026-09-04 and moved out when the
// hero's Next target card needed the same thing. The alternative was for the
// hero to keep its own hand-built row of the same figures, which is what it had
// — a name, an amount to allocate, a percentage and a day count, each named
// slightly differently from the card in the list below it, so the board
// described its most urgent pocket in one vocabulary and the same pocket in
// another four rows further down.
//
// It sits in its own file rather than being exported from ListPocket: the hero
// would then import from the list it is stacked above, and the two are siblings
// under Pocket.tsx, not one inside the other.
//
// The whole card is the link, which is also what makes the pocket reachable
// from the hero at all. Next target used to make a link of its heading only —
// two words at the top of the card — and everything the reader was actually
// looking at, the name and the figures, led nowhere.

import { Link } from 'react-router-dom';
import {
 StatusSquare,
 StatusTick,
} from '../../../general_components/boxComponents/BoxComponents.tsx';
import {
 CURRENCY_OPTIONS,
 DEFAULT_CURRENCY,
} from '../../../helpers/constants.ts';
import {
 currencyFormat,
 formatCalendarDate,
} from '../../../helpers/functions.ts';
import {
 POCKET_STATUS_WORD,
 PocketStatusLevel,
 pocketMarkIsTick,
 pocketSquareClass,
} from '../../../helpers/pocketStatus.ts';
import { PocketStatus } from '../../../types/pocketTypes.ts';

// A figure the contract withheld. Never 0 and never an empty cell: a dash says
// the answer is absent, where 0 would state an amount.
const DASH = '—';

// The tone the card's word, bar fill and percentage all take, so the three
// cannot paint a pocket three ways. It is NOT the square's class: the mark is
// asked for separately, because completed is drawn as a shape and has no tone
// to give it.
//
// Colour alone survives neither colour blindness nor a monochrome print, which
// is why every card also prints the word.
const STATUS_TONE: Record<PocketStatusLevel, string> = {
 completed: 'ok',
 aboveTarget: 'info',
 ahead: 'ahead',
 onTrack: 'neutral',
 behind: 'behind',
 atRisk: 'warning',
 overdue: 'alert',
};

const plural = (count: number, word: string): string =>
 `${count} ${word}${Math.abs(count) === 1 ? '' : 's'}`;

// How the deadline reads against today. Negative days are a deadline already
// passed, and the day it falls on is neither left nor overdue.
const deadlineReading = (days: number): string => {
 if (days === 0) return 'Due today';

 return days > 0
  ? `${plural(days, 'day')} left`
  : `${plural(Math.abs(days), 'day')} overdue`;
};

type PocketCardPropType = {
 pocket: PocketStatus;
 // Where the reader came from, carried so the detail's back control returns
 // there instead of to whichever route happens to be the module's default. The
 // hero and the list pass different values for the same pocket.
 previousRoute: string;
};

function PocketCard({ pocket, previousRoute }: PocketCardPropType) {
 const {
  pocketId,
  name,
  note,
  allocated,
  target,
  remaining,
  progress,
  desiredDate,
  daysRemaining,
  requiredMonthly,
  scheduledByNow,
  aheadOfPlan,
  sourceCount,
  uncovered,
  currency,
  level,
 } = pocket;

 const currency_code = currency ?? DEFAULT_CURRENCY;
 // The locale is the reader's, never the amount's. Taken from the amount's own
 // currency, Intl leaves every currency unmarked, and the dollar, the Colombian
 // peso and the Mexican peso all narrow to '$' -- two cards in different
 // currencies then read identically.
 const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

 const amount = (value: number) =>
  currencyFormat(currency_code, value, formatNumberCountry);

 // Built from the parts of a YYYY-MM-DD label the server resolved on the
 // owner's calendar. new Date() on one of these is UTC midnight and renders as
 // the previous day west of UTC.
 const deadlineText = formatCalendarDate(desiredDate);

 const tone = STATUS_TONE[level];

 // The row's percentage is not clamped and passes 100 when the goal is passed,
 // which is a fact the label prints. The track is clamped instead, because a
 // fill wider than its rail is a paint error and not a reading.
 const barWidth = Math.min(Math.max(progress, 0), 100);

 // A shortfall and an excess are the same subtraction with opposite signs and
 // they are not the same news, so each gets its own word. Exactly zero is a real
 // answer — nothing is missing — and prints as the amount.
 const isExcess = remaining < 0;

 // null and 0 are different answers on this field: null is a deadline already
 // passed, so no pace exists to state, and 0 is a goal already met, so none is
 // required. Neither is an amount of money per month.
 //
 // A passed deadline printed a dash here, which told the owner nothing about a
 // pocket the board is raising an alert on. There is no RATE left, because a
 // rate is money over time and the time is gone, but there is very much an
 // amount: the whole shortfall, due now rather than spread.
 //
 // It is read off `remaining`, which the server already sends. Nothing is
 // written into requiredMonthly: a field named for a monthly figure must not
 // carry one that is not monthly, and every consumer that formats it with
 // "/ month" would then print something untrue.
 const paceText =
  requiredMonthly === null
   ? `${amount(remaining)} now`
   : requiredMonthly === 0
     ? 'Not needed'
     : amount(requiredMonthly);

 // The label follows the figure and stops naming a rate on a pocket that has
 // none left.
 const paceLabel = requiredMonthly === null ? 'To settle' : 'Monthly pace';

 // Where the pocket sits against the line its OWN plan implies, in money.
 // Without the amount the At risk colour is an assertion the owner cannot
 // check; with it the reading says by how much and in which direction.
 //
 // A plan whose window is shorter than a month publishes no line, so it says so
 // rather than printing a pace built on a window that states nothing.
 // Served, signed, never recomputed here: aheadOfPlan is committed minus what
 // the already-due instalments required.
 const scheduleText =
  scheduledByNow === null || aheadOfPlan === null
   ? 'The plan has no window — no pace is shown'
   : aheadOfPlan < 0
     ? `${amount(Math.abs(aheadOfPlan))} behind the plan`
     : `${amount(aheadOfPlan)} ahead of the plan`;

 return (
  <Link
   to={`pockets/${pocketId}`}
   state={{ previousRoute }}
   className={`pocketCard ${uncovered ? 'pocketCard--uncovered' : ''}`.trim()}
  >
   <div className='pocketCard__head'>
    <h3 className='pocketCard__name'>{name}</h3>

    {/* The level is decided once on the server and only named here. Completed
        takes a TICK and every other level a square: the shape is asked for
        through the shared helper, so the card, the hero strip and the detail
        panel cannot disagree about which reading is finished. It is also the
        only mark on this scale that a colour-blind reader can still tell from
        its neighbours — the seven collapse to two families under simulation. */}
    <span className={`pocketCard__status pocketCard__status--${tone}`}>
     {pocketMarkIsTick(level) ? (
      <StatusTick />
     ) : (
      <StatusSquare alert={pocketSquareClass(level)} />
     )}
     {POCKET_STATUS_WORD[level]}
    </span>
   </div>

   <p className='pocketCard__note'>{note ?? DASH}</p>

   {/* The percentage sits ON the bar it reports, not at the end of the row of
       amounts below. It used to close pocketCard__amounts, which put two
       unrelated figures — the allocated amount and the target — between the bar
       and the number that states the same fact, so the number read as a loose
       datum rather than as the bar's own label.

       They are not redundant, which is why the number stays rather than being
       dropped: the bar is approximate and the figure is exact. */}
   <div className='pocketCard__progress'>
    <span className={`pocketCard__percent pocketCard__percent--${tone}`}>
     {Math.round(progress)}%
    </span>

    <div
     className='pocketCard__bar'
     role='progressbar'
     aria-label={`${name} progress`}
     aria-valuemin={0}
     aria-valuemax={100}
     aria-valuenow={Math.round(progress)}
    >
     <div
      className={`pocketCard__barFill pocketCard__barFill--${tone}`}
      style={{ width: `${barWidth}%` }}
     />
    </div>
   </div>

   <p className='pocketCard__amounts'>
    <span className='pocketCard__allocated'>{amount(allocated)}</span>
    {/* The figure is NAMED, not related by a preposition. "of" asserts that the
        second amount is the whole and the first a part of it, and an
        over-funded pocket makes that false on screen: "$5.00 of $1.38". The
        label holds for every pocket because it states what the figure IS. */}
    <span className='pocketCard__target'>
     <span className='pocketCard__targetLabel'>Target</span> {amount(target)}
    </span>
   </p>

   <dl className='pocketCard__facts'>
    <div className='pocketCard__fact'>
     {/* The same words the board hero and the detail panel use for this figure.
         "Remaining" was a fourth name for it, and the card sits in a list the
         hero heads. */}
     <dt className='pocketCard__factLabel'>
      {isExcess ? 'Over target' : 'Still to allocate'}
     </dt>
     <dd
      className={`pocketCard__factValue ${
       isExcess ? 'pocketCard__factValue--ok' : ''
      }`.trim()}
     >
      {amount(Math.abs(remaining))}
     </dd>
    </div>

    <div className='pocketCard__fact'>
     <dt className='pocketCard__factLabel'>{paceLabel}</dt>
     <dd
      className={`pocketCard__factValue ${
       requiredMonthly === null ? 'pocketCard__factValue--alert' : ''
      }`.trim()}
     >
      {paceText}
     </dd>
    </div>

    <div className='pocketCard__fact'>
     <dt className='pocketCard__factLabel'>Deadline</dt>
     <dd className='pocketCard__factValue'>{deadlineText || DASH}</dd>
    </div>

    <div className='pocketCard__fact'>
     <dt className='pocketCard__factLabel'>Time</dt>
     <dd
      className={`pocketCard__factValue ${
       daysRemaining < 0 ? 'pocketCard__factValue--alert' : ''
      }`.trim()}
     >
      {deadlineReading(daysRemaining)}
     </dd>
    </div>
   </dl>

   {/* The sentence that makes the criterion legible. It is the whole substance
       of the change: On track and At risk occupy the same space — deadline
       ahead, target not met — and this line is the only thing separating
       them. */}
   <p
    className={`pocketCard__gap ${
     aheadOfPlan !== null && aheadOfPlan < 0 ? '' : 'pocketCard__gap--none'
    }`.trim()}
   >
    {scheduleText}
   </p>

   {/* A count, not names: the detail screen lists the accounts one by one and
       the card has no room for two of them. */}
   <p className='pocketCard__sources'>
    {sourceCount === 0
     ? 'No funding account yet'
     : `Funded by ${plural(sourceCount, 'account')}`}
   </p>

   {/* Orthogonal to the readings above and louder than any of them: a funded
       pocket can still be uncovered. Folded by the server across the accounts,
       so nothing here derives it. */}
   {uncovered && (
    <p className='pocketCard__uncovered'>
     Funding accounts no longer hold what this pocket committed
    </p>
   )}
  </Link>
 );
}

export default PocketCard;
