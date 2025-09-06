import SavingGoals from './components/SavingGoals.tsx';
import AccountBalance from './components/AccountBalance.tsx';
import MonthlyAverage from './components/MonthlyAverage';
import LastMovements, {
  LastMovementType,
} from './components/LastMovements.tsx';
import InvestmentAccountBalance from './components/InvestmentAccBalance';

import {
  url_get_total_account_balance_by_type,
  url_monthly_TotalAmount_ByType,
  dashboardMovementTransactions,
} from '../../endpoints.ts';

import {
  BalancePocketRespType,
  FinancialDataRespType,
  LastMovementRespType,
  // MovementTransactionDataType,
} from '../../types/responseApiTypes.ts';

import { overviewFetchAll } from './overviewFetchAll.ts';
import {
  calculateMonthlyAverage,
  ResultType,
  // FinancialResultType,
} from './CalculateMonthlyAverage.ts';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
// import { CurrencyType } from '../../types/types.ts';

import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import OpenAddEditBtn from '../../general_components/OpenAddEditBtn.tsx';
//---------------------------------
export type CreateNewAccountPropType = {
  originRoute: string;
  createNewAccount(originRoute: string): void;
};
//---------------------------------
const userId = import.meta.env.VITE_USER_ID;

//---type of api response
export type ApiRespDataType = {
  SavingGoals: BalancePocketRespType | null;
  MonthlyTotalAmountByType: FinancialDataRespType | null;
  MovementExpenseTransactions: LastMovementRespType | null;
  MovementDebtTransactions: LastMovementRespType | null;
  MovementIncomeTransactions: LastMovementRespType | null;
  MovementPocketTransactions: LastMovementRespType | null;
  MovementInvestmentTransactions: LastMovementRespType | null;
  MovementPnLTransactions: LastMovementRespType | null;
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
  LastDebtMovements: LastMovementType[] | null;
  LastIncomeMovements: LastMovementType[] | null;
  LastPocketMovements: LastMovementType[] | null;
  LastInvestmentMovements: LastMovementType[] | null;
  LastPnLMovements: LastMovementType[] | null;
};
//-----------------------------------------
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
    key: 'MovementExpenseTransactions',
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
    key: 'MovementIncomeTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=income&user=${userId}`,
    type: {} as LastMovementRespType,
  },
  {
    key: 'MovementPocketTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=pocket&user=${userId}`,
    type: {} as LastMovementRespType,
  },
    {
    key: 'MovementInvestmentTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=investment&user=${userId}`,
    type: {} as LastMovementRespType,
  },
    {
    key: 'MovementPnLTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=pnl&user=${userId}`,
    type: {} as LastMovementRespType,
  },
];
//=======================
//MAIN COMPONENT OVERVIEW
//=======================
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
    LastDebtMovements: null,
    LastIncomeMovements: null,
    LastPocketMovements: null,
    LastInvestmentMovements: null,
    LastPnLMovements: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  //------------------
  //functions
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
        // console.log('🚀 ~ fetchOverviewData ~ result:', result);

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
          result.MovementExpenseTransactions.status === 'success'
            ? result.MovementExpenseTransactions?.data?.data
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
        const movementDebtTransactionsData =
          result.MovementDebtTransactions.status === 'success'
            ? result.MovementDebtTransactions?.data?.data
            : null;

        const movementDebtTransactions = movementDebtTransactionsData
          ? movementDebtTransactionsData?.map((debt) => {
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
          result.MovementIncomeTransactions.status === 'success'
            ? result.MovementIncomeTransactions?.data?.data
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

//---
        const movementInvestmentTransactionsData =
          result.MovementInvestmentTransactions.status === 'success'
            ? result.MovementInvestmentTransactions?.data?.data
            : null;

        const movementInvestmentTransactions = movementInvestmentTransactionsData
          ? Array.from(
              { length: movementInvestmentTransactionsData.length },
              (_, i) => {
                const {
                  account_name,
                  amount,
                  description,
                  transaction_actual_date,
                  currency_code,
                } = movementInvestmentTransactionsData[i];

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
        const movementPnLTransactionsData =
          result.MovementPnLTransactions.status === 'success'
            ? result.MovementPnLTransactions?.data?.data
            : null;

        const movementPnLTransactions = movementPnLTransactionsData
          ? Array.from(
              { length: movementPnLTransactionsData.length },
              (_, i) => {
                const {
                  account_name,
                  amount,
                  description,
                  transaction_actual_date,
                  currency_code,
                } = movementPnLTransactionsData[i];

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
//-------------
        setKpiData({
          SavingGoals: savingGoalsData,
          MonthlyMovementKPI: totalAndMonthlyAmount,
          LastExpenseMovements: movementExpenseTransactions,
          LastDebtMovements: movementDebtTransactions,
          LastIncomeMovements: movementIncomeTransactions,
          LastPocketMovements: movementPocketTransactions,
          LastInvestmentMovements: movementInvestmentTransactions,
          LastPnLMovements: movementPnLTransactions,
        });
      } catch (err:unknown) {
        console.error('Overview fetch error:', err);
        if(err instanceof Error){
          setError(err.message)
        }else {setError(String(err))}
      } finally {
        setIsLoading(false);
      }
    };
//---
    fetchOverviewData();
  }, []);

  // console.log('data state kpi', kpiData);
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
            previousRoute={originRoute}
            accountType={'bank'}
          />
        }

        {
          <InvestmentAccountBalance
          previousRoute={originRoute}
          accountType={'investment'}
          />
        }

        {
        <OpenAddEditBtn   
          btnFunction={createNewAccount}
          btnFunctionArg={originRoute}
          btnPreviousRoute={originRoute}
        >
          <div className='open__btn__label'>Add Account</div>
        </OpenAddEditBtn>
      }
      
        <LastMovements
          data={kpiData.LastExpenseMovements}
          title='Last Movements (expense)'
        />

        <LastMovements
          data={kpiData.LastDebtMovements}
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

        <LastMovements
          data={kpiData.LastInvestmentMovements}
          title='Last Movements (investment)'
        />

        <LastMovements
          data={kpiData.LastPnLMovements}
          title='Last Movements (PnL)'
        />
      </div>
    </section>
  );
}
export default Overview;
