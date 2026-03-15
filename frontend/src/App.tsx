// frontend/src/App.tsx
// 🚀 THIRD-PARTY IMPORTS
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';
import { Slide, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// 🛡️ AUTHENTICATION & PROTECTION
import ProtectedRoute from './auth/components/protectedRoute/ProtectedRoute.tsx';
import AuthPage from './auth/components/authPage/AuthPage.tsx';


// 🏗️ LAYOUT COMPONENTS & 
import Layout from './pages/layout/Layout.tsx';
import TrackerLayout from './pages/tracker/TrackerLayout.tsx';


// 📊 TRACKER PAGES
import Expense from './pages/tracker/expense/Expense.tsx';
import Income from './pages/tracker/income/Income.tsx';
import Transfer from './pages/tracker/transfer/Transfer.tsx';
import Debts from './pages/tracker/debts/Debts.tsx';
import PnL from './pages/tracker/profitNloss/PnL.tsx';

// 💰 BUDGET & DEBT PAGES
import BudgetLayout from './pages/budget/BudgetLayout.tsx';
import Budget from './pages/budget/Budget.tsx';
import DebtsLayout from './pages/debts/DebtsLayout.tsx';
import Debtors from './pages/debts/Debtors.tsx';

// 👁️ OVERVIEW & ACCOUNTING PAGES
import OverviewLayout from './pages/overview/OverviewLayout.tsx';
import Overview from './pages/overview/Overview.tsx';
import AccountingDashboard from './pages/accountingDashboard/AccountingDashboard.tsx';

// 📝 FORM PAGES - CREATION
import NewCategory from './pages/forms/newCategory/NewCategory.tsx';
import NewPocket from './pages/forms/newPocket/NewPocket.tsx';
import NewProfile from './pages/forms/newProfile/NewProfile.tsx';
import NewAccount from './pages/forms/newAccount/NewAccount.tsx';

// 🔍 FORM PAGES - DETAIL VIEWS
import AccountDetail from './pages/forms/accountDetail/AccountDetail.tsx';
import DebtorDetail from './pages/forms/debtorDetail/DebtorDetail.tsx';
import PocketDetail from './pages/forms/pocketDetail/PocketDetail.tsx';
import CategoryAccountList from './pages/forms/categoryDetail/CategoryAccountList.tsx';
import CategoryDetail from './pages/forms/categoryDetail/CategoryDetail.tsx';

//🚀 ACTIONS FOR ACCOUNT EDITION/DELETION 
import EditAccount from './editionAndDeletion/pages/editionAccount/EditAccount.tsx';

import {AccountDeletionPage} from './editionAndDeletion/pages/deletionAccount/AccountDeletionPage.tsx';

// ❌ ERROR HANDLING
import ErrorPage from './pages/error/ErrorPage.tsx';
// import TestAuthStorage from './tests/Tests.tsx';

import { AUTH_ROUTE } from './auth/auth_constants/constants.ts';
// import NotFoundPage from './pages/error/NotFoundPage.tsx';
//----------------------------------
function App() {
  const router = createBrowserRouter([
  // 🔄 REDIRECT ROUTES  
     {
    path: '/',
    element: <AuthPage />
  },
    
  // 🔐 AUTHENTICATION ROUTES
    {
     path: AUTH_ROUTE,
     element: <AuthPage />,
    },

  // 🏠 MAIN APP ROUTES
  { 
    path: '/fintrack',
    element: <ProtectedRoute />,
    children: [
 // 🎯 MAIN LAYOUT WITH NESTED ROUTES
      ///fintrack/
      {
        path: '',
        element: <Layout />,
        errorElement: <ErrorPage />,
        // errorElement: <NotFoundPage />,

        children: [
        // ➡️ DEFAULT REDIRECT 
          //pages/tracker
          // /fintrack
          {
            index: true,
            element: <Navigate to="tracker/expense" replace
            //'tracker/expense' 
            />,
          },
          // 💸 TRACKER SECTION
          //top menu:tracker
          // /fintrack/
          {
            path: 'tracker',
            element: <TrackerLayout />,
            children: [
              { index: true, element: <Expense /> },
            ///fintrack/tracker/
              {path: 'expense', element:<Expense /> },
              {path: 'income', element: <Income /> },
              {path: 'transfer',element: <Transfer />,},
              {path: 'pnl',element: <PnL/>,},
              {path: 'debts', element: <Debts /> },
            ],
          },

          // 📅 BUDGET SECTION
          // bottom menu: navbar pages
          // /fintrack/
          {
            path: 'budget',
            element: <BudgetLayout />,
            children: [
              { index: true, element: <Budget /> },
            ],
          },

          // 🏦 DEBTS SECTION
          {
            path: 'debts',
            element: <DebtsLayout />,
            children: [
             { index: true, element: <Debtors /> },
             //fintrack/debts/
              { path: 'debtors', element: <Debtors /> },
            ],
          },

        // 📈 OVERVIEW SECTION
        //fintrack/overview
          {
            path: 'overview',
            element: <OverviewLayout />,
            children: [
              { index: true, element: <Overview /> }],
          },

        ],
      },

// 🧾 STANDALONE PAGES (PROTECTED)
  // /fintrack
    { path: 'tracker/accounting', element: <AccountingDashboard /> },

  // ✨ACCOUNT CREATION FORMS (PROTECTED)
    //page form new item
      { path: 'budget/new_category', element: <NewCategory /> },

      { path: 'budget/new_pocket', element: <NewPocket /> },
        
      {
        path: 'debts/debtors/new_profile',
        element: <NewProfile />,
      },

      { path: 'overview/new_account', element: <NewAccount /> },

  // 🔍 DETAIL VIEW PAGES (PROTECTED)
    //show detail item page
      {
        path: 'overview/accounts/:accountId',
        element: <AccountDetail />,
      },

      {
        path: 'debts/debtors/:debtorId',
        element: <DebtorDetail />,
      },
      {
        path: 'budget/pockets/:pocketId',
        element: <PocketDetail />,
      },

      {
        path: 'budget/category/:categoryName',
        element: <CategoryAccountList/>,
      },
      
    {
        path: 'budget/category/:categoryName/account/:accountId',
      element: <CategoryDetail />,
      },

//Accounting -> category detail view  
  {
      path: 'budget/account/:accountId',
    element: <CategoryDetail />,
    },

// ✨ EDITION FORMS (PROTECTED)
//Accounting -> edit account
// { path: 'account/:accountId/edit', element: <ErrorPage /> },
{ path: 'account/:accountId/edit', element: <EditAccount /> },

// 🚮 DELETION ACCOUNT PROCESS
//Accounting -> delete account
// { path: 'account/:accountId/edit', element: <ErrorPage /> },
{ path: 'account/:accountId/delete', element: <AccountDeletionPage /> },
],
 },
 ]);
//--------------
return (
<>
  <RouterProvider router={router} />

  {/* 🎭 TOAST NOTIFICATIONS */}
  <ToastContainer 
  position = "bottom-center" autoClose={2000}
  hideProgressBar = {false} newestOnTop={true}
  closeOnClick={false}
  rtl={false}
  pauseOnFocusLoss
  draggable
  pauseOnHover
  // theme="dark"

  transition={Slide}//flip, bounce, zoom, slide
  />
  
{/* TEST SECTION */}
{/* <TestAuthStorage/> */}

</>
);
}

export default App;

