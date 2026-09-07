// 📄 frontend/src/fintrack/editionAndDeletion/hooks/useStandardAccountDeletion.ts
import { useCallback, useMemo } from 'react';

import { useFetchLoad } from '../../hooks/useFetchLoad.ts';
import { useAccountStore } from '../../stores/useAccountStore.ts';

import { url_account_delete } from '../../../urlConfig.ts';

import {
  StandardDeletionMethodType,
  StandardDeletionResponseType,
  StandardExecutionPayloadType,
} from '../types/deletionTypes.ts';

//==================================
// 🎣 CUSTOM HOOK: SOFT / HARD ACCOUNT DELETION
// useStandardAccountDeletion (useStandardAccountDeletion.ts)
//
// Deliberately separate from useRTAImpactAndDeletion.ts: SOFT and HARD read
// their method from the DELETE request's query string and need no impact
// report GET ahead of them (ACCOUNT_DELETION_METHODS.md §1, §2, §6), so this
// hook fetches nothing on mount and the RTA hook stays untouched.
// =================================
export const useStandardAccountDeletion = (
  deletionType: StandardDeletionMethodType,
  targetAccountId: number | string,
) => {
  // ---------------------------------
  // 1. 🔗 URL: the method is a query param, not a route
  // ---------------------------------
  const deletionUrl = useMemo(
    () => `${url_account_delete(targetAccountId)}?type=${deletionType}`,
    [targetAccountId, deletionType],
  );

  // ---------------------------------
  // 2. 💣 DELETE EXECUTION (MANUAL FETCH LOAD)
  // ---------------------------------
  const removeAccountFromStore = useAccountStore(
    (state) => state.removeAccount,
  );

  const {
    requestFn: executeDeletionApiCall,
    isLoading: isExecutingDeletion,
    data: deletionResult,
    error: fetchLoadError,
    resetFn: resetDeletionState,
  } = useFetchLoad<StandardDeletionResponseType, StandardExecutionPayloadType>({
    url: deletionUrl,
    method: 'DELETE',
  });

  // ---------------------------------
  // 3. 💣 EXECUTION LOGIC (SOFT or HARD, per the deletionType this hook was
  //    instantiated with)
  // ---------------------------------
  const executeStandardDeletion = useCallback(async () => {
    if (!targetAccountId || String(targetAccountId).trim().length === 0) {
      return { success: false, message: 'Invalid account ID' };
    }

    const payload: StandardExecutionPayloadType = { deletionType };

    const { data: executionData, error: executionError } =
      await executeDeletionApiCall(payload);

    if (executionError || !executionData) {
      return {
        success: false,
        message: executionError || 'Deletion failed due to unknown API error',
        error: executionError,
      };
    }

    // ✅ Both SOFT (deleted_at set) and HARD (row erased) remove the account
    // from the active list the same way RTA's hook does - AccountingDashboard
    // only ever lists accounts with deleted_at IS NULL.
    removeAccountFromStore(targetAccountId);

    return {
      success: true,
      data: executionData,
      message: executionData.message,
      error: null,
    };
  }, [deletionType, executeDeletionApiCall, removeAccountFromStore, targetAccountId]);

  // ---------------------------------
  // 4. 🔄 RETURN VALUES
  // ---------------------------------
  return {
    executeStandardDeletion,
    isExecutingDeletion,
    deletionResult,
    fetchLoadError,
    resetDeletionState,
  };
};
