// frontend/src/fintrack/editionAndDeletion/pages/deletionAccount/UIComponents/closeAccountUI/CloseAccountUI.tsx

import { useId, useMemo, useState } from 'react';

import { UseCloseAccountReturnType } from '../../../../hooks/useCloseAccount.ts';
import { ModalStatusType } from '../../../../types/deletionTypes.ts';
import { DictionaryDataType } from '../../../../utils/languages.ts';

import { StandardDeletionDialog } from '../standardDeletionUI/StandardDeletionDialog.tsx';
import CharacterCounter from '../../../../../general_components/characterCounter/CharacterCounter.tsx';

import './closeAccountUI.css';

// ==========================
// 🎯 CLOSE ACCOUNT
//
// CLOSE IS A LIFECYCLE OPERATION, NOT AN ACCOUNTING ONE, and every choice in
// this component follows from that. It does not settle, transfer, discard or
// reverse anything: it refuses an account that still holds a balance, and on
// an account holding nothing it releases the pockets that account was backing,
// stops a category budget's month series, writes the closure into
// account_registry and deletes the account row.
//
// So the screen has two jobs the SOFT and HARD dialogs do not have:
//  - say up front whether the close will be ACCEPTED, because the balance
//    decides that and the owner cannot see it from the menu they came from;
//  - collect a reason, which the database requires rather than the interface
//    preferring - migration 035's chk_close_reason_accompanies_closure refuses
//    a closure stamp without one.
// ==========================
export type CloseAccountUIPropType = {
 t: (keyText: keyof DictionaryDataType) => string;
 isOpen: boolean;
 targetAccountId: number | string;
 targetAccountName: string;
 // The account's type name, used for one thing only: a category budget's
 // budget is deleted with the account, and the owner is told before he
 // confirms rather than after.
 targetAccountType: string;
 // The close state, owned by the page. It lives up there because the balance
 // decides whether the annulment is still offered beside this dialog, and a
 // second call to the hook here would fetch the same preview twice.
 close: UseCloseAccountReturnType;
 onClose: () => void;
 // Called once, only after a successful close - the caller navigates away
 // since the account row no longer exists.
 onClosed: () => void;
 // WHICH OPERATION THIS DIALOG CONFIRMS, and it changes three things: the
 // title and the confirm label, whether a blocking balance still disables the
 // button, and whether the boundary statement is shown.
 //
 // The page decides it, not this dialog, because the page is where the balance
 // is already known and where the trigger button carries the same name. A
 // checkbox in here would let the owner open "reverse and close" and confirm
 // something else.
 isBalanceReversed?: boolean;
};

