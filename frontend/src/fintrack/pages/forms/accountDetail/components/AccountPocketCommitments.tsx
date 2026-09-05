// AccountPocketCommitments.tsx
// parent: AccountDetail.tsx
//
// 👛 WHICH POCKETS THIS ACCOUNT IS FUNDING, and how much each one holds.
//
// The account's own read already served this and the screen threw it away: the
// total allocated to pockets, the cash no plan has claimed, the over-allocated
// flag and the per-pocket breakdown all arrive with the account and none of
// them was drawn. The owner could see from a pocket which accounts fund it and
// never the reverse — which goals are drawing on THIS account — so the answer
// existed and only the reading was missing.
//
// A collapsible card, the same shape the pocket board's funding accounts card
// draws for the mirror question: the two scalars head it and cost no request,
// the list behind the toggle is the detail.
//
// NO PROGRESS BAR, and that is a ruling and not an omission. What this account
// holds for a pocket has no denominator in the payload — the pocket's target is
// not served here — so any bar would divide by a figure the screen invented.

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFetch } from '../../../../hooks/useFetch.ts';
import {
 CURRENCY_OPTIONS,
 DEFAULT_CURRENCY,
} from '../../../../helpers/constants.ts';
import { currencyFormat } from '../../../../helpers/functions.ts';
import {
 AccountByTypeResponseType,
 AccountPocketAllocationType,
} from '../../../../types/responseApiTypes.ts';
import { CurrencyType } from '../../../../types/types.ts';
import { url_get_account_by_id } from '../../../../../urlConfig.ts';
// The wallet the pocket module wears for the pockets themselves. It names the
// SUBJECT of this card — the goals drawing on the account — and not the
// account, which the screen around it already is.
import WalletSvg from '../../../../../assets/pocketSvg/walletSvg.svg?react';
import ArrowDownLightSvg from '../../../../../assets/ArrowDownLightSvg.svg?react';

import '../styles/accountPocketCommitments.css';

const BODY_ID = 'accountPockets-body';

// How many placeholder rows the pending state draws. Enough to hold the card at
// roughly its answered height so the page does not jump under the reader's
// cursor, few enough not to claim a count the request has not answered yet.
const SKELETON_ROWS = 3;

const pocketRoute = (pocketId: number) =>
 `/fintrack/pocket/pockets/${pocketId}`;

type AccountPocketCommitmentsPropType = {
 accountId: string;
 // The three scalars and the list, exactly as the account read serves them.
 //
 // ABSENT — not zero — on every account type but bank, because an account that
 // holds no unassigned cash cannot be asked the question. The card renders
 // nothing at all in that case: a zero would answer it with "nothing
 // committed", which is a different statement from "this cannot be asked".
 allocated?: number;
 unassignedCash?: number;
 isOverAllocated?: boolean;
 // Absent when the account was handed over in router state by a list whose read
 // serves only the three scalars. That is a missing LIST and not an empty one,
 // which is why the card asks for it rather than printing "no pockets".
 pockets?: AccountPocketAllocationType[];
 currencyCode?: CurrencyType;
};

