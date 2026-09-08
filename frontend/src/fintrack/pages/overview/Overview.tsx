// frontend/src/pages/overview/Overview.tsx
//HOOKS
import { useEffect, useState } from 'react';

//NAVIGATION
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../../auth/hooks/useAuth.ts';

// UI COMPONENTS
import AccountBalance from './components/AccountBalance.tsx';
import MonthlyAverage from './components/MonthlyAverage.tsx';
import LastMovements, {
  LastMovementType,
} from './components/LastMovements.tsx';
import InvestmentAccountBalance from './components/InvestmentAccBalance.tsx';
import OpenAddEditBtn from '../../general_components/OpenAddEditBtn.tsx';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';

//ENDPOINTS
import {
  // Retired below, with the widget that was its only caller. MonthlyAverage.tsx
  // reads the monthly snapshot off useOverviewStore now, so no frontend module
  // requests this route any more. Commented and not deleted: the route and its
  // service still exist, and this line is the record of who used to call them.
  // url_monthly_TotalAmount_ByType,
  dashboardMovementTransactions,
} from '../../../urlConfig.ts';

//TYPES
import {
  FinancialDataRespType,
  LastMovementRespType,
  // YearlyTotalsType,
} from '../../types/responseApiTypes.ts';
// import { CurrencyType } from '../../types/types.ts';

//FUNCTIONS
import { overviewFetchAll } from './overviewFetchAll.ts';
// The browser-side average the widget used to run. The same four figures now
// arrive computed in makeMonthlySnapshot.js, so nothing here calls it.
// import {
//   calculateMonthlyAverage,
//   ResultType,
//   // FinancialResultType,
// } from './CalculateMonthlyAverage.ts';

//---------------------------------
export type CreateNewAccountPropType = {
  originRoute: string;
  createNewAccount(originRoute: string): void;
};
//---------------------------------
// const userId = import.meta.env.VITE_USER_ID;
//---TYPE OF API RESPONSE
export type ApiRespDataType = {
  MonthlyTotalAmountByType: FinancialDataRespType | null;
  MovementExpenseTransactions: LastMovementRespType | null;
  MovementDebtTransactions: LastMovementRespType | null;
  MovementIncomeTransactions: LastMovementRespType | null;
  MovementInvestmentTransactions: LastMovementRespType | null;
  MovementPnLTransactions: LastMovementRespType | null;
};
//---ENDPOINT CONFIG------------
type KPIEndpointType = {
  key: keyof ApiRespDataType;
  url: string;
  type: FinancialDataRespType | LastMovementRespType;
};

