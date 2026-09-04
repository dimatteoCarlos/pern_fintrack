//-------PocketBigBoxResult---------
//Parent: PocketLayout.tsx (the hero) and Pocket.tsx (the readings)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import {
 currencyFormat,
 formatBudgetMonthLabel,
} from '../../../helpers/functions';
import { PocketBoardSummary, PocketStatus } from '../../../types/pocketTypes';
import {
 StatusSquare,
 StatusTick,
} from '../../../general_components/boxComponents/BoxComponents';
import {
 POCKET_STATUS_WORD,
 pocketSquareClass,
} from '../../../helpers/pocketStatus';
import { usePocketBoardStore } from '../../../stores/usePocketBoardStore';
import PocketFundingAccounts from './PocketFundingAccounts';
// Decorative only, and drawn at --size-glyph-hero: the set is a 0.26 pen on a
// 24 unit grid and stops resolving below 4rem. Each file already carries
// aria-hidden, so none of them reaches the accessibility tree. The one beside
// the progress bar is the exception and the stylesheet states why.
import BarChartSvg from '../../../../assets/pocketSvg/barChartSvg.svg?react';
import BullsEyeSvg from '../../../../assets/pocketSvg/bullsEyeSvg.svg?react';
import WalletSvg from '../../../../assets/pocketSvg/walletSvg.svg?react';
// The accordion's own mark, and the same asset the accounting dashboard's
// groups already toggle with: one glyph rotated, never two pointing opposite
// ways, so the state reads as the same control moved rather than swapped.
import ArrowDownLightSvg from '../../../../assets/ArrowDownLightSvg.svg?react';

// What each toggle names to a screen reader through aria-controls. Declared
// once: the button and the region it opens have to agree on the string.
const STATUS_BODY_ID = 'pocketHero-statusBody';
const TARGET_BODY_ID = 'pocketHero-nextTargetBody';

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
 // The month every figure is about, and the latest month there is. Both
 // YYYY-MM, as the server resolved them: the movement line names a past
 // month by name and has to know which month it is reporting without asking
 // the browser clock.
 referenceMonth: string | null;
 currentMonth: string | null;
 // Why the figures read as dashes, in the server's own words. null when there
 // is nothing to explain.
 notice: string | null;
};

const MISSING = '—';

// The deadline as DD-MM-YYYY, built by slicing the YYYY-MM-DD text rather than
// by parsing it. new Date() on one of these reads UTC midnight and renders the
// previous day west of UTC, which is why the row type forbids it and why there
// is no Date here at all.
const deadlineLabel = (day: string | null) => {
 if (!day) return null;

 const [year, month, date] = day.split('-');
 if (!year || !month || !date) return null;

 return `${date}-${month}-${year}`;
};

// A level with nothing in it stays on screen and steps back. Dropping it breaks
// the partition its heading counts, and a reader cannot tell a level that is
// absent from one with nothing in it; printing it at full ink gives an empty
// level the same call on the eye as a populated one. On a board where four of
// the five are empty, this is what leaves the fifth as the only thing lit.
const markClass = (count: number): string =>
 count === 0 ? 'pocketHero__mark pocketHero__mark--empty' : 'pocketHero__mark';

// The words still come from the shared map and are never typed out here — the
// strip used to spell its own copies, so renaming the map left the card saying
// "Completed" beside a strip still saying "at target" — but they are no longer
// lower-cased. The reading was "2 completed" inside a sentence; it is now the
// first thing on its own row, and a row opens with a capital.

