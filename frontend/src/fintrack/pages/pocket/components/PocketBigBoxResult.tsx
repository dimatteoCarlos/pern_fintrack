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
// The portfolio card's own mark. A single continuous stroke, which is what
// keeps it apart from the three filled slabs of the bar chart glyph two rows
// above it on the same panel.
import PulseSvg from '../../../../assets/pocketSvg/pulseSvg.svg?react';
// The accordion's own mark, and the same asset the accounting dashboard's
// groups already toggle with: one glyph rotated, never two pointing opposite
// ways, so the state reads as the same control moved rather than swapped.
import ArrowDownLightSvg from '../../../../assets/ArrowDownLightSvg.svg?react';

// What each toggle names to a screen reader through aria-controls. Declared
// once: the button and the region it opens have to agree on the string.
const STATUS_BODY_ID = 'pocketHero-statusBody';
const TARGET_BODY_ID = 'pocketHero-nextTargetBody';
const PORTFOLIO_BODY_ID = 'pocketHero-portfolioBody';

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

 // Nothing to measure, so nothing is drawn. Three tiles of dashes over an
 // unpainted track say the schedule was measured and came out empty, when
 // there is no schedule to measure — but a message here would be the THIRD
 // "no pockets yet" on one screen: the list owns that sentence, and the card
 // below answers again for whoever opens it. A null summary is not this state:
 // the board has not answered yet, and the dashes are right for that.
 if (summary !== null && summary.pocketCount === 0) return null;

 // The furthest deadline and the lifetime progress both left this component
 // with the schedule redesign: the equation measures against the plan now, and
 // neither figure explains any of its three amounts. The lifetime pair belongs
 // to the reading card below, which states it in full.

 // THE SCHEDULE, which is what this hero measures since 2026-09-04. Not the
 // lifetime goal: a board where every pocket sits exactly on its own plan still
 // reads 40% against its targets, indistinguishable from one 60% behind. All of
 // these count ONLY the pockets holding a plan window, which is what
 // scheduledPocketCount states and why the committed figure here is not
 // totalAllocated.
 const scheduledByNow = summary?.totalScheduledByNow ?? null;
 const committedOnPlan = summary?.scheduledPocketsAllocated ?? null;
 const scheduleGap = summary?.totalScheduleGap ?? null;
 // Served UNCLAMPED and free to pass 100 — the card prints both operands in
 // words, so a clamped figure would contradict the division a reader makes by
 // eye. The clamp belongs to the fill alone, below.
 const adherence = summary?.scheduleAdherence ?? null;
 const scheduledCount = summary?.scheduledPocketCount ?? 0;

 // The plans have required nothing yet: every pocket holds a window but no
 // instalment has fallen due, so the ratio has no denominator and the server
 // withholds it. NOT a rare edge — a board of plans made this month is exactly
 // this, which is why the bar meets its unknown state on a first render rather
 // than eventually.
 const nothingDueYet = scheduledCount > 0 && scheduledByNow === 0;

 // What the variance is measured against, in words, because a bare signed
 // number cannot say which of two opposite situations happened.
 //
 // With nothing due, the amount is real and the READING is not: standing
 // "over the schedule" by everything committed, against a schedule that asked
 // for nothing, invites "I am well ahead" when the truth is that nothing has
 // come due. So the figure stays — the server served it — and the words say
 // what actually happened instead of claiming a side of an axis that has not
 // started.
 // Three words and not the sentence this used to be. The meta line never wraps
 // — a second row there takes the height of a fourth line and pulls the three
 // tiles out of alignment — so it clips, and every reading has to be short
 // enough that the clip never fires. At 360px the column is about 303 and each
 // tile about 95, where "committed before anything was due" ran to roughly 132
 // and was cut mid-word. The long form survives where there is width for it:
 // the bar's own label, which has the whole row.
 const scheduleSide = nothingDueYet
  ? 'nothing due yet'
  : scheduleGap === null
    ? null
    : scheduleGap < 0
      ? 'under the schedule'
      : 'over the schedule';

 // A past month is named. "This month" on a board reporting August is the one
 // wording that can be read as the wrong month, and the label comes from the
 // shared formatter so the sentence and the badge above it cannot disagree.
 const monthSuffix =
  referenceMonth === null ||
  currentMonth === null ||
  referenceMonth === currentMonth
   ? ''
   : ` in ${formatBudgetMonthLabel(referenceMonth)}`;

 // Where the plans' line is READ, which is not the same date in both cases. The
 // board evaluates the current month at TODAY and a past month at its close, so
 // naming the current month here would claim the whole of it — and the line is
 // now continuous in days, so only the days elapsed have been asked for.
 //
 // "By" and never "in": the ratio above the bar is CUMULATIVE on both sides,
 // everything committed to those pockets against everything their plans have
 // asked for since they started. "Required this month" invited exactly the
 // reading the developer arrived at, that the figure divides by one instalment.
 // The movement line keeps the suffix above, where "in" is the truth: that one
 // really is the month's own.
 const scheduleThrough =
  referenceMonth === null ||
  currentMonth === null ||
  referenceMonth === currentMonth
   ? ' to date'
   : ` by ${formatBudgetMonthLabel(referenceMonth)}`;

 // What moved INSIDE the month, with its direction in words. A bare signed
 // number cannot say which of two opposite decisions happened, and committing
 // cash to a goal and releasing it back are exactly that pair.
 //
 // null when the server withheld the figures, and the line is then absent
 // rather than printed as a dash: the two tiles beside it already carry the
 // dashes that say the totals are missing.
 // It reads the SCOPED net — the movement across the pockets holding a plan
 // window — and not the board-wide one, because it sits under a balance
 // counting exactly those pockets, and a sub-figure drawn from a wider
 // population is not a part of the number above it. The board-wide trio is
 // still served and still means what it always did; it has no consumer on this
 // hero and belongs to a reading about everything the owner holds.
 //
 // No gross halves exist at this scope, so the two of them cannot spell out
 // which direction won a mixed month. The word "net" carries that instead: an
 // inflow can be offset by a release inside the same month, and a bare "800
 // committed" would claim a gross the figure is not.
 const movement = ((): { text: string; isCommitted: boolean } | null => {
  const movedInMonth = summary?.scheduledPocketsMovedInMonth ?? null;
  if (movedInMonth === null) return null;

  // Zero is a real answer here and not an absence: no plan window took or gave
  // back money this month. It cannot say whether nothing happened or equal
  // amounts cancelled, so it claims neither.
  if (movedInMonth === 0) {
   return { text: `No net movement${monthSuffix}`, isCommitted: false };
  }

  return movedInMonth > 0
   ? {
      text: `${amount(movedInMonth)} net committed${monthSuffix}`,
      isCommitted: true,
     }
   : {
      text: `${amount(Math.abs(movedInMonth))} net released${monthSuffix}`,
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
    {/* EMPTY is its own state here too, and it is the whole hero: three tiles
        of dashes over an unpainted track say the schedule was measured and
        came out empty, when there is no schedule to measure. The message is
        what the reader can act on. The cards below stay, closed, and answer
        the same way when opened. */}
    <>
     <div className='pocketHero__equation'>
     {/* One word each, because the three sit in one row under one heading and a
         label only has to tell its own tile from the two beside it. "Total" and
         "Still to" were carrying nothing and were what forced the row to stack
         below 480px — three tracks at 320px hold about 88px, and the longer
         wording did not fit any size the type scale declares. */}
     <div className='pocketHero__tile pocketHero__tile--target'>
      {/* "to date" on this tile and the next, together or on neither: both are
          cumulative from each plan's creation through the close of the month in
          the stepper. Neither names the month — the stepper badge does, and a
          label repeating it would go stale the moment the badge moved. */}
      <span className='pocketHero__label'>Required to date</span>
      <span className='pocketHero__value'>
       {amount(scheduledByNow)}
      </span>

      {/* What the target is made of and by when. Absent on an empty board,
          where there is no deadline and the count would say zero twice — the
          status card below already states the population. Both figures are
          bound to the selected month by the server: a pocket created after it
          closed is not on this board at all. */}
      {/* Which pockets this figure counts, and — by the difference — how many
          it does not. Stated here because every amount on this row excludes the
          pockets holding no plan window, and a reader who does not know that
          reads three totals about a board and gets a fourth answer from the
          list below. "of N pockets" and not "N plans": one noun for one thing,
          or the row reads as some number of plans spread over some other number
          of pockets. */}
      {summary !== null && summary.pocketCount > 0 && (
       <span className='pocketHero__meta'>
        from {scheduledCount} of {summary.pocketCount} pockets
       </span>
      )}
     </div>

     <div className='pocketHero__tile pocketHero__tile--allocated'>
      {/* "Allocated" and not "committed": this is a BALANCE, how much stands
          against the plans right now. Commit and release are the two acts that
          move it, and they keep the word — the movement line below still reads
          "net committed", correctly. */}
      <span className='pocketHero__label'>Allocated to date</span>
      <span className='pocketHero__value'>
       {amount(committedOnPlan)}
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

     <div className='pocketHero__tile pocketHero__tile--variance'>
      <span className='pocketHero__label'>Variance</span>
      {/* The one figure on this row that carries a sign, and the sign is not
          the reading: the line under it is. Signed and unclamped, because it is
          a difference and not a shortfall — clamping would erase the very side
          the tile exists to name. */}
      <span
       className={`pocketHero__value${
        scheduleGap === null || nothingDueYet
         ? ''
         : scheduleGap < 0
           ? ' pocketHero__value--under'
           : ' pocketHero__value--over'
       }`}
      >
       {amount(scheduleGap)}
      </span>

      {scheduleSide !== null && (
       <span className='pocketHero__meta'>{scheduleSide}</span>
      )}
     </div>
    </div>

    {/* LEVEL 1b — the same three figures as a ratio, directly under them.
        The bar is what is committed over what was targeted, so it belongs
        beside the amounts it divides; two cards further down, the reader
        had to carry three figures in mind to know what it measured. The
        hero now reads in two movements: the money, then the pockets. */}
    <div className='pocketHero__progress'>
     {/* The label names the DENOMINATOR and the month, never the bare word
         progress: two percentages now live on this board measuring different
         things, and one of them unnamed makes the reader work out which. */}
     <p className='pocketHero__progressRow'>
      {/* The figure sits INSIDE the sentence, as the approved mockup draws it.
          Pushed to the far end of the row it read as a loose number at the end
          of a line; here "3052% of what your plans required this month" is one
          statement, and the words that name the denominator are the words the
          figure is read against. It also stops being the element that overflows
          on a narrow board: a sentence wraps where a nowrap label and a flush
          right figure collide. */}
      <span className='pocketHero__progressText'>
       {/* Inside the sentence too, and inline rather than a flex item beside
           it: an SVG has no baseline of its own, so flex synthesises one at its
           bottom edge and baseline alignment floated it a descender's depth
           above the words. In the text flow the font's own metrics place it. */}
       <BarChartSvg className='pocketHero__glyph' />{' '}
       {!nothingDueYet && (
        <>
         <b className='pocketHero__pct'>{percent(adherence)}</b>{' '}
        </>
       )}
       {nothingDueYet
        ? 'No instalment has fallen due yet'
        : `of what your plans required${scheduleThrough}`}
      </span>
     </p>

     <div
      className='pocketHero__bar'
      role='progressbar'
      aria-label={`Allocated against what the plans required${scheduleThrough}`}
      aria-valuemin={0}
      aria-valuemax={100}
      // Clamped, unlike the label beside it. A progress bar whose current value
      // exceeds its maximum is invalid, so the machine-readable number stops at
      // the track while the accessible text carries the true figure — a screen
      // reader then hears exactly what the sighted label says.
      aria-valuenow={adherence === null ? undefined : Math.min(adherence, 100)}
      aria-valuetext={adherence === null ? undefined : `${Math.round(adherence)}%`}
     >
      {/* No fill at all while the figure is missing, which on this board is a
          FIRST render and not an edge: plans made this month have required
          nothing yet. A width of zero would be the same paint as a board that
          committed nothing, and those are two different answers.

          The fill is where the clamping happens — it cannot paint past its own
          track — while the label above states the true value, which may exceed
          100 because standing over the schedule is the interesting case. */}
      {adherence !== null && (
       <div
        className={`pocketHero__barFill${
         adherence > 100 ? ' pocketHero__barFill--over' : ''
        }`}
        style={{ width: `${Math.min(adherence, 100)}%` }}
       />
      )}
     </div>
    </div>
     </>
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
 // Closed like the other three. It was open by default so the arithmetic sat
 // next to the bar, which prints a percentage and nothing else; measured at
 // 360px wide, that cost the whole toolbar below 745px of viewport height and
 // opened the board on four cards and no pocket. The user opens it.
 const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
 const [isStatusOpen, setIsStatusOpen] = useState(false);
 const [isTargetOpen, setIsTargetOpen] = useState(false);

 // The schedule fold, read off the store's summary here exactly as the hero
 // above reads it: this component takes the whole payload rather than having
 // figures threaded down to it.
 const totalScheduledByNow = summary?.totalScheduledByNow ?? null;
 const scheduledPocketsAllocated = summary?.scheduledPocketsAllocated ?? null;
 const totalRequiredMonthly = summary?.totalRequiredMonthly ?? null;
 const scheduledPocketCount = summary?.scheduledPocketCount ?? 0;
 const underScheduleCount = summary?.underScheduleCount ?? 0;
 const overScheduleCount = summary?.overScheduleCount ?? 0;

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
    {/* FIRST of the four, because it is the arithmetic behind the bar directly
        above it — the two amounts the ratio divides, the population it counts,
        and the pace left. A card explaining a figure belongs under that figure
        and nowhere else in the stack.

        The lifetime pair rides at its foot, under a rule, because it is the one
        reading here that is NOT about the schedule: it measures against the
        goals themselves. It sits in this card rather than in the hero because
        it explains no tile up there, and it leaves the page entirely once the
        overview module carries it. */}
    <div className='pocketHero__card'>
     <div className='pocketHero__cardHeadRow'>
      <span className='pocketHero__cardHead'>
       {/* A pulse and not the bar chart the ratio above already wears: two
           identical glyphs read as two views of one thing. It names the STATE
           of the portfolio, which is what this card reads. */}
       <PulseSvg className='pocketHero__glyph' />

       {/* No count in the bracket, unlike the two cards below. The population
           this card counts is not the board's — it is the pockets holding a
           plan window — and a bare figure after this heading would be read as
           how many pockets there are. The body states it in full, as a pair. */}
       <span className='pocketHero__label'>Pocket portfolio</span>
      </span>

      <button
       type='button'
       className={`pocketHero__toggle${isPortfolioOpen ? ' is-active' : ''}`}
       onClick={() => setIsPortfolioOpen((open) => !open)}
       aria-expanded={isPortfolioOpen}
       aria-controls={PORTFOLIO_BODY_ID}
       aria-label={
        isPortfolioOpen ? 'Collapse pocket portfolio' : 'Expand pocket portfolio'
       }
      >
       <ArrowDownLightSvg className='pocketHero__toggleChevron' />
      </button>
     </div>

     {isPortfolioOpen && (
      <div className='pocketHero__cardBody' id={PORTFOLIO_BODY_ID}>
       {/* EMPTY is its own state and not a row of dashes. With nothing to
           measure, the two sentences below print the whole structure with
           every amount a dash and every count a zero, which states in symbols
           that the arithmetic ran and came out empty — it did not run at all.
           The two empties are told apart because the answer to each is a
           different action: make a pocket, or give a pocket a plan. Same
           shape as the withheld-totals notice at the top of this component. */}
       {summary.pocketCount === 0 ? (
        <p className='pocketHero__cardEmpty'>
         No pockets yet. Create one with a target and a date, and this card
         measures it against its own plan.
        </p>
       ) : scheduledPocketCount === 0 ? (
        <p className='pocketHero__cardEmpty'>
         None of your {summary.pocketCount} pockets carries a plan. A target
         and a date are what a pocket is measured against, and this card is
         where that reading lands.
        </p>
       ) : (
        <>
       <p className='pocketHero__reading'>
        {/* The two operands of the ratio, in words. This is exactly why the
            served percentage is unclamped: a reader divides these two by eye,
            and a clamped figure would disagree with the division. */}
        <b className='pocketHero__num'>{amount(scheduledPocketsAllocated)}</b>{' '}
        allocated of{' '}
        <b className='pocketHero__num'>{amount(totalScheduledByNow)}</b>{' '}
        required &middot;{' '}
        {/* Both counts print. The complement is never recovered by subtraction:
            one number beside a signed net pointing the other way reads as a
            contradiction, and it makes the reader do arithmetic for a figure
            the line can simply state.

            "under" and "over schedule" — never "behind" and "ahead", which are
            the classifier's words for a different partition. */}
        <b className='pocketHero__num'>{scheduledPocketCount}</b> of{' '}
        <b className='pocketHero__num'>{summary.pocketCount}</b> pockets on a
        plan{' '}
        <span className='pocketHero__counts'>
         (<b className='pocketHero__num pocketHero__num--under'>
          {underScheduleCount}
         </b>{' '}
         under /{' '}
         <b className='pocketHero__num pocketHero__num--over'>
          {overScheduleCount}
         </b>{' '}
         over schedule)
        </span>
        {totalRequiredMonthly !== null && (
         <>
          {' '}
          &middot;{' '}
          {/* The pace to FINISH, never a bill due this month: the shortfall is
              already spread inside this figure, and wording it as due would
              invite adding it to what the schedule already asked for.
              "per month" and not "a month", which reads as a duration rather
              than a rate to anyone whose first language is not English. */}
          <b className='pocketHero__num'>{amount(totalRequiredMonthly)}</b> per
          month to finish on time
         </>
        )}
       </p>

       <p className='pocketHero__lifetime'>
        {/* The POPULATION is declared, as the sentence above declares its own.
            "allocated" appears twice in this card against two different totals
            — the scheduled pockets above, every pocket here — and a rule alone
            does not tell a reader the universe changed under it. */}
        Lifetime &middot; all{' '}
        <b className='pocketHero__num'>{summary.pocketCount}</b> pockets
        &middot; {amount(summary.totalAllocated)} allocated of{' '}
        {amount(summary.totalTarget)} total target &mdash;{' '}
        {/* The ratio is NAMED. Two percentages measure different things on this
            board — the bar divides by the schedule, this divides by the goals —
            and an unnamed one asks the reader to work out which. The word is
            the served field's own name, not a coinage. */}
        <span className='pocketHero__ratioName'>
         {percent(summary.overallProgress)} overall progress
        </span>
       </p>
        </>
       )}
      </div>
     )}
    </div>

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
           were states rather than a list.

           The bracket says "total" without the word: a lone figure after a
           heading is read as how many there are, and the two band subtotals
           under it add up to exactly this one. */}
       <span className='pocketHero__label'>
        Pocket status (<b>{summary.pocketCount}</b>)
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

           It prints at zero, like every reading above it, and no longer only
           when there is something to raise. Leaving took the check off the
           screen along with the problem, and a reader who has never seen a
           pocket lose its funding cannot tell "none are uncovered" from "this
           card does not look at that". A row reading zero says the board
           checked; an absent row says nothing at all.

           At zero it takes the same stepped-back treatment as an empty level —
           word and count off the ink, square at full colour — so it reports
           rather than warns. */}
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
         <span className={markClass(uncoveredCount)}>
          <StatusSquare alert={pocketSquareClass('overdue')} />
          <span className='pocketHero__markWord'>Uncovered</span>
          <b className='pocketHero__markCount'>{uncoveredCount}</b>
         </span>
        </span>
       </div>

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
