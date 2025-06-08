import SavingGoals from './components/SavingGoals.tsx';
import AccountBalance from './components/AccountBalance.tsx';
import MonthlyAverage from './components/MonthlyAverage';
import LastMovements, {
  LastMovementType,
} from './components/LastMovements.tsx';
import InvestmentAccountBalance from './components/InvestmentAccBalance';
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';

import {
  url_get_total_account_balance_by_type,
  url_monthly_TotalAmount_ByType,
  // dashboardMovementTransactionsByType,
  dashboardMovementTransactions,
} from '../../endpoints.ts';

import {
  BalancePocketRespType,
  FinancialDataRespType,
  LastMovementRespType,
  // MovementTransactionDataType,
} from '../../types/responseApiTypes.ts';

import { overviewFetchAll } from './overviewFetchAll.ts';
import { useEffect, useState } from 'react';
import {
  calculateMonthlyAverage,
  ResultType,
  // FinancialResultType,
} from './CalculateMonthlyAverage.ts';
// import { CurrencyType } from '../../types/types.ts';

import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';

export type CreateNewAccountPropType = {
  originRoute: string;
  createNewAccount(originRoute: string): void;
};

//---------------------------------
const userId = import.meta.env.VITE_USER_ID;

//---type of api response
type ApiRespDataType = {
  SavingGoals: BalancePocketRespType | null;
  MonthlyTotalAmountByType: FinancialDataRespType | null;
  MovementExpenseTransactionsByType: LastMovementRespType | null;
  MovementDebtTransactions: LastMovementRespType | null;
  MovementIncomeTransactionsByType: LastMovementRespType | null;
  MovementPocketTransactions: LastMovementRespType | null;
};
//---endpoint config------------------
type KPIEndpointType = {
  key: keyof ApiRespDataType;
  url: string;
  type: BalancePocketRespType | FinancialDataRespType | LastMovementRespType;
};

