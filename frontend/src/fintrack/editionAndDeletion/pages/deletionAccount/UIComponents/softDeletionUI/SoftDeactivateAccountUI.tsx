// frontend/src/fintrack/editionAndDeletion/pages/deletionAccount/UIComponents/softDeletionUI/SoftDeactivateAccountUI.tsx

import { useMemo } from 'react';

import { useStandardAccountDeletion } from '../../../../hooks/useStandardAccountDeletion.ts';
import { DELETION_TYPE_SOFT, ModalStatusType } from '../../../../types/deletionTypes.ts';
import { DictionaryDataType } from '../../../../utils/languages.ts';

import { StandardDeletionDialog } from '../standardDeletionUI/StandardDeletionDialog.tsx';

// ==========================
// 🎯 SOFT DEACTIVATION TRIGGER
// ACCOUNT_DELETION_METHODS.md §1: a one-column UPDATE (deleted_at), fully
// reversible, no admin check and no impact report needed - the lightweight
// sibling of RTA and HARD, so its copy and confirm button read as low-stakes
// rather than as a scary red dialog.
// ==========================
export type SoftDeactivateAccountUIPropType = {
 t: (keyText: keyof DictionaryDataType) => string;
 isOpen: boolean;
 targetAccountId: number | string;
 targetAccountName: string;
 onClose: () => void;
 // Called once, only after a successful deactivation - the caller navigates
 // away since the account just left the active list.
 onDeactivated: () => void;
};

export const SoftDeactivateAccountUI = ({
 t,
 isOpen,
 targetAccountId,
 targetAccountName,
 onClose,
 onDeactivated,
}: SoftDeactivateAccountUIPropType) => {
 const { executeStandardDeletion, isExecutingDeletion, deletionResult, fetchLoadError } =
  useStandardAccountDeletion(DELETION_TYPE_SOFT, targetAccountId);

 const status: ModalStatusType = isExecutingDeletion
  ? 'executing'
  : fetchLoadError
   ? 'error'
   : deletionResult
    ? 'success'
    : 'idle';

 const successMessage = useMemo(
  () =>
   t('softDeactivateSuccessMessage').replace(
    '{targetAccountName}',
    targetAccountName,
   ),
  [t, targetAccountName],
 );

 const handleConfirm = () => {
  executeStandardDeletion();
 };

 const handleClose = () => {
  if (status === 'success') {
   onDeactivated();
   return;
  }
  onClose();
 };

 return (
  <StandardDeletionDialog
   t={t}
   isOpen={isOpen}
   variant="soft"
   title={t('softDeactivateTitle')}
   description={t('softDeactivateDescription')}
   confirmLabel={t('softDeactivateConfirmButton')}
   successMessage={successMessage}
   errorMessage={fetchLoadError}
   status={status}
   onConfirm={handleConfirm}
   onClose={handleClose}
  />
 );
};

export default SoftDeactivateAccountUI;