//type of state data to render
type KPIDataStateType = {
  // Both moved to useOverviewStore with the widget that read them.
  // MonthlyMovementKPI: ResultType | null;
  // YearlyTotals: YearlyTotalsType | null;
  LastExpenseMovements: LastMovementType[] | null;
  LastDebtMovements: LastMovementType[] | null;
  LastIncomeMovements: LastMovementType[] | null;
  LastInvestmentMovements: LastMovementType[] | null;
  LastPnLMovements: LastMovementType[] | null;
};
//-----------------------------------------
//CONFIG of DATA TO BE FETCHED
const overviewKPIendpoints: KPIEndpointType[] = [
  // One request fewer on first paint. The three monthly averages, their month
  // counts and the year to date are all in the /overview payload the layout
  // already fetched, so asking a second route for the same figures both costs a
  // round trip and lets the two disagree: this one was pinned to ?type=expense
  // and cut against its own window, not against the month the page is showing.
  //
  // The key stays in ApiRespDataType above so overviewFetchAll keeps its type
  // guard and its five other branches untouched. Nothing reads the result that
  // is now absent from the object it returns.
  // {
  //   key: 'MonthlyTotalAmountByType',
  //   url: `${url_monthly_TotalAmount_ByType}?type=expense`,
  //   type: {} as FinancialDataRespType,
  // },
  {
    key: 'MovementExpenseTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=expense&transaction_type=&account_type=category_budget`,
    type: {} as LastMovementRespType,
  },
  {
    key: 'MovementDebtTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=debt`,
    type: {} as LastMovementRespType,
  },
  {
    key: 'MovementIncomeTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=income`,
    type: {} as LastMovementRespType,
  },
  {
    key: 'MovementInvestmentTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=investment`,
    type: {} as LastMovementRespType,
  },
  {
    key: 'MovementPnLTransactions',
    url: `${dashboardMovementTransactions}?start=&end=&movement=pnl`,
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
  //-- STATES----
  const [kpiData, setKpiData] = useState<KPIDataStateType>({
    // MonthlyMovementKPI: null,
    // YearlyTotals: null,
    LastExpenseMovements: null,
    LastDebtMovements: null,
    LastIncomeMovements: null,
    LastInvestmentMovements: null,
    LastPnLMovements: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AUTHENTICATION STATE
  const { isAuthenticated, isCheckingAuth } = useAuth();
  //------------------
  //FUNCTIONS
  function createNewAccount(originRoute: string) {
    navigateTo(originRoute + '/new_account', {
      state: { previousRoute: originRoute },
    });
  }

  //--start overviewFetchAll
  useEffect(() => {
    if (isCheckingAuth || !isAuthenticated) {
      return;
    }
    const fetchOverviewData = async () => {
      try {
        const result = await overviewFetchAll(overviewKPIendpoints);
        // console.log('🚀 ~ fetchOverviewData ~ result:', result);

        if (!result) {
          throw new Error('No data received from API');
        }
        //----------------
        // The average, its month count and the year to date are served by
        // makeMonthlySnapshot.js and read from the store by the widget. Kept
        // here commented because these three lines are the only statement of
        // what the browser used to derive and from which endpoint.
        // const monthlyAmounts =
        //   result.MonthlyTotalAmountByType.status === 'success'
        //     ? result.MonthlyTotalAmountByType?.data?.data.monthlyAmounts
        //     : null;
        //
        // const totalAndMonthlyAmount = monthlyAmounts
        //   ? calculateMonthlyAverage(monthlyAmounts)
        //   : null;
        //
        // const yearlyTotals =
        //   result.MonthlyTotalAmountByType.status === 'success'
        //     ? (result.MonthlyTotalAmountByType?.data?.data.yearlyTotals ?? null)
        //     : null;

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
                  note,
                  transaction_actual_date,
                  currency_code, transaction_id,
                } = movementExpenseTransactionsData[i];

                const obj = {
                  accountName: account_name,
                  record: amount, //data? or title?
                  description: description,
                  note,
                  date: transaction_actual_date,
                  currency: currency_code,  transactionId: transaction_id,
                };
                return { ...obj };
              },
            )
          : null;
        //------------------------------------------
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
                note,
                transaction_actual_date,
                currency_code,
                transaction_id,
              } = debt;

              return {
                accountName: account_name,
                record: amount, //data or title?
                description: description, //data
                note,
                date: transaction_actual_date,
                currency: currency_code,
                  transactionId:transaction_id,
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
                  note,
                  transaction_actual_date,
                  currency_code, transaction_id,
                } = movementIncomeTransactionsData[i];

                const obj = {
                  accountName: account_name,
                  record: amount, //data? or title?
                  description: description,
                  note,
                  date: transaction_actual_date,
                  currency: currency_code,  transactionId: transaction_id,
                };
                return { ...obj };
              },
            )
          : null;
        //--------------------------------
        const movementInvestmentTransactionsData =
          result.MovementInvestmentTransactions.status === 'success'
            ? result.MovementInvestmentTransactions?.data?.data
            : null;

        const movementInvestmentTransactions =
          movementInvestmentTransactionsData
            ? Array.from(
                { length: movementInvestmentTransactionsData.length },
                (_, i) => {
                  const {
                    account_name,
                    amount,
                    description,
                    note,
                    transaction_actual_date,
                    currency_code,  transaction_id,
                  } = movementInvestmentTransactionsData[i];

                  const obj = {
                    accountName: account_name,
                    record: amount, //data? or title?
                    description: description,
                    note,
                    date: transaction_actual_date,
                    currency: currency_code,  transactionId: transaction_id,
                  };
                  return { ...obj };
                },
              )
            : null;
        //---------------
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
                  note,
                  transaction_actual_date,
                  currency_code,  transaction_id,
                } = movementPnLTransactionsData[i];

                const obj = {
                  accountName: account_name,
                  record: amount, //data? or title?
                  description: description,
                  note,
                  date: transaction_actual_date,
                  currency: currency_code,  transactionId: transaction_id,
                };
                return { ...obj };
              },
            )
          : null;
        //-------------
        setKpiData({
          // MonthlyMovementKPI: totalAndMonthlyAmount,
          // YearlyTotals: yearlyTotals,
          LastExpenseMovements: movementExpenseTransactions,
          LastDebtMovements: movementDebtTransactions,
          LastIncomeMovements: movementIncomeTransactions,
          LastInvestmentMovements: movementInvestmentTransactions,
          LastPnLMovements: movementPnLTransactions,
        });
      } catch (err: unknown) {
        console.error('Overview fetch error:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(String(err));
        }
      } finally {
        setIsLoading(false);
      }
    };
    //--------------------------------------
    fetchOverviewData();
  }, [isAuthenticated, isCheckingAuth]);

  // console.log('data state kpi', kpiData);
  //--RENDER ----
  if (error) return <div className='error-message'>{error}</div>;

  //Rendering condition
  if (isCheckingAuth) {
    return <CoinSpinner />;
  }

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

        {/* No props: the widget subscribes to useOverviewStore, which the
            layout above it has already filled for the month on screen. Passing
            them from here would have made this page fetch a month of its own,
            and the two months would drift the moment the picker moved. */}
        <MonthlyAverage />

        {
          <OpenAddEditBtn
            btnFunction={createNewAccount}
            btnFunctionArg={originRoute}
            btnPreviousRoute={originRoute}
          >
            <div className='open__btn__label'>Add Account</div>
          </OpenAddEditBtn>
          }

        {<AccountBalance previousRoute={originRoute} accountType={'bank'} />}

        {
          <InvestmentAccountBalance
            previousRoute={originRoute}
            accountType={'investment'}
          />
        }
{/* ------------------ */}
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