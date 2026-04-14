// frontend/src/App.tsx

// 🚀 THIRD-PARTY IMPORTS
import { lazy, Suspense} from 'react';
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

// 🏗️ LAYOUT COMPONENTS (Load immediately - core structure)
import Layout from './fintrack/pages/layout/Layout.tsx';
import TrackerLayout from './fintrack/pages/tracker/TrackerLayout.tsx';

// 📊 TRACKER PAGES (Load immediately - main pages)
import Expense from './fintrack/pages/tracker/expense/Expense.tsx';
import Income from './fintrack/pages/tracker/income/Income.tsx';
import Transfer from './fintrack/pages/tracker/transfer/Transfer.tsx';
import Debts from './fintrack/pages/tracker/debts/Debts.tsx';
import PnL from './fintrack/pages/tracker/profitNloss/PnL.tsx';

// 💰 BUDGET & DEBT PAGES
//(Load immediately - structure)
import BudgetLayout from './fintrack/pages/budget/BudgetLayout.tsx';
import DebtsLayout from './fintrack/pages/debts/DebtsLayout.tsx';

// These components are loaded only when the route is accessed
const Budget = lazy(()=>import ('./fintrack/pages/budget/Budget.tsx'));
const Debtors = lazy(()=>import ('./fintrack/pages/debts/Debtors.tsx'));

// 👁️ OVERVIEW & ACCOUNTING PAGES
import OverviewLayout from './fintrack/pages/overview/OverviewLayout.tsx';//(Load immediately - structure)

// ✅ Overview page - loads when user navigates to /fintrack/overview
const Overview = lazy(()=>import ('./fintrack/pages/overview/Overview.tsx'));

// ✅ Accounting Dashboard - loads when user navigates to /fintrack/tracker/accounting
const AccountingDashboard = lazy(()=>import ('./fintrack/pages/accountingDashboard/AccountingDashboard.tsx'));

// 📝 FORM PAGES - CREATION
// (used infrequently)
const NewCategory = lazy(()=>import ('./fintrack/pages/forms/newCategory/NewCategory.tsx'));
const NewPocket = lazy(()=>import ('./fintrack/pages/forms/newPocket/NewPocket.tsx'));
const NewProfile = lazy(()=>import ('./fintrack/pages/forms/newProfile/NewProfile.tsx'));
const NewAccount = lazy(()=>import ('./fintrack/pages/forms/newAccount/NewAccount.tsx'));

// 🔍 FORM PAGES - DETAIL VIEWS
// ✅ Detail view pages (load on demand when user clicks on an item)
const AccountDetail = lazy(()=>import ('./fintrack/pages/forms/accountDetail/AccountDetail.tsx'));
const DebtorDetail = lazy(()=>import ('./fintrack/pages/forms/debtorDetail/DebtorDetail.tsx'));
const PocketDetail = lazy(()=>import ('./fintrack/pages/forms/pocketDetail/PocketDetail.tsx'));
const CategoryAccountList = lazy(()=>import ('./fintrack/pages/forms/categoryDetail/CategoryAccountList.tsx'));
const CategoryDetail = lazy(()=>import ('./fintrack/pages/forms/categoryDetail/CategoryDetail.tsx'));

//🚀 ACTIONS FOR ACCOUNT EDITION/DELETION
//dition and deletion pages (used occasionally)
const EditAccount = lazy(()=>import ('./fintrack/editionAndDeletion/pages/editionAccount/EditAccount.tsx'));

const AccountDeletionPage = lazy(()=>import ('./fintrack/editionAndDeletion/pages/deletionAccount/AccountDeletionPage.tsx'));

// ❌ ERROR HANDLING
import ErrorPage from './fintrack/pages/error/ErrorPage.tsx';
// import TestAuthStorage from './tests/Tests.tsx';

import { AUTH_ROUTE } from './auth/auth_constants/constants.ts';

// ==========================================
// LOADER COMPONENT
// ==========================================
// ✅ Shows loading spinner while lazy components are being fetched
// Uses CircleLoader from existing loader components
// ==========================================

import CircleLoader from './fintrack/loader/circleLoader/CircleLoader.tsx';

const PageLoader = () => (
  <div className="flex justify-center items-center min-h-screen">
    <CircleLoader />
  </div>
);

