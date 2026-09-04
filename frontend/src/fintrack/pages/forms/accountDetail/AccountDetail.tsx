//frontend/src/pages/forms/accountDetail/AccountDetail.tsx
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useFetch } from '../../../hooks/useFetch.ts';

import LeftArrowLightSvg from '../../../../assets/LeftArrowSvg.svg';
import AccountEditLink from '../../../general_components/accountEditLink/AccountEditLink.tsx';
import MonthPicker from '../../../general_components/monthPicker/MonthPicker.tsx';

import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import AccountBalanceSummary from '../accountDetailSharedComponents/accountBalanceSummary/AccountBalanceSummary.tsx';
import AccountTransactionsList from '../accountDetailSharedComponents/accountTransactionsList/AccountTransactionsList.tsx';
import { AccountTransactionDetailModal } from '../accountDetailSharedComponents/accountTransactionDetailModal/AccountTransactionDetailModal.tsx';
import AccountPocketCommitments from './components/AccountPocketCommitments.tsx';
import CoinSpinner from '../../../loader/coin/CoinSpinner.tsx';
import { useTransactionDetail } from '../../../hooks/useTransactionDetail.ts';

import {
  DEFAULT_CURRENCY,
  VARIANT_FORM,
  DEFAULT_ACCOUNT_TRANSACTIONS,
} from '../../../helpers/constants.ts';
import {
  capitalize,
  numberFormatCurrency,
  formatDateToDDMMYYYY,
  toCalendarDay,
} from '../../../helpers/functions.ts';

import {
  AccountByTypeResponseType,
  AccountListType,
  TransactionsAccountApiResponseType,
  AccountTransactionType,
  AccountSummaryBalanceType,
} from '../../../types/responseApiTypes.ts';

import {
  url_get_account_by_id,
  url_get_transactions_by_account_id,
} from '../../../../urlConfig.ts';

//styles import
import '../styles/forms-styles.css';

import '../accountDetailSharedComponents/accountTransactionsList/styles/accountDetailPeriodInfo-styles.css';
import '../../../general_components/monthPicker/styles/monthPicker-styles.css';

/*frontend/src/fintrack/pages/forms/accountDetailSharedComponents/accountTransactionsList/styles/accountDetailPeriodInfo-styles.css */

// frontend\src\fintrack\pages\forms\accountDetail\AccountDetail.tsx

//--------------------------------
type LocationStateType = {
  previousRoute: string;
  detailedData: AccountListType;
};
// No placeholder account. The screen starts with NOTHING, not with a blank one:
// a default object carrying account_balance: 0 prints a real 0.00 for a figure
// the server has not sent, and no reader can tell that apart from an account
// that truly holds nothing. Absence is rendered as absence — see ACCOUNT_DEFAULT
// in helpers/constants.ts, which now says so at the source.
const DASH = '—';

