// frontend/src/pages/overview/Overview.tsx
//HOOKS
import { useEffect, useState } from 'react';

//NAVIGATION
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../../auth/hooks/useAuth.ts';
import { useFetch } from '../../hooks/useFetch.ts';

// UI COMPONENTS
import AccountBalance from './components/AccountBalance.tsx';
import DomainCards from './components/DomainCards.tsx';
import FinancialGoals from './components/FinancialGoals.tsx';
// MonthlyAverage is superseded by MonthlySnapshot, which prints the same
// three figures plus the two baselines and the deviation square it did not.
// The file stays on disk unrendered rather than being removed.
// import MonthlyAverage from './components/MonthlyAverage.tsx';
import MonthlySnapshot from './components/MonthlySnapshot.tsx';
import TrendCharts from './components/TrendCharts.tsx';
import ExpenseByCategory from './components/ExpenseByCategory.tsx';
// Imported by RecentActivity.tsx now, which is what renders the list here.
// import LastMovements, {
//   LastMovementType,
// } from './components/LastMovements.tsx';
import RecentActivity from './components/RecentActivity.tsx';
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
  // The five per-domain movement requests were retired with the lists they
  // fed. Same treatment as the line above: the route still exists and this is
  // the record of who used to call it.
  // dashboardMovementTransactions,
  url_get_accounts_by_type,
} from '../../../urlConfig.ts';

//TYPES
import {
  AccountByTypeResponseType,
  FinancialDataRespType,
  LastMovementRespType,
  // YearlyTotalsType,
} from '../../types/responseApiTypes.ts';
// import { CurrencyType } from '../../types/types.ts';

//FUNCTIONS
// Retired with the five requests it ran. The module itself stays: the level-2
// screens are the next caller of a multi-endpoint fetch.
// import { overviewFetchAll } from './overviewFetchAll.ts';
// The teaser mapping below was this file's only reader of the store: every
// other block subscribes on its own. OverviewLayout.tsx is what fills it.
// import { useOverviewStore } from '../../stores/useOverviewStore.ts';
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
/* Described the retired endpoint list. ApiRespDataType above it stays: it is
   overviewFetchAll's own contract and the level-2 screens are its next caller.

type KPIEndpointType = {
  key: keyof ApiRespDataType;
  url: string;
  type: FinancialDataRespType | LastMovementRespType;
};
*/

//type of state data to render
/* The shape of the retired state. Five lists, one per domain, which is the
   arrangement the activity teaser replaced.

     Both moved to useOverviewStore with the widget that read them.
     MonthlyMovementKPI: ResultType | null;
     YearlyTotals: YearlyTotalsType | null;

type KPIDataStateType = {
  LastExpenseMovements: LastMovementType[] | null;
  LastDebtMovements: LastMovementType[] | null;
  LastIncomeMovements: LastMovementType[] | null;
  LastInvestmentMovements: LastMovementType[] | null;
  LastPnLMovements: LastMovementType[] | null;
};
*/
//-----------------------------------------
//CONFIG of DATA TO BE FETCHED
/* Retired with the requests that consumed it. Every URL here points at
   /dashboard, and the five results fed the per-domain lists be08f507 replaced
   with the activity teaser from the /overview payload.
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
*/

