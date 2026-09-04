// PocketFundingAccounts.tsx
// parent: PocketBigBoxResult.tsx (PocketBoardReadings)
//
// 💳 WHICH ACCOUNTS ARE FUNDING THE POCKETS, and how much each one holds.
//
// The board stated this three times as a COUNT and never once as a list. The
// hero read "3 funding accounts", every pocket card reads "Funded by N
// accounts", and the only place an account NAME appears is the Money sources
// section inside one pocket's detail — which lists the accounts for that one
// pocket. To learn the three the owner had to open all six pockets and merge
// the lists by hand.
//
// So the count becomes the door: the number is this card's own heading, and
// opening it lists what it counted. That is the whole design, and it is why the
// count is not repeated anywhere inside the body.
//
// A third accordion beside Pocket status and Next target, same shape as both:
// the body is ABSENT rather than hidden while closed, because a collapsed card
// should cost the page its height and not only its ink.

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getPocketSourceAccounts } from '../../../api/pocketApi.ts';
import {
 CURRENCY_OPTIONS,
 DEFAULT_CURRENCY,
} from '../../../helpers/constants.ts';
import {
 currencyFormat,
 formatBudgetMonthLabel,
} from '../../../helpers/functions.ts';
import { PocketEligibleAccount } from '../../../types/pocketTypes.ts';
// A bank, and neither the wallet nor the coins. The wallet is the mark "Pocket
// status" already wears, and two cards carrying one glyph read as two views of
// the same thing. Coins would name the MONEY, which every other figure on this
// hero already names; what this card lists is the institutions the money sits
// in, so the glyph names those. Drawn for this card with the set's own pen.
import BankSvg from '../../../../assets/pocketSvg/bankSvg.svg?react';
import ArrowDownLightSvg from '../../../../assets/ArrowDownLightSvg.svg?react';

const BODY_ID = 'pocketHero-fundingAccountsBody';

// A figure the read could not answer for. The two pocket figures are absent
// rather than zero on an account the allocation read could not resolve, and a
// zero there would state that nothing is committed to an account nobody
// measured.
const DASH = '—';

// The account's own screen, addressed absolutely because it is declared beside
// this board rather than under it — both hang off the same /fintrack parent, so
// a relative path from the pocket board would resolve inside the board.
//
// It is the SHARED account page, the one Accounting Dashboard opens, and that
// is deliberate: an account has one canonical screen and a second copy reached
// only from here would be a fourth near-identical file of the three that
// already exist. It is also the screen that already RECEIVES what this card
// cannot show — its own read serves the total committed to pockets, the cash no
// plan has claimed, the over-committed flag and the per-pocket breakdown, and
// renders none of them. Until that page is allowed to print them the link is
// correct and its destination is incomplete: it lands on the right account and
// that account still says nothing about the goals drawing on it.
const accountRoute = (accountId: number) =>
 `/fintrack/overview/accounts/${accountId}`;

// How many placeholder rows the pending state draws. Enough to hold the card
// open at roughly its answered height so the page does not jump, few enough not
// to claim a count — the heading already carries the real one.
const SKELETON_ROWS = 3;

type PocketFundingAccountsPropType = {
 // The board's own count of distinct accounts holding an allocation above zero,
 // folded by the server. It heads the card so the closed state costs no
 // request.
 //
 // It is bound to the month the board is reporting — it is the fold of a
 // per-pocket count the contract states is "bounded at the close of the
 // selected month" — and the rows below are not. See the note this component
 // prints when the two clocks can disagree.
 sourceAccountCount: number;
 // The month the board is reporting and the latest month there is, both YYYY-MM
 // as the server resolved them on the owner's calendar. They are equal whenever
 // the reader has not stepped back, which is the only case where this card's
 // heading and its rows are answering about the same instant.
 referenceMonth: string | null;
 currentMonth: string | null;
};

