// 📄 frontend/src/fintrack/editionAndDeletion/hooks/useCloseAccount.ts
import { useCallback, useMemo } from 'react';

import { useFetch } from '../../hooks/useFetch.ts';
import { useFetchLoad } from '../../hooks/useFetchLoad.ts';
import { useAccountStore } from '../../stores/useAccountStore.ts';

import {
 url_account_close_preview,
 url_account_delete,
} from '../../../urlConfig.ts';

import {
 CloseExecutionPayloadType,
 ClosePreviewResponseType,
 CloseDeletionResponseType,
 DELETION_TYPE_CLOSE,
} from '../types/deletionTypes.ts';

//==================================
// 🎣 CUSTOM HOOK: CLOSE AN ACCOUNT
// useCloseAccount (useCloseAccount.ts)
//
// Separate from useStandardAccountDeletion for two reasons that both come
// from the engine rather than from the screen.
//
// 1. CLOSE READS BEFORE IT WRITES. SOFT and HARD need nothing ahead of them,
//    so that hook deliberately fetches nothing on mount. CLOSE refuses any
//    balance that is not zero, so the screen has to know the balance before
//    it can say whether the button will work - the same shape as the RTA
//    hook, which fetches its impact report first.
// 2. CLOSE CARRIES A BODY. SOFT and HARD put their method in the query string
//    and send a body only so the request self-documents. CLOSE sends
//    closeReason, which the service requires: it raises 400 before taking its
//    lock when the reason is missing or is only whitespace.
// =================================
export const useCloseAccount = (targetAccountId: number | string) => {
 // ---------------------------------
 // 1. 🔗 URLS
 // ---------------------------------
 const isValidAccountId = useMemo(
  () => !!targetAccountId && String(targetAccountId).trim().length > 0,
  [targetAccountId],
 );

 // Null while the id is unusable, so useFetch does not fire a request that
 // could only 400 - the same guard the RTA hook applies to its report URL.
 const previewUrl = isValidAccountId
  ? url_account_close_preview(targetAccountId)
  : null;

 // The method travels in the body for CLOSE, so no query string here.
 const closeUrl = url_account_delete(targetAccountId);

 // ---------------------------------
 // 2. 📝 CLOSE PREVIEW (AUTOMATIC FETCH)
 // ---------------------------------
 const {
  apiData: previewResponse,
  isLoading: isLoadingPreview,
  error: previewError,
 } = useFetch<ClosePreviewResponseType>(previewUrl);

 const targetAccount = previewResponse?.data?.targetAccount ?? null;

 // Text all the way through, never a number. The server sends the balance as
 // the driver handed it over precisely so nothing rounds it in transit; the
 // only place it is parsed is the zero test below, and that result is a
 // boolean, not a figure to render.
 const residual = targetAccount?.residual ?? null;

 // WHY THIS DECIDES WHETHER THE BUTTON WORKS. CLOSE is a lifecycle operation,
 // not an accounting one: it does not settle, transfer or discard anything,
 // it refuses an account that still holds something. So a nonzero balance is
 // not a warning to show beside the confirm button - it is the reason the
 // request would come back refused, and the screen names it instead.
 const canClose = residual !== null && parseFloat(residual) === 0;

 // ---------------------------------
 // 3. 💣 CLOSE EXECUTION (MANUAL FETCH LOAD)
 // ---------------------------------
 const removeAccountFromStore = useAccountStore(
  (state) => state.removeAccount,
 );

 const {
  requestFn: executeCloseApiCall,
  isLoading: isClosing,
  data: closeResult,
  error: fetchLoadError,
  resetFn: resetCloseState,
 } = useFetchLoad<CloseDeletionResponseType, CloseExecutionPayloadType>({
  url: closeUrl,
  method: 'DELETE',
 });

 const executeClose = useCallback(
  async (closeReason: string) => {
   if (!isValidAccountId) {
    return { success: false, message: 'Invalid account ID' };
   }

   // Trimmed here as well as on the server, and neither check makes the
   // other redundant: this one keeps a reason of spaces from becoming a
   // round trip, the server's is what the schema's own CHECK constraint
   // requires and is the one that cannot be bypassed.
   const reason = closeReason.trim();

   if (reason.length === 0) {
    return { success: false, message: 'A reason is required to close' };
   }

   const payload: CloseExecutionPayloadType = {
    deletionType: DELETION_TYPE_CLOSE,
    closeReason: reason,
   };

   const { data: executionData, error: executionError } =
    await executeCloseApiCall(payload);

   if (executionError || !executionData) {
    return {
     success: false,
     message: executionError || 'Close failed due to unknown API error',
     error: executionError,
    };
   }

   // The account row is gone, not merely marked, so it leaves the active
   // list for the same reason HARD's does. What survives is the
   // account_registry row, which no store on this screen reads.
   removeAccountFromStore(targetAccountId);

   return {
    success: true,
    data: executionData,
    message: executionData.message,
    error: null,
   };
  },
  [
   executeCloseApiCall,
   isValidAccountId,
   removeAccountFromStore,
   targetAccountId,
  ],
 );

 // ---------------------------------
 // 4. 🔄 RETURN VALUES
 // ---------------------------------
 return {
  // preview
  targetAccount,
  residual,
  canClose,
  isLoadingPreview,
  previewError,
  // execution
  executeClose,
  isClosing,
  closeResult,
  fetchLoadError,
  resetCloseState,
 };
};

export default useCloseAccount;
