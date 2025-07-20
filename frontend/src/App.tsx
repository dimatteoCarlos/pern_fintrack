import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';

import ProtectedRoute from './pages/auth/ProtectedRoute.tsx';

import Expense from './pages/tracker/expense/Expense.tsx';
import Income from './pages/tracker/income/Income.tsx';
import PnL from './pages/tracker/profitNloss/PnL.tsx';
import Debts from './pages/tracker/debts/Debts.tsx';
// import Investment from './pages/tracker/investment/Investment.tsx';

import Budget from './pages/budget/Budget.tsx';
import Debtors from './pages/debts/Debtors.tsx';

import TrackerLayout from './pages/tracker/TrackerLayout.tsx';
import Layout from './pages/layout/Layout.tsx';
import BudgetLayout from './pages/budget/BudgetLayout.tsx';
import DebtsLayout from './pages/debts/DebtsLayout.tsx';
import OverviewLayout from './pages/overview/OverviewLayout.tsx';
import Accounting from './pages/accounting/Accounting.tsx';
import NewCategory from './pages/forms/newCategory/NewCategory.tsx';
import NewPocket from './pages/forms/newPocket/NewPocket.tsx';
import NewProfile from './pages/forms/newProfile/NewProfile.tsx';
import NewAccount from './pages/forms/newAccount/NewAccount.tsx';
import Overview from './pages/overview/Overview.tsx';
// import Movements from './pages/movements/Movements.tsx';

import AccountDetail from './pages/forms/accountDetail/AccountDetail.tsx';
import DebtorDetail from './pages/forms/debtorDetail/DebtorDetail.tsx';
import PocketDetail from './pages/forms/pocketDetail/PocketDetail.tsx';
//--------------------------------
// import AuthPage from './pages/auth/AuthPage.tsx';
import ErrorPage from './pages/error/ErrorPage.tsx';
import Transfer from './pages/tracker/transfer/Transfer.tsx';
import CategoryAccountList from './pages/forms/categoryDetail/CategoryAccountList.tsx';
import CategoryDetail from './pages/forms/categoryDetail/CategoryDetail.tsx';
//---------------------
import { Slide, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
//-----------------------
// import NotFoundPage from './pages/error/NotFoundPage.tsx';
function App() {
  const router = createBrowserRouter([
    //access to fintrack app
    { path: '/', element: <Navigate to='/fintrack/' /> },
    // { path: '/', element: <Navigate to='/auth/' replace /> },

    // //authentication routes
    // {
    //   path: '/auth',
    //   element: <AuthPage />,
    // },

    //pages/Layout

    //app routes
    {
      path: '/fintrack',
      element: <ProtectedRoute />,
      children: [
        {
          path: '/fintrack/',
          element: <Layout />,
          errorElement: <ErrorPage />,
          // errorElement: <NotFoundPage />,

          children: [
            //pages/tracker
            {
              index: true,
              element: <Navigate to='/fintrack/tracker/expense' />,
            },
            //top menu:tracker
            {
              path: '/fintrack/tracker',
              element: <TrackerLayout />,
              children: [
                { index: true, element: <Expense /> },
                { path: '/fintrack/tracker/expense', element: <Expense /> },
                { path: '/fintrack/tracker/income', element: <Income /> },
                {
                  path: '/fintrack/tracker/transfer',
                  element: <Transfer />,
                },
                {
                  path: '/fintrack/tracker/pnl',
                  element: <PnL/>,
                },
                { path: '/fintrack/tracker/debts', element: <Debts /> },
              ],
            },

            // bottom menu: navbar pages
            {
              path: '/fintrack/budget',
              element: <BudgetLayout />,
              children: [
                { path: '/fintrack/budget', element: <Budget /> },
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

        { path: '/fintrack/tracker/accounting', element: <Accounting /> },

        //page form new item
        { path: '/fintrack/budget/new_category', element: <NewCategory /> },

        { path: '/fintrack/budget/new_pocket', element: <NewPocket /> },
         
        {
          path: '/fintrack/debts/debtors/new_profile',
          element: <NewProfile />,
        },

        { path: '/fintrack/overview/new_account', element: <NewAccount /> },

        //rendering movements view or layout not yet defined
        // {
        //   path: '/fintrack/overview/movements/expense',
        //   element: <Movements />,
        // },
        // {
        //   path: '/fintrack/overview/movements/debt',
        //   element: <Movements />,
        // },

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
          path: '/fintrack/budget/pockets/:pocketId',
          element: <PocketDetail />,
        },

        {
          path: '/fintrack/budget/category/:categoryName',
          element: <CategoryAccountList/>,
        },
        
      {
          path: '/fintrack/budget/category/:categoryName/account/:accountId',
        element: <CategoryDetail />,
        },

      ],
    },

  ]);


  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer 
      position = "bottom-center" autoClose={3000}
      hideProgressBar = {false} newestOnTop={false}
      closeOnClick={false}
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="dark"
      transition={Slide}//flip, bounce, zoom, slide
      />
    </>
  );
}

export default App;

