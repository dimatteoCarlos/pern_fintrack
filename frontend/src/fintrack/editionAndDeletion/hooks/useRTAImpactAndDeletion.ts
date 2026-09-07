// 📄 frontend/src/edition/hooks/useRTAImpactAndDeletion.ts
import { useCallback, useMemo } from 'react';

import { useFetch } from '../../hooks/useFetch.ts';
import { useFetchLoad } from '../../hooks/useFetchLoad.ts';
import { useAccountStore } from '../../stores/useAccountStore.ts';

import {
  url_account_delete,
  url_report_of_affected_accounts,
} from '../../../urlConfig.ts';

import {
  DELETION_TYPE_RTA,
  ReportResponseType,
  DeletionSuccessDataType,
  RTAExecutionPayloadType,
} from '../types/deletionTypes.ts';

//==================================
// 🎣 CUSTOM HOOK:FOR RTA ACCOUNT DELETION
// useRTAImpactAndDeletion (useRTAImpactAndDeletion.ts)
// =================================
export const useRTAImpactAndDeletion = (
  targetAccountId: number | string,
  targetAccountName: string,
) => {
  // ---------------------------------
  // 1. Validate inputs early and Build URLs
  // ---------------------------------
  const isValidAccountId = useMemo(
    () => !!targetAccountId && String(targetAccountId).trim().length > 0,
    [targetAccountId],
  );
  // ---------------------------------
  // 🔗 URL BLOCK: Build URL from endpoints
  // ---------------------------------
  const getUrl = isValidAccountId
    ? url_report_of_affected_accounts(targetAccountId)
    : null;

  const deletionUrl = url_account_delete(targetAccountId); //what to do if arg is invalid
  // ---------------------------------
  // 2. 📝 GET AFFECTED ACCOUNTS IMPACT REPORT (AUTOMATIC FETCH)
  // ---------------------------------
  const {
    apiData: reportResponse, //data, message, status
    isLoading: isLoadingReport,
    error: reportError,
    // status:fetchUseStatus,
  } = useFetch<ReportResponseType>(getUrl);

  // Extract impact report from response
  const affectedAccountReport = useMemo(
    () => reportResponse?.data?.impactReport || [],
    [reportResponse?.data?.impactReport],
  );

  // The total the server folded. Read, not recomputed: a sum over
  // affectedAccountReport is short by the unattributed amount, which is
  // exactly what the component used to do.
  //
  // null, not 0, when the field is absent. 0 is a real total and a dash is
  // not, so the two cannot share a value.
  const totalNetAdjustmentAmount =
    reportResponse?.data?.totalNetAdjustmentAmount ?? null;

  // Zero is the ordinary answer and renders no line at all, so null and 0
  // reach the screen the same way here and the distinction costs nothing.
  const unattributedAmount = reportResponse?.data?.unattributedAmount ?? null;
  const unattributedTransactionCount =
    reportResponse?.data?.unattributedTransactionCount ?? null;

  // Pockets losing backing from this account (POCKET_MODULE_SPEC.md §11.1
  // Q8b) - preview only, shown to the owner ahead of confirmation.
  const pocketImpact = useMemo(
    () => reportResponse?.data?.pocketImpact || [],
    [reportResponse?.data?.pocketImpact],
  );

  // console.log('fetchUse data structure:',
  //  {reportResponse}, {isLoadingReport}, {reportError},{fetchUseStatus}, 'apidata data:', reportResponse?.data )

  // console.log({fetchUseStatus})
  // ---------------------------------
  // 3.💣 DELETE EXECUTION (MANUAL FETCH LOAD)
  // ---------------------------------
  //store state
  const removeAccountFromStore = useAccountStore(
    (state) => state.removeAccount,
  ); //useAccountStore().removeAccount

  const {
    requestFn: executeDeletionApiCall,
    isLoading: isExecutingDeletion,
    data: deletionResult,
    error: fetchLoadError,
    resetFn: resetDeletionState, // ⬅️ Retorna la función de reseteo
  } = useFetchLoad<DeletionSuccessDataType, RTAExecutionPayloadType>({
    url: deletionUrl,
    method: 'DELETE',
  });

  // console.log('fetchLoad:',
  // 'isLoading:',
  // isExecutingDeletion,
  // 'data Deletion Result:', deletionResult,
  // 'error:',fetchLoadError)

  // ---------------------------------
  // Definition of deletion account function  (executeRTAAnnulment)
  // 4. 💣 EXECUTION LOGIC (RTA Annulment))
  // ---------------------------------
  //builds payload and the executing DELETE request
  const executeRTAAnnulment = useCallback(async () => {
    if (!targetAccountId || String(targetAccountId).trim().length === 0) {
      return { success: false, message: 'Invalid account ID' };
    }

    // 1. Build the RTA Payload (Body for the DELETE request)
    // impactReport is not sent: the backend recomputes it itself inside the
    // locked transaction (unit 6, 2026-09-06) and no longer reads this field.
    const payload: RTAExecutionPayloadType = {
      deletionType: DELETION_TYPE_RTA,
      targetAccountName,
    };

    // 2. Execute the DELETE API call
    const { data: executionDeletionData, error: executionDeletionError } =
      await executeDeletionApiCall(payload);
    // console.log('execution deletion response', executionDeletionData,executionDeletionError)

    if (executionDeletionError || !executionDeletionData) {
      const errorMessage =
        executionDeletionError || 'Deletion failed due to unknown API ERROR';
      return {
        success: false,
        message: `Failed to execute RTA annulment: ${errorMessage}`,
        error: executionDeletionError,
      };
    }

    // 3. 🗑️ SUCCESS:Update global state by removing the account
    removeAccountFromStore(targetAccountId);

    return {
      success: true,
      data: executionDeletionData,
      message: `RTA Annulment successful for ${targetAccountName}.`,
      error: null,
    };
  }, [
    affectedAccountReport,
    executeDeletionApiCall,
    removeAccountFromStore,
    targetAccountId,
    targetAccountName,
  ]);

  // ---------------------------------
  // 6. 🔄 RETURN VALUES
  // ---------------------------------
  return {
    //Data and status from the GET request
    affectedAccountReport,
    totalNetAdjustmentAmount,
    unattributedAmount,
    unattributedTransactionCount,
    pocketImpact,
    isLoadingReport,
    reportError,

    //DELETE execution request
    executeRTAAnnulment,

    // Write States (DELETE Execution)
    isExecutingDeletion,
    deletionResult,
    fetchLoadError,
    resetDeletionState, // ⬅️ Retorna la función de reset

    //Required parameters,
    targetAccountId,
    targetAccountName,
  };
};