function AccountPocketCommitments({
 accountId,
 allocated,
 unassignedCash,
 isOverAllocated,
 pockets,
 currencyCode,
}: AccountPocketCommitmentsPropType) {
 // Where the pocket screen's back control returns to.
 const previousRoute = useLocation().pathname;

 const [isOpen, setIsOpen] = useState(false);

 // Asked for on the first expand and only when the list did not arrive with the
 // account. Accounting Dashboard and Overview both hand the account over in
 // router state, and their own reads carry the three scalars without the
 // breakdown — so the screen has the heading it needs and not the body.
 //
 // A null url is what useFetch takes for "do not ask", so a card nobody opens
 // costs no request, and an account that already carried its own list is never
 // asked for at all.
 const needsPockets = pockets === undefined;
 const { apiData, isLoading, error, refetch } =
  useFetch<AccountByTypeResponseType>(
   isOpen && needsPockets ? `${url_get_account_by_id}/${accountId}` : null,
  );

 const fetchedPockets = apiData?.data?.accountList[0]?.pockets;
 const rows = pockets ?? fetchedPockets;

 const currency_code = currencyCode ?? DEFAULT_CURRENCY;
 // The locale is the reader's, never the amount's. Taken from the amount's own
 // currency, Intl leaves every currency unmarked and the dollar, the Colombian
 // peso and the Mexican peso all narrow to '$'.
 const amount = (value: number) =>
  currencyFormat(currency_code, value, CURRENCY_OPTIONS[DEFAULT_CURRENCY]);

 // The four keys travel together, so one of them decides for all four. Nothing
 // is drawn for an investment or a debtor account: the question does not apply
 // there, and a card stating so would be noise on every one of those screens.
 if (allocated === undefined) return null;

 return (
  <section className='accountPockets'>
   <div className='accountPockets__headRow'>
    <span className='accountPockets__head'>
     <WalletSvg className='accountPockets__glyph' />

     <span className='accountPockets__label'>Committed to pockets</span>
    </span>

    <button
     type='button'
     className={`accountPockets__toggle${isOpen ? ' is-active' : ''}`}
     onClick={() => setIsOpen((open) => !open)}
     aria-expanded={isOpen}
     aria-controls={BODY_ID}
     aria-label={
      isOpen
       ? 'Collapse the pockets funded by this account'
       : 'Expand the pockets funded by this account'
     }
    >
     <ArrowDownLightSvg className='accountPockets__toggleChevron' />
    </button>
   </div>

   {/* Both figures and never one: a single "allocated" reads as money the owner
       can no longer spend, and a single "unassigned" reads as the available
       balance. A pocket blocks no spending — the available balance is still the
       whole balance — and what is left here is only the cash no plan has
       claimed yet.

       It can read negative, which is a state the screen reports and does not
       correct: the app has no policy for deciding which pocket gives cash back,
       and inventing one would be the screen editing the owner's plans. */}
   <p className='accountPockets__figures'>
    <span className='accountPockets__figure'>
     <span className='accountPockets__figureLabel'>allocated</span>
     <b className='accountPockets__figureValue'>{amount(allocated)}</b>
    </span>

    {unassignedCash !== undefined && (
     <span className='accountPockets__figure'>
      <span className='accountPockets__figureLabel'>unassigned</span>
      <b
       className={`accountPockets__figureValue${
        isOverAllocated === true ? ' accountPockets__figureValue--over' : ''
       }`}
      >
       {amount(unassignedCash)}
      </b>
     </span>
    )}
   </p>

   {/* The WORD carries this reading and the colour only seconds it: an account
       committed past its own balance has to survive a monochrome print and
       every kind of colour blindness. */}
   {isOverAllocated === true && (
    <p className='accountPockets__flag'>
     Allocated past this account&apos;s balance.
    </p>
   )}

   {isOpen && (
    <div className='accountPockets__body' id={BODY_ID}>
     {/* Three states and they are not degrees of one another: a failed request
         is not an empty list, and neither is a request still in flight. */}
     {error !== null ? (
      <div className='accountPockets__state' role='alert'>
       <p className='accountPockets__stateText'>
        The pockets funded by this account could not be loaded.
       </p>
       <p className='accountPockets__stateDetail'>{error}</p>
       <button
        type='button'
        className='accountPockets__retry'
        onClick={refetch}
       >
        Try again
       </button>
      </div>
     ) : rows === undefined || isLoading ? (
      <ul className='accountPockets__list' aria-hidden='true'>
       {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <li
         className='accountPockets__row accountPockets__row--skeleton'
         key={`pocket-skeleton-${index}`}
        >
         <span className='accountPockets__bar accountPockets__bar--name' />
         <span className='accountPockets__bar accountPockets__bar--amount' />
        </li>
       ))}
      </ul>
     ) : rows.length === 0 ? (
      /* A real state and not a gap in the answer: this account funds no
         pocket. A pocket this account funded and then released in full is
         absent too rather than a row reading zero, which is why the sentence
         speaks of today and not of ever. */
      <p className='accountPockets__empty'>
       No pocket is drawing on this account today.
      </p>
     ) : (
      <ul className='accountPockets__list'>
       {rows.map((pocket) => (
        <li key={`pocket-${pocket.pocketId}`}>
         {/* The whole row is the link and not the name inside it: the amount
             is half of what the reader is weighing when they decide to open
             a pocket. */}
         <Link
          to={pocketRoute(pocket.pocketId)}
          state={{ previousRoute }}
          className='accountPockets__row accountPockets__row--link'
         >
          <span className='accountPockets__name'>{pocket.name}</span>

          {/* What THIS account holds for that pocket, and never the pocket's
              own progress. No bar under it and no percentage beside it: the
              payload carries no target, so this figure has no denominator. */}
          <span className='accountPockets__amount'>
           {amount(pocket.heldFromThisAccount)}
          </span>
         </Link>
        </li>
       ))}
      </ul>
     )}
    </div>
   )}
  </section>
 );
}

export default AccountPocketCommitments;