const initialAccountTransactionsData = DEFAULT_ACCOUNT_TRANSACTIONS['data'];
// console.log('initialAccountTransactions', initialAccountTransactionsData)
//==============================
//MAIN COMPONENT ACCOUNT DETAILED
// ==============================
function AccountDetail() {
  const location = useLocation();
  const { accountId } = useParams();
  const state = location.state as LocationStateType | null;
  const accountDetailedFromState = state?.detailedData;
  //------------------------------
  //✅ DYNAMIC BACK ROUTE
  const previousRouteFromState = state?.previousRoute || '/fintrack/overview';

  //--STATES
  const [previousRoute, setPreviousRoute] = useState<string>(
    previousRouteFromState,
  );
  // console.log('location',location,   accountId, {detailedData}, {previousRouteFromState}, )

  // Nullable, so "the answer has not arrived" is a state the render can see. It
  // was an always-present object before, which made the guard below dead code
  // and every figure on the card readable as data before any data existed.
  const [accountDetail, setAccountDetail] = useState<AccountListType | null>(
    null,
  );

  //--state for account transactions data
  const [transactions, setTransactions] = useState<AccountTransactionType[]>(
    initialAccountTransactionsData.transactions,
  );

  const [summaryAccountBalance, setSummaryAccountBalance] =
    useState<AccountSummaryBalanceType>(initialAccountTransactionsData.summary);
  //----------------------------------
  // API CALLS
  //--Fetch Data
  //--account detail global info
  // Always by id, never conditional on the account riding in location.state.
  // The list route serves eight explicit columns and the by-id route serves the
  // whole row plus its derived fields, so a screen that skipped the fetch read
  // undefined for everything outside those eight — silently, because an absent
  // key looks the same as a field the owner never filled.
  const urlAccountById = `${url_get_account_by_id}/${accountId}`;

  const {
    apiData: accountsDataFromFetch,
    isLoading,
    error,
  } = useFetch<AccountByTypeResponseType>(urlAccountById);

  //Data transforming for rendering
  // The fetched account wins. The one carried in state is the optimistic first
  // paint, so the screen renders immediately and is corrected when the complete
  // row lands.
  const accountsData =
    accountsDataFromFetch?.data?.accountList[0] ?? accountDetailedFromState;

  //-------------------------------------
  //--ACCOUNT TRANSACTION API RESPONSE
  //--THE PERIOD, AS A CONTROL
  // Replaces the fixed two-month window built from the device's clock and sent
  // as start/end. The statement endpoint resolves a month on the account
  // owner's calendar when asked with ?month=, the path DebtorDetail.tsx already
  // uses for the same request.
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month');

  const selectMonth = (month: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('month', month);
    // replace, so browsing five months does not bury the previous screen under
    // five history entries.
    setSearchParams(nextParams, { replace: true });
  };

  const currentMonth = toCalendarDay(new Date()).slice(0, 7);
  const reportedMonth = monthParam ?? currentMonth;

  //-----
  const urlTransactionsAccountById = `${url_get_transactions_by_account_id}/${accountId}/?month=${reportedMonth}`;

  const {
    apiData: transactionAccountApiResponse, //{status, message, data}
    isLoading: isLoadingTransactions,
    error: errorTransactions,
  } = useFetch<TransactionsAccountApiResponseType>(urlTransactionsAccountById);
  //------------------------------
  // UPDATE TRANSACTIONS WHEN DATA LOADS
  useEffect(() => {
    if (transactionAccountApiResponse?.data.transactions) {
      setTransactions(transactionAccountApiResponse?.data.transactions);
      setSummaryAccountBalance(transactionAccountApiResponse?.data.summary);
    }
    //else keep the initial values
  }, [transactionAccountApiResponse]);
  //-------------------------------
  // UPDATE ACCOUNT DETAIL WHEN DATA LOADS
  useEffect(() => {
    if (accountsData) {
      setAccountDetail(accountsData);
      // if (previousRouteFromState) {
      setPreviousRoute(previousRouteFromState);
      // }
    }
  }, [accountsData, previousRouteFromState]);

  //--TRANSACTION DETAIL MODAL
  // Owned here and not inside the list: the list is presentational and shared
  // by the other detail screens.
  const {
    selectedTransaction,
    isLoading: isLoadingTransactionDetail,
    openTransaction,
    closeTransaction,
  } = useTransactionDetail();
  //-----------------------------
  return (
    <>
      <section className='page__container'>
        <TopWhiteSpace variant={'dark'} />

        <div className='page__content'>
          <div className='main__title--container'>
            <Link to={previousRoute} relative='path' className='iconLeftArrow'>
              <LeftArrowLightSvg />
            </Link>

            <div className='form__title'>
              {accountDetail
                ? capitalize(accountDetail.account_name).toUpperCase()
                : 'Loading...'}
            </div>

            {/* The editor returns to this card, not to the list the user came
                from: it is where they were standing. */}
            {accountId && (
              <AccountEditLink
                accountId={accountId}
                returnRoute={location.pathname}
                accountName={accountDetail?.account_name ?? ''}
                originRoute={previousRoute}
              />
            )}
          </div>

          <form className='form__box'>
            <div className='form__container'>
              <div className='input__box'>
                <div className='label forms__label'>{`Current Balance`}</div>

                {/* A dash and never 0.00 while the row is in flight. A zero
                    here is a statement about the owner's money, and the screen
                    is in no position to make it yet. */}
                <div className='input__container' style={{ padding: '0.5rem' }}>
                  {accountDetail
                    ? numberFormatCurrency(accountDetail.account_balance)
                    : DASH}
                </div>
              </div>

              <div className='input__box'>
                <label className='label forms__label'>{'Account Type'}</label>

                <p className='input__container' style={{ padding: '0.5rem' }}>
                  {accountDetail?.account_type_name
                    ? capitalize(accountDetail.account_type_name.toLocaleString())
                    : DASH}
                </p>
              </div>

              <div className='account__dateAndCurrency'>
                <div className='account__date'>
                  <label className='label forms__label'>
                    {'Starting Point'}
                  </label>
                  <div
                    className='form__datepicker__container'
                    style={{ textAlign: 'center', color: 'white' }}
                  >
                    {accountDetail?.account_start_date
                      ? formatDateToDDMMYYYY(accountDetail.account_start_date)
                      : DASH}
                  </div>
                </div>

                <div className='account__currency'>
                  <div className='label forms__label'>{'Currency'}</div>

                  <CurrencyBadge
                    variant={VARIANT_FORM}
                    currency={accountDetail?.currency_code ?? DEFAULT_CURRENCY}
                  />
                </div>
              </div>
            </div>

            {/* Above the statement and not inside it, deliberately. What this
                account has committed to pockets is a standing state like the
                balance over it — the read that serves it takes no month — while
                everything below the picker is a window on a list of movements.
                Placed under the picker it would look windowed by it and would
                contradict itself every time the reader stepped back a month.

                It draws nothing at all on an account type that holds no
                unassigned cash, which is every type but bank. */}
            {accountId && (
              <AccountPocketCommitments
                accountId={accountId}
                allocated={accountDetail?.allocated}
                unassignedCash={accountDetail?.unassignedCash}
                isOverAllocated={accountDetail?.isOverAllocated}
                pockets={accountDetail?.pockets}
                currencyCode={accountDetail?.currency_code}
              />
            )}

            {/* --- TRANSACTION STATEMENT SECTION --- */}
            <div
              className='account-transactions__container '
              style={{ margin: '1rem 0' }}
            >
              {/* The floor is the account's own opening month; the ceiling is
                  the current one, so the picker cannot land on a month the
                  server would refuse with 422. */}
              <MonthPicker
                month={`${reportedMonth}-01`}
                currentMonth={`${currentMonth}-01`}
                minMonth={
                  accountDetail?.account_start_local_date
                    ? String(accountDetail.account_start_local_date).slice(
                        0,
                        7,
                      )
                    : null
                }
                surface='dark'
                onSelect={selectMonth}
              />

              <div className='period-info'>
                <div className='period-info__label'>Period</div>
                <span className='period-info__dates  '>
                  {formatDateToDDMMYYYY(summaryAccountBalance.periodStartDate)}
                  {'  '} / {'  '}{' '}
                  {formatDateToDDMMYYYY(summaryAccountBalance.periodEndDate)}
                </span>
              </div>

              <AccountBalanceSummary
                summaryAccountBalance={summaryAccountBalance}
              />

              <div className='presentation__card__title__container '>
                <CardTitle>{'Last Movements'}</CardTitle>
              </div>

              <AccountTransactionsList
                transactions={transactions}
                onTransactionClick={openTransaction}
              />
            </div>
            {/* --- END TRANSACTION STATEMENT SECTION --- */}
          </form>

          {(isLoading || isLoadingTransactions) && <p>Loading...</p>}
          {(error || errorTransactions) && (
            <p>Error fetching account info: {error ?? errorTransactions}</p>
          )}
        </div>
      </section>

      {/* A click with no answer for the length of a round trip reads as a dead
          row, so the request states itself before the modal can. */}
      {isLoadingTransactionDetail && <CoinSpinner />}

      <AccountTransactionDetailModal
        transaction={selectedTransaction}
        onClose={closeTransaction}
      />
    </>
  );
}