function PocketFundingAccounts({
 sourceAccountCount,
 referenceMonth,
 currentMonth,
}: PocketFundingAccountsPropType) {
 // Where the account screen's back control returns to. The router already holds
 // it, so it is read here rather than threaded down as a prop.
 const previousRoute = useLocation().pathname;

 const [isOpen, setIsOpen] = useState(false);
 const [accounts, setAccounts] = useState<PocketEligibleAccount[] | null>(null);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 // Asked once, and the claim is a ref because a state flag would re-render and
 // re-run the effect that reads it.
 const hasRequested = useRef(false);

 // Whether this component is still on screen. It guards the three state writes
 // below so an answer landing after the board is left does not write into a
 // component nobody is rendering.
 const isMounted = useRef(true);
 useEffect(
  () => () => {
   isMounted.current = false;
  },
  [],
 );

 // Asked for on the first expand and never with the board. The board's payload
 // does not carry these rows, and a card most readers never open must not cost
 // every reader a request. `accounts !== null` is what makes it once and not
 // once per toggle.
 //
 // The right end state is for the board's own payload to carry them — one
 // answer serving every reading of it — and this call is what that would
 // replace, not a second source beside it.
 useEffect(() => {
  if (!isOpen || hasRequested.current) return;

  // Claimed BEFORE the request goes out, and in a ref rather than in state. A
  // state flag cannot guard this: setting one re-renders, and while `isLoading`
  // was a dependency of this effect that re-render tore the effect down and
  // rebuilt it — the teardown cancelled the very request the setup had just
  // started, and the card sat in its skeleton for ever. A ref does not
  // re-render, so nothing is torn down.
  hasRequested.current = true;
  setIsLoading(true);
  setError(null);

  getPocketSourceAccounts()
   .then((rows) => {
    if (isMounted.current) setAccounts(rows);
   })
   .catch((err: unknown) => {
    if (!isMounted.current) return;

    setError(
     err instanceof Error ? err.message : 'The accounts could not be loaded',
    );
    // Released so closing and reopening asks again. A failure that latched the
    // claim would leave the only way back a full reload of the board.
    hasRequested.current = false;
   })
   .finally(() => {
    if (isMounted.current) setIsLoading(false);
   });

  // Deliberately NOT cancelled when the card is closed. This component stays
  // mounted either way — only its body is conditional — so an answer that lands
  // after a close is still the answer, and dropping it would mean asking again
  // for something already paid for. Only leaving the board discards it, which
  // the unmount effect above handles.
 }, [isOpen]);

 // The endpoint answers with every account a commitment MAY draw on, which is
 // not the same set as the accounts funding a pocket today: a bank with nothing
 // committed is eligible and belongs in the allocation picker, and listing it
 // here would put the card's own heading in the wrong. Absent is not zero, so a
 // row whose figure the read could not answer for is excluded too rather than
 // being treated as empty.
 const funding = (accounts ?? []).filter(
  (account) => account.allocated !== undefined && account.allocated > 0,
 );

 // Three different ways for the list to come out short, and one sentence for
 // all of them would be a lie in two of the cases.
 //
 // The heading states a count the server folded from the pockets themselves, so
 // a card that says "3" over an empty body is the board contradicting itself,
 // and the reader has to be told WHICH of these happened rather than being left
 // to assume the least alarming one.
 const answered = accounts !== null;
 const carriesFigures = (accounts ?? []).some(
  (account) => account.allocated !== undefined,
 );
 const emptyText =
  answered && accounts.length === 0
   ? 'No bank account was returned, so there is nothing this board could be funded from.'
   : answered && !carriesFigures
     ? 'The accounts answered, but none of them carried what it has committed to a pocket. The figure is served by the accounts read, so this is a gap in the answer and not an empty board.'
     : 'No account has committed cash to a pocket yet. Committing from one lists it here.';

 const amountFor = (account: PocketEligibleAccount, value?: number) => {
  if (value === undefined) return DASH;

  const currency_code = account.currency_code ?? DEFAULT_CURRENCY;

  return currencyFormat(
   currency_code,
   value,
   CURRENCY_OPTIONS[currency_code],
  );
 };

 return (
  <div className='pocketHero__card'>
   <div className='pocketHero__cardHeadRow'>
    <span className='pocketHero__cardHead'>
     <BankSvg className='pocketHero__glyph' />

     {/* Plain parentheses and NOT the "(total: N)" the status card uses. That
         card heads a partition of pockets by level and its number has to add up
         to the readings beneath it; this one is only how many accounts are
         listed and makes no such claim. */}
     <span className='pocketHero__label'>
      Funding accounts (<b>{sourceAccountCount}</b>)
     </span>
    </span>

    <button
     type='button'
     className={`pocketHero__toggle${isOpen ? ' is-active' : ''}`}
     onClick={() => setIsOpen((open) => !open)}
     aria-expanded={isOpen}
     aria-controls={BODY_ID}
     aria-label={
      isOpen ? 'Collapse funding accounts' : 'Expand funding accounts'
     }
    >
     <ArrowDownLightSvg className='pocketHero__toggleChevron' />
    </button>
   </div>

   {isOpen && (
    <div className='pocketHero__cardBody' id={BODY_ID}>
     {/* TWO CLOCKS, said out loud rather than left for the reader to discover.
         The count in the heading is folded from the pockets and is bounded at
         the close of the month the board is reporting; every figure in the rows
         below comes from the accounts read, which takes no month and answers
         about right now. What an account holds has no month — there is no way
         to ask what its uncommitted cash was at the close of a past September,
         and inventing one would be a figure the server never stated.

         On the current month the two agree and the line is absent. Stepped back,
         they can differ honestly, and the reader has to be told which of the two
         they are looking at rather than being left to assume both move
         together. */}
     {referenceMonth !== null &&
      currentMonth !== null &&
      referenceMonth !== currentMonth && (
       <p className='pocketHero__accountNote'>
        Balances are as they stand today. Only the count above is bound to{' '}
        {formatBudgetMonthLabel(referenceMonth)}.
       </p>
      )}

     {/* Three states and they are not degrees of one another: a failed request
         is not an empty list, and neither is a request still in flight. */}
     {error !== null ? (
      <div className='pocketHero__accountsState' role='alert'>
       <p className='pocketHero__accountsStateText'>
        The funding accounts could not be loaded.
       </p>
       <p className='pocketHero__accountsStateDetail'>{error}</p>
      </div>
     ) : isLoading ? (
      <ul className='pocketHero__accounts' aria-hidden='true'>
       {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <li
         className='pocketHero__account pocketHero__account--skeleton'
         key={`funding-skeleton-${index}`}
        >
         <span className='pocketHero__accountBar pocketHero__accountBar--name' />
         <span className='pocketHero__accountBar pocketHero__accountBar--amount' />
        </li>
       ))}
      </ul>
     ) : funding.length === 0 ? (
      <p className='pocketHero__accountsEmpty'>{emptyText}</p>
     ) : (
      <ul className='pocketHero__accounts'>
       {funding.map((account) => (
        <li key={`funding-${account.account_id}`}>
         {/* The whole row is the link, not the name inside it: the amount and
             the cash left uncommitted are the two things the reader is weighing
             when they decide to open an account, so a link that covered only
             the name would exclude what makes them click. */}
         <Link
          to={accountRoute(account.account_id)}
          state={{ previousRoute }}
          className='pocketHero__account pocketHero__account--link'
         >
         <span className='pocketHero__accountLeft'>
          <span className='pocketHero__accountName'>
           {account.account_name}
          </span>

          {/* THREE amounts and not one, shown together so that no single one of
              them can be read as "available" — the same reason the pocket
              detail's own source rows carry three. A pocket blocks no spending,
              so the balance is still the whole balance, and what is not
              committed is only the cash no plan has claimed yet.

              It can read negative, which is a deficit the screen reports and
              does not correct. It is never split across the pockets drawing on
              the account: any split would need a policy the app would have to
              invent. */}
          <span className='pocketHero__accountFacts'>
           <span
            className={`pocketHero__accountFact${
             account.isOverAllocated === true
              ? ' pocketHero__accountFact--over'
              : ''
            }`}
           >
            not committed {amountFor(account, account.unassignedCash)}
           </span>

           <span className='pocketHero__accountFact'>
            balance {amountFor(account, account.account_balance)}
           </span>
          </span>
         </span>

         <span className='pocketHero__accountRight'>
          <span className='pocketHero__accountAmount'>
           {amountFor(account, account.allocated)}
          </span>

          {/* Under the amount rather than beside the two figures on the left.
              As a third item on that line it wrapped in every row, spending a
              whole line of height per account to state three letters; this
              column was standing empty. */}
          <span className='pocketHero__accountUnit'>
           {(account.currency_code ?? DEFAULT_CURRENCY).toUpperCase()}
          </span>

          {/* The WORD carries this reading and the colour only seconds it: an
              account over its own balance has to survive a monochrome print and
              every kind of colour blindness. Same wording the pocket detail's
              own source rows use for the same state. */}
          {account.isOverAllocated === true && (
           <span className='pocketHero__accountFlag'>over-committed</span>
          )}
         </span>

         {/* What the figures above cannot answer without arithmetic: how close
             this account is to its own edge. The bar is committed over balance,
             and it is what turns three amounts into a comparison the eye makes
             at a glance.

             aria-hidden and no progressbar role: both figures it divides are
             printed as text directly above it, and the role would announce a
             percentage this card never states.

             An account whose figures the read could not answer for is drawn
             with NO bar rather than an empty one — an empty track is the same
             paint as an account with nothing committed, and those are two
             different answers. */}
         {account.allocated !== undefined &&
          account.account_balance !== undefined && (
           <span className='pocketHero__accountTrack' aria-hidden='true'>
            <span
             className={`pocketHero__accountTrackFill${
              account.isOverAllocated === true
               ? ' pocketHero__accountTrackFill--over'
               : ''
             }`}
             style={{
              width: `${Math.min(
               Math.max(
                account.account_balance > 0
                 ? (account.allocated / account.account_balance) * 100
                 : 100,
                0,
               ),
               100,
              )}%`,
             }}
            />
           </span>
          )}
         </Link>
        </li>
       ))}
      </ul>
     )}
    </div>
   )}
  </div>
 );
}

export default PocketFundingAccounts;
