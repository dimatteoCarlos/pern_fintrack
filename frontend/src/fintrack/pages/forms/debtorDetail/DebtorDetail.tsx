import { Link, useLocation, useParams } from 'react-router-dom';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../../assets/LeftArrowSvg.svg';
import AccountEditLink from '../../../general_components/accountEditLink/AccountEditLink.tsx';
import { CardTitle } from '../../../general_components/CardTitle.tsx';

import { DEFAULT_CURRENCY, VARIANT_FORM } from '../../../helpers/constants.ts';
import {
  AccountByTypeResponseType,
  AccountListType,
  AccountSummaryBalanceType,
  AccountTransactionType,
  DebtorListType,
  TransactionsAccountApiResponseType,
} from '../../../types/responseApiTypes.ts';
import {
  url_get_account_by_id,
  url_get_transactions_by_account_id,
} from '../../../../urlConfig.ts';
import { useFetch } from '../../../hooks/useFetch.ts';
import {
  capitalize,
  formatDateToDDMMYYYY,
  numberFormatCurrency,
} from '../../../helpers/functions.ts';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import AccountBalanceSummary from '../accountDetailSharedComponents/accountBalanceSummary/AccountBalanceSummary.tsx';
import AccountTransactionsList from '../accountDetailSharedComponents/accountTransactionsList/AccountTransactionsList.tsx';
import SummaryDebtorDetailBox from './summaryDebtorDetailBox/SummaryDebtorDetailBox.tsx';
import { AccountTransactionDetailModal } from '../accountDetailSharedComponents/accountTransactionDetailModal/AccountTransactionDetailModal.tsx';
import CoinSpinner from '../../../loader/coin/CoinSpinner.tsx';
import { useTransactionDetail } from '../../../hooks/useTransactionDetail.ts';

import '../styles/forms-styles.css';
import '../accountDetailSharedComponents/accountTransactionsList/styles/accountDetailPeriodInfo-styles.css';
import './styles/debtorDetail-styles.css';

//---------------
// const user = import.meta.env.VITE_USER_ID;

type LocationStateType = {
  previousRoute: string;
  debtorDetailedData: DebtorListType;
};

// A figure or a date the answer did not carry. Never a fabricated value: a date
// means something here, and it does not mean "the server did not send one".
const DASH = '—';

//--functions
function getBubleInfoFromAccountDetail(
  accountDetail: AccountListType,
): DebtorListType {
  return {
    account_name: accountDetail.account_name,
    account_id: accountDetail.account_id,
    currency_code: accountDetail.currency_code,
    total_debt_balance: accountDetail.account_balance,
    debt_receivable:
      accountDetail.account_balance < 0 ? accountDetail.account_balance : 0,
    debt_payable:
      accountDetail.account_balance > 0 ? accountDetail.account_balance : 0,
    creditor: accountDetail.account_balance < 0 ? 1 : 0,
    debtor: accountDetail.account_balance >= 0 ? 1 : 0,
  };
}

