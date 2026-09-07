// frontend/src/fintrack/editionAndDeletion/pages/deletionAccount/UIComponents/hardDeletionUI/HardDeleteConfirmationUI.tsx

import { useMemo } from 'react';

import { useStandardAccountDeletion } from '../../../../hooks/useStandardAccountDeletion.ts';
import { DELETION_TYPE_HARD, ModalStatusType } from '../../../../types/deletionTypes.ts';
import { DictionaryDataType } from '../../../../utils/languages.ts';

import { StandardDeletionDialog } from '../standardDeletionUI/StandardDeletionDialog.tsx';

// ==========================
// 🎯 HARD DELETE CONFIRMATION
// ACCOUNT_DELETION_METHODS.md §2: permanent erase, no reversal of the
// financial impact this account had on any counterparty - the contrast with
// RTA above is the whole point of this screen, so its warning copy states
// that explicitly instead of relabelling RTA's button (the pre-existing
// "Confirm Hard Deletion" label on the RTA dialog is cosmetic and still
// executes RTA underneath; this screen is the real path).
//
// The backend gate that should restrict this to admins is known to be
// permissive for every role today (ACCOUNT_DELETION_METHODS.md §2) - a
// backend-owned bug, not mirrored here with a client-side role check that
// would only hide the action inconsistently with what the API actually
// allows.
// ==========================
export type HardDeleteConfirmationUIPropType = {
 t: (keyText: keyof DictionaryDataType) => string;
 isOpen: boolean;
 targetAccountId: number | string;
 targetAccountName: string;
 onClose: () => void;
 // Called once, only after a successful erase - the caller navigates away
 // since the account no longer exists.
 onErased: () => void;
};

export const HardDeleteConfirmationUI = ({
 t,
 isOpen,
 targetAccountId,
 targetAccountName,
 onClose,
 onErased,
}: HardDeleteConfirmationUIPropType) => {
 const { executeStandardDeletion, isExecutingDeletion, deletionResult, fetchLoadError } =
  useStandardAccountDeletion(DELETION_TYPE_HARD, targetAccountId);

 const status: ModalStatusType = isExecutingDeletion
  ? 'executing'
  : fetchLoadError
   ? 'error'
   : deletionResult
    ? 'success'
    : 'idle';

 const successMessage = useMemo(
  () =>
   t('hardDeleteSuccessMessage').replace('{targetAccountName}', targetAccountName),
  [t, targetAccountName],
 );

 const handleConfirm = () => {
  executeStandardDeletion();
 };

 const handleClose = () => {
  if (status === 'success') {
   onErased();
   return;
  }
  onClose();
 };

 return (
  <StandardDeletionDialog
   t={t}
   isOpen={isOpen}
   variant="hard"
   title={t('hardDeleteTitle')}
   description={t('hardDeleteDescription')}
   warning={t('hardDeleteWarning')}
   confirmLabel={t('hardDeleteConfirmButton')}
   successMessage={successMessage}
   errorMessage={fetchLoadError}
   status={status}
   onConfirm={handleConfirm}
   onClose={handleClose}
  />
 );
};

export default HardDeleteConfirmationUI;