// The pocket to send the owner to, which is not the same question as which
// deadline falls first on the calendar.
//
// Excluding the late ones outright, as this did, blanked the card on exactly
// the board where direction matters most: every unfinished pocket past its
// date meant nothing upcoming, so four pockets could be raising an alert while
// the tile said there was nothing pending. A deadline that has passed is not
// next by the calendar, but it is very much what to do next.
//
// So: the nearest deadline among those still running, and only when none is
// still running, the one furthest past its date. daysRemaining goes negative
// once the deadline passes, so one comparison answers both.
//
// null when every pocket has reached its target, or there are none at all.
// The tile is then absent rather than empty: the bands above already say
// "in progress 0", and a card whose only message is that it has nothing to say
// spends the width of the hero to repeat it.
const findNextGoal = (pockets: PocketStatus[]): PocketStatus | null => {
 const unfinished = pockets.filter((pocket) => !pocket.funded);
 const running = unfinished.filter((pocket) => !pocket.overdue);
 const pool = running.length > 0 ? running : unfinished;

 return pool.reduce<PocketStatus | null>(
  (nearest, pocket) =>
   nearest === null || pocket.daysRemaining < nearest.daysRemaining
    ? pocket
    : nearest,
  null,
 );
};

// The board mixes currencies and the server withheld the totals. The hero
// prints the sentence instead of the figures; the readings below stand down for
// the same reason, so one absence is not stated twice in two shapes.
const isWithheld = (summary: PocketBoardSummary | null): boolean =>
 summary !== null && summary.pocketCount > 0 && summary.currency === null;

