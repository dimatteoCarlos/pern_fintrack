// frontend/src/App

// 🚀 THIRD-PARTY IMPORTS
import React, { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';
import { Slide, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; //it seems not necessary

// 🛡️ AUTHENTICATION & PROTECTION
import ProtectedRoute from './auth/components/protectedRoute/ProtectedRoute';
import AuthPage from './auth/components/authPage/AuthPage';

// 🏗️ LAYOUT COMPONENTS (Load immediately - core structure)
import Layout from './fintrack/pages/layout/Layout';
import TrackerLayout from './fintrack/pages/tracker/TrackerLayout';

// 📊 TRACKER PAGES (Load immediately - main pages)
import Expense from './fintrack/pages/tracker/expense/Expense';
import Income from './fintrack/pages/tracker/income/Income';
import Transfer from './fintrack/pages/tracker/transfer/Transfer';
import Debts from './fintrack/pages/tracker/debts/Debts';
import PnL from './fintrack/pages/tracker/profitNloss/PnL';

// 💰 BUDGET, POCKET & DEBT PAGES
//(Load immediately - structure)
import BudgetLayout from './fintrack/pages/budget/BudgetLayout';

import PocketLayout from './fintrack/pages/pocket/PocketLayout';

import DebtsLayout from './fintrack/pages/debts/DebtsLayout';

// These components are loaded only when the route is accessed
const Budget = lazy(() => import('./fintrack/pages/budget/Budget'));
const Pocket = lazy(() => import('./fintrack/pages/pocket/Pocket'));
const Debtors = lazy(() => import('./fintrack/pages/debts/Debtors'));

// 👁️ OVERVIEW & ACCOUNTING PAGES
import OverviewLayout from './fintrack/pages/overview/OverviewLayout'; //(Load immediately - structure)

// ✅ Overview page - loads when user navigates to /fintrack/overview
const Overview = lazy(() => import('./fintrack/pages/overview/Overview'));

// ✅ Accounting Dashboard - loads when user navigates to /fintrack/tracker/accounting
const AccountingDashboard = lazy(
  () => import('./fintrack/pages/accountingDashboard/AccountingDashboard'),
);

// 📝 FORM PAGES - CREATION
// (used infrequently)
const NewCategory = lazy(
  () => import('./fintrack/pages/forms/newCategory/NewCategory'),
);
const NewPocket = lazy(
  () => import('./fintrack/pages/forms/newPocket/NewPocket'),
);
const EditPocket = lazy(
  () => import('./fintrack/pages/forms/editPocket/EditPocket'),
);
const NewProfile = lazy(
  () => import('./fintrack/pages/forms/newProfile/NewProfile'),
);
const NewAccount = lazy(
  () => import('./fintrack/pages/forms/newAccount/NewAccount'),
);

// 🔍 FORM PAGES - DETAIL VIEWS
// ✅ Detail view pages (load on demand when user clicks on an item)
const AccountDetail = lazy(
  () => import('./fintrack/pages/forms/accountDetail/AccountDetail'),
);
const DebtorDetail = lazy(
  () => import('./fintrack/pages/forms/debtorDetail/DebtorDetail'),
);
const PocketDetail = lazy(
  () => import('./fintrack/pages/forms/pocketDetail/PocketDetail'),
);
const CategoryAccountList = lazy(
  () => import('./fintrack/pages/forms/categoryDetail/CategoryAccountList'),
);
const CategoryDetail = lazy(
  () => import('./fintrack/pages/forms/categoryDetail/CategoryDetail'),
);

//🚀 ACTIONS FOR ACCOUNT EDITION/DELETION
//dition and deletion pages (used occasionally)
const EditAccount = lazy(
  () =>
    import('./fintrack/editionAndDeletion/pages/editionAccount/EditAccount'),
);

const AccountDeletionPage = lazy(
  () =>
    import('./fintrack/editionAndDeletion/pages/deletionAccount/AccountDeletionPage'),
);

// ❌ ERROR HANDLING
import ErrorPage from './fintrack/pages/error/ErrorPage';
// import TestAuthStorage from './tests/Tests';

import { AUTH_ROUTE } from './auth/auth_constants/constants';

// ==========================================
// LOADER COMPONENT
// ==========================================
// ✅ Shows loading spinner while lazy components are being fetched
// Uses CircleLoader from existing loader components
// ==========================================

import CircleLoader from './fintrack/loader/circleLoader/CircleLoader';

const PageLoader = () => (
  <div className='flex justify-center items-center min-h-screen'>
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
              children: [
                {
                  index: true,
                  element: (
                    <LazyRoute>
                      <Budget />
                    </LazyRoute>
                  ),
                },
              ],
            },

            // 📅 POCKET SECTION
            // bottom menu: navbar pages
            // /fintrack/
            {
              path: 'pocket',
              element: <PocketLayout />,
              children: [
                {
                  index: true,
                  element: (
                    <LazyRoute>
                      <Pocket />
                    </LazyRoute>
                  ),
                },
              ],
            },

            // 🏦 DEBTS SECTION
            {
              path: 'debts',
              element: <DebtsLayout />,
              children: [
                // One canonical debts URL. The two used to render the same
                // board while every control under it was built for
                // /fintrack/debts/debtors, so the section worked or failed
                // depending on which of the two the user had reached.
                {
                  index: true,
                  element: <Navigate to='debtors' replace />,
                },
                //fintrack/debts/
                {
                  path: 'debtors',
                  element: (
                    <LazyRoute>
                      <Debtors />
                    </LazyRoute>
                  ),
                },
              ],
            },

            // 📈 OVERVIEW SECTION
            //fintrack/overview
            {
              path: 'overview',
              element: <OverviewLayout />,
              children: [
                {
                  index: true,
                  element: (
                    <LazyRoute>
                      <Overview />
                    </LazyRoute>
                  ),
                },
              ],
            },
          ],
        },

        // 🧾 STANDALONE PAGES (PROTECTED)
        // /fintrack
        {
          path: 'tracker/accounting',
          element: (
            <LazyRoute>
              <AccountingDashboard />
            </LazyRoute>
          ),
        },

        // ✨ACCOUNT CREATION FORMS (PROTECTED)
        //page form new item
        {
          path: 'budget/new_category',
          element: (
            <LazyRoute>
              <NewCategory />
            </LazyRoute>
          ),
        },

        {
          path: 'pocket/new_pocket',
          element: (
            <LazyRoute>
              <NewPocket />
            </LazyRoute>
          ),
        },

        {
          path: 'debts/debtors/new_profile',
          element: (
            <LazyRoute>
              <NewProfile />
            </LazyRoute>
          ),
        },

        {
          path: 'overview/new_account',
          element: (
            <LazyRoute>
              <NewAccount />
            </LazyRoute>
          ),
        },

        // 🔍 DETAIL VIEW PAGES (PROTECTED)
        //show detail item page
        {
          path: 'overview/accounts/:accountId',
          element: (
            <LazyRoute>
              <AccountDetail />
            </LazyRoute>
          ),
        },

        {
          path: 'debts/debtors/:debtorId',
          element: (
            <LazyRoute>
              <DebtorDetail />
            </LazyRoute>
          ),
        },
        {
          path: 'pocket/pockets/:pocketId',
          element: (
            <LazyRoute>
              <PocketDetail />
            </LazyRoute>
          ),
        },

        // Declared beside the detail rather than inside it, so opening the
        // editor unmounts the card underneath. Committing and releasing cash
        // are modals for the opposite reason: they answer with the whole detail
        // payload, so they repaint the card they are standing on.
        {
          path: 'pocket/pockets/:pocketId/edit',
          element: (
            <LazyRoute>
              <EditPocket />
            </LazyRoute>
          ),
        },

        {
          path: 'budget/category/:categoryName',
          element: (
            <LazyRoute>
              <CategoryAccountList />
            </LazyRoute>
          ),
        },

        {
          path: 'budget/category/:categoryName/account/:accountId',
          element: (
            <LazyRoute>
              <CategoryDetail />
            </LazyRoute>
          ),
        },

        //Accounting -> category detail view
        {
          path: 'budget/account/:accountId',
          element: (
            <LazyRoute>
              <CategoryDetail />
            </LazyRoute>
          ),
        },

        // ✨ EDITION FORMS (PROTECTED)
        //Accounting -> edit account
        // { path: 'account/:accountId/edit', element: <ErrorPage /> },
        {
          path: 'account/:accountId/edit',
          element: (
            <LazyRoute>
              <EditAccount />
            </LazyRoute>
          ),
        },

        // 🚮 DELETION ACCOUNT PROCESS
        //Accounting -> delete account
        // { path: 'account/:accountId/edit', element: <ErrorPage /> },
        {
          path: 'account/:accountId/delete',
          element: (
            <LazyRoute>
              <AccountDeletionPage />
            </LazyRoute>
          ),
        },
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
