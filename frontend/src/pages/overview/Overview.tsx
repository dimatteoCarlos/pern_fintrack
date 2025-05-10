import SavingGoals from './components/SavingGoals.tsx';
import AccountBalance from './components/AccountBalance.tsx';
import MonthlyAverage from './components/MonthlyAverage';
import LastMovements from './components/LastMovements.tsx';
import LastDebts from './components/LastDebts.tsx';
import InvestmentAccountBalance from './components/InvestmentAccBalance';

import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';

import {
  url_get_total_account_balance_by_type,
  url_monthly_TotalAmount_ByType,
  url_get_transactions_by_movement,
  url_get_transactions_by_search,
} from '../../endpoints.ts';
import {
  BalancePocketRespType,
  FinancialDataRespType,
  LastMovementRespType,
  MovementTransactionDataType,
} from '../../types/responseApiTypes.ts';

import { overviewFetchAll } from './overviewFetchAll.ts';
import { useEffect, useState } from 'react';
import {
  calculateMonthlyAverage,
  FinancialResultType,
  ResultType,
} from './CalculateMonthlyAverage.ts';
import { CurrencyType } from '../../types/types.ts';

export type CreateNewAccountPropType = {
  originRoute: string;
  createNewAccount(originRoute: string): void;
};

//---------------------------------
const userId = import.meta.env.VITE_USER_ID;

//type of api response

type ApiRespDataType = {
  SavingGoals: BalancePocketRespType | null;
  MonthlyTotalAmountByType: FinancialDataRespType | null;
  MovementTransactionsByType: LastMovementRespType | null;
  MovementDebtTransactions: LastMovementRespType | null;
};
//---------------------
type KPIEndpointType = {
  key: keyof ApiRespDataType;
  url: string;
  type: BalancePocketRespType | FinancialDataRespType | LastMovementRespType;
};

type LastExpenseMovementType = {
  categoryName: string; //category of expense
  record: number; //data or title?
  description: string; //data
  date: Date | string;
  currency: CurrencyType;
};
type LastMovementType = {
  accountName: string; //category of expense
  record: number; //data or title?
  description: string; //data
  date: Date | string;
  currency: CurrencyType;
};

//type of state data
type KPIDataStateType = {
  SavingGoals: BalancePocketRespType | null;
  MonthlyMovementKPI: ResultType | null;
  LastExpenseMovements: LastExpenseMovementType[] | null;
  LastMovements: LastMovementType[] | null;
};
//----------------------------
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
    key: 'MovementTransactionsByType',
    url: `${url_get_transactions_by_movement}?start=&end=&movement=expense&transaction_type=deposit&account_type=category_budget&user=${userId}`,
    type: {} as LastMovementRespType,
  },

  {
    key: 'MovementDebtTransactions',
    url: `${url_get_transactions_by_search}?start=&end=&search=debt&user=${userId}`,
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
  });

  const [loading, setLoading] = useState(true);
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
        const movementTransactionsData =
          result.MovementTransactionsByType.status === 'success'
            ? result.MovementTransactionsByType?.data?.data
            : null;

        const movementTransactions = movementTransactionsData
          ? Array.from({ length: movementTransactionsData.length }, (_, i) => {
              const {
                account_name,
                amount,
                description,
                transaction_actual_date,
                currency_code,
              } = movementTransactionsData[i];

              const obj = {
                categoryName: account_name,
                record: amount, //data or title?
                description: description,
                date: transaction_actual_date,
                currency: currency_code,
              };
              return { ...obj };
            })
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

        setKpiData({
          SavingGoals: savingGoalsData,
          MonthlyMovementKPI: totalAndMonthlyAmount,
          LastExpenseMovements: movementTransactions,
          LastMovements: debtTransactions,
        });
      } catch (err) {
        setError('Failed to load overview data');
        console.error('Overview fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverviewData();
  }, []);

  console.log('estado', kpiData);

  //-----
  // const movementCurrencyKPI = calulcateMonthlyAverage()
  //-----

  if (loading) return <p>Loading...</p>;
  if (error) return <div className='error-message'>{error}</div>;

  return (
    <section className='content__presentation'>
      <div className='cards__presentation'>
        {/* <SavingGoals data={kpiData.SavingsGoals} /> */}
        {/*  */}

        {/*<MonthlyAverage
       data={kpiData.MonthlyMovementKPI}
          
        />*/}

        {
          <AccountBalance
            createNewAccount={createNewAccount}
            originRoute={originRoute}
          />
        }

        {/* {        <InvestmentAccountBalance
          createNewAccount={createNewAccount}
          originRoute={originRoute}
        />} */}

        <LastMovements />

        <LastDebts />
      </div>
    </section>
  );
}
export default Overview;
/*
<section className='content__presentation'>
<div className='cards__presentation'>
  <SavingGoals data={kpiData.SavingGoals} />
  <MonthlyAverage data={kpiData.MonthlyMovementKPI} />
  <AccountBalance
    createNewAccount={createNewAccount}
    originRoute={originRoute}
  />
  <InvestmentAccountBalance
    createNewAccount={createNewAccount}
    originRoute={originRoute}
  />
  <LastMovements data={kpiData.LastExpenseMovements} />
  <LastDebts data={kpiData.LastMovements} />
</div>
</section>
*/

// const endpointsOverview = {
//   //BalancePocketRespType
//   savingGoalsUrl: `${url_get_total_account_balance_by_type}+/type=pocket_saving&user=${userId}`,

//   //FinancialDataRespType
//   monthlyTotaExpenseUrl: `${url_monthly_TotalAmount_ByType}+?type=expense&user=${userId}`,

//   monthlyTotalIncomeUrl: `${url_monthly_TotalAmount_ByType}+?type=income&user=${userId}`,

//   //LastMovementRespType
//   expenseLastMovementsUrl: `${url_get_transactions_by_movement}/?start=&end=&movement=expense&transaction_type=deposit&account_type=category_budget&user=${userId}`,

//   investmentLastMovementsUrl: `${url_get_transactions_by_movement}/?start=&end=&movement=investment&transaction_type=&account_type=investment&&user=${userId}`,

//   debtLastMovementsUrl: `${url_get_transactions_by_movement}/?start=&end=&movement=debt&transaction_type=&account_type=debtor&&user=${userId}`,
// };

//arreglar los componentes para que aceptaen los datos dinamicos, y probar si renderizan
//verficiar l el tipado sobreante, para que y porque
//terminado overview, faltaria que mostrar al hacer click en las burbujas, por ejemplo detalles de cuentas, detalles de movimientos, ver mas movimientos por busqueda o filtrado
//establecer que cuando se abra una cuenta de categoria, no se meta plata, ni de pocket, ni de debtor, porque no dice n de donse sale la otra cuenta cotntraparte.
//faltarian , debt, budget, pocket, creaction de cuentas, manejo de cuentas, yh vistas de detalles, con las box o big boxes con su informacion.
//y despues seguir con income, investmente, debt y pocket y transferecnia de entre cuentas.
//en accounting, pod ponder menu de puntos para ajustar, positivo o negativo.
//fijar el currency en las pantallas de entrada, i y fijarlo a usd.
//que borrar, que editar, quec que filtrar, pagination con scroll infinito?