// The board's headline, and the only part of the page that stays in view: the
// three figures, and the ratio between them.
//
// It was one component with the two reading cards until 2026-09-03. They were
// split because the scroll boundary moved: the cards are a reading of the
// board, not the figure the board leads with, so they pass under this rather
// than being pinned beside it.
function PocketBigBoxResult({
 summary,
 referenceMonth,
 currentMonth,
 notice,
}: PocketHeroPropType) {
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

 const deadline = deadlineLabel(summary?.latestDesiredDate ?? null);
 // Clamped per pocket by the server before folding, so the bar needs no clamp
 // of its own and cannot paint past its track.
 const overallProgress = summary?.overallProgress ?? null;

 // A past month is named. "This month" on a board reporting August is the one
 // wording that can be read as the wrong month, and the label comes from the
 // shared formatter so the sentence and the badge above it cannot disagree.
 const monthSuffix =
  referenceMonth === null ||
  currentMonth === null ||
  referenceMonth === currentMonth
   ? ''
   : ` in ${formatBudgetMonthLabel(referenceMonth)}`;

 // What moved INSIDE the month, with its direction in words. A bare signed
 // number cannot say which of two opposite decisions happened, and committing
 // cash to a goal and releasing it back are exactly that pair.
 //
 // null when the server withheld the figures, and the line is then absent
 // rather than printed as a dash: the two tiles beside it already carry the
 // dashes that say the totals are missing.
 const movement = ((): { text: string; isCommitted: boolean } | null => {
  if (summary === null) return null;

  const {
   totalCommittedInMonth: committedInMonth,
   totalReleasedInMonth: releasedInMonth,
   totalMovedInMonth: movedInMonth,
  } = summary;
  if (
   committedInMonth === null ||
   releasedInMonth === null ||
   movedInMonth === null
  ) {
   return null;
  }

  if (committedInMonth === 0 && releasedInMonth === 0) {
   return { text: `Nothing moved${monthSuffix}`, isCommitted: false };
  }

  if (releasedInMonth === 0) {
   return {
    text: `${amount(committedInMonth)} committed${monthSuffix}`,
    isCommitted: true,
   };
  }

  if (committedInMonth === 0) {
   return {
    text: `${amount(releasedInMonth)} released${monthSuffix}`,
    isCommitted: false,
   };
  }

  // Both happened, so neither gross half is the answer on its own: the net
  // states which decision won the month, and the word states which one it was.
  return movedInMonth >= 0
   ? {
      text: `${amount(movedInMonth)} committed net${monthSuffix}`,
      isCommitted: true,
     }
   : {
      text: `${amount(Math.abs(movedInMonth))} released net${monthSuffix}`,
      isCommitted: false,
     };
 })();

 return (
  <div className='total__container flex-col-sb'>
   <div className='pocketHero'>
    {/* LEVEL 1 — where the board stands, as three peer figures rather than one
        headline with the other two demoted into its footnotes: the goal, what
        is committed against it, and the gap between them.

        They reconcile as allocated − excess + remaining = target, NOT as a
        plain subtraction: the shortfall is clamped per pocket before the server
        sums it. The excess now states itself beside the count of pockets past
        their target, in the card below.

        The two meta lines are gone with the demotion. "of a $X target" and "to
        reach every target" existed only because the target had no tile of its
        own to be stated in; each now repeats the line above or below it. */}
    <div className='pocketHero__equation'>
     {/* One word each, because the three sit in one row under one heading and a
         label only has to tell its own tile from the two beside it. "Total" and
         "Still to" were carrying nothing and were what forced the row to stack
         below 480px — three tracks at 320px hold about 88px, and the longer
         wording did not fit any size the type scale declares. */}
     <div className='pocketHero__tile pocketHero__tile--target'>
      <span className='pocketHero__label'>Target</span>
      <span className='pocketHero__value'>
       {amount(summary?.totalTarget)}
      </span>

      {/* What the target is made of and by when. Absent on an empty board,
          where there is no deadline and the count would say zero twice — the
          status card below already states the population. Both figures are
          bound to the selected month by the server: a pocket created after it
          closed is not on this board at all. */}
      {deadline !== null && summary !== null && (
       <span className='pocketHero__meta'>
        {summary.pocketCount} pockets till {deadline}
       </span>
      )}
     </div>

     <div className='pocketHero__tile pocketHero__tile--committed'>
      <span className='pocketHero__label'>Allocated</span>
      <span className='pocketHero__value'>
       {amount(summary?.totalAllocated)}
      </span>

      {/* One slot, and what earns it depends on the board.

          The surplus takes it whenever there is one, because without it the
          three figures above contradict each other. They do not add up and
          cannot: the shortfall is clamped per pocket before the server sums it,
          so a pocket past its target contributes 0 to the gap rather than a
          negative — netting would let one over-funded pocket hide another that
          is behind. The identity is allocated − excess + remaining = target,
          and this is the only term of it that was not on screen. A reader who
          added the two visible amounts got a third total and nothing to explain
          it.

          It hangs off ALLOCATED and not off TO ALLOCATE because it is a part of
          this figure — money committed, past the goal it was committed to —
          rather than a correction applied to the gap.

          The count of funding accounts keeps the slot when there is no surplus.
          It gives way rather than the movement line below, which is the hero's
          only FLOW and appears nowhere else on the board; the count explains no
          figure on this card, and the detail screen already lists those
          accounts one by one, which is the same fact with names on it. */}
      {summary !== null && summary.totalExcess !== null && summary.totalExcess > 0 ? (
       <span className='pocketHero__meta pocketHero__meta--excess'>
        {amount(summary.totalExcess)} above target
       </span>
      ) : (
       summary !== null &&
       summary.sourceAccountCount > 0 && (
        <span className='pocketHero__meta'>
         {summary.sourceAccountCount} funding account
         {summary.sourceAccountCount === 1 ? '' : 's'}
        </span>
       )
      )}
     </div>

     <div className='pocketHero__tile pocketHero__tile--remaining'>
      {/* Allocated is the figure's word — POCKET_DECISIONS 18.1 freezes it —
          and commit is the event's. This names a figure, so it takes the
          figure's word and pairs with "Allocated" beside it. */}
      <span className='pocketHero__label'>To allocate</span>
      <span className='pocketHero__value'>
       {amount(summary?.totalRemaining)}
      </span>

      {/* A FLOW where the two tiles beside it are stocks: what the owner did
          this month, not what stands after every month. The surplus that used
          to sit here is a stock that rarely moves and it went to the status
          card, beside the count of pockets it belongs to. */}
      {movement !== null && (
       <span
        className={`pocketHero__meta pocketHero__meta--movement${
         movement.isCommitted ? ' pocketHero__meta--committed' : ''
        }`}
       >
        {movement.text}
       </span>
      )}
     </div>
    </div>

    {/* LEVEL 1b — the same three figures as a ratio, directly under them.
        The bar is what is committed over what was targeted, so it belongs
        beside the amounts it divides; two cards further down, the reader
        had to carry three figures in mind to know what it measured. The
        hero now reads in two movements: the money, then the pockets. */}
    <div className='pocketHero__progress'>
     <div className='pocketHero__progressRow'>
      <span className='pocketHero__progressHead'>
       <BarChartSvg className='pocketHero__glyph' />
       <span className='pocketHero__label'>Overall progress</span>
      </span>
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

// LEVEL 2 — what to act on.
//
// Two readings of the board's population rather than of its money, and the
// first thing that scrolls: they answer questions the owner asks after the
// headline, not with it. Only the second is a door, so only the second carries
// a chevron — a chevron on a tile that leads nowhere is an affordance that
// lies.
//
// It reads the store directly, the way ListPocket beside it does, rather than
// taking props through Pocket.tsx: the store is the board's single answer and a
// page threading it through would be a second path to the same figures.
export function PocketBoardReadings() {
 const summary = usePocketBoardStore((state) => state.summary);
 const pockets = usePocketBoardStore((state) => state.pockets);
 // Which month the figures above are about, and the latest month there is. Read
 // here because the funding accounts card has to state which of its own numbers
 // moves with the stepper and which does not.
 const referenceMonth = usePocketBoardStore((state) => state.referenceMonth);
 const currentMonth = usePocketBoardStore((state) => state.currentMonth);

 // Closed until asked for, and independently: these two answer different
 // questions, so opening the partition is not a request for the next deadline.
 // Component state and not the URL, unlike the list's own filters — a card left
 // open is a glance, not a reading someone returns to or shares.
 const [isStatusOpen, setIsStatusOpen] = useState(false);
 const [isTargetOpen, setIsTargetOpen] = useState(false);

 const currency_code = summary?.currency ?? DEFAULT_CURRENCY;
 const formatNumberCountry = CURRENCY_OPTIONS[currency_code];

 const amount = (value: number | null | undefined) =>
  value === null || value === undefined
   ? MISSING
   : currencyFormat(currency_code, value, formatNumberCountry);

 const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? MISSING : `${Math.round(value)}%`;

 if (summary === null || isWithheld(summary)) return null;

 // Served, not folded here. This component used to count the levels itself
 // while the cards read the served flags, so one board could be partitioned two
 // ways; the five counts now come from the same fold the rows come from.
 const levels = summary.levelCounts;
 const nextGoal = findNextGoal(pockets);
 const uncoveredCount = summary.uncoveredCount;
 const targetReached = levels.completed + levels.aboveTarget;
 // Ahead joins the running band and not the finished one: a pocket in front of
 // its plan has still not reached its target, which is the whole criterion this
 // split turns on. The two bands add up to pocketCount with the seventh level
 // exactly as they did with six.
 const inProgress =
  levels.ahead +
  levels.onTrack +
  levels.behind +
  levels.atRisk +
  levels.overdue;

 // The slack the pockets at level `ahead` hold. Its count comes from
 // levelCounts and no longer from a served aheadCount, which stopped existing
 // 2026-09-04: while ahead was an orthogonal reading the count and the amount
 // were folded by two different rules, and a screen printing "3 ahead ·
 // $500.00" could name three pockets and sum the slack of five.
 const totalAheadOfPlan = summary.totalAheadOfPlan;

 return (
  <div className='pocketHero pocketHero--readings'>
   <div className='pocketHero__cards'>
    <div className='pocketHero__card'>
     {/* The heading and its toggle on one line, the chevron at the far right.
         Both cards open independently: they answer different questions and a
         reader opening one is not asking for the other. */}
     <div className='pocketHero__cardHeadRow'>
      {/* The glyph beside the heading and not above it. On a line of its own it
          spent a whole row of the card saying what the words beside it already
          say, which is a lot of height for decoration on a board that has to
          hold five readings under this. */}
      <span className='pocketHero__cardHead'>
       <WalletSvg className='pocketHero__glyph' />

       {/* "Pocket status" and not "Pockets": what follows is the partition by
           level, and the count is the total it adds up to. The old word named
           the objects and left the reader to discover that the lines beneath
           were states rather than a list. */}
       <span className='pocketHero__label'>
        Pocket status (total: <b>{summary.pocketCount}</b>)
       </span>
      </span>

      <button
       type='button'
       className={`pocketHero__toggle${isStatusOpen ? ' is-active' : ''}`}
       onClick={() => setIsStatusOpen((open) => !open)}
       aria-expanded={isStatusOpen}
       aria-controls={STATUS_BODY_ID}
       aria-label={
        isStatusOpen ? 'Collapse pocket status' : 'Expand pocket status'
       }
      >
       <ArrowDownLightSvg className='pocketHero__toggleChevron' />
      </button>
     </div>

     {/* The body every reading lives in, absent rather than hidden while the
         card is closed: a collapsed card should cost the page its height, not
         just its ink. */}
     {isStatusOpen && (
      <div className='pocketHero__cardBody' id={STATUS_BODY_ID}>
       {/* Two headings, each with the count it heads, and its readings beneath.
           The pockets that reached their target and the ones still running are
           the top-level split; how a pocket got there is the detail under each.

           The two counts add up to pocketCount and nothing overlaps: the five
           levels are evaluated top down on the server, so no pocket carries two.

           Every reading prints even at zero: a partition that drops its empty
           members stops adding up to the list below it, and a reader cannot tell
           an absent level from a level with nothing in it.
           Never colour alone — each square carries its word. */}
       <div className='pocketHero__strip'>
        <span className='pocketHero__group'>
         {/* Named for the outcome, not the mechanism, so the heading rhymes with
             the two readings under it. Nobody reads this board asking how a
             pocket was financed. */}
         <span className='pocketHero__groupLabel'>
          Target reached <b>{targetReached}</b>
         </span>

         <span className='pocketHero__marks'>
          <span className={markClass(levels.completed)}>
           {/* A tick, not a square, and that is the whole argument: this is the
               one level on the strip that is FINISHED rather than pending, so
               its mark is off the semaphore entirely. A shape also survives
               every kind of colour blindness, which no green beside an amber
               does — simulated, the seven levels collapse to two families and
               five of them sit within 1.11:1 of one another.

               Shared with the board card and the detail panel since 2026-09-04;
               it was this strip's own private markup until then. */}
           <StatusTick />
           <span className='pocketHero__markWord'>
            {POCKET_STATUS_WORD.completed}
           </span>
           <b className='pocketHero__markCount'>{levels.completed}</b>
          </span>

          <span className={markClass(levels.aboveTarget)}>
           <StatusSquare alert={pocketSquareClass('aboveTarget')} />
           <span className='pocketHero__markWord'>
            {POCKET_STATUS_WORD.aboveTarget}

            {/* The surplus, arriving from the third tile it used to occupy.
                Beside the count of the pockets it is made of is the only place
                it reads as one fact rather than as a second figure competing
                with the gap. Absent when nothing passed its target.

                It rides the word rather than taking a line of its own: on a
                card of seven rows, two extra lines are two rows' worth of
                height spent on a detail of one of them. */}
            {summary.totalExcess !== null && summary.totalExcess > 0 && (
             <span className='pocketHero__markExtra'>
              {amount(summary.totalExcess)} above
             </span>
            )}
           </span>
           <b className='pocketHero__markCount'>{levels.aboveTarget}</b>
          </span>
         </span>
        </span>

        {/* "In progress" states what these pockets ARE. "Not funded" defined the
            group by negation, which forced the reader to hold the other band in
            mind to understand this one.

            The late ones are counted here, and the reason is a domain call
            rather than a display one: a pocket past its date has not reached its
            target and has not been closed. It is late, not finished. */}
        <span className='pocketHero__group'>
         <span className='pocketHero__groupLabel'>
          In progress <b>{inProgress}</b>
         </span>

         <span className='pocketHero__marks'>
          {/* First in the band, because the marks run from the level that asks
              least of the owner to the one that asks most and a pocket in front
              of its plan asks for nothing. It reads here rather than beside
              "target reached": ahead of the line is not the same as past the
              goal, and this band is every pocket still short of one.

              Seventh level since 2026-09-04. Until then the pace ratio put
              these pockets in "on track" — the ratio is at or under 1 exactly
              when a pocket is at or ahead of its own line — so the board could
              not name the one reading that needs no action. */}
          <span className={markClass(levels.ahead)}>
           <StatusSquare alert={pocketSquareClass('ahead')} />
           <span className='pocketHero__markWord'>
            {POCKET_STATUS_WORD.ahead}

            {/* The slack these pockets hold, beside the count of the pockets it
                belongs to — the same shape the surplus takes beside "above
                target". It had a heading of its own under the coverage alerts
                until the level existed, where it was the only row on the card
                reporting good news under a warning band, and its count came
                from a separate fold that could name a different set of pockets
                than the amount summed. */}
            {totalAheadOfPlan !== null && totalAheadOfPlan > 0 && (
             <span className='pocketHero__markExtra pocketHero__markExtra--ahead'>
              {amount(totalAheadOfPlan)} ahead
             </span>
            )}
           </span>
           <b className='pocketHero__markCount'>{levels.ahead}</b>
          </span>

          <span className={markClass(levels.onTrack)}>
           <StatusSquare alert={pocketSquareClass('onTrack')} />
           <span className='pocketHero__markWord'>
            {POCKET_STATUS_WORD.onTrack}
           </span>
           <b className='pocketHero__markCount'>{levels.onTrack}</b>
          </span>

          {/* Between on track and at risk, the order the ratio itself climbs
              in. Violet since 2026-09-04, when the sixth colour token RULED
              2026-09-03 (POCKET_DECISIONS.md #23) left unnamed was decided. */}
          <span className={markClass(levels.behind)}>
           <StatusSquare alert={pocketSquareClass('behind')} />
           <span className='pocketHero__markWord'>
            {POCKET_STATUS_WORD.behind}
           </span>
           <b className='pocketHero__markCount'>{levels.behind}</b>
          </span>

          <span className={markClass(levels.atRisk)}>
           <StatusSquare alert={pocketSquareClass('atRisk')} />
           <span className='pocketHero__markWord'>
            {POCKET_STATUS_WORD.atRisk}
           </span>
           <b className='pocketHero__markCount'>{levels.atRisk}</b>
          </span>

          <span className={markClass(levels.overdue)}>
           <StatusSquare alert={pocketSquareClass('overdue')} />
           <span className='pocketHero__markWord'>
            {POCKET_STATUS_WORD.overdue}
           </span>
           <b className='pocketHero__markCount'>{levels.overdue}</b>
          </span>
         </span>
        </span>
       </div>

       {/* Coverage, and ONLY coverage. It is the other axis entirely: a pocket
           whose funding accounts no longer hold what it says is committed can be
           at ANY level, so the fact says nothing about which band it belongs to
           and cannot join either.

           Absent when there is nothing to raise, unlike the readings inside a
           band, which print at zero because a partition has to keep adding up.
           Nothing is partitioned here, so nothing breaks by leaving. */}
       {uncoveredCount > 0 && (
        <div className='pocketHero__alerts'>
         <span className='pocketHero__marks'>
          {/* The wording names what failed rather than labelling the pocket.
              Not funded is the pocket against its own target. This is whether
              the money it says it holds still exists.

              One word since the readings became rows: the sentence "N with
              funding not covered" spelled its own subject because it stood
              alone under a heading, and the row it is now states the subject in
              the column it shares with the seven levels above. The heading went
              with it — a band label over a single row names nothing the row
              does not already say. */}
          <span className='pocketHero__mark'>
           <StatusSquare alert={pocketSquareClass('overdue')} />
           <span className='pocketHero__markWord'>Uncovered</span>
           <b className='pocketHero__markCount'>{uncoveredCount}</b>
          </span>
         </span>
        </div>
       )}

       {/* Ahead of plan had its own group here, under the coverage alerts, for
           exactly one day. RULED 2026-09-03 (POCKET_DECISIONS.md #23.3) made it
           an orthogonal reading with a row of its own precisely because it was
           not a level; it became the seventh level on 2026-09-04, so it reads
           inside the partition above and this block is gone rather than
           duplicated. A reading stated in two places on one card is two places
           that can disagree. */}
      </div>
     )}
    </div>

    {/* Target and not goal. The frozen vocabulary lets the word goal name the
        figure a pocket aims at, never the object itself — and a tile headed
        "next goal" over a pocket's NAME says the opposite.

        Absent, not empty, when there is nothing to point at: a control that
        can only refuse is worse than one that is absent, and the bands above
        have already said there is nothing in progress. */}
    {nextGoal !== null && (
     <div className='pocketHero__card pocketHero__card--row'>
      {/* The heading navigates and the chevron toggles: two controls, never
          one nested in the other. A button inside the anchor would be two
          interactive elements in one box, which no browser resolves the same
          way; as siblings each answers for itself. */}
      <div className='pocketHero__cardHeadRow'>
       <Link
        to={`pockets/${nextGoal.pocketId}`}
        className='pocketHero__cardHead pocketHero__cardHead--link'
       >
        <BullsEyeSvg className='pocketHero__glyph' />

        <span className='pocketHero__label'>Next target</span>
       </Link>

       <button
        type='button'
        className={`pocketHero__toggle${isTargetOpen ? ' is-active' : ''}`}
        onClick={() => setIsTargetOpen((open) => !open)}
        aria-expanded={isTargetOpen}
        aria-controls={TARGET_BODY_ID}
        aria-label={
         isTargetOpen ? 'Collapse next target' : 'Expand next target'
        }
       >
        <ArrowDownLightSvg className='pocketHero__toggleChevron' />
       </button>
      </div>

      {/* The body is a link to the same pocket its heading points at, and not a
          read-only row. Only the two words "Next target" led anywhere before,
          so everything the reader actually looks at once the card is open — the
          NAME of the pocket and its three readings — was inert.

          Two links to one destination and not one wrapping the other: the
          heading has to stay reachable while the body is collapsed, and an
          anchor around both would swallow the toggle button between them. */}
      {isTargetOpen && (
      <Link
       to={`pockets/${nextGoal.pocketId}`}
       className='pocketHero__inline pocketHero__inline--link'
       id={TARGET_BODY_ID}
      >
       <span className='pocketHero__cardValue pocketHero__cardValue--name'>
        {nextGoal.name}
       </span>

       {/* The figure the owner acts ON: a percentage and a date say how it is
           going, not how much to put in. Clamped at zero because this card
           only ever shows a pocket short of its target. */}
       <span className='pocketHero__inlineItem'>
        {amount(Math.max(nextGoal.remaining, 0))} to allocate
       </span>

       <span className='pocketHero__inlineItem'>
        {percent(nextGoal.progress)} committed
       </span>

       {/* The square is the level this pocket already computes, so the card
           and the bands above cannot disagree about the same pocket. Late is
           not "minus twelve days left" — the sign is spent on the word. */}
       <span className='pocketHero__inlineItem'>
        <StatusSquare alert={pocketSquareClass(nextGoal.level)} />
        {nextGoal.daysRemaining < 0
         ? `${Math.abs(nextGoal.daysRemaining)} days late`
         : nextGoal.daysRemaining === 1
           ? '1 day left'
           : `${nextGoal.daysRemaining} days left`}
       </span>
      </Link>
      )}
     </div>
    )}

    {/* WHICH accounts are funding the pockets, and LAST of the three.

        The order is the order of the objects, not of the questions. The two
        cards above are both about the pockets themselves — how they stand
        against their plans, and which one to open now — so they belong
        together; this one is about a different object entirely, the bank
        accounts the money physically sits in, and putting it between them would
        split a pair.

        It takes the count the server already folded and asks for the rows
        itself, only once opened. The board's payload does not carry them today;
        when it does, that fold replaces this card's own request and nothing
        here changes. */}
    {summary.sourceAccountCount > 0 && (
     <PocketFundingAccounts
      sourceAccountCount={summary.sourceAccountCount}
      referenceMonth={referenceMonth}
      currentMonth={currentMonth}
     />
    )}
   </div>
  </div>
 );
}

export default PocketBigBoxResult;
