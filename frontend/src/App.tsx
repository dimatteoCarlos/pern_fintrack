import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';

import Expense from './pages/tracker/expense/Expense.tsx';
import Income from './pages/tracker/income/Income.tsx';
import Investment from './pages/tracker/investment/Investment.tsx';
import Debts from './pages/tracker/debts/Debts.tsx';

import Budget from './pages/budget/components/Budget.tsx';
import Debtors from './pages/debts/components/Debtors.tsx';

import TrackerLayout from './pages/tracker/TrackerLayout.tsx';
import Layout from './pages/layout/Layout.tsx';
import BudgetLayout from './pages/budget/BudgetLayout.tsx';
import DebtsLayout from './pages/debts/DebtsLayout.tsx';
import OverviewLayout from './pages/overview/OverviewLayout.tsx';

import NotFoundPage from './pages/error/NotFoundPage.tsx';

import Accounting from './pages/accounting/Accounting.tsx';

import NewCategory from './pages/forms/newCategory/NewCategory.tsx';
import NewPocket from './pages/forms/newPocket/NewPocket.tsx';
import NewProfile from './pages/forms/newProfile/NewProfile.tsx';
import NewAccount from './pages/forms/newAccount/NewAccount.tsx';
import Overview from './pages/overview/Overview.tsx';
import Movements from './pages/movements/Movements.tsx';

import AccountDetail from './pages/forms/accountDetail/AccountDetail.tsx';
import DebtorDetail from './pages/forms/debtorDetail/DebtorDetail.tsx';
import CategoryDetail from './pages/forms/categoryDetail/CategoryDetail.tsx';
import PocketDetail from './pages/forms/pocketDetail/PocketDetail.tsx';
import ProtectedRoute from './pages/auth/ProtectedRoute.tsx';

//--------------------------------

import AuthPage from './pages/auth/AuthPage.tsx';

function App() {
  const router = createBrowserRouter([
    //access to fintrack app

    { path: '/', element: <Navigate to='/auth/' replace /> },

    //authentication routes
    {
      path: '/auth',
      element: <AuthPage />,
      // children: [
      //   { path: '/auth/signin', element: <AuthPage /> },
      //   { path: '/auth/signup', element: <AuthPage /> },
      // ],
    },

    //pages/Layout

    //set the function for isAuthenticated
    {
      path: '/fintrack',
      element: <ProtectedRoute isAuthenticated={true} />,
      children: [
        {
          path: '/fintrack/',
          element: <Layout />,
          errorElement: <NotFoundPage />,

          children: [
            //pages/tracker
            {
              index: true,
              element: <Navigate to='/fintrack/tracker/expense' />,
            },
            {
              path: '/fintrack/tracker',
              element: <TrackerLayout />,
              children: [
                { index: true, element: <Expense /> },
                { path: '/fintrack/tracker/expense', element: <Expense /> },
                { path: '/fintrack/tracker/income', element: <Income /> },
                {
                  path: '/fintrack/tracker/investment',
                  element: <Investment />,
                },
                { path: '/fintrack/tracker/debts', element: <Debts /> },
              ],
            },
            // main navbar pages
            {
              path: '/fintrack/budget',
              element: <BudgetLayout />,
              children: [
                { path: '/fintrack/budget/presentation', element: <Budget /> },
              ],
            },

            {
              path: '/fintrack/debts',
              element: <DebtsLayout />,
              children: [
                { index: true, element: <Debtors /> },
                { path: '/fintrack/debts/debtors', element: <Debtors /> },
              ],
            },

            {
              path: '/fintrack/overview',
              element: <OverviewLayout />,
              children: [{ index: true, element: <Overview /> }],
            },
          ],
        },

        { path: '/fintrack/accounting', element: <Accounting /> },

        //page form new item
        { path: '/fintrack/budget/new_category', element: <NewCategory /> },
        { path: '/fintrack/budget/new_pocket', element: <NewPocket /> },
        {
          path: '/fintrack/debts/debtors/new_profile',
          element: <NewProfile />,
        },
        { path: '/fintrack/overview/new_account', element: <NewAccount /> },

        //rendering movements view or layout not yet defined
        {
          path: '/fintrack/overview/movements/expense',
          element: <Movements />,
        },
        {
          path: '/fintrack/overview/movements/debt',
          element: <Movements />,
        },

        //show detailed item page
        {
          path: '/fintrack/overview/accounts/:accountId',
          element: <AccountDetail />,
        },

        {
          path: '/fintrack/debts/debtors/:debtorId',
          element: <DebtorDetail />,
        },
        {
          path: '/fintrack/budget/categories/:categoryId',
          element: <CategoryDetail />,
        },
        {
          path: '/fintrack/budget/pockets/:pocketId',
          element: <PocketDetail />,
        },
      ],
    },

    //
  ]);

  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