//---------------------------
function DebtorDetail() {
  const location = useLocation();
  const state = location.state as LocationStateType | null;
  const debtorDetailedData = state?.debtorDetailedData;
  // Where the back arrow and the editor return to. The list sends it in the
  // link state; a direct load has none, so the canonical list URL stands in.
  const previousRoute = state?.previousRoute ?? '/fintrack/debts/debtors';
  const { debtorId: accountId } = useParams();

  //-------------------------------------
  //--Fetch Data
  //--account detail global info
  const urlAccountById = `${url_get_account_by_id}/${accountId}`;

  const {
    apiData: accountsData,
    isLoading,
    error,
    status,
    refetch,
  } = useFetch<AccountByTypeResponseType>(urlAccountById);

  //--account transaction api response
  //--how to handle dates period
  const tdy = new Date();
  const numberOfMonths = 2;
  const firstDayOfPeriod = new Date(
    tdy.getFullYear(),
    tdy.getMonth() - numberOfMonths + 1,
    1,
  );
  const lastDayOfPeriod = new Date(tdy.getFullYear(), tdy.getMonth() + 1, 0);

  //--YYYY-MM-DD
  const apiStartDate = firstDayOfPeriod.toISOString().split('T')[0];
  const apiEndDate = lastDayOfPeriod.toISOString().split('T')[0];

  //-----
  const urlTransactionsAccountById = `${url_get_transactions_by_account_id}/${accountId}/?start=${apiStartDate}&end=${apiEndDate}`;

  const {
    apiData: transactionAccountApiResponse, //{status, message, data}
    isLoading: isLoadingTransactions,
    error: errorTransactions,
    status: statusTransactions,
    refetch: refetchTransactions,
  } = useFetch<TransactionsAccountApiResponseType>(urlTransactionsAccountById);
  //-------------------------------------
  //--WHAT THE ANSWERS CARRY
  // Nothing is seeded and nothing is copied into state. The screen used to open
  // on a sample account — 'Lastname, name example' owing 10.00, with a
  // statement running from 2025-05-18 — which the fetch overwrote only on
  // success, so a failed or missing account left the sample standing as if it
  // were the debtor. Reading the answers here also removes the render in
  // between, where an answer had arrived and the copy of it had not.
  const accountDetail: AccountListType | null =
    accountsData?.data?.accountList?.[0] ?? null;

  // The row the list handed over in the link state paints the bubble until the
  // account answers. Real data for this debtor either way, and null on a direct
  // load or a refresh, where the fetch is the only source.
  const bubleInfo: DebtorListType | null = accountDetail
    ? getBubleInfoFromAccountDetail(accountDetail)
    : debtorDetailedData ?? null;

  // null is "no answer yet"; an empty array is "the window holds no movement".
  const statementData = transactionAccountApiResponse?.data ?? null;
  const transactions: AccountTransactionType[] | null =
    statementData?.transactions ?? null;
  const summaryAccountBalance: AccountSummaryBalanceType | null =
    statementData?.summary ?? null;

  //--TRANSACTION DETAIL MODAL
  // Owned here and not inside the list: the list is presentational and shared
  // by the other detail screens.
  const {
    selectedTransaction,
    isLoading: isLoadingTransactionDetail,
    openTransaction,
    closeTransaction,
  } = useTransactionDetail();

  //--------------------------------------
  //--FETCH STATES
  // The hook starts idle and raises isLoading inside its effect, so a status or
  // an error is what says an answer has actually come back.
  const hasAccountAnswer = status !== null || error !== null;

  // A debtor that answers 404 is gone — deleted here or in another tab. That is
  // its own state: not an empty screen, and never the sample account this
  // screen used to fall back to.
  const isAccountMissing = status === 404;
  const hasAccountFailed = Boolean(error) && !isAccountMissing;
  const isAccountPending =
    !isAccountMissing && !hasAccountFailed && (isLoading || !hasAccountAnswer);

  const hasStatementAnswer =
    statusTransactions !== null || errorTransactions !== null;
  const hasStatementFailed = Boolean(errorTransactions);
  const isStatementPending =
    !hasStatementFailed && (isLoadingTransactions || !hasStatementAnswer);

  // Also the last branch of each chain below: an answer that came back carrying
  // no account, or no statement, is a request that failed to produce one. The
  // screen says so rather than waiting on a skeleton that will never resolve.
  const accountErrorPanel = (
    <article className='form__box debtorDetail__state'>
      <p className='debtorDetail__stateText'>
        This debtor could not be loaded.
      </p>

      <button type='button' className='debtorDetail__retry' onClick={refetch}>
        Try again
      </button>
    </article>
  );

  const statementErrorPanel = (
    <div className='debtorDetail__state'>
      <p className='debtorDetail__stateText'>
        The statement could not be loaded.
      </p>

      <button
        type='button'
        className='debtorDetail__retry'
        onClick={refetchTransactions}
      >
        Try again
      </button>
    </div>
  );

  //--------------------------------------
  return (
    <>
      <section className='page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div className='main__title--container '>
            <Link to={previousRoute} relative='path' className='iconLeftArrow'>
              <LeftArrowLightSvg />
            </Link>
            <div className='form__title'>
              {/* The name of an account that is gone, or of one that failed to
                  load, is not a fact this screen may state. */}
              {bubleInfo && !isAccountMissing && !hasAccountFailed ? (
                String(bubleInfo.account_name).toUpperCase()
              ) : (
                <span
                  className='debtorDetail__skeletonBar debtorDetail__skeletonBar--title'
                  aria-hidden='true'
                ></span>
              )}
            </div>
            {/* The editor returns to this card, not to the list the user came
                from: it is where they were standing. Offered only once the
                account is known to exist. */}
            {accountId && accountDetail && (
              <AccountEditLink
                accountId={accountId}
                returnRoute={location.pathname}
                accountName={String(accountDetail.account_name)}
                originRoute={previousRoute}
              />
            )}
          </div>

          {isAccountMissing ? (
            <article className='form__box debtorDetail__state'>
              <p className='debtorDetail__stateText'>
                This debtor no longer exists. It may have been deleted from
                another screen.
              </p>

              <Link to={previousRoute} className='debtorDetail__stateLink'>
                Back to the debtor list
              </Link>
            </article>
          ) : hasAccountFailed ? (
            accountErrorPanel
          ) : isAccountPending ? (
            <article
              className='form__box debtorDetail__skeleton'
              aria-hidden='true'
            >
              <div className='debtorDetail__skeletonBar debtorDetail__skeletonBar--amount'></div>
              <div className='debtorDetail__skeletonBar'></div>
              <div className='debtorDetail__skeletonBar'></div>
              <div className='debtorDetail__skeletonBar debtorDetail__skeletonBar--wide'></div>
            </article>
          ) : !accountDetail || !bubleInfo ? (
            accountErrorPanel
          ) : (
            <>
              <SummaryDebtorDetailBox
                bubleInfo={bubleInfo}
              ></SummaryDebtorDetailBox>

              <article className='form__box'>
                <div className='form__container'>
                  <div className='input__box'>
                    <label className='label forms__label'>{`Current Balance`}</label>

                    <div
                      className='input__container'
                      style={{ padding: '0.5rem' }}
                    >
                      {numberFormatCurrency(accountDetail.account_balance)}
                    </div>
                  </div>

                  <div className='input__box'>
                    <label className='label forms__label'>
                      {'Account Type'}
                    </label>

                    <p
                      className='input__container'
                      style={{ padding: '0.5rem' }}
                    >
                      {capitalize(
                        accountDetail.account_type_name!.toLocaleString(),
                      )}
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
                        {/* The calendar label the server resolved on the
                            owner's zone, not the raw instant beside it:
                            formatDateToDDMMYYYY reads UTC parts, which named
                            the day after for an account opened in the
                            evening. */}
                        {accountDetail.account_start_local_date
                          ? formatDateToDDMMYYYY(
                              accountDetail.account_start_local_date,
                            )
                          : DASH}
                      </div>
                    </div>

                    <div className='account__currency'>
                      <div className='label forms__label'>{'Currency'}</div>

                      <CurrencyBadge
                        variant={VARIANT_FORM}
                        currency={accountDetail.currency_code ?? DEFAULT_CURRENCY}
                      />
                    </div>
                  </div>
                </div>

                {/* --- TRANSACTION STATEMENT SECTION --- */}
                {/* Its own three states. The statement is a second request and
                    can fail while the account itself is on screen. */}
                <div
                  className='account-transactions__container '
                  style={{ margin: '1rem 0' }}
                >
                  {hasStatementFailed ? (
                    statementErrorPanel
                  ) : isStatementPending ? (
                    <div className='debtorDetail__skeleton' aria-hidden='true'>
                      <div className='debtorDetail__skeletonBar debtorDetail__skeletonBar--wide'></div>
                      <div className='debtorDetail__skeletonBar'></div>
                      <div className='debtorDetail__skeletonBar'></div>
                    </div>
                  ) : !summaryAccountBalance || !transactions ? (
                    statementErrorPanel
                  ) : (
                    <>
                      <div className='period-info'>
                        <div className='period-info__label'>Period</div>
                        <span className='period-info__dates  '>
                          {formatDateToDDMMYYYY(
                            summaryAccountBalance.periodStartDate,
                          )}
                          {'  '} / {'  '}{' '}
                          {formatDateToDDMMYYYY(
                            summaryAccountBalance.periodEndDate,
                          )}
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
                    </>
                  )}
                </div>
                {/* --- END TRANSACTION STATEMENT SECTION --- */}
              </article>
            </>
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

export default DebtorDetail;
