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
import { numberFormatCurrency } from '../../../../helpers/functions.ts';
import CurrencyBadge from '../../../../general_components/currencyBadge/CurrencyBadge.tsx';
import PocketSourcePicker, {
 PocketSourceOption,
} from './PocketSourcePicker.tsx';
import { CurrencyType } from '../../../../types/types.ts';
import {
 PocketAllocationBody,
 PocketEligibleAccount,
 PocketSource,
} from '../../../../types/pocketTypes.ts';

import './styles/pocketCashModal-styles.css';

const TITLE_ID = 'pocketCashTitle';

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

type PocketCashModalPropType = {
 pocketId: number;
 pocketName: string;
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
 currency,
 direction,
 sources,
 onClose,
}: PocketCashModalPropType) {
 const panelRef = useRef<HTMLDivElement>(null);
 const amountRef = useRef<HTMLInputElement>(null);

 const copy = COPY[direction];

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

 useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
   if (event.key === 'Escape' && !isSubmitting) onClose();
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => window.removeEventListener('keydown', handleKeyDown);
 }, [onClose, isSubmitting]);

 // What makes the panel actually modal, and neither half works without the
 // other. The dialog role announces a modal; it does not enforce one, and
 // without this the page behind stays tabbable and scrollable under the
 // overlay. The inert attribute goes on the application root because the header
 // and the bottom navbar are rendered outside whichever screen mounted this.
 //
 // The overflow is captured and restored rather than cleared: another overlay
 // may already hold the lock.
 useEffect(() => {
  const root = document.getElementById('root');
  const previousOverflow = document.body.style.overflow;
  const previouslyFocused = document.activeElement;

  root?.setAttribute('inert', '');
  document.body.style.overflow = 'hidden';

  return () => {
   root?.removeAttribute('inert');
   document.body.style.overflow = previousOverflow;
   // After the attribute is removed and never before: focusing a node still
   // inside inert content is a no-op.
   if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  };
 }, []);

 useEffect(() => {
  panelRef.current?.focus();
 }, []);

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
   <div
    className='pocketCash__panel'
    role='dialog'
    aria-modal='true'
    aria-labelledby={TITLE_ID}
    ref={panelRef}
    tabIndex={-1}
   >
    <h2 className='pocketCash__title' id={TITLE_ID}>
     {copy.title} · {pocketName}
    </h2>

    <p className='pocketCash__body'>{copy.explanation}</p>

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
      variant={'form'}
      updateOutsideCurrencyData={setTypedCurrency}
      currency={typedCurrency}
     />
    </div>

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
