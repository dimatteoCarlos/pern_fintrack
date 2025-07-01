// OverviewLayout.tsx

import Overview from './Overview';
import { BigBoxResult } from './components/BigBoxResult';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader';
import { url_get_total_account_balance_by_type } from '../../endpoints';
import { BalanceIncomeRespType } from '../../types/responseApiTypes';
import { useFetch } from '../../hooks/useFetch';
import { useEffect, useMemo, useState } from 'react';
import CoinSpinner from '../../loader/coin/CoinSpinner';

import './styles/overview-styles.css';
// import { Outlet } from 'react-router-dom';

function OverviewLayout() {
  //Temporary Dummy data
  //Saving Goals
  //to be fetched from data bases. Need ENDPOINT to get from backend.

  const userId = import.meta.env.VITE_USER_ID;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  //data fetching balance of account type income_source and category_budget
  const {
    apiData: incomeBalanceApiData,
    isLoading: incomeBalanceIsLoading,
    error: incomeBalanceError,
    // status: incomeBalanceStatus,
  } = useFetch<BalanceIncomeRespType>(
    `${url_get_total_account_balance_by_type}/?type=income_source&user=${userId}`
  );
  // console.log(
  //   '🚀 ~ OverviewLayout ~ incomeBalanceApiData:',
  //   incomeBalanceApiData,
  //   incomeBalanceError,
  //   incomeBalanceStatus
  // );

  const {
    apiData: expenseBalanceApiData,
    isLoading: expenseBalanceIsLoading,
    error: expenseBalanceError,
    status: expenseBalanceStatus,
  } = useFetch<BalanceIncomeRespType>(
    `${url_get_total_account_balance_by_type}/?type=category_budget&user=${userId}`
  );

  console.log(
    '🚀 ~ OverviewLayout ~ expenseBalanceApiData:',
    // expenseBalanceApiData,
    expenseBalanceError,
    expenseBalanceStatus
  );
  //---show error message
  useEffect(() => {
    if (incomeBalanceError || expenseBalanceError) {
      setErrorMessage(incomeBalanceError || expenseBalanceError);
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [incomeBalanceError, expenseBalanceError]);

  //-------------------------
  //remeber income account balance is negative (withdraws) and expense accoutn balance is positive (deposits)
  const { netWorth, totalIncome, totalExpense } = useMemo(() => {
    const totalIncome =
      Math.abs(Number(incomeBalanceApiData?.data?.total_balance) ?? 0) ;

    const totalExpense = expenseBalanceApiData?.data?.total_balance ?? 0;
    const netWorth= (totalIncome - totalExpense)==0?0:totalIncome-totalExpense

    return { totalIncome, totalExpense, netWorth };
  }, [
    incomeBalanceApiData?.data?.total_balance,
    expenseBalanceApiData?.data?.total_balance,
  ]);

  const bigScreenInfo = [
    { title: 'net worth', amount: isNaN(netWorth)?0:netWorth },
    { title: 'income', amount: isNaN(totalIncome)?0:totalIncome },
    { title: 'expenses', amount: isNaN(totalIncome)?0:totalExpense },
  ];

  return (
    <main className='overviewLayout '>
      <div className='layout__header'>
        <div className='headerContent__container '>
          <TitleHeader />{' '}
        </div>
      </div>
      {(incomeBalanceIsLoading || expenseBalanceIsLoading) && (
        <div
          className='loader__container'
          style={{ position: 'absolute', left: '50%', top: '20%', zIndex: '1' }}
        >
          <CoinSpinner />
        </div>
      )}

      <BigBoxResult bigScreenInfo={bigScreenInfo} />

      {(incomeBalanceError || expenseBalanceError) && (
        <p
          style={{
            color: 'red',
            position: 'absolute',
            top: '1.5%',
            left: '10%',
            zIndex: '150',
          }}
        >
          {/* Error: */}
           {errorMessage}
        </p>
      )}
      <Overview />
    </main>
  );
}

export default OverviewLayout;