export default AccountDetail;
//------------------------------------
// {
// 	"status": 200,
// 	"message": "5 transaction(s) found for account id 23. Period between 2025-05-21 and 2025-06-21.",
// 	"data": {
// 		"totalTransactions": 5,
// 		"summary": {
// 			"initialBalance": {
// 				"amount": 0,
// 				"date": "2025-06-15T22:40:50.140Z",
// 				"currency": "usd"
// 			},
// 			"finalBalance": {
// 				"amount": 3418.32,
// 				"currency": "usd",
// 				"date": "2025-06-16T00:07:08.436Z"
// 			},
// 			"periodStartDate": "2025-05-21",
// 			"periodEndDate": "2025-06-21"
// 		},
// 		"transactions": [
// 			{
// 				"transaction_id": 15,
// 				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
// 				"description": "income test.Transaction: deposit. Received 3316.32 usd in account \"nuovo conto (bank), from \"project 01\" (income_source). Date: 15/06/2025, 20:07",
// 				"amount": "3316.32",
// 				"movement_type_id": 2,
// 				"transaction_type_id": 2,
// 				"currency_id": 1,
// 				"account_id": 23,
// 				"account_balance_after_tr": "3418.32",
// 				"source_account_id": 4,
// 				"destination_account_id": 23,
// 				"status": "complete",
// 				"transaction_actual_date": "2025-06-16T00:07:08.436Z",
// 				"created_at": "2025-06-16T04:07:09.547Z",
// 				"updated_at": "2025-06-16T04:07:09.547Z",
// 				"movement_type_name": "income",
// 				"currency_code": "usd",
// 				"account_name": "nuovo conto",
// 				"account_starting_amount": 0,
// 				"account_start_date": "2025-06-15T22:40:50.140Z"
// 			},
// 			{
// 				"transaction_id": 13,
// 				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
// 				"description": "test b-b.Transaction: deposit. Received 100 usd in account \"nuovo conto (bank), from \"Nueva Cuenta\" (bank). Date: 15/06/2025, 20:00",
// 				"amount": "100.00",
// 				"movement_type_id": 6,
// 				"transaction_type_id": 2,
// 				"currency_id": 1,
// 				"account_id": 23,
// 				"account_balance_after_tr": "102.00",
// 				"source_account_id": 21,
// 				"destination_account_id": 23,
// 				"status": "complete",
// 				"transaction_actual_date": "2025-06-16T00:00:37.008Z",
// 				"created_at": "2025-06-16T04:00:38.168Z",
// 				"updated_at": "2025-06-16T04:00:38.168Z",
// 				"movement_type_name": "transfer",
// 				"currency_code": "usd",
// 				"account_name": "nuovo conto",
// 				"account_starting_amount": 0,
// 				"account_start_date": "2025-06-15T22:40:50.140Z"
// 			},
// 			{
// 				"transaction_id": 11,
// 				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
// 				"description": "5.Transaction: deposit. Received 1 usd from account \"Nueva Cuenta\" (bank), credited to \"nuovo conto (bank). Date: 15/06/2025, 19:53",
// 				"amount": "1.00",
// 				"movement_type_id": 6,
// 				"transaction_type_id": 2,
// 				"currency_id": 1,
// 				"account_id": 23,
// 				"account_balance_after_tr": "2.00",
// 				"source_account_id": 21,
// 				"destination_account_id": 23,
// 				"status": "complete",
// 				"transaction_actual_date": "2025-06-15T23:53:55.736Z",
// 				"created_at": "2025-06-16T03:53:56.930Z",
// 				"updated_at": "2025-06-16T03:53:56.930Z",
// 				"movement_type_name": "transfer",
// 				"currency_code": "usd",
// 				"account_name": "nuovo conto",
// 				"account_starting_amount": 0,
// 				"account_start_date": "2025-06-15T22:40:50.140Z"
// 			},
// 			{
// 				"transaction_id": 16,
// 				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
// 				"description": "tet s b-d.Transaction: lend. Transfered 100 usd from account \"nuovo conto\" (bank) credited to \"villalba, jovito\" (debtor). Date: 15/06/2025, 18:38",
// 				"amount": "-100.00",
// 				"movement_type_id": 4,
// 				"transaction_type_id": 3,
// 				"currency_id": 1,
// 				"account_id": 23,
// 				"account_balance_after_tr": "3318.32",
// 				"source_account_id": 23,
// 				"destination_account_id": 7,
// 				"status": "complete",
// 				"transaction_actual_date": "2025-06-15T22:38:34.755Z",
// 				"created_at": "2025-06-16T04:08:34.766Z",
// 				"updated_at": "2025-06-16T04:08:34.766Z",
// 				"movement_type_name": "debt",
// 				"currency_code": "usd",
// 				"account_name": "nuovo conto",
// 				"account_starting_amount": 0,
// 				"account_start_date": "2025-06-15T22:40:50.140Z"
// 			},
// 			{
// 				"transaction_id": 5,
// 				"user_id": "c109eb15-4139-43b4-b081-8fb9860588af",
// 				"description": "Transaction: account-opening. Account: nuovo conto. Type: bank. Initial-(account-opening). Amount: 0 usd. Date: 15-06-2025",
// 				"amount": "0.00",
// 				"movement_type_id": 8,
// 				"transaction_type_id": 5,
// 				"currency_id": 1,
// 				"account_id": 23,
// 				"account_balance_after_tr": "0.00",
// 				"source_account_id": 23,
// 				"destination_account_id": 23,
// 				"status": "complete",
// 				"transaction_actual_date": "2025-06-15T21:47:25.964Z",
// 				"created_at": "2025-06-16T01:47:29.837Z",
// 				"updated_at": "2025-06-16T01:47:29.837Z",
// 				"movement_type_name": "account-opening",
// 				"currency_code": "usd",
// 				"account_name": "nuovo conto",
// 				"account_starting_amount": 0,
// 				"account_start_date": "2025-06-15T22:40:50.140Z"
// 			}
// 		]
// 	}
// }
