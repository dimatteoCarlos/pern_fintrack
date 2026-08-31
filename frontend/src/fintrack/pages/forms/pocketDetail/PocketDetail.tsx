//frontend/src/fintrack/pages/forms/pocketDetail/PocketDetail.tsx
//
// One pocket, from the endpoint that answers for pockets.
//
// Rewritten 2026-08-29. What was here renamed the route parameter — `const
// { pocketId: accountId } = useParams()` — and spent that id against the
// account endpoints, so the screen rendered another record's name, balance and
// full statement under a pocket's title. Pocket ids and account ids are
// separate sequences that both start at 1, so the substitution had no symptom
// to catch it. It was unreachable only while the pockets table could hold no
// rows; migration 020 converted four accounts into pockets and armed it.
//
// The statement is gone with it, and that is a change of meaning rather than a
// regression: a pocket has no transactions of its own. No money ever moved into
// one. What it has is a set of accounts that committed cash to it, and a
// history of those decisions — both served in the same payload as the hero.

import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../../assets/LeftArrowSvg.svg';
import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';
import {
 capitalize,
 formatCalendarDate,
 numberFormatCurrency,
} from '../../../helpers/functions.ts';
import SummaryPocketDetailBox from './summaryPocketDetailBox/SummaryPocketDetailBox.tsx';
import AccountActionsTrigger from '../../../general_components/accountActionsTrigger/AccountActionsTrigger.tsx';
import AccountActionsMenu from '../../../editionAndDeletion/components/accountActionMenu/AccountActionsMenu.tsx';
import DeletePocketModal from './deletePocketModal/DeletePocketModal.tsx';
import AllocationEntryModal from './allocationEntryModal/AllocationEntryModal.tsx';
import PocketCashModal, {
 PocketCashDirection,
} from './pocketCashModal/PocketCashModal.tsx';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import RateTooltip from '../../../general_components/rateTooltip/RateTooltip.tsx';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents.tsx';
import {
 PocketStatusLevel,
 POCKET_STATUS_WORD,
 pocketDateLevel,
 pocketReadingModifier,
 pocketSquareClass,
} from '../../../helpers/pocketStatus.ts';
import PocketReadingIcon from './PocketReadingIcon.tsx';
import { usePocketDetailStore } from '../../../stores/usePocketDetailStore.ts';
import { PocketAllocationEntry } from '../../../types/pocketTypes.ts';

import '../styles/forms-styles.css';
import './styles/pocketDetail-styles.css';

// A figure the contract withheld. Never 0 and never an empty cell: a dash says
// the answer is absent, where 0 would state an amount.
const DASH = '—';

// How many placeholder rows each list draws while the answer is on the wire.
const SKELETON_ROWS = 3;

type LocationStateType = {
 previousRoute?: string;
};

