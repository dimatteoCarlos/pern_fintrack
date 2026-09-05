// frontend/src/fintrack/pages/forms/pocketDetail/pocketCashModal/PocketCashModal.tsx
// 💸 COMMIT AND RELEASE: the two decisions that make every other figure in this
// module stop reading zero.
//
// One component and not two, for the reason the server has one handler for both
// endpoints: committing cash and releasing it are the same decision with the
// opposite effect, and the endpoint is the only thing that distinguishes them.
// Two components would be two copies of one form, drifting.
//
// What the direction actually changes is two things, and they are the reason
// the two are not one endpoint with a flag either:
//
// - where the accounts come from. Committing may draw on any bank the owner
//   holds; releasing may draw only on the accounts already funding THIS pocket.
// - what bounds the amount. Committing is bounded by what the ACCOUNT has left
//   uncommitted; releasing by what THIS POCKET holds from that one account.
//
// A modal and not a route, because both endpoints answer with the entire detail
// payload: the screen underneath repaints from that one response. A route would
// unmount the screen and then pay a second request to come back to it.
//
// The amount always goes out positive. The sign lives in the URL, and a minus
// in the field would be a second way of saying a direction already said.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
 allocateToPocket,
 getPocketSourceAccounts,
 releaseFromPocket,
} from '../../../../api/pocketApi.ts';
import { usePocketDetailStore } from '../../../../stores/usePocketDetailStore.ts';
import { usePocketBoardStore } from '../../../../stores/usePocketBoardStore.ts';
import { normalizeError } from '../../../../helpers/normalizeError.ts';
import { showToastByStatus } from '../../../../helpers/showToastByStatus.ts';
import {
 formatCalendarDate,
 numberFormatCurrency,
} from '../../../../helpers/functions.ts';
import CurrencyBadge from '../../../../general_components/currencyBadge/CurrencyBadge.tsx';
import RateTooltip from '../../../../general_components/rateTooltip/RateTooltip.tsx';
import { useServerCurrencyConversion } from '../../../../hooks/useServerCurrencyConversion.ts';
import { useCurrencyStore } from '../../../../stores/useCurrencyStore.ts';
import PocketSourcePicker, {
 PocketSourceOption,
} from './PocketSourcePicker.tsx';
import { CurrencyType } from '../../../../types/types.ts';
import {
 PocketAllocationBody,
 PocketEligibleAccount,
 PocketSource,
} from '../../../../types/pocketTypes.ts';
import { useModalDialog } from '../../../../../hooks/useModalDialog.ts';
import TransactionDateTrigger from '../../../../general_components/transactionDateTrigger/TransactionDateTrigger.tsx';
import { useTransactionDate } from '../../../../hooks/useTransactionDate.ts';

import './styles/pocketCashModal-styles.css';

export type PocketCashDirection = 'allocate' | 'release';

// Everything the direction decides, stated once so no branch is spelled out
// twice in the body below.
const COPY: Record<
 PocketCashDirection,
 {
  title: string;
  explanation: string;
  ceilingLabel: string;
  submit: string;
  pending: string;
  confirmation: (figure: string, account: string, pocket: string) => string;
 }
