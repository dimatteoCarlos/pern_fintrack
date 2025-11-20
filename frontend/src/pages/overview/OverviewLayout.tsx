// frontend/src/pages/overview/OverviewLayout.tsx
import { useEffect, useMemo, useState } from 'react';

import Overview from './Overview.tsx';
import { BigBoxResult } from './components/BigBoxResult.tsx';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
import './styles/overview-styles.css';
import { MessageToUser } from '../../general_components/messageToUser/MessageToUser.tsx';

import { url_get_total_account_balance_by_type } from '../../endpoints';

import { BalanceBankRespType, BalanceIncomeRespType, BalancePocketRespType, DebtorRespType } from '../../types/responseApiTypes';

import { useFetch } from '../../hooks/useFetch.ts';
//==================
//==MAIN COMPONENT==
//==================
function OverviewLayout() {
//Saving Goals
// const userId = import.meta.env.VITE_USER_ID;
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
    `${url_get_total_account_balance_by_type}/?type=income_source`
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
    `${url_get_total_account_balance_by_type}/?type=category_budget`
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
    `${url_get_total_account_balance_by_type}/?type=bank`
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
    `${url_get_total_account_balance_by_type}/?type=investment`
  );
  //  console.log(
  //   '🚀 ~ OverviewLayout ~ investmentBalanceApiData:',JSON.stringify({
  //   // investmentBalanceApiData,
  //   // investmentBalanceIsLoading,
  //   // investmentBalanceError,
  //   investmentBalanceStatus,})
  // );
//--Pocket accounts total balance
const {
  apiData: pocketBalanceApiData,
  isLoading: pocketBalanceIsLoading,
  error: pocketBalanceError,
  // status: pocketBalanceStatus,
} = useFetch<BalancePocketRespType>(
  `${url_get_total_account_balance_by_type}/?type=pocket_saving`
);
  //  console.log(
  //   '🚀 ~ OverviewLayout ~ pocketBalanceApiData:',JSON.stringify({
  //   // pocketBalanceApiData,
  //   // pocketBalanceIsLoading,
  //   // pocketBalanceError,
  //   // pocketBalanceStatus,})
  // );
//--debtor accounts total balance
const {
  apiData: debtorBalanceApiData,
  isLoading: debtorBalanceIsLoading,
  error: debtorBalanceError,
  // status: debtorBalanceStatus,
} = useFetch<DebtorRespType>(
  `${url_get_total_account_balance_by_type}/?type=debtor`
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
 const totalIncome =
  -(Number(incomeBalanceApiData?.data?.total_balance)) || 0 ;

 const totalExpense = expenseBalanceApiData?.data?.total_balance || 0;

//--Parameters to calculate net worth
//  const totalBankBalance =
//   (Number(bankBalanceApiData?.data?.total_balance) ?? 0) ;

const totalBankBalance = 
  (Number(bankBalanceApiData?.data?.total_balance) || 0); 

const totalPocketBalance =
  (Number(pocketBalanceApiData?.data?.total_balance) || 0) ;

const totalInvestmentBalance =
  (Number(investmentBalanceApiData?.data?.total_balance) || 0) ;

const totalDebtorBalance =
  (Number(debtorBalanceApiData?.data?.total_debt_balance) || 0) ;
// console.log("🚀 ~ operatingProfit:", (totalIncome - totalExpense)==0?0:totalIncome-totalExpense;)

const netWorthRaw= (
    +totalBankBalance+
    totalPocketBalance+
    totalInvestmentBalance+
    totalDebtorBalance)
    
// console.log("🚀 ~ OverviewLayout ~ netWorthRaw:", netWorthRaw, totalBankBalance,
// totalPocketBalance,
// totalInvestmentBalance,
// totalDebtorBalance)

const netWorth=netWorthRaw==0?0:netWorthRaw

return { totalIncome, totalExpense, netWorth };
  }, [
    incomeBalanceApiData?.data?.total_balance,
    expenseBalanceApiData?.data?.total_balance,bankBalanceApiData?.data?.total_balance, debtorBalanceApiData?.data?.total_debt_balance, investmentBalanceApiData?.data?.total_balance,pocketBalanceApiData?.data?.total_balance
  ]);
 
//---show error message
  useEffect(() => {
    const error =
    bankBalanceError ||
    expenseBalanceError ||
    incomeBalanceError ||
    investmentBalanceError ||
    pocketBalanceError ||
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
    }, [incomeBalanceError, expenseBalanceError,bankBalanceError,
    investmentBalanceError,
    pocketBalanceError,
    debtorBalanceError,lastErrorMessage]);

 //==================================
  const bigScreenInfo = [
    { title: 'net worth', amount: isNaN(netWorth)?0:netWorth },
    { title: 'income', amount: isNaN(totalIncome)?0:totalIncome },
    { title: 'expenses', amount: isNaN(totalIncome)?0:totalExpense },
  ];
//loader for any loading process
const isAnyLoading = bankBalanceIsLoading||
  investmentBalanceIsLoading||
    pocketBalanceIsLoading|| incomeBalanceIsLoading||expenseBalanceIsLoading ||debtorBalanceIsLoading

  return (
    <main className='overviewLayout '>
      <div className='layout__header'>
        <div className='headerContent__container '>
          <TitleHeader />{' '}
        </div>
      </div>

      {(isAnyLoading) && (
        <div
          className='loader__container'
          style={{ position: 'absolute', left: '50%', top: '20%', zIndex: '1' }}
        >
          <CoinSpinner />
        </div>
      )}

      <BigBoxResult bigScreenInfo={bigScreenInfo} />

      {errorMessage  && (
          <MessageToUser
            isLoading={false}
            // isLoading={isLoading}
            messageToUser={errorMessage ??"" }
            error={errorMessage}
            variant={'form'}
          />
        )}

      <Overview />
    </main>
  );
}

export default OverviewLayout;
