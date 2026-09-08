// frontend/src/fintrack/editionAndDeletion/pages/deletionAccount/UIComponents/closeAccountUI/CloseAccountUI.tsx

import { useId, useMemo, useState } from 'react';

import { useCloseAccount } from '../../../../hooks/useCloseAccount.ts';
import { ModalStatusType } from '../../../../types/deletionTypes.ts';
import { DictionaryDataType } from '../../../../utils/languages.ts';

import { StandardDeletionDialog } from '../standardDeletionUI/StandardDeletionDialog.tsx';

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
 onClose: () => void;
 // Called once, only after a successful close - the caller navigates away
 // since the account row no longer exists.
 onClosed: () => void;
};

export const CloseAccountUI = ({
 t,
 isOpen,
 targetAccountId,
 targetAccountName,
 onClose,
 onClosed,
}: CloseAccountUIPropType) => {
 const reasonFieldId = useId();
 const [closeReason, setCloseReason] = useState('');

 const {
  residual,
  canClose,
  isLoadingPreview,
  previewError,
  executeClose,
  isClosing,
  closeResult,
  fetchLoadError,
 } = useCloseAccount(targetAccountId);

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
 const isConfirmDisabled =
  isLoadingPreview || !!previewError || !canClose || trimmedReason.length === 0;

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
  return t('closeAccountBlockedByBalance').replace('{residual}', residual);
 }, [canClose, isLoadingPreview, previewError, residual, t]);

 const handleConfirm = () => {
  executeClose(closeReason);
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
   title={t('closeAccountTitle')}
   description={t('closeAccountDescription')}
   warning={balanceWarning}
   confirmLabel={t('closeAccountConfirmButton')}
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

    {previewError && (
     <p className="close-account__preview-error" role="alert">
      {t('closeAccountPreviewError')}
     </p>
    )}

    {/* THE REASON. Required by the schema, so the label says so rather than
        letting the owner discover it in a 400. */}
    <label className="close-account__label" htmlFor={reasonFieldId}>
     {t('closeAccountReasonLabel')}
    </label>

    <textarea
     id={reasonFieldId}
     className="close-account__reason"
     value={closeReason}
     onChange={(event) => setCloseReason(event.target.value)}
     placeholder={t('closeAccountReasonPlaceholder')}
     rows={3}
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