> = {
 allocate: {
  title: 'Commit money',
  // The mirror of the release line below, and read as a pair they state the
  // whole model in two sentences: nothing moves, only what the money is spoken
  // for changes. Both fit the panel's one line of about forty-four characters.
  //
  // It does not open by naming the commit. The title reads "Commit cash" and
  // the button reads "Commit", so a third statement of it would spend the only
  // line on what the reader has already been told twice.
  //
  // "Allocated" is this module's frozen word for what is committed to a goal
  // (POCKET_DECISIONS 18.1), and it is the word the hero's own tile carries.
  explanation: 'Stays in the account, allocated to this goal.',
  ceilingLabel: 'Unassigned',
  submit: 'Commit',
  pending: 'Committing…',
  // What was done, once it is done. It names the three things the panel asked
  // for -- how much, to which goal, out of which account -- because the panel
  // is gone by the time this is read and the figures behind it may be off the
  // bottom of a phone screen.
  confirmation: (figure, account, pocket) =>
   `${figure} committed to ${pocket} from ${account}`,
 },
 release: {
  title: 'Release money',
  // One line, which the panel is 310px wide and 14px tall enough to hold at
  // about forty-four characters. What went is the half the panel already says
  // twice: the title reads "Release cash" and the button reads "Release", so an
  // explanation that opens by restating the release spends its only line on it.
  // Where the money goes is the part nothing else on the panel states.
  //
  // "Unassigned" and not "unallocated": allocated is this module's word for what
  // IS committed to a goal (POCKET_DECISIONS 18.1), and unassigned is its word
  // for what is not — the ceiling label on the commit side of this same object
  // reads Unassigned, and the deletion modal ends on the same word.
  explanation: 'Stays in the account, no longer allocated.',
  // What THIS pocket holds in the account, which is the most a release may
  // take from it. Named for the pocket and not for the account: "here" had no
  // account in view under the amount field and could be read as the pocket.
  ceilingLabel: 'To this pocket',
  submit: 'Release',
  pending: 'Releasing…',
  // The mirror of the line above, and the preposition is the whole difference:
  // cash leaves the goal and lands back in the account.
  confirmation: (figure, account, pocket) =>
   `${figure} released from ${pocket} to ${account}`,
 },
};

// The plan the decision is measured against. One object rather than four
// props because it is one thing: a target, the day it is wanted by, and where
// the pocket stands against both. The modal reads it, never derives it — every
// figure is served on the detail payload.
type PocketPlan = {
 target: number;
 desiredDate: string;
 allocated: number;
 // Negative past the target, which is over-funding and a fact rather than an
 // error. The header states the excess instead of a negative shortfall.
 remaining: number;
};

type PocketCashModalPropType = {
 pocketId: number;
 pocketName: string;
 plan: PocketPlan;
 // The pocket's accounting currency. Every figure the picker shows is stated in
 // it, and it is what the amount field starts in.
 currency: CurrencyType;
 direction: PocketCashDirection;
 // The accounts already funding this pocket, from the detail payload. Read only
 // in the releasing direction, where they are the whole set.
 sources: PocketSource[];
 onClose: () => void;
};