//=======================
//MAIN COMPONENT OVERVIEW
//=======================
function Overview() {
  const navigateTo: NavigateFunction = useNavigate();
  const location = useLocation();
  const originRoute = location.pathname;

  /* The activity teaser, read off the page payload. RecentActivity asks
     GET /overview/activity for its own page, so this mapping has no reader:
     five rows out of a set the reader can page through would be a second
     answer to the same question, cut differently.

     recentActivity stays in useOverviewStore and the payload keeps publishing
     it. Whether the page should stop carrying five rows nobody renders is a
     question about the /overview statement, not about this file.

  const recentActivity = useOverviewStore((state) => state.recentActivity);

  const recentMovements: LastMovementType[] | null = recentActivity
    ? recentActivity.map((row) => ({
        accountName: row.account_name,
        record: row.amount,
        description: row.description,
        note: row.note,
        date: row.transaction_actual_date,
        currency: row.currency_code as LastMovementType['currency'],
        transactionId: row.transaction_id,
      }))
    : null;
  */
  // console.log({ originRoute });
  //-- STATES----
  /* Retired with them. Nothing reads this state and nothing writes it: the
     five lists it held are one list now, and that list is held in
     useOverviewStore beside the rest of the payload.
  const [, setKpiData] = useState<KPIDataStateType>({
    // MonthlyMovementKPI: null,
    // YearlyTotals: null,
    LastExpenseMovements: null,
    LastDebtMovements: null,
    LastIncomeMovements: null,
    LastInvestmentMovements: null,
    LastPnLMovements: null,
  });
  */

  const [isLoading, setIsLoading] = useState(true);
  /* The only writer was the retired effect's catch, so this could no longer
     become anything but null. The page's failure state belongs to the request
     that can fail, and that one is the layout's: OverviewLayout renders the
     message and the retry beside the figures it could not draw.

  const [error, setError] = useState<string | null>(null);
  */

  // AUTHENTICATION STATE
  const { isAuthenticated, isCheckingAuth } = useAuth();

  // ONE REQUEST FOR BOTH ACCOUNT CARDS. Account Balance asked the route for
  // ?type=bank and Investment Accounts asked the same route for
  // ?type=investment - two round trips for two halves of one list. The route
  // already answers bank_and_investment (getAccountController.js:440), so the
  // page asks once and each card takes its own type out of the one answer.
  const urlAccountsByType =
    !isCheckingAuth && isAuthenticated
      ? `${url_get_accounts_by_type}/?type=bank_and_investment`
      : null;

  const {
    apiData: accountsByTypeData,
    isLoading: accountsLoading,
    error: accountsError,
    refetch: refetchAccounts,
  } = useFetch<AccountByTypeResponseType>(urlAccountsByType);

  // Split here and not inside each card: the division is a property of this one
  // answer, and a card filtering its own share would have to know what the
  // other card takes. Null while nothing has arrived, which is what lets a card
  // tell "not yet" from "none of this type".
  const accountList = accountsByTypeData?.data?.accountList ?? null;

  // EACH CARD KEEPS THE ORDER ITS OWN STATEMENT GAVE IT, restored here because
  // the shared statement cannot give two. ?type=bank ordered by balance ascending
  // (getAccountController.js:434) and ?type=investment by the magnitude of the
  // balance descending (:379), while bank_and_investment orders by type and then
  // by name (:454). Sorting a copy of the filtered slice: filter already returns
  // a new array, so neither sort reaches accountList.
  const bankAccounts =
    accountList
      ?.filter((acc) => acc.account_type_name === 'bank')
      .sort((a, b) => a.account_balance - b.account_balance) ?? null;

  const investmentAccounts =
    accountList
      ?.filter((acc) => acc.account_type_name === 'investment')
      .sort((a, b) => Math.abs(b.account_balance) - Math.abs(a.account_balance)) ??
    null;
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
    /* Retired. The five /dashboard movement requests below fed the five
       per-domain lists that be08f507 replaced with the one activity teaser,
       and nothing has read their result since. Kept commented per the standing
       rule on deletions.

       What is NOT retired with them is the loading flag: the spinner at the
       foot of this component is bound to it, so it has to be cleared by
       whatever runs in this effect's place.
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
    */

    // No request of this component's own any longer. Every figure on the page
    // comes from the /overview payload the layout fetches, and the account
    // panels have their own useFetch.
    setIsLoading(false);
  }, [isAuthenticated, isCheckingAuth]);

  // console.log('data state kpi', kpiData);
  //--RENDER ----
  /* Went with the state above.

  if (error) return <div className='error-message'>{error}</div>;
  */

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

        {/* First on the page, in the band between the hero panel and the
            month heading. It used to sit ten blocks down, between the trend
            charts and the account panels, where the reader had to scroll past
            every figure on the screen to reach the one action the page offers.

            It goes HERE and not in the layout's header. That header is
            positioned from a constant height and MonthPicker is floated out of
            its flow for exactly that reason; a second child inside it would
            change the constant and re-measure every absolute box below. This
            is the Outlet's first child, which is the same band on screen and
            costs the layout nothing. createNewAccount and originRoute also
            live in this file, not in the layout. */}
        <OpenAddEditBtn
          btnFunction={createNewAccount}
          btnFunctionArg={originRoute}
          btnPreviousRoute={originRoute}
        >
          <div className='open__btn__label'>Add Account</div>
        </OpenAddEditBtn>

        {/* THE TWO ACCOUNT PANELS COME FIRST, directly under the button that
            creates an account. Carlos's order, 2026-09-10, and the reason is
            in the adjacency: the button opens the account form, and the two
            panels are the list of what that button has already produced. They
            sat eight blocks down, after every aggregate on the page, so the
            one action the screen offers and the result of that action were
            separated by everything else.

            The blocks below keep the order they had relative to each other;
            only these two moved. */}
        {
          <AccountBalance
            previousRoute={originRoute}
            accounts={bankAccounts}
            isLoading={accountsLoading}
            error={accountsError}
            onRetry={refetchAccounts}
          />
        }

        {
          <InvestmentAccountBalance
            previousRoute={originRoute}
            accounts={investmentAccounts}
            isLoading={accountsLoading}
            error={accountsError}
            onRetry={refetchAccounts}
          />
        }

        {/* The six domain cards answer what the month did, and everything below
            them is detail on one part of that answer. Like MonthlyAverage it
            takes no props and reads the store the layout above has filled.
            Each card folds on its own, inside the component. */}
        <DomainCards />

        {/* No props: the widget subscribes to useOverviewStore, which the
            layout above it has already filled for the month on screen. Passing
            them from here would have made this page fetch a month of its own,
            and the two months would drift the moment the picker moved. */}
        <MonthlySnapshot />

        {/* Block 05, in the sketch's own order: the goals read at the close of
            the same month the cards above are cut to. Store-backed like the two
            above it, so the page still makes one request for all three. */}
        <FinancialGoals />

        {/* Block 07, first half. */}
        <TrendCharts />

        {/* Block 07, second half, which the line above used to record as
            waiting on a ramp the design system did not carry. The ramp is
            declared (tokens.css, --color-scale-magnitude-*) and the bar is
            mounted. Store-backed like every block above it: the ranking is
            already in the level-1 answer, so no request is added. */}
        <ExpenseByCategory />
{/* ------------------ */}
        {/* One list, not five. The five that stood here came from /dashboard,
            one request per domain, and carried no row cap: on this data they
            were more than half the height of the page, and level 2 is where
            every transaction of the period for one domain belongs.

            RecentActivity composes the same LastMovements the teaser used and
            adds the three controls around it - a search, a kind of movement and
            a period - so it fetches GET /overview/activity itself instead of
            reading the five rows the page payload carries. That is the reason
            the mapping this file used to do is commented out above rather than
            moved: the rows come from a different request now.

            Not bounded by the reference month, and it is the only block of this
            page that is not: the period is the reader's here. */}
        <RecentActivity />
      </div>
    </section>
  );
}
export default Overview;