import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import MonthPicker from '../../../general_components/monthPicker/MonthPicker.tsx';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../../assets/LeftArrowSvg.svg';
import AccountEditLink from '../../../general_components/accountEditLink/AccountEditLink.tsx';
import { CardTitle } from '../../../general_components/CardTitle.tsx';

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
  formatDateToDDMMYYYY,
  toCalendarDay,
} from '../../../helpers/functions.ts';
import AccountBalanceSummary from '../accountDetailSharedComponents/accountBalanceSummary/AccountBalanceSummary.tsx';
import AccountTransactionsList from '../accountDetailSharedComponents/accountTransactionsList/AccountTransactionsList.tsx';
import SummaryDebtorDetailBox from './summaryDebtorDetailBox/SummaryDebtorDetailBox.tsx';
import { AccountTransactionDetailModal } from '../accountDetailSharedComponents/accountTransactionDetailModal/AccountTransactionDetailModal.tsx';
import CoinSpinner from '../../../loader/coin/CoinSpinner.tsx';
import { useTransactionDetail } from '../../../hooks/useTransactionDetail.ts';

import '../styles/forms-styles.css';
import '../accountDetailSharedComponents/accountTransactionsList/styles/accountDetailPeriodInfo-styles.css';
import '../../../general_components/monthPicker/styles/monthPicker-styles.css';
import './styles/debtorDetail-styles.css';

//---------------
// const user = import.meta.env.VITE_USER_ID;

type LocationStateType = {
  previousRoute: string;
  debtorDetailedData: DebtorListType;
};

//--functions
// The board's list row, rebuilt from the account the detail endpoint answers so
// the bubble holds real data on a direct load.
//
// The four debt fields carry the server's definitions verbatim, from the debtor
// branch of the summary query in dashboardController: a POSITIVE balance is a
// receivable and they owe the owner, a NEGATIVE one is a payable and the owner
// owes, and zero is settled, which raises neither flag. Receivable and payable
// were inverted against that definition here; no pixel showed it only because
// the bubble reads neither field.
//
// The payable stays negative, as the accounting contract serves it. Printing
// its absolute value is the interface's business, not this function's.
//
// The direction is still read off the sign because GET /account/:accountId
// serves no debt position. Serving one closes that; a second client-side
// derivation would not.
function getBubleInfoFromAccountDetail(
  accountDetail: AccountListType,
): DebtorListType {
  const balance = accountDetail.account_balance;

  return {
    account_name: accountDetail.account_name,
    account_id: accountDetail.account_id,
    currency_code: accountDetail.currency_code,
    total_debt_balance: balance,
    debt_receivable: balance > 0 ? balance : 0,
    debt_payable: balance < 0 ? balance : 0,
    creditor: balance < 0 ? 1 : 0,
    debtor: balance > 0 ? 1 : 0,
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
  //--THE PERIOD, AS A CONTROL
  //
  // The window used to be a two-month stretch built here from the device's
  // clock and sent as start and end. The statement endpoint names its window
  // two ways and they are not two flavours of one thing
  // (getTransactionsForAccountById.js:124-137): start and end are taken as
  // given, while a month is resolved on the ACCOUNT OWNER's calendar. This
  // screen now sends the month, so the boundary belongs to the owner and not to
  // whichever device is looking.
  //
  // In the URL and not in state, for the reason the category detail states for
  // the same choice: opening a movement unmounts nothing, but the editor and
  // the back arrow both leave and return, and a month held in a component would
  // not survive the trip.
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month');

  const selectMonth = (month: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('month', month);
    // replace, so browsing five months does not bury the previous screen under
    // five history entries.
    setSearchParams(nextParams, { replace: true });
  };

  // The month the screen opens on. The device's clock decides only WHICH month
  // is asked for; the two boundaries of it are the server's, resolved on the
  // owner's calendar. The residual is one day at a month's edge for an owner in
  // a distant zone, and it closes when the server serves its own current month
  // the way the budget status endpoint already does for the category screen.
  const currentMonth = toCalendarDay(new Date()).slice(0, 7);
  const reportedMonth = monthParam ?? currentMonth;

  //-----
  const urlTransactionsAccountById = `${url_get_transactions_by_account_id}/${accountId}/?month=${reportedMonth}`;

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
            {/* The link held nothing but a glyph, so it was announced as an
                unnamed link. "Go back" and not the destination: previousRoute
                is whatever the caller handed over. The worded link further down
                this file can name the debtor list because it only renders on
                the branch that has no other origin. */}
            <Link
              to={previousRoute}
              relative='path'
              className='iconLeftArrow'
              aria-label='Go back'
            >
              <LeftArrowLightSvg aria-hidden='true' />
            </Link>
            {/* The screen's own name. As a div it was not a heading, so this
                page had no h1 and every CardTitle below it hung off nothing.
                Every rule for this class selects the class, so the tag changes
                and nothing moves. */}
            <h1 className='form__title'>
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
            </h1>
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
                {/* The record card -- balance, account type, opening date and currency
                    -- stood here until 2026-09-02. It restated the account's own
                    properties ahead of the movements this screen exists to show,
                    which pushed the transaction list below the fold on a short
                    screen. The balance survives in the summary above, the
                    currency in the symbol of every figure, and the opening date
                    is read from Edit account, where it is changed. */}

                {/* --- TRANSACTION STATEMENT SECTION --- */}
                {/* Its own three states. The statement is a second request and
                    can fail while the account itself is on screen. */}
                <div
                  className='account-transactions__container '
                  style={{ margin: '1rem 0' }}
                >
                  {/* Above the three states on purpose: the control has to stay
                      on screen while the month it just asked for is in flight,
                      or the owner loses the thing they were operating exactly
                      when they operated it. The floor is the account's own
                      opening month — a debtor cannot report a month it did not
                      exist in — and the ceiling is the current one. */}
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
