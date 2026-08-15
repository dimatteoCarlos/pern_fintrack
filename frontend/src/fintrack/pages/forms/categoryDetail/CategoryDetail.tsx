//frontend/src/pages\/orms/categoryDetail/CategoryDetail.tsx
import { useEffect, useMemo } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';

import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../../assets/LeftArrowSvg.svg';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import AccountBalanceSummary from '../accountDetailSharedComponents/accountBalanceSummary/AccountBalanceSummary.tsx';
import AccountTransactionsList from '../accountDetailSharedComponents/accountTransactionsList/AccountTransactionsList.tsx';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import Dots3LightSvg from '../../../../assets/Dots3LightSvg.svg';
import SummaryDetailBox from '../accountDetailSharedComponents/summaryDetailBox/SummaryDetailBox.tsx';
import CoinSpinner from '../../../loader/coin/CoinSpinner.tsx';

import { useBudgetStatusStore } from '../../../stores/useBudgetStatusStore.ts';
import { useFetch } from '../../../hooks/useFetch.ts';
import {
  url_get_account_by_id,
  url_get_transactions_by_account_id,
} from '../../../../urlConfig.ts';

import {
  CategoryBudgetAccountsResponseType,
  TransactionsAccountApiResponseType,
} from '../../../types/responseApiTypes.ts';

import {
  capitalize,
  currencyFormat,
  formatBudgetMonthLabel,
  formatDateToDDMMYYYY,
  withMonthParam,
} from '../../../helpers/functions.ts';

import { DEFAULT_CURRENCY, VARIANT_FORM } from '../../../helpers/constants.ts';

import '../styles/forms-styles.css';
import '../../../general_components/monthPicker/styles/monthPicker-styles.css';
import './styles/categoryDetail-styles.css';

import '../accountDetailSharedComponents/accountTransactionsList/styles/accountDetailPeriodInfo-styles.css';

