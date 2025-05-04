import SavingGoals from './components/SavingGoals.tsx';
import AccountBalance from './components/AccountBalance.tsx';
import LastMovements from './components/LastMovements.tsx';
import LastDebts from './components/LastDebts.tsx';
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import InvestmentAccountBalance from './components/InvestmentAccBalance';
import MonthlyAverage from './components/MonthlyAverage';
import {
  url_get_total_account_balance_by_type,
  url_monthly_TotalAmount_ByType,
} from '../../endpoints.ts';

export type CreateNewAccountPropType = {
  originRoute: string;
  createNewAccount(originRoute: string): void;
};

function Overview() {
  const navigateTo: NavigateFunction = useNavigate();
  const location = useLocation();
  const originRoute = location.pathname;
  // console.log({ originRoute });

  //------------------
  function createNewAccount(originRoute: string) {
    navigateTo(originRoute + '/new_account', {
      state: { previousRoute: originRoute },
    });
  }
  //-----------------
  const userId = import.meta.env.VITE_USER_ID;
  const endpointsOverview = {
    savingGoalsUrl: `${url_get_total_account_balance_by_type}+/type=pocket_saving&user=${userId}`,
    monthlyTotaExpenseUrl: `${url_monthly_TotalAmount_ByType}+?type=expense&user=${userId}`,
    monthlyTotalIncomeUrl: `${url_monthly_TotalAmount_ByType}+?type=income&user=${userId}`,
  };
  //falta los siguientes enpoints> hacer la funcion para sacar los promedios mensuales, lista de account Balance para cuentas tipo bank, y para cuentas tipo investment. Last Movements  expense category)budgets, las movments debts, cuando se crea una nueva cuenta bien bank, investment, income_source, opninm , pos adj. meg adj., al crear cuentas, que se debe actualizar ademas de las transacciones? a mneos que se abran con ta cantidad, entonces se acct el balance., budget, target o goal saving.

  //lista de categorias y pockets, cuando nuvas cuentas, si se les deposita, encontes budget y target se deben actuazlicar.,
  //lista de debtors account, actualizar balances al crear un debtor.,

  return (
    <section className='content__presentation'>
      <div className='cards__presentation'>
        <SavingGoals />
        {/*  */}
        <MonthlyAverage />

        <AccountBalance
          createNewAccount={createNewAccount}
          originRoute={originRoute}
        />

        <InvestmentAccountBalance
          createNewAccount={createNewAccount}
          originRoute={originRoute}
        />

        <LastMovements />

        <LastDebts />
      </div>
    </section>
  );
}
export default Overview;
