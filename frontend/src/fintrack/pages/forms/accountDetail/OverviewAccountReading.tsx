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

import {
  ACCOUNT_DEFAULT,
  DEFAULT_ACCOUNT_TRANSACTIONS,
} from '../../../helpers/constants.ts';
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
//dummy data (used if API data is not available or for initial state)
const initialAccountDetail = ACCOUNT_DEFAULT[0];

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
  const isAccountDetailMissing = !accountDetailedFromState;

  //--STATES
  const [previousRoute, setPreviousRoute] = useState<string>(
    previousRouteFromState,
  );

  const [accountDetail, setAccountDetail] =
    useState<AccountListType>(initialAccountDetail);

  //--state for account transactions data
  const [transactions, setTransactions] = useState<AccountTransactionType[]>(
    initialAccountTransactionsData.transactions,
  );

  const [summaryAccountBalance, setSummaryAccountBalance] =
    useState<AccountSummaryBalanceType>(initialAccountTransactionsData.summary);
  //----------------------------------
  // API CALLS
  const urlAccountById = isAccountDetailMissing
    ? `${url_get_account_by_id}/${accountId}`
    : null;

  const {
    apiData: accountsDataFromFetch,
    isLoading,
    error,
  } = useFetch<AccountByTypeResponseType>(urlAccountById);

  const accountsData =
    accountDetailedFromState || accountsDataFromFetch?.data?.accountList[0];

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

  useEffect(() => {
    if (!accountsData && accountsData) {
      const account = accountsData;
      if (account) setAccountDetail(account);
    }
  }, [accountsData, accountId]);

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
                accountName={accountDetail.account_name}
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
                  accountDetail.account_start_local_date
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
