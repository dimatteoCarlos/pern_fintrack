// frontend/src/pages/overview/OverviewLayout.tsx
import { useEffect, useMemo, useState } from 'react';

import { BigBoxResult } from './components/BigBoxResult.tsx';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
import './styles/overview-styles.css';
import { MessageToUser } from '../../general_components/messageToUser/MessageToUser.tsx';
// import Overview from './Overview.tsx';

import { url_get_total_account_balance_by_type } from '../../../urlConfig.ts';

import {
  BalanceBankRespType,
  BalanceIncomeRespType,
  DebtorRespType,
} from '../../types/responseApiTypes.ts';

import { useFetch } from '../../hooks/useFetch.ts';
import { Outlet } from 'react-router-dom';
//==================
//==MAIN COMPONENT==
//==================
function OverviewLayout() {
  //Saving Goals
  //--states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  //data fetching balance of account type income_source and category_budget
  const {
    apiData: incomeBalanceApiData,
    isLoading: incomeBalanceIsLoading,
    error: incomeBalanceError,
    // status: incomeBalanceStatus,
  } = useFetch<BalanceIncomeRespType>(
    `${url_get_total_account_balance_by_type}/?type=income_source`,
  );
  // console.log(
  // '🚀 ~ OverviewLayout ~ incomeBalanceApiData:',JSON.stringify({
  // incomeBalanceApiData,
  //   incomeBalanceError,
  //   // incomeBalanceStatus
  // })
  // );
  const {
    apiData: expenseBalanceApiData,
    isLoading: expenseBalanceIsLoading,
    error: expenseBalanceError,
    // status: expenseBalanceStatus,
  } = useFetch<BalanceIncomeRespType>(
    `${url_get_total_account_balance_by_type}/?type=category_budget`,
  );
  // console.log(
  //   '🚀 ~ OverviewLayout ~ expenseBalanceApiData:',JSON.stringify({
  //   // expenseBalanceApiData,
  //   // expenseBalanceError,
  //   expenseBalanceStatus})
  // );

  //--Calculation of Net Worth-----------
  //--bank account total balance
  const {
    apiData: bankBalanceApiData,
    isLoading: bankBalanceIsLoading,
    error: bankBalanceError,
    // status: bankBalanceStatus,
  } = useFetch<BalanceBankRespType>(
    `${url_get_total_account_balance_by_type}/?type=bank`,
  );
  //  console.log(
  //   '🚀 ~ OverviewLayout ~ bankBalanceApiData:',JSON.stringify({
  //   // bankBalanceApiData,
  //   // bankBalanceIsLoading,
  //   // bankBalanceError,
  //   bankBalanceStatus,})
  //     );

  //--investment account total balance
  const {
    apiData: investmentBalanceApiData,
    isLoading: investmentBalanceIsLoading,
    error: investmentBalanceError,
    // status: investmentBalanceStatus,
  } = useFetch<BalanceBankRespType>(
    `${url_get_total_account_balance_by_type}/?type=investment`,
  );
  //  console.log(
  //   '🚀 ~ OverviewLayout ~ investmentBalanceApiData:',JSON.stringify({
  //   // investmentBalanceApiData,
  //   // investmentBalanceIsLoading,
  //   // investmentBalanceError,
  //   investmentBalanceStatus,})
  // );
  //--debtor accounts total balance
  const {
    apiData: debtorBalanceApiData,
    isLoading: debtorBalanceIsLoading,
    error: debtorBalanceError,
    // status: debtorBalanceStatus,
  } = useFetch<DebtorRespType>(
    `${url_get_total_account_balance_by_type}/?type=debtor`,
  );
  // console.log(
  //     '🚀 ~ OverviewLayout ~ debtorBalanceApiData:',
  //  JSON.stringify({
  //     // debtorBalanceApiData,
  //     debtorBalanceIsLoading,
  //     // debtorBalanceError,
  //     debtorBalanceStatus,})
  //   );
  //-------------------------
  //income account balance is negative (withdraws) and expense account balance is positive (deposits)
  const { netWorth, totalIncome, totalExpense } = useMemo(() => {
    //--Parameters to render into bubble info
    // No || 0 default on any of the five: it collapsed two different
    // answers into the same figure. A request that never answered leaves
    // apiData undefined and Number(undefined) is NaN, which now survives to
    // asFigure and prints a dash; a type the user genuinely holds none of
    // answers total_balance null and Number(null) is 0, which still prints
    // zero because that zero is true. The default printed the first as the
    // second, so a dead request stated the user holds nothing.
    // Negating turns an empty income into -0, which formats as -$0.00, so it
    // is normalised the way netWorthRaw already is below.
    const totalIncomeRaw = -Number(incomeBalanceApiData?.data?.total_balance);
    const totalIncome = totalIncomeRaw == 0 ? 0 : totalIncomeRaw;

    // Number() here for the same reason as the other four: without it the
    // value reaches asFigure as whatever the response carried, and a string
    // is not NaN, so a malformed figure would print instead of blanking.
    const totalExpense = Number(expenseBalanceApiData?.data?.total_balance);

    //--Parameters to calculate net worth
    // NaN propagates through the sum on purpose: net worth missing one of
    // its three components is not the user's net worth, and publishing the
    // other two as the whole understates it silently.
    const totalBankBalance = Number(bankBalanceApiData?.data?.total_balance);

    const totalInvestmentBalance = Number(
      investmentBalanceApiData?.data?.total_balance,
    );

    const totalDebtorBalance = Number(
      debtorBalanceApiData?.data?.total_debt_balance,
    );
    // console.log("🚀 ~ operatingProfit:", (totalIncome - totalExpense)==0?0:totalIncome-totalExpense;)

    const netWorthRaw =
      +totalBankBalance + totalInvestmentBalance + totalDebtorBalance;

    // console.log("🚀 ~ OverviewLayout ~ netWorthRaw:", netWorthRaw, totalBankBalance,
    // totalInvestmentBalance,
    // totalDebtorBalance)

    const netWorth = netWorthRaw == 0 ? 0 : netWorthRaw;

    return { totalIncome, totalExpense, netWorth };
  }, [
    incomeBalanceApiData?.data?.total_balance,
    expenseBalanceApiData?.data?.total_balance,
    bankBalanceApiData?.data?.total_balance,
    debtorBalanceApiData?.data?.total_debt_balance,
    investmentBalanceApiData?.data?.total_balance,
  ]);

  //---show error message
  useEffect(() => {
    const error =
      bankBalanceError ||
      expenseBalanceError ||
      incomeBalanceError ||
      investmentBalanceError ||
      debtorBalanceError;

    if (error && error !== lastErrorMessage) {
      setErrorMessage(error);
      setLastErrorMessage(error);

      const timer = setTimeout(() => {
        setErrorMessage(null);

        //allows to show the same error later
        setTimeout(() => {
          setLastErrorMessage(null);
        }, 1000);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [
    incomeBalanceError,
    expenseBalanceError,
    bankBalanceError,
    investmentBalanceError,
    debtorBalanceError,
    lastErrorMessage,
  ]);

  //==================================
  // A figure the page could not compute is published as null, never as 0: the
  // three rows are the user's own money, and 0 states they hold nothing.
  //
  // The guard used to read totalIncome on all three rows, so a broken expense
  // printed as real money and a valid expense blanked whenever income broke.
  const asFigure = (amount: number) => (Number.isNaN(amount) ? null : amount);

  const bigScreenInfo = [
    { title: 'net worth', amount: asFigure(netWorth) },
    { title: 'income', amount: asFigure(totalIncome) },
    { title: 'expenses', amount: asFigure(totalExpense) },
  ];
  //loader for any loading process
  const isAnyLoading =
    bankBalanceIsLoading ||
    investmentBalanceIsLoading ||
    incomeBalanceIsLoading ||
    expenseBalanceIsLoading ||
    debtorBalanceIsLoading;

  return (
    <main className='overviewLayout '>
      <div className='layout__header'>
        <div className='headerContent__container '>
          <TitleHeader />{' '}
        </div>
      </div>

      {isAnyLoading && (
        <div
          className='loader__container'
          style={{ position: 'absolute', left: '50%', top: '20%', zIndex: '1' }}
        >
          <CoinSpinner />
        </div>
      )}

      <BigBoxResult bigScreenInfo={bigScreenInfo} />

      {errorMessage && (
        <MessageToUser
          isLoading={false}
          // isLoading={isLoading}
          messageToUser={errorMessage ?? ''}
          error={errorMessage}
          variant={'form'}
        />
      )}

      <Outlet />
    </main>
  );
}

export default OverviewLayout;