//type of state data to render
type KPIDataStateType = {
  SavingGoals: BalancePocketRespType | null; //??
  MonthlyMovementKPI: ResultType | null;
  LastExpenseMovements: LastMovementType[] | null;
  LastMovements: LastMovementType[] | null;
  LastIncomeMovements: LastMovementType[] | null;
  LastPocketMovements: LastMovementType[] | null;
};
//----------------------------------------------
//data to be fetched
const overviewKPIendpoints: KPIEndpointType[] = [
  {
    key: 'SavingGoals',
    url: `${url_get_total_account_balance_by_type}/?type=pocket_saving&user=${userId}`,
    type: {} as BalancePocketRespType,
  },
  {
    key: 'MonthlyTotalAmountByType',
    url: `${url_monthly_TotalAmount_ByType}?type=expense&user=${userId}`,
    type: {} as FinancialDataRespType,
  },
  {
    key: 'MovementExpenseTransactionsByType',
    url: `${dashboardMovementTransactions}?start=&end=&movement=expense&transaction_type=&account_type=category_budget&user=${userId}`,
    type: {} as LastMovementRespType,
  },

  {
    key: 'MovementDebtTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=debt&user=${userId}`,
    // url: `${url_get_transactions_by_search}?start=&end=&search=debt&user=${userId}`,
    type: {} as LastMovementRespType,
  },
  {
    key: 'MovementIncomeTransactionsByType',
    url: `${dashboardMovementTransactions}?start=&end=&movement=incom&user=${userId}`,
    type: {} as LastMovementRespType,
  },
  {
    key: 'MovementPocketTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=pocket&user=${userId}`,
    type: {} as LastMovementRespType,
  },
];
//--------------------------
// type CreateNewAccountProps = {
//   originRoute: string;
//   onCreateAccount: (route: string) => void;
// };
//----------------------------------------------------
function Overview() {
  const navigateTo: NavigateFunction = useNavigate();
  const location = useLocation();
  const originRoute = location.pathname;
  // console.log({ originRoute });
  //states----
  const [kpiData, setKpiData] = useState<KPIDataStateType>({
    SavingGoals: null,
    MonthlyMovementKPI: null,
    LastExpenseMovements: null,
    LastMovements: null,
    LastIncomeMovements: null,
    LastPocketMovements: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  //------------------

  //------------------
  function createNewAccount(originRoute: string) {
    navigateTo(originRoute + '/new_account', {
      state: { previousRoute: originRoute },
    });
  }
  //------------------
  useEffect(() => {
    const fetchOverviewData = async () => {
      try {
        const result = await overviewFetchAll(overviewKPIendpoints);
        console.log('🚀 ~ fetchOverviewData ~ result:', result);

        if (!result) {
          throw new Error('No data received from API');
        }

        const savingGoalsData =
          result.SavingGoals.status === 'success'
            ? result.SavingGoals.data
            : null;
        //---
        const monthlyAmounts =
          result.MonthlyTotalAmountByType.status === 'success'
            ? result.MonthlyTotalAmountByType?.data?.data.monthlyAmounts
            : null;

        const totalAndMonthlyAmount = monthlyAmounts
          ? calculateMonthlyAverage(monthlyAmounts)
          : null;

        //-------------------
        const movementExpenseTransactionsData =
          result.MovementExpenseTransactionsByType.status === 'success'
            ? result.MovementExpenseTransactionsByType?.data?.data
            : null;

        const movementExpenseTransactions = movementExpenseTransactionsData
          ? Array.from(
              { length: movementExpenseTransactionsData.length },
              (_, i) => {
                const {
                  account_name,
                  amount,
                  description,
                  transaction_actual_date,
                  currency_code,
                } = movementExpenseTransactionsData[i];

                const obj = {
                  accountName: account_name,
                  record: amount, //data? or title?
                  description: description,
                  date: transaction_actual_date,
                  currency: currency_code,
                };
                return { ...obj };
              }
            )
          : null;

        //---
        const debtTransactionsData =
          result.MovementDebtTransactions.status === 'success'
            ? result.MovementDebtTransactions?.data?.data
            : null;

        const debtTransactions = debtTransactionsData
          ? debtTransactionsData?.map((debt) => {
              const {
                account_name,
                amount,
                description,
                transaction_actual_date,
                currency_code,
              } = debt;

              return {
                accountName: account_name,
                record: amount, //data or title?
                description: description, //data
                date: transaction_actual_date,
                currency: currency_code,
              };
            })
          : null;

        //---
        const movementIncomeTransactionsData =
          result.MovementIncomeTransactionsByType.status === 'success'
            ? result.MovementIncomeTransactionsByType?.data?.data
            : null;

        const movementIncomeTransactions = movementIncomeTransactionsData
          ? Array.from(
              { length: movementIncomeTransactionsData.length },
              (_, i) => {
                const {
                  account_name,
                  amount,
                  description,
                  transaction_actual_date,
                  currency_code,
                } = movementIncomeTransactionsData[i];

                const obj = {
                  accountName: account_name,
                  record: amount, //data? or title?
                  description: description,
                  date: transaction_actual_date,
                  currency: currency_code,
                };
                return { ...obj };
              }
            )
          : null;
        //---

        const movementPocketTransactionsData =
          result.MovementPocketTransactions.status === 'success'
            ? result.MovementPocketTransactions?.data?.data
            : null;

        const movementPocketTransactions = movementPocketTransactionsData
          ? Array.from(
              { length: movementPocketTransactionsData.length },
              (_, i) => {
                const {
                  account_name,
                  amount,
                  description,
                  transaction_actual_date,
                  currency_code,
                } = movementPocketTransactionsData[i];

                const obj = {
                  accountName: account_name,
                  record: amount, //data? or title?
                  description: description,
                  date: transaction_actual_date,
                  currency: currency_code,
                };
                return { ...obj };
              }
            )
          : null;

        console.log('recvisar result pocket6', result);

        //-------------
        setKpiData({
          SavingGoals: savingGoalsData,
          MonthlyMovementKPI: totalAndMonthlyAmount,
          LastExpenseMovements: movementExpenseTransactions,
          LastMovements: debtTransactions,
          LastIncomeMovements: movementIncomeTransactions,
          LastPocketMovements: movementPocketTransactions,
        });
      } catch (err) {
        setError('Failed to load overview data');
        // console.log('pocket', kpiData.LastPocketMovements);
        console.error('Overview fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverviewData();
  }, []);

  console.log('estado', kpiData);

  //-----

  if (error) return <div className='error-message'>{error}</div>;

  return (
    <section className='content__presentation'>
      <div className='cards__presentation'>
        {isLoading && (
          <div
            className='loader__container'
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              zIndex: '1',
            }}
          >
            <CoinSpinner />
          </div>
        )}

        <SavingGoals data={kpiData.SavingGoals} />
        {/*  */}

        <MonthlyAverage data={kpiData.MonthlyMovementKPI} />

        {
          <AccountBalance
            createNewAccount={createNewAccount}
            originRoute={originRoute}
          />
        }

        {
          <InvestmentAccountBalance
            createNewAccount={createNewAccount}
            originRoute={originRoute}
          />
        }

        <LastMovements
          data={kpiData.LastExpenseMovements}
          title='Last Movements (expense)'
        />

        <LastMovements
          data={kpiData.LastMovements}
          title='Last Movements (debts)'
        />

        {
          <LastMovements
            data={kpiData.LastIncomeMovements}
            title='Last Movements (income)'
          />
        }

        <LastMovements
          data={kpiData.LastPocketMovements}
          title='Last Movements (pocket)'
        />
      </div>
    </section>
  );
}
export default Overview;