//=============================
// MAIN COMPONENT POCKET DETAIL
//=============================
function PocketDetail() {
 const location = useLocation();
 const state = location.state as LocationStateType | null;

 // The board, not the budget module. A pocket is reached from the pocket board
 // and the arrow goes back where the user came from.
 const previousRoute = state?.previousRoute ?? '/fintrack/pocket';

 // The parameter keeps its name. Renaming it here is what let the old screen
 // hand a pocket id to the account endpoints.
 const { pocketId } = useParams();
 const parsedPocketId = Number(pocketId);
 const hasValidId = Number.isInteger(parsedPocketId) && parsedPocketId > 0;

 const pocket = usePocketDetailStore((store) => store.pocket);
 const sources = usePocketDetailStore((store) => store.sources);
 const history = usePocketDetailStore((store) => store.history);
 const isLoading = usePocketDetailStore((store) => store.isLoading);
 const isLoaded = usePocketDetailStore((store) => store.isLoaded);
 const error = usePocketDetailStore((store) => store.error);
 const fetchDetail = usePocketDetailStore((store) => store.fetchDetail);
 const refreshDetail = usePocketDetailStore((store) => store.refreshDetail);
 const clear = usePocketDetailStore((store) => store.clear);

 // The confirmation is asked on this card rather than on a route of its own:
 // it is one yes-or-no question about the pocket the owner is standing on, and
 // a route would unmount the card to ask it.
 const [isConfirmingDeletion, setIsConfirmingDeletion] =
  useState<boolean>(false);

 // The overflow menu in the header. Its own flag and not folded into the one
 // above: the menu closes before the confirmation opens, so for one frame both
 // would have to be true, and a single piece of state cannot say that.
 const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

 const navigate = useNavigate();

 // Which money decision is open, or none. One piece of state and not two
 // flags: the two are alternatives, and two booleans would admit a state
 // where both panels are open at once.
 const [cashDirection, setCashDirection] =
  useState<PocketCashDirection | null>(null);

 // Which history entry is open, held whole rather than by id: the list is
 // already in memory, so looking the row up again by id would be a second
 // source for something this screen is already holding.
 const [openEntry, setOpenEntry] = useState<PocketAllocationEntry | null>(
  null,
 );

 useEffect(() => {
  if (!hasValidId) return;

  void fetchDetail(parsedPocketId);

  // Emptied on the way out, so the next pocket opened cannot flash this one's
  // figures under its own title while its request is in flight.
  return () => {
   clear();
  };
 }, [parsedPocketId, hasValidId, fetchDetail, clear]);

 const currency = pocket?.currency ?? DEFAULT_CURRENCY;
 const amount = (value: number) => numberFormatCurrency(value, 2, currency);

 // A figure the payload may withhold. numberFormatCurrency(null) does not print
 // a dash: parseFloat('null') is NaN, and it returns the literal string
 // 'Not a valid number, please try again' into the space where an amount
 // belonged. So the absence is answered here, before the formatter sees it.
 const amountOrDash = (value: number | null) =>
  value === null ? DASH : amount(value);

 // The audit trail behind a converted entry: the rate that produced the stored
 // figure, which source answered, and when that rate was read. It is metadata
 // and never a second unit to do arithmetic in, so it lives in a tooltip rather
 // than in the row.
 //
 // The rate keeps every decimal its column holds. Rounding it here would print
 // a number that cannot be re-applied to the original amount to reproduce the
 // stored one, which is the only thing this line is for.
 // The multiplier is read off the row's own two figures rather than printed
 // from the stored rate field, so the line cannot claim a direction that field
 // does not hold. The stored rate comes with it, undirected and with every
 // decimal its column keeps, because re-applying it to the original amount is
 // the only way to check the figure above.
 const originTip = (entry: PocketAllocationEntry) => {
  const typed = Math.abs(entry.originalAmount);

  return [
   typed > 0
    ? `1 ${entry.originalCurrency.toUpperCase()} = ${
       Math.abs(entry.amount) / typed
      } ${currency.toUpperCase()}`
    : '',
   `stored rate: ${entry.exchangeRate}`,
   entry.exchangeRateSource ? `source: ${entry.exchangeRateSource}` : '',
   entry.exchangeRateTimestamp
    ? `read: ${new Date(entry.exchangeRateTimestamp).toLocaleString()}`
    : '',
  ]
   .filter(Boolean)
   .join('\n');
 };

 //--------------------------------------------
 const header = (
  <div className='page__content'>
   <div className='main__title--container'>
    <Link to={previousRoute} className='iconLeftArrow'>
     <LeftArrowLightSvg />
    </Link>

    <div className='form__title'>
     {pocket ? capitalize(pocket.name).toUpperCase() : ''}
    </div>

    {/* Rendered only once the pocket is in hand, because the control names it
        in its accessible label and a menu opened for a pocket the screen
        cannot name yet has nothing to act on.

        A menu and not the pencil it replaces. Editing and deleting are both
        operations on the pocket as an object, and they belong together behind
        one overflow control; the two money decisions stay as visible buttons
        under the hero, because those are the task the screen exists for. */}
    {pocket && (
     <AccountActionsTrigger
      accountName={pocket.name}
      isOpen={isMenuOpen}
      onClick={() => setIsMenuOpen(true)}
     />
    )}
   </div>
  </div>
 );

 //--------------------------------------------
 // Three states, and they are not degrees of one another: a failed request is
 // not a pocket still loading, and neither is an id that is not a number.
 if (!hasValidId) {
  return (
   <section className='page__container'>
    <TopWhiteSpace variant={'dark'} />
    {header}

    <div className='pocketDetail__state'>
     <p className='pocketDetail__stateText'>
      That is not a pocket this page can open.
     </p>

     <Link to='/fintrack/pocket' className='pocketDetail__retry'>
      Back to the board
     </Link>
    </div>
   </section>
  );
 }

 if (error) {
  return (
   <section className='page__container'>
    <TopWhiteSpace variant={'dark'} />
    {header}

    <div className='pocketDetail__state'>
     <p className='pocketDetail__stateText'>
      This pocket could not be loaded.
     </p>

     <button
      type='button'
      className='pocketDetail__retry'
      onClick={() => {
       void refreshDetail();
      }}
     >
      Try again
     </button>
    </div>
   </section>
  );
 }

 if (isLoading || !isLoaded || pocket === null) {
  return (
   <section className='page__container'>
    <TopWhiteSpace variant={'dark'} />
    {header}

    <div className='pocketDetail__skeletonHero' aria-hidden='true'></div>

    <article className='form__box'>
     {Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <div
       className='pocketDetail__skeletonRow'
       key={`pocket-detail-skeleton-${index}`}
       aria-hidden='true'
      ></div>
     ))}
    </article>
   </section>
  );
 }

 // Built after the guards, where the pocket is known to have arrived: the three
 // states below all read fields off it.
 //
 // The date reading, in its three states, and the null is not the zero. A
 // required rate of exactly 0 means the goal is covered and there is no pace
 // left to keep; null means the date passed while money is still short, so
 // there is no monthly figure that answers anything. Branching on falsiness
 // collapses the two, because 0 is falsy in JavaScript.
 // The colour of the square and of the border come from this one level, so the
 // two cannot state different things about the same pocket.
 const dateLevel = pocketDateLevel(pocket);

 // The pace card, and the one block of this screen that is still waiting on the
 // server. The rate the plan REQUIRES is served; the rate actually achieved
 // needs the monthly transaction series, and POCKET_DECISIONS.md section 2.2
 // rules out deriving a lifetime average from what is served — a pocket funded
 // once eleven months ago would read identically to one funded every month.
 // Until that endpoint lands, the achieved rate and the projected date print a
 // dash, which says the answer is absent where a 0 would state a figure.
 //
 // Omitted entirely once the date has passed: requiredMonthly is null there,
 // and a card whose every cell is a dash invites reading figures that do not
 // exist. The reading above has already stated the passed date and the gap.
 const requiredMonthly = pocket.requiredMonthly;

 const pace =
  requiredMonthly === null
   ? null
   : {
      level: (pocket.funded ? 'funded' : 'onPlan') as PocketStatusLevel,
      verdict: pocket.funded
       ? 'The target is covered, so there is no rate left to keep.'
       : `${amount(requiredMonthly)} a month keeps this target on its date.`,
      requiredRate: pocket.funded ? DASH : `${amount(requiredMonthly)} / month`,
     };

 // How far the deadline is, and nothing else, because nothing else here was
 // new. The sentence used to rebuild the whole plan: it restated the desired
 // date, which the panel above already prints beside the target, and the
 // monthly rate, which the pace card below prints twice - once as a sentence
 // and once as a labelled figure. On one screen the date appeared twice and
 // the rate three times.
 //
 // A fact belongs at the level where it carries the most, and it belongs there
 // once. The distance to the deadline has no other home, so this reading keeps
 // it and gives everything else back.
 //
 // The sign is spent on the word rather than on the number: late is "12 days
 // late", never "-12 days left". Same rule the module applies to every figure
 // whose direction is already stated in words beside it.
 const dayCount = Math.abs(pocket.daysRemaining);
 const dayWord = dayCount === 1 ? 'day' : 'days';

 // The word comes from the shared map, not from a literal written here. The
 // square beside it is painted for the LEVEL, so the text has to name that
 // same level: a pocket past its goal lights the over-funded blue, and
 // "Target reached" is the BAND that holds both landing on the goal and
 // passing it. A band name beside a level's colour disagrees about how precise
 // the reading is, and the map exists so a card, the hero's tallies and this
 // reading cannot name one level three ways.
 const dateText = pocket.funded
  ? POCKET_STATUS_WORD[dateLevel]
  : pocket.daysRemaining < 0
    ? `${dayCount} ${dayWord} late`
    : pocket.daysRemaining === 0
      ? 'Due today'
      : `${dayCount} ${dayWord} away`;

 //--------------------------------------------
 return (
  <section className='page__container page__container--pocket'>
   <TopWhiteSpace variant={'dark'} />
   {header}

   <SummaryPocketDetailBox pocket={pocket} />

   {/* The state readings, between the hero and the controls: they say what is
       true about the pocket, and the two buttons are what can be done about
       it, so the sentence comes before the response to it.

       Outside the cream panel and not inside it. In the panel they made it
       grow with the number of states a pocket happened to be in; out here the
       panel keeps one height.

       Coverage leads when both are present. The criterion is not which hurts
       more but which contradicts the figures above: an account that no longer
       holds what is committed makes the hero's number unbacked, while a passed
       date leaves it true. */}
   <div className='pocketDetail__readings'>
    {pocket.uncovered && (
     <p
      className={`pocketDetail__reading ${pocketReadingModifier('offPlan')}`}
      role='status'
     >
      <StatusSquare alert={pocketSquareClass('offPlan')} />
      <PocketReadingIcon level='offPlan' className='pocketDetail__readingIcon' />
      <span className='pocketDetail__readingText'>
       The funding accounts no longer hold what is committed here.
      </span>
     </p>
    )}

    <p className={`pocketDetail__reading ${pocketReadingModifier(dateLevel)}`}>
     <StatusSquare alert={pocketSquareClass(dateLevel)} />
     <PocketReadingIcon level={dateLevel} className='pocketDetail__readingIcon' />
     <span className='pocketDetail__readingText'>{dateText}</span>
    </p>
   </div>

   {/* The two decisions the module exists for, lifted out of the article on
       2026-08-30 so they answer the hero directly instead of sitting past two
       empty states.

       Release is disabled and not hidden: a pocket with nothing committed still
       has two things that can be done to it, and a control that appears only
       after the first commitment teaches the pair by surprise. Disabled it
       keeps the row's shape between an empty pocket and a funded one. */}
   <div className='pocketDetail__actions'>
    {/* Only one of the pair carries the cream fill at a time: it marks which
        operation is in hand, so two filled buttons would state that both are.
        Committing holds it at rest, because it is what the screen is for, and
        hands it over while the release panel is open. */}
    <button
     type='button'
     className={`pocketDetail__action${
      cashDirection === 'release' ? '' : ' pocketDetail__action--primary'
     }`}
     onClick={() => setCashDirection('allocate')}
    >
     Commit cash
    </button>

    <button
     type='button'
     className={`pocketDetail__action${
      cashDirection === 'release' ? ' pocketDetail__action--primary' : ''
     }`}
     onClick={() => setCashDirection('release')}
     disabled={sources.length === 0}
    >
     Release cash
    </button>
   </div>

   {/* Two figures that exist to be compared, so they are a description list and
       not bullets: a bullet between them separates them at the moment they have
       to be read together. The verdict leads, because neither figure answers
       the question on its own — one states what the plan asks, the other what
       is happening. */}
   {pace && (
    <div className='pocketDetail__pace'>
     <p className='pocketDetail__paceVerdict'>
      <StatusSquare alert={pocketSquareClass(pace.level)} />
      <span className='pocketDetail__readingText'>{pace.verdict}</span>
     </p>

     <dl className='pocketDetail__paceFigures'>
      <div className='pocketDetail__paceFigure'>
       <dt>Required rate</dt>
       <dd>{pace.requiredRate}</dd>
      </div>

      <div className='pocketDetail__paceFigure'>
       <dt>Actual rate</dt>
       <dd>{DASH}</dd>
      </div>
     </dl>

     <p className='pocketDetail__paceProjection'>
      <span>Projected completion</span>
      <span>{DASH}</span>
     </p>
    </div>
   )}

   <article className='form__box'>
    {/* What the pocket carries besides its figures. Read-only, and it now looks
        it: these three borrowed the form's own input classes, so a bordered box
        around each value invited a click that does nothing. The pencil beside
        the title is this screen's one editing affordance, and a value dressed
        as a control competes with it.

        The desired date and the currency both left this block on 2026-08-30.
        They are labelled figures in the hero now, beside the target they
        qualify; printed in two places they were two facts the reader had to
        reconcile. What stays is the one field that is prose. */}
    <div className='pocketDetail__meta'>
     <div className='pocketDetail__metaItem'>
      <span className='pocketDetail__metaLabel'>Note</span>
      <p className='pocketDetail__metaNote'>{pocket.note ?? DASH}</p>
     </div>
    </div>

    {/* --- THE ACCOUNTS FUNDING THIS POCKET --- */}
    <div className='pocketDetail__section'>
     <div className='presentation__card__title__container'>
      <CardTitle>{'Money sources'}</CardTitle>
     </div>

     {sources.length === 0 ? (
      <p className='pocketDetail__empty'>
       No account has committed cash to this pocket yet. Committing from one
       adds it here.
      </p>
     ) : (
      <ul className='pocketDetail__list'>
       {sources.map((source) => (
        <li className='pocketDetail__row' key={`source-${source.accountId}`}>
         <div className='pocketDetail__rowLeft'>
          {/* The allocation ledger names an account the account read cannot
              resolve: it was removed, or it is internal. What it holds is
              still real and still counted, so the row is served. */}
          <span className='pocketDetail__rowTitle'>
           {source.accountName ?? 'Account no longer available'}
          </span>

          <span className='pocketDetail__rowSubtitle'>
           unassigned cash: {amountOrDash(source.accountUnassignedCash)}
          </span>
         </div>

         <div className='pocketDetail__rowRight'>
          <span className='pocketDetail__rowAmount'>
           {amount(source.heldByThisPocket)}
          </span>

          {/* The ACCOUNT's own state, not this pocket's share of it. */}
          {source.covered === false && (
           <span className='pocketDetail__flag'>over-committed</span>
          )}
         </div>
        </li>
       ))}
      </ul>
     )}
    </div>

    {/* --- WHAT WAS DECIDED, AND WHEN --- */}
    <div className='pocketDetail__section'>
     <div className='presentation__card__title__container'>
      <CardTitle>{'Pocket allocation history'}</CardTitle>
     </div>

     {history.length === 0 ? (
      <p className='pocketDetail__empty'>
       Nothing has been committed or released yet.
      </p>
     ) : (
      <ul className='pocketDetail__list'>
       {history.map((entry) => (
        <li key={`allocation-${entry.allocationId}`}>
         {/* A button and not a list item with a handler: the row opens a panel
             rather than navigating, so it needs focus, Enter and Space, and a
             div with an onClick answers none of the three. */}
         <button
          type='button'
          className='pocketDetail__row pocketDetail__row--open'
          onClick={() => setOpenEntry(entry)}
          aria-label={`Open the entry of ${formatCalendarDate(
           entry.allocationDate,
          )}`}
         >
          <div className='pocketDetail__rowLeft'>
          {/* The word beside the sign, never the colour alone: colour
              survives neither colour blindness nor print. */}
          <span className='pocketDetail__rowTitle'>
           {entry.amount < 0 ? 'Released' : 'Committed'}
          </span>

          <span className='pocketDetail__rowSubtitle'>
           {entry.sourceAccountName ?? DASH}
           {' · '}
           {formatCalendarDate(entry.allocationDate)}
          </span>
         </div>

         <div className='pocketDetail__rowRight'>
          <span
           className={
            entry.amount < 0
             ? 'pocketDetail__rowAmount pocketDetail__rowAmount--negative'
             : 'pocketDetail__rowAmount'
           }
          >
           {amount(entry.amount)}
          </span>

          {/* What the owner actually typed, when it was not this pocket's own
              unit. The stored figure above is the one the pocket counts in and
              the only one any arithmetic uses; this one is the decision as it
              was made, and without it the row cannot be checked against the
              bank statement it came from.

              Withheld when the two units agree: repeating the same figure in
              the same currency would read as a second amount. */}
          {entry.originalCurrency !== currency && (
           <RateTooltip
            tipText={originTip(entry)}
            surface='dark'
            placement='anchor-left'
           >
            <span className='pocketDetail__rowOrigin'>
             {numberFormatCurrency(
              Math.abs(entry.originalAmount),
              2,
              entry.originalCurrency,
             )}
            </span>
           </RateTooltip>
          )}
          </div>
         </button>
        </li>
       ))}
      </ul>
     )}
    </div>

    {/* The delete button that stood here until 2026-08-30 moved into the
        overflow menu in the header, next to editing. It is still two steps from
        the deletion — the menu, then the confirmation — so it is no closer to a
        stray tap than it was at the bottom of the page, and the screen no
        longer ends on its most destructive control. */}
   </article>

   {openEntry && (
    <AllocationEntryModal
     entry={openEntry}
     currency={currency}
     onClose={() => setOpenEntry(null)}
    />
   )}

   {cashDirection && (
    <PocketCashModal
     pocketId={pocket.pocketId}
     pocketName={pocket.name}
     plan={{
      target: pocket.target,
      desiredDate: pocket.desiredDate,
      allocated: pocket.allocated,
      remaining: pocket.remaining,
     }}
     currency={currency}
     direction={cashDirection}
     sources={sources}
     onClose={() => setCashDirection(null)}
    />
   )}

   {isConfirmingDeletion && (
    <DeletePocketModal
     pocketId={pocket.pocketId}
     pocketName={pocket.name}
     currency={currency}
     onClose={() => setIsConfirmingDeletion(false)}
    />
   )}

   {/* The object actions, behind the header's overflow control. Each closes
       the menu before it acts: the editor navigates away, and the confirmation
       is a second panel that must not open under this one. */}
   <AccountActionsMenu
    isOpen={isMenuOpen}
    accountName={capitalize(pocket.name)}
    onClose={() => setIsMenuOpen(false)}
    editLabel='Edit pocket'
    deleteLabel='Delete pocket'
    onEditAccount={() => {
     setIsMenuOpen(false);
     navigate(`/fintrack/pocket/pockets/${pocket.pocketId}/edit`, {
      state: { previousRoute: location.pathname },
     });
    }}
    onDeleteAccount={() => {
     setIsMenuOpen(false);
     setIsConfirmingDeletion(true);
    }}
   />
  </section>
 );
}

export default PocketDetail;
