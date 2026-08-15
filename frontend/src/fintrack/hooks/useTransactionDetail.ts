// frontend/src/fintrack/hooks/useTransactionDetail.ts
// The state of the transaction detail modal: which transaction is open, whether
// it is still on the wire, and how it failed. It lived inside ListContent, which
// meant any other list wanting the same modal had to copy the fetch.

import { useCallback, useState } from 'react';

import { authFetch } from '../../auth/auth_utils/authFetch';
import { url_get_transaction_by_id } from '../../urlConfig';
import { TransactionDetailType } from '../types/responseApiTypes';

export function useTransactionDetail() {
 const [selectedTransaction, setSelectedTransaction] =
  useState<TransactionDetailType | null>(null);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const openTransaction = useCallback(async (transactionId: number) => {
  // A row with no id is a row of a list that does not carry one, not a failure
  // worth reporting to the reader.
  if (!transactionId) return;

  setIsLoading(true);
  setError(null);

  try {
   const response = await authFetch<TransactionDetailType>(
    `${url_get_transaction_by_id}${transactionId}`,
   );
   setSelectedTransaction(response.data);
  } catch (err) {
   // Kept as state and not only logged: the caller decides whether to show it,
   // and a silent failure reads as a modal that simply never opens.
   setError(
    err instanceof Error ? err.message : 'Failed to load the transaction',
   );
  } finally {
   setIsLoading(false);
  }
 }, []);

 const closeTransaction = useCallback(() => {
  setSelectedTransaction(null);
  setError(null);
 }, []);

 return {
  selectedTransaction,
  isLoading,
  error,
  openTransaction,
  closeTransaction,
 };
}
