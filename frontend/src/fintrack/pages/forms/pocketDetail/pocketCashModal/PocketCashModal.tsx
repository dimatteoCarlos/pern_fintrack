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
import useAuth from '../../../../../auth/hooks/useAuth.ts';
import { isIanaTimeZone } from '../../../../../auth/auth_utils/timeZoneOptions.ts';

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
 }
> = {
 allocate: {
  title: 'Commit cash',
  explanation:
   'The account keeps every cent. What changes is how much of it is already promised to a goal.',
  ceilingLabel: 'Unassigned',
  submit: 'Commit',
  pending: 'Committing…',
 },
 release: {
  title: 'Release cash',
  explanation:
   'The goal stops holding this. It returns to the account as cash no plan has claimed.',
  ceilingLabel: 'Held here',
  submit: 'Release',
  pending: 'Releasing…',
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
 const options = useMemo<PocketSourceOption[]>(() => {
  if (direction === 'release') {
   return sources.map((source) => ({
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

  return (banks ?? []).map((bank) => ({
   accountId: bank.account_id,
   accountName: bank.account_name,
   balance: bank.account_balance,
   // Absent rather than zero when the allocation read could not answer for the
   // row, and the server then applies the real bound.
   committed: bank.allocated ?? null,
   ceiling: bank.unassignedCash ?? null,
  }));
 }, [direction, sources, banks]);

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
 const conversion = useServerCurrencyConversion(amountText, typedCurrency);

 const accountingCurrency = useCurrencyStore((state) => {
  return state.accountingCurrency;
 });

 // The zone the reading below is stated in. The account's own, not the
 // browser's: the two disagree for an owner who travels.
 const { userData } = useAuth();

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
 const quoteLine = conversion.quote
  ? `1 ${accountingCurrency.toUpperCase()} = ${numberFormatCurrency(
     conversion.quote.rate,
     Math.abs(conversion.quote.rate) < 10 ? 4 : 2,
     undefined,
     'es-ES',
    )} ${conversion.quote.currency.toUpperCase()}`
  : '';

 // The account's own zone, named in the line. toLocaleString with no arguments
 // renders the browser's locale and zone silently, so a reading is read as
 // local time by an owner whose account keeps another one. The zone is checked
 // before it is passed: an identifier Intl rejects throws on format.
 const readAtLine = conversion.fetchedAt
  ? `read: ${new Date(conversion.fetchedAt).toLocaleString('es-ES', {
     day: '2-digit',
     month: '2-digit',
     year: 'numeric',
     hour: '2-digit',
     minute: '2-digit',
     hour12: false,
     timeZone: isIanaTimeZone(userData?.timezone)
      ? userData?.timezone
      : undefined,
     timeZoneName: 'short',
    })}`
  : '';

 // Source and reading time come with the rate: a figure resolved from a stale
 // reading is still one the owner is entitled to question.
 const rateTooltipText =
  conversion.convertedAmount !== null && amount > 0
   ? [quoteLine, conversion.source ? `source: ${conversion.source}` : '', readAtLine]
      .filter(Boolean)
      .join('\n')
   : '';

 async function onSubmit() {
  if (selectedAccountId === null || !isAmountUsable) return;

  setIsSubmitting(true);
  setErrorMessage(null);

  const body: PocketAllocationBody = {
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
    <h2 className='pocketCash__title' id={titleId}>
     {copy.title} · {pocketName}
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
         the word carries the sign so the amount never prints one. */}
     <div className='pocketCash__planItem'>
      <dt className='pocketCash__planLabel'>
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

    <label className='pocketCash__label' htmlFor='pocketCashAmount'>
     Amount
    </label>

    <div className='pocketCash__amountRow'>
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
      // This modal's panel is --color-surface-panel (cream), not the dark
      // surface 'form' is aliased to elsewhere -- 'light' names the surface
      // it actually sits on. See CurrencyBadge point 1/7.
      variant={'light'}
      updateOutsideCurrencyData={setTypedCurrency}
      currency={typedCurrency}
     />
    </div>

    {/* Three states, and they are not degrees of one another. A rate the
        server could not resolve used to render exactly like an amount that
        needs no conversion — nothing at all — which is the one case where the
        owner most needs to be told. */}
    {conversion.status === 'querying' && (
     <span
      className='pocketCash__fxPreview pocketCash__fxPreview--querying'
      aria-live='polite'
     >
      Converting to {accountingCurrency.toUpperCase()}…
     </span>
    )}

    {conversion.status === 'resolved' && convertedText && (
     <RateTooltip
      tipText={rateTooltipText}
      surface='light'
      placement='anchor-left'
     >
      <span className='pocketCash__fxPreview'>{convertedText}</span>
     </RateTooltip>
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

    {ceilingText && (
     <p className='pocketCash__ceiling'>
      {copy.ceilingLabel}: {ceilingText}
     </p>
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
