//DebtsLayout.tsx
import { useEffect, useMemo, useState } from 'react';
import { url_get_total_account_balance_by_type } from '../../endpoints';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader';
import { useFetch } from '../../hooks/useFetch.ts';
import { BalanceCategoryRespType } from '../../types/responseApiTypes';
import Budget from './Budget';
import BudgetBigBoxResult from './components/BudgetBigBoxResult';
import './styles/budget-styles.css';
import CoinSpinner from '../../loader/coin/CoinSpinner';

function BudgetLayout() {

  // console.log('')
  //temporary values------------
  const userId = import.meta.env.VITE_USER_ID;
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  const budgetUrl = `${url_get_total_account_balance_by_type}?type=category_budget&user=${userId}`;

  const { apiData, isLoading, error } =
    useFetch<BalanceCategoryRespType>(budgetUrl);

  useEffect(() => {
    if (error) {
      setErrorMessage(error);
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);
//--------------------------------------
  const { total_balance, total_budget, total_remaining, currency } =
    useMemo(() => {
      return {
        total_balance: apiData?.data.total_balance ?? 0,
        total_budget: apiData?.data.total_budget ?? 0,
        total_remaining: apiData?.data.total_remaining ?? 0,
        currency: apiData?.data.currency_code,
      };
    }, [
      apiData?.data.total_balance,
      apiData?.data.total_budget,
      apiData?.data.total_remaining,
      apiData?.data.currency_code,
    ]);

  // const bigScreenInfo = [
  const bigScreenInfo = [
    { title: 'total budget', amount: total_budget },
    { title: 'Remaining', amount: total_remaining },
    { title: 'expenses', amount: total_balance },
  ];

  return (
    <>
      <div className='budgetLayout '>
        <div className='layout__header'>
          <div className='headerContent__container'>
            <TitleHeader></TitleHeader>
          </div>
        </div>

        {isLoading && (
          <div
            className='loader__container'
            style={{
              position: 'absolute',
              left: '50%',
              top: '20%',
              zIndex: '1',
            }}
          >
            <CoinSpinner />
          </div>
        )}

        <BudgetBigBoxResult bigScreenInfo={bigScreenInfo} currency={currency} />

        {error && (
          <p
            style={{
              color: 'red',
              position: 'absolute',
              top: '1.5%',
              left: '10%',
              zIndex: '150',
            }}
          >
            {/* Error:  */}
            {errorMessage}
          </p>
        )}
        <Budget />
      </div>
    </>
  );
}

export default BudgetLayout;
