// frontend/src/fintrack/hooks/useTransactionDate.ts

// The day a tracker entry is recorded on, and the window it may move in.
//
// Four forms ask the same three questions of it — which day is chosen, which
// days may be chosen, and which accounts already existed on it — so it is
// answered once here instead of copied into each of them.
//
// The server validates the same window independently. Nothing here is the
// guarantee: it keeps the form from offering what would come back as a 422.

import { useCallback, useMemo, useState } from 'react';

import { toCalendarDay } from '../helpers/functions';
import { TransactionDatePropsType } from '../general_components/transactionDateTrigger/TransactionDateTrigger';

export function useTransactionDate(disabled = false) {
 const [transactionDate, setTransactionDate] = useState<Date>(() => new Date());

 // Resolved once per mount: the first day of the current month, and today, on
 // the device's calendar.
 const { minDate, maxDate } = useMemo(() => {
  const now = new Date();

  return {
   minDate: new Date(now.getFullYear(), now.getMonth(), 1),
   maxDate: now,
  };
 }, []);

 // What the payload carries. Read off the local parts, so a choice made in the
 // evening west of UTC does not arrive as the following day.
 const transactionActualDate = toCalendarDay(transactionDate);

 // An account may take a movement only from its opening day onward. Both sides
 // are YYYY-MM-DD, which compares correctly as text and needs no second Date to
 // disagree with the first.
 //
 // An account whose opening the payload does not carry is admitted rather than
 // hidden: the server still refuses it, and hiding on missing data would empty
 // the list on a contract change instead of failing where it can be seen.
 const isOpenOnChosenDay = useCallback(
  (accountStartDate: string | Date | null | undefined) => {
   if (!accountStartDate) return true;

   const opening = new Date(accountStartDate);
   if (Number.isNaN(opening.getTime())) return true;

   return toCalendarDay(opening) <= transactionActualDate;
  },
  [transactionActualDate],
 );

 const dateProps: TransactionDatePropsType = useMemo(
  () => ({
   date: transactionDate,
   changeDate: setTransactionDate,
   minDate,
   maxDate,
   disabled,
  }),
  [transactionDate, minDate, maxDate, disabled],
 );

 return {
  transactionDate,
  setTransactionDate,
  transactionActualDate,
  isOpenOnChosenDay,
  dateProps,
 };
}
