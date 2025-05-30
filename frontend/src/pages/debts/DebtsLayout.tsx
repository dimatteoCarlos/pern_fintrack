import DebtsBigBoxResult from './components/DebtsBigBoxResult.tsx';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import Debtors from './components/Debtors.tsx';
import './styles/debts-styles.css';
import { DEFAULT_CURRENCY } from '../../helpers/constants.ts';
import { url_get_total_account_balance_by_type } from '../../endpoints.ts';
import { useEffect, useMemo, useState } from 'react';
import { useFetch } from '../../hooks/useFetch.tsx';
import { DebtorRespType } from '../../types/responseApiTypes.ts';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;

//--------------------------------------

function DebtsLayout() {
  const userId = import.meta.env.VITE_USER_ID;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debtUrl = `${url_get_total_account_balance_by_type}?type=debtor&user=${userId}`;

  const { apiData, isLoading, error } = useFetch<DebtorRespType>(debtUrl);

  //--------------------------------------
  useEffect(() => {
    if (error) {
      setErrorMessage(error);
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  //--------------------------------------
  const {
    total_debt_balance,
    debt_receivable,
    debt_payable,
    debtors,
    creditors,
    // debtors_without_debt,
    currency,
  } = useMemo(() => {
    return {
      total_debt_balance: apiData?.data.total_debt_balance ?? 0,

      debt_payable: apiData?.data.debt_payable ?? 0,
      creditors: apiData?.data.creditors ?? 0,

      debtors: apiData?.data.debtors ?? 0,
      debt_receivable: apiData?.data.debt_receivable ?? 0,


      debtors_without_debt: apiData?.data.debtors_without_debt ?? 0,

      currency: apiData?.data.currency_code ?? defaultCurrency,
    };
  }, [
    apiData?.data.total_debt_balance,
    apiData?.data.debt_payable,
    apiData?.data.debt_receivable,
    apiData?.data.debtors,
    apiData?.data.creditors,
    apiData?.data.debtors_without_debt,
    apiData?.data.currency_code,
  ]);

  const bigScreenInfo = [
    {
      title: total_debt_balance >= 0 ? "you're owed" : 'you owe',
      amount: total_debt_balance,
    },
      {
      title: 'receivable',
      amount: debt_receivable,
    },
      {
      title: 'debtors',
      amount: debtors,
    },
    {
      title: 'payable',
      amount: debt_payable,
    },
  
  
    {
      title: 'creditors',
      amount: creditors,
    },
  ];

  return (
    <div className='debtsLayout'>
      <div className='layout__header'>
        <div className='headerContent__container'>
          <TitleHeader />
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

      <DebtsBigBoxResult
        bigScreenInfo={bigScreenInfo}
        currency={currency}
      ></DebtsBigBoxResult>

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
          Error: {errorMessage}
        </p>
      )}
      <Debtors />
    </div>
  );
}

export default DebtsLayout;