export const CloseAccountUI = ({
 t,
 isOpen,
 targetAccountName,
 targetAccountType,
 close,
 onClose,
 onClosed,
 isBalanceReversed = false,
}: CloseAccountUIPropType) => {
// The schema's ceiling on the reason (036's chk_close_reason_length), restated
// here so the field stops at it rather than letting the owner write past it and
// meet a refusal on submit. The form is the courtesy; the database is the
// enforcement, and neither replaces the other.
const CLOSE_REASON_MAX_LENGTH = 255;

 const reasonFieldId = useId();
 const [closeReason, setCloseReason] = useState('');

 const {
  residual,
  netWorth,
  canClose,
  isLoadingPreview,
  previewError,
  executeClose,
  isClosing,
  closeResult,
  fetchLoadError,
 } = close;

 const status: ModalStatusType = isClosing
  ? 'executing'
  : fetchLoadError
   ? 'error'
   : closeResult
    ? 'success'
    : 'idle';

 const trimmedReason = closeReason.trim();

 // Three separate conditions, deliberately not folded into one: the preview
 // has not answered yet, the preview says the balance refuses the close, and
 // the owner has not written a reason. Each has its own sentence below, so a
 // disabled button always has a visible cause beside it.
 // canClose DROPS OUT OF THIS WHEN THE BALANCE IS BEING REVERSED, and that is
 // the whole point of the operation rather than an exception to the rule: the
 // reversal exists to make a blocking balance closeable, so a button that
 // refuses on the balance it is about to neutralise would never be pressable.
 // The other three conditions still hold - a preview that has not answered or
 // failed leaves the reversal without an amount to state.
 const isConfirmDisabled =
  isLoadingPreview ||
  !!previewError ||
  (!canClose && !isBalanceReversed) ||
  trimmedReason.length === 0;

 const successMessage = useMemo(
  () =>
   t('closeAccountSuccessMessage').replace(
    '{targetAccountName}',
    targetAccountName,
   ),
  [t, targetAccountName],
 );

 // The refusal, quoted before the owner meets it. Reads the balance the
 // preview returned rather than any stored figure, because that is the same
 // expression the engine derives its own refusal from.
 const balanceWarning = useMemo(() => {
  if (isLoadingPreview || previewError || canClose || residual === null) {
   return undefined;
  }
  // THE SAME BALANCE, TWO DIFFERENT SENTENCES. Under the plain close it is a
  // refusal and names the remedy. Under the reversal it is not a refusal at
  // all - it states what is about to be moved and where - so quoting the
  // refusal here would tell the owner the button will fail while it is about
  // to succeed.
  if (isBalanceReversed) {
   return t('closeAccountReversalNotice').replace('{residual}', residual);
  }
  return t('closeAccountBlockedByBalance').replace('{residual}', residual);
 }, [canClose, isBalanceReversed, isLoadingPreview, previewError, residual, t]);

 const handleConfirm = () => {
  executeClose(closeReason, isBalanceReversed);
 };

 const handleClose = () => {
  if (status === 'success') {
   onClosed();
   return;
  }
  onClose();
 };

 return (
  <StandardDeletionDialog
   t={t}
   isOpen={isOpen}
   variant="hard"
   title={t(
    isBalanceReversed ? 'closeAccountReverseTitle' : 'closeAccountTitle',
   )}
   description={t(
    isBalanceReversed
     ? 'closeAccountReverseDescription'
     : 'closeAccountDescription',
   )}
   warning={balanceWarning}
   confirmLabel={t(
    isBalanceReversed
     ? 'closeAccountReverseConfirmButton'
     : 'closeAccountConfirmButton',
   )}
   confirmDisabled={isConfirmDisabled}
   successMessage={successMessage}
   errorMessage={fetchLoadError}
   status={status}
   onConfirm={handleConfirm}
   onClose={handleClose}
  >
   <div className="close-account__fields">
    {/* THE BALANCE, IN THREE DISTINCT STATES. A missing figure renders as a
        skeleton or a dash, never as 0 - a zero here would read as "this
        account is empty and will close", which is the opposite of unknown. */}
    <p className="close-account__balance-row">
     <span className="close-account__balance-label">
      {t('closeAccountBalanceLabel')}
     </span>

     {isLoadingPreview ? (
      <span
       className="close-account__balance-skeleton"
       aria-label={t('loading')}
      />
     ) : previewError || residual === null ? (
      <span className="close-account__balance-value">&mdash;</span>
     ) : (
      <span
       className={`close-account__balance-value${
        canClose ? '' : ' close-account__balance-value--blocking'
       }`}
      >
       {residual}
      </span>
     )}
    </p>

    {/* WHAT THE CLOSE DOES TO NET WORTH, on the reversal path only. The plain
        close refuses any balance that is not zero, so its before and after are
        the same figure written twice. Guarded on the same three states as the
        balance above, and on the key being present at all: a frontend released
        ahead of the backend that serves it renders nothing here. */}
    {isBalanceReversed &&
     netWorth &&
     !isLoadingPreview &&
     !previewError && (
      <div className="close-account__net-worth" role="note">
       <p className="close-account__net-worth-title">
        {t('closeNetWorthSectionLabel')}
       </p>

       <p className="close-account__balance-row">
        <span className="close-account__balance-label">
         {t('closeNetWorthBeforeLabel')}
        </span>
        <span className="close-account__balance-value">{netWorth.before}</span>
       </p>

       <p className="close-account__balance-row">
        <span className="close-account__balance-label">
         {t('closeNetWorthAfterLabel')}
        </span>
        <span className="close-account__balance-value">{netWorth.after}</span>
       </p>

       {/* The two figures are equal here, and without this line that reads as
           a bug rather than as the answer. */}
       {!netWorth.countsTowardNetWorth && (
        <p className="close-account__net-worth-note">
         {t('closeNetWorthUnchangedNote')}
        </p>
       )}
      </div>
     )}

    {/* THE BUDGET GOES WITH THE ACCOUNT. The owner ruled on 2026-09-07 that a
        category budget's budget is deleted with its account; he ruled on
        2026-09-08 that the owner is told before confirming, because the close
        does not come back. Only this type carries one, so only this type
        shows the line. */}
    {targetAccountType === 'category_budget' && (
     <p className="close-account__budget-warning" role="note">
      {t('closeAccountBudgetWarning')}
     </p>
    )}

    {previewError && (
     <p className="close-account__preview-error" role="alert">
      {t('closeAccountPreviewError')}
     </p>
    )}

    {/* THE REASON. Required by the schema, so the label says so rather than
        letting the owner discover it in a 400. */}
    <label className="close-account__label" htmlFor={reasonFieldId}>
     {t('closeAccountReasonLabel')}
     <CharacterCounter
      value={closeReason}
      maxLength={CLOSE_REASON_MAX_LENGTH}
     />
    </label>

    <textarea
     id={reasonFieldId}
     className="close-account__reason"
     value={closeReason}
     onChange={(event) => setCloseReason(event.target.value)}
     placeholder={t('closeAccountReasonPlaceholder')}
     rows={3}
     maxLength={CLOSE_REASON_MAX_LENGTH}
     required
     aria-required="true"
     disabled={isClosing}
    />

    <p className="close-account__hint">{t('closeAccountReasonHint')}</p>
   </div>
  </StandardDeletionDialog>
 );
};

export default CloseAccountUI;