// ==========================================
// LAZY ROUTE WRAPPER
// ==========================================
// ✅ Wraps lazy-loaded routes with Suspense
// DRY (Don't Repeat Yourself) pattern - avoids writing Suspense for every route
// ==========================================
const LazyRoute = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

//----------------------------------
function App() {
  const router = createBrowserRouter([
    // 🔄 REDIRECT ROUTES
    {
      path: '/',
      element: <AuthPage />,
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
              element: (
                <Navigate
                  to='tracker/expense'
                  replace
                  //'tracker/expense'
                />
              ),
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
                { path: 'expense', element: <Expense /> },
                { path: 'income', element: <Income /> },
                { path: 'transfer', element: <Transfer /> },
                { path: 'pnl', element: <PnL /> },
                { path: 'debts', element: <Debts /> },
              ],
            },

            // 📅 BUDGET SECTION
            // bottom menu: navbar pages
            // /fintrack/
            {
              path: 'budget',
              element: <BudgetLayout />,
              children: [{ index: true, element:(<LazyRoute> <Budget /></LazyRoute> )}],
            },

            // 🏦 DEBTS SECTION
            {
              path: 'debts',
              element: <DebtsLayout />,
              children: [
                { index: true, element:(<LazyRoute> <Debtors /></LazyRoute>) },
                //fintrack/debts/
                { path: 'debtors', element:(<LazyRoute> <Debtors /></LazyRoute>) },
              ],
            },

            // 📈 OVERVIEW SECTION
            //fintrack/overview
            {
              path: 'overview',
              element: <OverviewLayout />,
              children: [{ index: true, element:(<LazyRoute> <Overview /></LazyRoute>)}],
            },
          ],
        },

        // 🧾 STANDALONE PAGES (PROTECTED)
        // /fintrack
        { path: 'tracker/accounting', element:(<LazyRoute> <AccountingDashboard /></LazyRoute>) },

        // ✨ACCOUNT CREATION FORMS (PROTECTED)
        //page form new item
        { path: 'budget/new_category', element:(<LazyRoute> <NewCategory /></LazyRoute>) },

        { path: 'budget/new_pocket', element:(<LazyRoute> <NewPocket /></LazyRoute>) },

        {
          path: 'debts/debtors/new_profile',
          element:(<LazyRoute> <NewProfile /></LazyRoute>)},

        { path: 'overview/new_account', element:(<LazyRoute> <NewAccount /></LazyRoute>) },

        // 🔍 DETAIL VIEW PAGES (PROTECTED)
        //show detail item page
        {
          path: 'overview/accounts/:accountId',
          element:(<LazyRoute> <AccountDetail /></LazyRoute>)},

        {
          path: 'debts/debtors/:debtorId',
          element:(<LazyRoute> <DebtorDetail /></LazyRoute>)},
        {
          path: 'budget/pockets/:pocketId',
          element:(<LazyRoute> <PocketDetail /></LazyRoute>)},

       { path: 'budget/category/:categoryName', element: (<LazyRoute><CategoryAccountList /></LazyRoute>), },

        {
          path: 'budget/category/:categoryName/account/:accountId',
          element:(<LazyRoute> <CategoryDetail /></LazyRoute>)},

        //Accounting -> category detail view
        {
          path: 'budget/account/:accountId',
          element:(<LazyRoute> <CategoryDetail /></LazyRoute>)},

        // ✨ EDITION FORMS (PROTECTED)
        //Accounting -> edit account
        // { path: 'account/:accountId/edit', element: <ErrorPage /> },
        { path: 'account/:accountId/edit', element:(<LazyRoute> <EditAccount /></LazyRoute>) },

        // 🚮 DELETION ACCOUNT PROCESS
        //Accounting -> delete account
        // { path: 'account/:accountId/edit', element: <ErrorPage /> },
        { path: 'account/:accountId/delete', element:(<LazyRoute> <AccountDeletionPage /></LazyRoute>) },
      ],
    },
  ]);
  //--------------
  return (
    <>
      <RouterProvider router={router} />

      {/* 🎭 TOAST NOTIFICATIONS */}
      <ToastContainer
        position='bottom-center'
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        // theme="dark"

        transition={Slide} //flip, bounce, zoom, slide
      />

    </>
  );
}

export default App;