//========================
// MAIN COMPONENT CATEGORY DETAIL
//========================
function CategoryDetail() {
  const { accountId: rawAccountId, categoryName } = useParams<{
    accountId?: string;
    categoryName?: string;
  }>();
  //CHECK ACCOUNT ID
  const accountId = (rawAccountId || '').trim();
  if (!accountId) {
    throw new Error('Invalid account ID parameter');
  }
  //---DETAIL ACCOUNT DATA FETCHER
  const location = useLocation();
  const state = location.state ?? {};
  const { previousRoute: previousRouteFromState } = state;

  const previousRoute =
    previousRouteFromState ??
    (categoryName
      ? `/fintrack/budget/category/${categoryName}`
      : '/fintrack/budget');

  //--BUDGET FIGURES----------------
  // Read from the module's payload, never rebuilt here. This screen has two
  // entry points — the category list and the accounting dashboard — and the
  // second one arrives with nothing in location.state, which is why the
  // figures it used to read from there resolved to NaN.
  const budgetAccounts = useBudgetStatusStore((state) => state.accounts);
  const referenceMonth = useBudgetStatusStore((state) => state.referenceMonth);
  const isLoadingStatus = useBudgetStatusStore((state) => state.isLoading);
  const errorStatus = useBudgetStatusStore((state) => state.error);
  const fetchStatus = useBudgetStatusStore((state) => state.fetchStatus);

  // Read from this screen's own URL: this route is declared beside the budget
  // layout, so nothing above it is still mounted to inherit a month from.
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get('month');

  // Either entry point can be the first screen of the session. The store's
  // guard makes this a no-op when the month is already loaded.
  useEffect(() => {
    fetchStatus(monthParam ?? undefined);
  }, [fetchStatus, monthParam]);

  const budgetAccount = useMemo(
    () =>
      budgetAccounts.find(
        (account) => String(account.accountId) === accountId,
      ) ?? null,
    [budgetAccounts, accountId],
  );
  //---
  // ACCOUNT RECORD
  // The budget contract carries figures, not the account record: the account
  // type and the opening date are not budget facts. This request exists for
  // those two fields alone, and is what used to arrive inside location.state.
  const urlAccountById = `${url_get_account_by_id}/${accountId}`;

  const {
    apiData: accountsDataFromFetch,
    isLoading: isLoadingAccount,
    error: errorAccount,
  } = useFetch<CategoryBudgetAccountsResponseType>(urlAccountById);

  const accountRecord = accountsDataFromFetch?.data?.accountList[0];

  const currency_code =
    budgetAccount?.currency ?? accountRecord?.currency_code ?? DEFAULT_CURRENCY;
  //-------------------------
  //SUMMARY DATA
  // Withheld rather than zeroed while the payload is still on the wire: a
  // budget that has not arrived is not a budget of zero.
  const summaryData = budgetAccount
    ? {
        title: 'Budget',
        amount: budgetAccount.budgetAmount,
        subtitle1: 'Spent',
        amount1: budgetAccount.actualSpent,
        status: budgetAccount.isOverBudget,
        amount2: budgetAccount.remainingBudget,
        currency_code: budgetAccount.currency,
        executionPercentage: budgetAccount.executionPercentage,
      }
    : null;
  //--------------------------------
  //DATES PERIOD
  //
  // RETIRED by commit 9b — remove in the cleanup block (V1 §9.4, D8).
  // A two-month window built from the browser's clock, under a card stating a
  // single month's budget. The list answered a different question than the
  // figures above it, and the clock it was built from is not the account
  // owner's.
  //
  // const tdy = new Date();
  // const numberOfMonths = 2;
  // const firstDayOfPeriod = new Date(tdy.getFullYear(), tdy.getMonth() - numberOfMonths + 1, 1);
  // const lastDayOfPeriod = new Date(tdy.getFullYear(), tdy.getMonth() + 1, 0);
  // const apiStartDate = firstDayOfPeriod.toISOString().split('T')[0];
  // const apiEndDate = lastDayOfPeriod.toISOString().split('T')[0];
  //
  // The month the figures above are about, as the server resolved it on the
  // owner's calendar. Null until the payload lands: with no month the endpoint
  // falls back to that same legacy window, so the request waits instead.
  const month = referenceMonth ? referenceMonth.slice(0, 7) : null;
  //--------------------------------
  //--FETCH TRANSACTIONS DATA
  //--account detail transactions
  const urlTransactionsAccountById = month
    ? `${url_get_transactions_by_account_id}/${accountId}/?month=${month}`
    : null;

  const {
    apiData: transactionAccountApiResponse, //{status, message, data}
    isLoading: isLoadingTransactions,
    error: errorTransactions,
  } = useFetch<TransactionsAccountApiResponseType>(urlTransactionsAccountById);

  const transactions = transactionAccountApiResponse?.data.transactions ?? [];

  // Null, not a zeroed shape: the period line and the balance pair are
  // withheld until the answer lands rather than stating a balance of 0 on a
  // period of ''.
  const summaryAccountBalance =
    transactionAccountApiResponse?.data.summary ?? null;

  const isLoading = isLoadingStatus || isLoadingAccount || isLoadingTransactions;
  const error = errorStatus ?? errorAccount ?? errorTransactions;
  //===============================
  return (
    <>
      <section className='page__container page__container--budget'>
        <TopWhiteSpace variant={'dark'} />

        {/* The column that puts this screen's rows at the same x as level 1's.
            The spacer above stays outside it. */}
        <div className='budgetDetail__content'>
          <div className='page__content'>
            <div className='main__title--container'>
              <Link
                to={withMonthParam(previousRoute, monthParam)}
                relative='path'
                className='iconLeftArrow'
              >
                <LeftArrowLightSvg />
              </Link>

              <div className='form__title form__title--recordName'>
                {capitalize(
                  budgetAccount?.accountName ?? accountRecord?.account_name
                )}
              </div>

              {/* <Link to='edit' className='flx-col-center icon3dots'>
                <Dots3LightSvg />
              </Link> */}

              <div id='edit' className='flx-col-center icon3dots'>
                <Dots3LightSvg />
              </div>
            </div>
          </div>

          {/* Read-only, and no chevron: at this level a picker would be a second
              way to ask what the account's own series answers. The label is the
              resolved month, so it is a skeleton until the answer lands. */}
          {referenceMonth ? (
            <div className='month-badge month-badge--dark'>
              {formatBudgetMonthLabel(referenceMonth)}
            </div>
          ) : (
            <div
              className='month-badge month-badge--dark month-badge--skeleton'
              aria-hidden='true'
            />
          )}

          {summaryData && <SummaryDetailBox bubleInfo={summaryData} />}

          <article className='form__box'>
            <div className='form__container'>
              <div className='input__box'>
                <label className='label forms__label'>{`Current Balance`}</label>

                <div className='input__container' style={{ padding: '0.5rem' }}>
                  {currencyFormat(currency_code, accountRecord?.account_balance)}
                </div>
              </div>

              <div className='input__box'>
                <label className='label forms__label'>{'Account Type'}</label>

                <p className='input__container' style={{ padding: '0.5rem' }}>
                  {accountRecord?.account_type_name}
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
                    {formatDateToDDMMYYYY(accountRecord?.account_start_date)}
                  </div>
                </div>

                <div className='account__currency'>
                  <div className='label forms__label'>{'Currency'}</div>

                  <CurrencyBadge
                    variant={VARIANT_FORM}
                    currency={currency_code}
                  />
                </div>
              </div>
            </div>

            {/* --- TRANSACTION STATEMENT SECTION --- */}
            <div
              className='account-transactions__container '
              style={{ margin: '1rem 0' }}
            >
              {/* The month the budget figures above are about, as the server
                  bounded it on the owner's calendar. */}
              {summaryAccountBalance && (
                <>
                  <div className='period-info'>
                    <div className='period-info__label'>Period</div>
                    <span className='period-info__dates  '>
                      {formatDateToDDMMYYYY(
                        summaryAccountBalance.periodStartDate
                      )}
                      {'  '} / {'  '}{' '}
                      {formatDateToDDMMYYYY(summaryAccountBalance.periodEndDate)}
                    </span>
                  </div>

                  <AccountBalanceSummary
                    summaryAccountBalance={summaryAccountBalance}
                  />
                </>
              )}

              <div className='presentation__card__title__container '>
                <CardTitle>{'Last Movements'}</CardTitle>
              </div>

              {/* Loading, error and empty are three states: a month still on the
                  wire is not a month without movements. */}
              {isLoading && <CoinSpinner />}

              {!isLoading && !error && transactions.length === 0 && (
                <p className='box__subtitle'>
                  No transactions in this account for the period.
                </p>
              )}

              {!isLoading && !error && transactions.length > 0 && (
                <AccountTransactionsList transactions={transactions} />
              )}
            </div>
          </article>

          {/* --- END OF TRANSACTION STATEMENT SECTION --- */}
          {!isLoading && error && (
            <p className='box__subtitle'>Error fetching account info: {error}</p>
          )}
        </div>
      </section>
    </>
  );
}

export default CategoryDetail;
