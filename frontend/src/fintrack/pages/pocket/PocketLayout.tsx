//frontend\src\fintrack\pages\budget\BudgetLayout.tsx
import { useEffect, useMemo, useState } from 'react';
import { url_get_total_account_balance_by_type } from '../../../urlConfig.ts';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import { useFetch } from '../../hooks/useFetch.ts';
import { BalanceCategoryRespType } from '../../types/responseApiTypes.ts';
import PocketBigBoxResult from './components/PocketBigBoxResult.tsx';

import './styles/pocket-styles.css';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
import { Outlet } from 'react-router-dom';

function PocketLayout() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  //total pocket balance
  const pocketUrl = `${url_get_total_account_balance_by_type}?type=pocket_saving`;

  const { apiData, isLoading, error } =
    useFetch<BalanceCategoryRespType>(pocketUrl);

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
      <div className='budgetLayout'>
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

        <PocketBigBoxResult bigScreenInfo={bigScreenInfo} currency={currency} />

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
        <Outlet />
      </div>
    </>
  );
}

export default PocketLayout;
