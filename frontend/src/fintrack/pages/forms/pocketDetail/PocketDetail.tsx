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

import { Link, useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../../assets/LeftArrowSvg.svg';
import { DEFAULT_CURRENCY, VARIANT_FORM } from '../../../helpers/constants.ts';
import {
 capitalize,
 formatCalendarDate,
 numberFormatCurrency,
} from '../../../helpers/functions.ts';
import SummaryPocketDetailBox from './summaryPocketDetailBox/SummaryPocketDetailBox.tsx';
import PocketEditLink from './PocketEditLink.tsx';
import DeletePocketModal from './deletePocketModal/DeletePocketModal.tsx';
import PocketCashModal, {
 PocketCashDirection,
} from './pocketCashModal/PocketCashModal.tsx';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import { usePocketDetailStore } from '../../../stores/usePocketDetailStore.ts';

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

 // Which money decision is open, or none. One piece of state and not two
 // flags: the two are alternatives, and two booleans would admit a state
 // where both panels are open at once.
 const [cashDirection, setCashDirection] =
  useState<PocketCashDirection | null>(null);

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
        in its accessible label and an editor opened for a pocket the screen
        cannot name yet has nothing to edit. The editor returns to this card,
        not to the board the user came from: this is where they are standing. */}
    {pocket && (
     <PocketEditLink
      pocketId={pocket.pocketId}
      returnRoute={location.pathname}
      pocketName={pocket.name}
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

 //--------------------------------------------
 return (
  <section className='page__container'>
   <TopWhiteSpace variant={'dark'} />
   {header}

   <SummaryPocketDetailBox pocket={pocket} />

   <article className='form__box'>
    <div className='form__container'>
     <div className='input__box'>
      <label className='label forms__label'>{'Note'}</label>
      {/* The modifier asks for the note's four lines. The base class alone is
          one line, which is what the value boxes below want. */}
      <div className='input__container input__container--note pocketDetail__value'>
       {pocket.note ?? DASH}
      </div>
     </div>

     <div className='account__dateAndCurrency'>
      <div className='account__date'>
       <label className='label forms__label'>{'Desired Date'}</label>
       {/* Built from the parts of a YYYY-MM-DD label the server resolved on
           the owner's calendar. new Date() on one of these is UTC midnight and
           renders as the previous day west of UTC. */}
       <div className='form__datepicker__container pocketDetail__value'>
        {formatCalendarDate(pocket.desiredDate)}
       </div>
      </div>

      <div className='account__currency'>
       <div className='label forms__label'>{'Currency'}</div>
       <CurrencyBadge variant={VARIANT_FORM} currency={currency} />
      </div>
     </div>
    </div>

    {/* --- THE ACCOUNTS FUNDING THIS POCKET --- */}
    <div className='pocketDetail__section'>
     <div className='presentation__card__title__container'>
      <CardTitle>{'Funded by'}</CardTitle>
     </div>

     {sources.length === 0 ? (
      <p className='pocketDetail__empty'>
       No account has committed cash to this pocket yet.
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
      <CardTitle>{'History'}</CardTitle>
     </div>

     {history.length === 0 ? (
      <p className='pocketDetail__empty'>Nothing has been committed yet.</p>
     ) : (
      <ul className='pocketDetail__list'>
       {history.map((entry) => (
        <li
         className='pocketDetail__row'
         key={`allocation-${entry.allocationId}`}
        >
         <div className='pocketDetail__rowLeft'>
          {/* The word beside the sign, never the colour alone: colour
              survives neither colour blindness nor print. */}
          <span className='pocketDetail__rowTitle'>
           {entry.amount < 0 ? 'Released' : 'Allocated'}
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
         </div>
        </li>
       ))}
      </ul>
     )}
    </div>

    {/* The two decisions the module exists for. Releasing is offered only
        when something is actually held: a control that can only refuse is
        worse than one that is not there. */}
    <div className='pocketDetail__actions'>
     <button
      type='button'
      className='pocketDetail__action pocketDetail__action--primary'
      onClick={() => setCashDirection('allocate')}
     >
      Commit cash
     </button>

     {sources.length > 0 && (
      <button
       type='button'
       className='pocketDetail__action'
       onClick={() => setCashDirection('release')}
      >
       Release cash
      </button>
     )}
    </div>

    {/* Last on the screen and not in the header beside the editor. Deleting is
        the one action here that cannot be undone by repeating it, so it sits
        past everything the owner came to read rather than one stray tap from
        the title. */}
    <button
     type='button'
     className='pocketDetail__delete'
     onClick={() => setIsConfirmingDeletion(true)}
    >
     Delete this pocket
    </button>
   </article>

   {cashDirection && (
    <PocketCashModal
     pocketId={pocket.pocketId}
     pocketName={pocket.name}
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
  </section>
 );
}

export default PocketDetail;