function PocketCashModal({
 pocketId,
 pocketName,
 plan,
 currency,
 direction,
 sources,
 onClose,
}: PocketCashModalPropType) {
 const amountRef = useRef<HTMLInputElement>(null);

 const copy = COPY[direction];

 // The plan's figures, always in the pocket's own currency. The amount below
 // may be typed in another and is converted; these are not.
 const planAmount = (value: number) =>
  numberFormatCurrency(value, 2, currency);

 const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
  null,
 );
 const [amountText, setAmountText] = useState<string>('');
 const [typedCurrency, setTypedCurrency] = useState<CurrencyType>(currency);
 const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
 const [errorMessage, setErrorMessage] = useState<string | null>(null);

 // The day the decision is dated on, and the window it may move in. The same
 // hook the four tracker forms use, so a pocket cannot answer the question
 // differently from a movement: the floor is the back-dating window, the
 // ceiling is today, and both are read on the owner's calendar.
 const {
  transactionActualDate: chosenDay,
  isOpenOnChosenDay,
  dateProps,
 } = useTransactionDate(isSubmitting);

 // Only the committing direction asks for these. Releasing already has its set
 // in the payload that drew the screen, and asking again would be a request for
 // an answer already in hand.
 const [banks, setBanks] = useState<PocketEligibleAccount[] | null>(null);
 const [banksFailed, setBanksFailed] = useState<boolean>(false);

 useEffect(() => {
  if (direction !== 'allocate') return;

  let isCurrent = true;

  const load = async () => {
   try {
    const accounts = await getPocketSourceAccounts();
    if (isCurrent) setBanks(accounts);
   } catch (error) {
    console.error('🔥 Error loading the source accounts', error);
    if (isCurrent) setBanksFailed(true);
   }
  };

  void load();

  return () => {
   isCurrent = false;
  };
 }, [direction]);

 // The behaviour this file used to carry itself, now stated once. canClose does
 // what the Escape handler did: the request must not be abandoned while it is
 // in flight. No initial focus is named, so the caret stays on the panel rather
 // than in the amount field -- the reader reads the direction and the pocket
 // before typing a figure into either.
 //
 // The title id is generated rather than the module constant it replaces: that
 // string was shared by every instance, so two panels open at once would both
 // name the first heading.
 const { titleId, dialogProps } = useModalDialog({
  onClose,
  canClose: !isSubmitting,
 });

 // The picker's rows, built from whichever set this direction draws on. The
 // picker itself never learns which one it is looking at.
 // An account may back a decision only from its opening day onward, so the day
 // filters the list. It is a convenience and never the guarantee: the server
 // checks the same bound on every request, whatever this offered. Hiding the
 // option is what keeps the owner from meeting a 422 they could not have
 // predicted from the form.
 const options = useMemo<PocketSourceOption[]>(() => {
  if (direction === 'release') {
   return sources
    .filter((source) => isOpenOnChosenDay(source.accountStartDate))
    .map((source) => ({
     accountId: source.accountId,
     // The same words the detail screen uses for the same absence: the
     // allocation ledger names an account this read cannot resolve. It is a
     // missing NAME, never a missing amount — what it holds is still counted.
     accountName: source.accountName ?? 'Account no longer available',
     balance: source.accountBalance,
     committed: source.accountAllocated,
     // What THIS pocket holds from THIS account, which is the only figure a
     // release may be measured against.
     ceiling: source.heldByThisPocket,
    }));
  }

  return (banks ?? [])
   .filter((bank) => isOpenOnChosenDay(bank.account_start_date))
   .map((bank) => ({
    accountId: bank.account_id,
    accountName: bank.account_name,
    balance: bank.account_balance,
    // Absent rather than zero when the allocation read could not answer for the
    // row, and the server then applies the real bound.
    committed: bank.allocated ?? null,
    ceiling: bank.unassignedCash ?? null,
   }));
 }, [direction, sources, banks, isOpenOnChosenDay]);

 // A selection the chosen day just invalidated is dropped rather than left
 // standing: the row would still be sent, and the server would refuse it with
 // a message about an account no longer on screen.
 useEffect(() => {
  if (selectedAccountId === null) return;

  const isStillOffered = options.some(
   (option) => option.accountId === selectedAccountId,
  );

  if (!isStillOffered) setSelectedAccountId(null);
 }, [options, selectedAccountId]);

 const selected = options.find(
  (option) => option.accountId === selectedAccountId,
 );

 const amount = Number(amountText);
 const isAmountUsable = amountText.trim() !== '' && amount > 0;

 // The ceiling is shown and never enforced here. It is stated in the pocket's
 // accounting currency while the figure may be typed in another, so comparing
 // the two on the client would mean converting at a rate this screen does not
 // hold — and the server checks the real bound inside its row lock anyway, then
 // names both figures in its refusal.
 const ceilingText =
  selected && selected.ceiling !== null
   ? numberFormatCurrency(selected.ceiling, 2, currency)
   : null;

 // What the typed figure is worth in the currency the row will be stored in.
 // Asked to the same conversion service the write path uses, not divided by a
 // cached rate: what is shown here is what the row will carry. It still does
 // not arm the ceiling above, which stays unenforced for the reason stated
 // there — the server checks the real bound inside its row lock.
 const conversion = useServerCurrencyConversion(
  amountText,
  typedCurrency,
  chosenDay,
 );

 const accountingCurrency = useCurrencyStore((state) => {
  return state.accountingCurrency;
 });

 const convertedText =
  conversion.convertedAmount !== null
   ? `≈ ${numberFormatCurrency(conversion.convertedAmount, 2, accountingCurrency)}`
   : null;

 // The QUOTE the provider published, and not the multiplier read off the two
 // figures the server sent. Dividing them states the conversion backwards --
 // 1 COP = 0,0003 USD -- a direction no rate table publishes and a number whose
 // information sits past the fourth decimal. The quote is the accounting rate,
 // one accounting unit expressed in the typed currency, and it cannot be
 // derived here: a cross conversion composes two of them.
 //
 // Four decimals below ten, because a currency worth less than an accounting
 // unit carries its information after the second place.
 //
 // Grouped the way every other amount on this screen is: comma for thousands,
 // point for decimals. Two conventions in one tooltip would have the rate and
 // the figure it produced disagreeing about what a separator means.
 const quoteLine = conversion.quote
  ? `1 ${accountingCurrency.toUpperCase()} = ${numberFormatCurrency(
     conversion.quote.rate,
     Math.abs(conversion.quote.rate) < 10 ? 4 : 2,
    )} ${conversion.quote.currency.toUpperCase()}`
  : '';

 // Why THIS rate values the chosen day, and only when there is something to
 // explain. A rate carries a validity rather than belonging to one day: the TRM
 // published on a Saturday is in force that Saturday, the Sunday and the Monday,
 // so a decision dated Monday the 24th is valued by the 22nd.
 //
 // "for <day>" said that badly — it read as "the rate is of the 22nd", which is
 // the question the owner was asking, not the answer. "in force since" states
 // the validity that reaches their day. Nothing prints when the two agree: the
 // day is already on the trigger beside the field.
 //
 // It replaces the reading time this line used to state. When the store
 // downloaded a figure is an internal fact, and a whole month pulled in one
 // warm-up call carries the same download stamp on every day of it — so the
 // owner read a date that had nothing to do with the rate in front of them.
 const valuedDayLine =
  conversion.effectiveDate && conversion.effectiveDate !== chosenDay
   ? `in force since ${formatCalendarDate(conversion.effectiveDate)}`
   : '';

 // The rate and the day it belongs to. The provider's identifier is kept
 // commented rather than deleted: the provenance is still owed to the owner,
 // and where it belongs is the open decision — a string like
 // banrep-trm@2026-08-29 names a source the reader has no way to check from
 // here, which is what put it in question.
 const rateTooltipText =
  conversion.convertedAmount !== null && amount > 0
   ? [
      quoteLine,
      // conversion.source ? `source: ${conversion.source}` : '',
      valuedDayLine,
     ]
      .filter(Boolean)
      .join('\n')
   : '';

 async function onSubmit() {
  if (selectedAccountId === null || !isAmountUsable) return;

  setIsSubmitting(true);
  setErrorMessage(null);

  const body: PocketAllocationBody = {
   // The day the decision is dated on. Always sent, including today: the
   // server compares it against today on the OWNER's calendar, which is the
   // only calendar that decides, and omitting it would hand that decision to
   // whatever zone the request happens to arrive in.
   allocationDate: chosenDay,
   sourceAccountId: selectedAccountId,
   amount,
   currency: typedCurrency,
  };

  try {
   const detail =
    direction === 'allocate'
     ? await allocateToPocket(pocketId, body)
     : await releaseFromPocket(pocketId, body);

   // The response carried the hero, the source breakdown and the history
   // already recomputed, so the screen underneath repaints from it and asks
   // for nothing. The board is only marked stale: it refetches if and when the
   // owner walks back to it.
   usePocketDetailStore.getState().setDetail(detail);
   usePocketBoardStore.getState().invalidate();

   // Said out loud, because until now the success was silent: the panel closed
   // and the only evidence was a repainted figure that a phone may have below
   // the fold. A repaint is also not announced to a screen reader, which is
   // what WCAG 4.1.3 asks a status message to be.
   //
   // In the currency it was TYPED in, not the pocket's: this confirms what the
   // owner did, and the conversion is the server's business.
   showToastByStatus(
    copy.confirmation(
     numberFormatCurrency(amount, 2, typedCurrency),
     selected?.accountName ?? 'the account',
     pocketName,
    ),
    200,
   );

   onClose();
  } catch (error) {
   // The server's own words, verbatim. A refusal over the ceiling names both
   // figures — what was asked for and what was there — and rewording it here
   // would drop the one thing that tells the owner what to type instead.
   console.error('🔥 Error moving cash on the pocket', error);
   const { message } = normalizeError(error);
   setErrorMessage(message);
  } finally {
   setIsSubmitting(false);
  }
 }

 const isLoadingSources = direction === 'allocate' && banks === null;

 return createPortal(
  <div className='pocketCash__overlay'>
   <div className='pocketCash__panel' {...dialogProps}>
    {/* Two lines, not one sentence joined by a middot. The verb says what the
        panel does and the name says which pocket it does it to — two different
        questions, and on one line a long name was crowded against the action
        it had nothing to do with. Both stay inside the h2, so the accessible
        name the dialog is labelled by is unchanged. */}
    <h2 className='pocketCash__title' id={titleId}>
     <span className='pocketCash__action'>{copy.title}</span>
     <span className='pocketCash__pocketName'>{pocketName}</span>
    </h2>

    <p className='pocketCash__body'>{copy.explanation}</p>

    {/* What the amount below is measured against. The modal asked how much to
        commit and stated nothing about the plan, so the decision had to be
        made from memory or by closing the modal to go and read the panel
        behind it.

        Four figures and no more: the target and the day it is wanted by are
        the plan; what is allocated and what is still to allocate are where the
        pocket stands against it. The sum of the last two IS the target, which
        is what lets the owner check the row without arithmetic. */}
    <dl className='pocketCash__plan'>
     <div className='pocketCash__planItem'>
      <dt className='pocketCash__planLabel'>Target</dt>
      <dd className='pocketCash__planValue'>{planAmount(plan.target)}</dd>
     </div>

     <div className='pocketCash__planItem'>
      <dt className='pocketCash__planLabel'>By</dt>
      <dd className='pocketCash__planValue'>
       {formatCalendarDate(plan.desiredDate)}
      </dd>
     </div>

     <div className='pocketCash__planItem'>
      <dt className='pocketCash__planLabel'>Allocated</dt>
      <dd className='pocketCash__planValue'>{planAmount(plan.allocated)}</dd>
     </div>

     {/* Over target when the shortfall has gone negative: the same figure, and
         the word carries the sign so the amount never prints one.

         Which is why it takes a colour of its own. Dressed like the three
         fixed labels beside it, the only carrier of the sign read as a heading
         that never changes. The colour is the one this module already gives a
         pocket above its target — the info level of pocketStatus.ts — so the
         panel and the board cannot say the same state two ways. */}
     <div className='pocketCash__planItem'>
      <dt
       className={`pocketCash__planLabel${
        plan.remaining < 0 ? ' pocketCash__planLabel--overTarget' : ''
       }`}
      >
       {plan.remaining < 0 ? 'Over target' : 'Still to allocate'}
      </dt>
      <dd className='pocketCash__planValue'>
       {planAmount(Math.abs(plan.remaining))}
      </dd>
     </div>
    </dl>

    {banksFailed && (
     <p className='pocketCash__error' role='alert'>
      The accounts could not be loaded.
     </p>
    )}

    {isLoadingSources && !banksFailed ? (
     <div className='pocketCash__skeleton' aria-hidden='true'>
      <div className='pocketCash__skeletonRow'></div>
      <div className='pocketCash__skeletonRow'></div>
     </div>
    ) : (
     <PocketSourcePicker
      options={options}
      selectedAccountId={selectedAccountId}
      onSelect={setSelectedAccountId}
      currency={currency}
      ceilingLabel={copy.ceilingLabel}
      disabled={isSubmitting}
     />
    )}

    {/* The label, the field and the converted figure as one block, and the
        block is what the rate chip anchors to. The chip belongs under the
        FIELD, centred on it, and the figure that opens it sits on the label's
        own line — so no element the chip could hang off is in the right place
        for it. Positioning it against this box instead is what puts it there,
        and the scoping keeps that out of the six other callers of the shared
        tooltip. */}
    <div className='pocketCash__amountBlock'>
     <div className='pocketCash__labelRow'>
      {/* The label alone. The date moved into the field below, which is where
          the four tracker forms put it. It stays a group so the row keeps two
          children and its space-between goes on holding the converted figure
          at the right end. */}
      <span className='pocketCash__labelGroup'>
       <label className='pocketCash__label' htmlFor='pocketCashAmount'>
        Amount
       </label>
      </span>

      {/* The converted figure rides the label's line rather than taking one of
          its own under the field. Three states, and they are not degrees of
          one another: a rate the server could not resolve used to render
          exactly like an amount that needs no conversion — nothing at all —
          which is the one case where the owner most needs to be told. The
          failure is not here, because it is a sentence with a button after it
          and would not fit a label's line. */}
      {conversion.status === 'querying' && (
       <span
        className='pocketCash__fxPreview pocketCash__fxPreview--querying'
        aria-live='polite'
       >
        Converting to {accountingCurrency.toUpperCase()}…
       </span>
      )}

      {conversion.status === 'resolved' && convertedText && (
       <RateTooltip tipText={rateTooltipText} surface='light'>
        <span className='pocketCash__fxPreview'>{convertedText}</span>
       </RateTooltip>
      )}
     </div>

     <div className='pocketCash__amountRow'>
      {/* The date leads the figure it qualifies: the amount is the decision's
          headline and the day is a fact about that decision, so the field
          reads as one sentence — this much, on this day. The row already held
          the figure and its unit, so a third part costs it no line. */}
      <TransactionDateTrigger {...dateProps} />

      <input
       id='pocketCashAmount'
       className='pocketCash__amount'
       type='text'
       inputMode='decimal'
       autoComplete='off'
       maxLength={15}
       value={amountText}
       onChange={(event) => setAmountText(event.target.value)}
       disabled={isSubmitting}
       ref={amountRef}
      />

      <CurrencyBadge
       // The tracker's square, and the same one: this field is the tracker's
       // amount field in a modal — a figure, its unit and the day — so the
       // unit is drawn the way that field draws it. 'light' rendered it as
       // bare text, which read as a caption rather than as the control it is.
       variant={'tracker'}
       updateOutsideCurrencyData={setTypedCurrency}
       currency={typedCurrency}
      />
     </div>
    </div>

    {ceilingText && selected && (
     <p className='pocketCash__ceiling'>
      Up to {ceilingText} from {selected.accountName}
     </p>
    )}

    {conversion.status === 'failed' && (
     <div className='pocketCash__fxFailure' role='status'>
      <span className='pocketCash__fxFailureText'>
       No rate for {typedCurrency.toUpperCase()} right now. The amount is still
       sent; the server resolves the rate when it writes the row.
      </span>

      <button
       type='button'
       className='pocketCash__fxRetry'
       onClick={conversion.retry}
       disabled={isSubmitting}
      >
       Retry
      </button>
     </div>
    )}

    {errorMessage && (
     <p className='pocketCash__error' role='alert'>
      {errorMessage}
     </p>
    )}

    <div className='pocketCash__actions'>
     <button
      type='button'
      className='pocketCash__button pocketCash__button--quiet'
      onClick={onClose}
      disabled={isSubmitting}
     >
      Cancel
     </button>

     <button
      type='button'
      className='pocketCash__button pocketCash__button--confirm'
      onClick={() => void onSubmit()}
      disabled={isSubmitting || selectedAccountId === null || !isAmountUsable}
     >
      {isSubmitting ? copy.pending : copy.submit}
     </button>
    </div>
   </div>
  </div>,
  document.body,
 );
}

export default PocketCashModal;
