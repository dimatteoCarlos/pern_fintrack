// Overview's own account screen, reached from AccountBalance.tsx and
// InvestmentAccBalance.tsx. A copy of AccountDetail.tsx without the record
// card (balance, account type, opening date, currency): that block belongs to
// AccountDetail.tsx, the screen Accounting Dashboard reaches at
// overview/accounts/:accountId, and stays there unedited. This is a separate
// component so the two can diverge without one commit touching both.
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
import AccountBalanceSummary from '../accountDetailSharedComponents/accountBalanceSummary/AccountBalanceSummary.tsx';
import AccountTransactionsList from '../accountDetailSharedComponents/accountTransactionsList/AccountTransactionsList.tsx';
import { AccountTransactionDetailModal } from '../accountDetailSharedComponents/accountTransactionDetailModal/AccountTransactionDetailModal.tsx';
import CoinSpinner from '../../../loader/coin/CoinSpinner.tsx';
import { useTransactionDetail } from '../../../hooks/useTransactionDetail.ts';

import { DEFAULT_ACCOUNT_TRANSACTIONS } from '../../../helpers/constants.ts';
import {
  capitalize,
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
const initialAccountTransactionsData = DEFAULT_ACCOUNT_TRANSACTIONS['data'];
//==============================
//MAIN COMPONENT OVERVIEW ACCOUNT READING
// ==============================
function OverviewAccountReading() {
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

  // Nullable, so "the answer has not arrived" is a state the render can see. It
  // was an always-present object before, which made the guard below dead code.
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
    apiData: transactionAccountApiResponse,
    isLoading: isLoadingTransactions,
    error: errorTransactions,
  } = useFetch<TransactionsAccountApiResponseType>(urlTransactionsAccountById);
  //------------------------------
  useEffect(() => {
    if (transactionAccountApiResponse?.data.transactions) {
      setTransactions(transactionAccountApiResponse?.data.transactions);
      setSummaryAccountBalance(transactionAccountApiResponse?.data.summary);
    }
  }, [transactionAccountApiResponse]);
  //-------------------------------
  useEffect(() => {
    if (accountsData) {
      setAccountDetail(accountsData);
      setPreviousRoute(previousRouteFromState);
    }
  }, [accountsData, previousRouteFromState]);

  //--TRANSACTION DETAIL MODAL
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
            {/* The record card -- balance, account type, opening date and
                currency -- does not stand here. It belongs to AccountDetail.tsx,
                the screen Accounting Dashboard reaches at
                overview/accounts/:accountId, and stays there: this screen is
                Overview's own, and never carried the block to begin with. */}

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

      {isLoadingTransactionDetail && <CoinSpinner />}

      <AccountTransactionDetailModal
        transaction={selectedTransaction}
        onClose={closeTransaction}
      />
    </>
  );
}

export default OverviewAccountReading;
