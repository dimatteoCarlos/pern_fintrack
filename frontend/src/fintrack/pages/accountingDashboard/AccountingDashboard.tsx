// frontend/src/pages/accountingDashboard/AccountingDashboard.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
//---
import { INITIAL_PAGE_ADDRESS } from '../../helpers/constants';
import { url_get_all_accounting_accounts } from '../../../urlConfig';
//---
import AccountingBox from './AccountingBox';
import TopWhiteSpace from '../../general_components/topWhiteSpace/TopWhiteSpace';
import LeftArrowSvg from '../../../assets/LeftArrowSvg.svg';
// '?react' and not a bare import: only that specifier carries a React
// component type, so the icon can take a className.
import BankAccountSvg from '../../../assets/accountingDashboardSvg/bankAccountSvg.svg?react';
import DebtsAccountsSvg from '../../../assets/accountingDashboardSvg/debtsAccountsSvg.svg?react';
import ExpenseAccountsSvg from '../../../assets/accountingDashboardSvg/expenseAccountsSvg.svg?react';
import IncomeAccountsSvg from '../../../assets/accountingDashboardSvg/incomeAccountsSvg.svg?react';
import InvestmentAccountsSvg from '../../../assets/accountingDashboardSvg/investmentAccountsSvg.svg?react';
import PocketsAccountsSvg from '../../../assets/accountingDashboardSvg/pocketsAccountsSvg.svg?react';
// The disclosure affordance of every group heading. One asset, rotated when
// the group opens, rather than a second drawing for the open state.
import ArrowDownLightSvg from '../../../assets/ArrowDownLightSvg.svg?react';
import Toast from '../../editionAndDeletion/components/toast/Toast';
import AccountActionsMenu from '../../editionAndDeletion/components/accountActionMenu/AccountActionsMenu';
//---
import {
  AccountByTypeResponseType,
  AccountListType,
  CategoryBudgetAccountListType,
} from '../../types/responseApiTypes';
//---
import { capitalize } from '../../helpers/functions';
//---
import { isCategoryBudgetAccount } from '../../editionAndDeletion/utils/categoryBudgetCalculations';
//---
import './styles/accountingDashboard-styles.css';

//--------------------------------

//--------------------------------
// ACCOUNT TYPE CONFIGURATION
// Drawings and not emoji: an emoji renders in the OS emoji font, so it never
// takes the colour of the heading it sits in.
const ACCOUNT_TYPE_DATA = {
  bank: { Icon: BankAccountSvg, name: 'bank' },
  investment: { Icon: InvestmentAccountsSvg, name: 'investment' },
  debtor: { Icon: DebtsAccountsSvg, name: 'debtor' },
  pocket_saving: { Icon: PocketsAccountsSvg, name: 'pocket_saving' },
  category_budget: { Icon: ExpenseAccountsSvg, name: 'category_budget' },
  income_source: { Icon: IncomeAccountsSvg, name: 'income_source' },
  // No drawing of its own yet, so it borrows the debtor glyph by decision.
  other: { Icon: DebtsAccountsSvg, name: 'other' },
};

// ROUTE CONFIGURATION
const ACCOUNT_TYPE_DETAIL_PAGE: { [key: string]: string } = {
  bank: '/fintrack/overview/accounts',
  income_source: '/fintrack/overview/accounts',
  investment: '/fintrack/overview/accounts',
  debtor: '/fintrack/debts/debtors',
  pocket_saving: '/fintrack/budget/pockets',
  category_budget: `/fintrack/budget/account`,
};
//---TYPE DEFINITIONS
type AccountType = keyof typeof ACCOUNT_TYPE_DATA;
type ToastMessageType = 'success' | 'error' | 'info' | 'warning';

//--- FUNCTIONS DECLARATION
// 🎯 ACCOUNT GROUPING
const groupAccountsBytype = (
  accounts: AccountListType[],
): Partial<Record<AccountType, AccountListType[]>> => {
  const groups: Partial<Record<AccountType, AccountListType[]>> = {};

  accounts.forEach((account) => {
    const accountType = ACCOUNT_TYPE_DATA[
      account.account_type_name as AccountType
    ]
      ? (account.account_type_name as AccountType)
      : 'other';

    // if (!groups[accountType]) {
    //   groups[accountType] = [];
    // }
    // groups[accountType] = [...(groups[accountType] ||= []), account];

    (groups[accountType] ||= []).push(account);
  });

  return groups;
};
//============================
// 🏦 MAIN COMPONENT ACCOUNTING DASHBOARD
//============================
const AccountingDashboard = () => {
  const location = useLocation();
  const navigateTo = useNavigate();

  //previous route to accounting
  const originRoute = location.state?.originRoute || INITIAL_PAGE_ADDRESS;

  // The return route handed to the six destination screens. The acted-on
  // account rides in the query string and not in location.state: every
  // destination forwards this string verbatim into a <Link to> or a
  // navigateTo, so anchoring the return costs those screens no change.
  const buildReturnRoute = (accountId: number | string) =>
    `${location.pathname}?focus=${accountId}`;

  // The card to come back to, read from the URL the destination sent us to.
  // A one-shot instruction, so it is not held in state.
  const focusedAccountId = new URLSearchParams(location.search).get('focus');
  // -----------------------------
  // console.log('location', {location},'previousRoute', {previousRoute},'state', location.state, 'originRoute', location.state?.originRoute)

  // -----------------------------
  // 🔄 FETCHING - ACCOUNTS LIST
  //get all basic info accounts
  const { apiData, isLoading, error } = useFetch<AccountByTypeResponseType>(
    `${url_get_all_accounting_accounts}`,
  );
  //-------------------------------
  //GET FULL CATEGORY BUDGET ACCOUNT DATA
  // const { apiData:apiDataCategory ,isLoading:isLoadingCategory ,error:errorCategory } = useFetch<AccountByTypeResponseType>(
  // `${url_get_category_budget_full_data}`
  // );
  // console.log('apiDataCategory',apiDataCategory )
  //=============================
  // 📂 GROUP COLLAPSE STATE
  // Collapsed is the default: the dashboard is an index of account types, and
  // every group open at once is the long scroll this replaces. A Set and not a
  // record so a type absent from the inventory carries no entry at all.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
   () => new Set(),
  );

  const toggleGroup = (accountType: string) => {
   setExpandedGroups((previous) => {
    const next = new Set(previous);

    if (next.has(accountType)) {
     next.delete(accountType);
    } else {
     next.add(accountType);
    }

    return next;
   });
  };
  //=============================
  // 🆕 MENU STATE
  const [menuState, setMenuState] = useState<{
    isOpen: boolean;
    account: AccountListType | null;
  }>({ isOpen: false, account: null });
  //==========================
  // FUNCTIONS DECLARATION
  //==========================
  //--------TOAST MANAGEMENT ----------
  // 🚨 TOAST STATE
  const [toast, setToast] = useState<{
    message: string;
    type: ToastMessageType;
    visible: boolean;
  }>({ message: '', type: 'info', visible: false });

  // TOAST STATE MANAGEMENT FUNCTIONS
  // 🎯 SHOW TOAST MESSAGE FUNCTION
  const showToast = useCallback(
    (message: string, type: ToastMessageType = 'info') => {
      setToast({ message, type, visible: true });
    },
    [],
  ); //

  // 🎯 HIDE TOAST MESSAGE FUNCTION
  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };
  //---
  //SIDE EFFECTS
  // ⏰ AUTO-HIDE TOAST AFTER x SECONDS
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        hideToast();
      }, 2500);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [toast.visible]);
  //---
  // Toast state messages / Definir los mensajes de estado
  const groupResponseMessage = useMemo(
    () => ({
      error: `Error loading accounts:`,
      isLoading: `...loading`,
      notFound: `No accounts found. Create first account! 🎯`,
    }),
    [],
  ); // Making groupResponseMessage a stable constant / Usamos useMemo para que esta constante sea estable

  //this side effects must not return anything, just void
  useEffect(() => {
    // 📊 SHOW TOAST BY TYPE
    if (error) {
      console.log(error);
      showToast(`${groupResponseMessage.error} ${error}`, 'error');
    }

    if (isLoading) {
      showToast(`${groupResponseMessage.isLoading}`, 'info');
    }

    if (apiData?.data.accountList.length === 0) {
      showToast(`${groupResponseMessage.notFound}`, 'warning');
    }
  }, [isLoading, error, apiData, showToast, groupResponseMessage]);
  //-----------------------------
  //============================
  // 🆕 ACCOUNT TYPE UTILITIES
  // 🎨 GET ICON AND NAME FOR ACCOUNT TYPE FUNCTION
  const getAccountTypeIconAndName = (accountType: AccountType) => {
    return ACCOUNT_TYPE_DATA[accountType] || ACCOUNT_TYPE_DATA['other'];
  };
  //---
  // 🎨 FORMAT ACCOUNT TYPE DISPLAY NAME FUNCTION
  const formatAccountTypeName = (accountType: AccountType): string => {
    return capitalize(accountType.replace('_', ' '));
  };

  // 📊 ACCOUNT GROUPING BY TYPE - FUNCTION
  const groupedAccounts = useMemo(() => {
    if (!apiData?.data.accountList.length) {
      return {};
    }
    return groupAccountsBytype(apiData?.data?.accountList);
  }, [apiData?.data.accountList]);
  //---------------------------------
  // 🎯 FOCUS GROUP EXPANSION
  // The anchored card arrives inside a collapsed group, so the group has to
  // open before the scroll effect below can find the card in the DOM. Setting
  // state here is what gives that effect the second pass it needs.
  useEffect(() => {
   if (!focusedAccountId) {
    return;
   }

   const groupHoldingFocus = Object.entries(groupedAccounts).find(
    ([, accounts]) =>
     accounts?.some(
      (account) => String(account.account_id) === focusedAccountId,
     ),
   )?.[0];

   if (!groupHoldingFocus) {
    return;
   }

   // Returning the same Set when it already holds the group: a fresh one every
   // pass would re-render forever.
   setExpandedGroups((previous) =>
    previous.has(groupHoldingFocus)
     ? previous
     : new Set(previous).add(groupHoldingFocus),
   );
  }, [focusedAccountId, groupedAccounts]);
  //---------------------------------
  // 🎯 RETURN ANCHOR
  // Brings the acted-on card back into view and hands it the keyboard. It
  // waits on groupedAccounts because the card is not in the DOM until the
  // inventory request resolves, and on expandedGroups because a collapsed
  // group renders no card to scroll to.
  useEffect(() => {
    if (!focusedAccountId || Object.keys(groupedAccounts).length === 0) {
      return;
    }

    const card = document.getElementById(`account-card-${focusedAccountId}`);
    if (!card) {
      return;
    }

    // No `behavior`: the default defers to the scrolling box's own
    // scroll-behavior, so a reduced-motion setting is still honoured.
    card.scrollIntoView({ block: 'center' });
    // The card is a div; its trigger is the only focusable node inside it.
    card.querySelector('button')?.focus({ preventScroll: true });

    // Consume the anchor: a refresh must not scroll again, and the id is not
    // part of an address worth sharing.
    navigateTo(location.pathname, { replace: true, state: location.state });
  }, [
    focusedAccountId,
    groupedAccounts,
    expandedGroups,
    location.pathname,
    location.state,
    navigateTo,
  ]);
  //=================================
  // 🎯 ACCOUNT ACTION HANDLERS
  //=================================
  // 🆕 OPEN MENU FUNCTION
  const handleMenuClick = (
    account: AccountListType,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    event.preventDefault();

    setMenuState({
      isOpen: true,
      account,
    });

    showToast(`Menu opened for ${account.account_name}`, 'info');
    //----------
    // console.log(
    //   'Menu clicked for account:',
    //   account.account_name,
    //   'previousRoute:',
    //   previousRoute,
    // );
  };
  //----------
  // 🆕 CLOSE MENU FUNCTION
  const handleCloseMenu = () => {
    setMenuState((prev) => ({ ...prev, isOpen: false }));
  };
  //---------
  // 🏦 REGULAR ACCOUNT NAVIGATION HANDLER
  // 🎯 HANDLE VIEW DETAILS
  const handleViewRegularAccountDetail = (account: AccountListType) => {
    const baseRoute =
      ACCOUNT_TYPE_DETAIL_PAGE[account.account_type_name] ||
      '/fintrack/overview/accounts';

    const detailRoute = `${baseRoute}/${account.account_id}`;
    const returnRoute = buildReturnRoute(account.account_id);
    console.log('regular', { detailRoute }, { account }, { returnRoute });

    navigateTo(detailRoute, {
      state: { previousRoute: returnRoute, detailedData: account },
    });
  };
  //---
  // 💰 CATEGORY BUDGET ACCOUNT NAVIGATION HANDLER
  const handleViewCategoryBudgetAccountDetail = (
    account: CategoryBudgetAccountListType,
  ) => {
    const categoryDetailRoute = `${ACCOUNT_TYPE_DETAIL_PAGE[account.account_type_name]}/${account.account_id}`;
    const returnRoute = buildReturnRoute(account.account_id);

    console.log(
      'categoryRoute',
      { categoryDetailRoute },
      { account },
      'id',
      account.account_id,
      { returnRoute },
    );

    // 🧭 NAVIGATE TO CATEGORY DETAIL
    navigateTo(categoryDetailRoute, {
      state: { detailedData: null, previousRoute: returnRoute },
    });
  };
  //------------------------------------
  // 📋HANDLE VIEW ACCOUNT DETAILS WITH ACCOUNT TYPE DETECTION
  //---------------------------------
  const handleViewDetails = (account: AccountListType) => {
    // 🎯 Detect Category Budget Accounts
    if (isCategoryBudgetAccount(account)) {
      // console.log('isCategoryBudgetAccount',account)
      handleViewCategoryBudgetAccountDetail(account);
    } else {
      handleViewRegularAccountDetail(account);
    }
  };
  //----------------------------------
  // 📋 HANDLE EDIT ACCOUNT✏️
  //----------------------------------
  const handleEditAccount = (account: AccountListType) => {
    // handleCloseMenu()
    //Navigate the route of edition
    const editRoute = `/fintrack/account/${account.account_id}/edit`;

    navigateTo(editRoute, {
      state: {
        accountData: account,
        previousRoute: buildReturnRoute(account.account_id),
        originRoute: originRoute,
      },
    });
  };
  //----------------------------------
  // 🚮 HANDLE DELETE ACCOUNT 🗑
  //----------------------------------
  const handleDeleteAccount = (account: AccountListType) => {
    //Navigate to the route of account deletion page
    const deleteAccountPage = `/fintrack/account/${account.account_id}/delete`; //RTA confirmation page

    navigateTo(deleteAccountPage, {
      state: {
        accountData: account,
        previousRoute: buildReturnRoute(account.account_id),
        originRoute: originRoute,
      },
    });
  };

  //====================================
  // 📦 ACCOUNT GROUPS RENDER FUNCTION
  const renderAccountGroups = () => {
    //LOADING
    // if(isLoading){
    //return <AccountingSkeleton/>;
    //  return (
    //   <div className="accounting-empty">
    //     <div className="accounting-empty__emoji">⏳</div>
    //     <h3 className="accounting-empty__title">Loading Accounts</h3>
    //     <p className="accounting-empty__message">Please wait while we load your accounts...</p>
    //   </div>
    //     )
    // }
    //--------------------------------------
    //NO ACCOUNTS INFO
    if (Object.keys(groupedAccounts).length === 0 && !isLoading) {
      return (
        <div className='accounting-empty'>
          <div className='accounting-empty__emoji'>📁</div>
          <h3 className='accounting-empty__title'>No Accounts Found</h3>
          <p className='accounting-empty__message'>
            Get started by creating your first account to manage your finances.
          </p>
        </div>
      );
    }
    //------
    return Object.entries(groupedAccounts).map(([accountType, accounts]) => {
      const safeAccountType = accountType as AccountType;
      const accountTypeData = getAccountTypeIconAndName(safeAccountType);
      // A capitalised binding: JSX reads a lowercase tag as an HTML element, so
      // accountTypeData.Icon cannot be rendered where it stands.
      const AccountTypeIcon = accountTypeData.Icon;
      // Bound once so the heading's aria-controls and the grid's id cannot
      // drift apart.
      const gridId = `account-group-grid-${accountType}`;
      const isExpanded = expandedGroups.has(accountType);

      return (
        <div className='account-group' key={accountType}>
          <h3 className='account-group__title'>
           <button
            type='button'
            className={`account-group__toggle${isExpanded ? ' is-active' : ''}`}
            onClick={() => toggleGroup(accountType)}
            aria-expanded={isExpanded}
            aria-controls={gridId}
           >
            {/* Decorative: the button around it is what answers the click, so
                the frame still declares no state of its own. */}
            <span className='account-group__icon-frame'>
             <AccountTypeIcon
              className='account-group__icon'
              aria-hidden='true'
              focusable='false'
             />
            </span>

            <span className='account-group__name'>
             {formatAccountTypeName(accountTypeData.name as AccountType)}{' '}
             accounts
            </span>

            {/* What a shut group has left to say about its size. */}
            <span className='account-group__count'>{accounts!.length}</span>

            <ArrowDownLightSvg
             className='account-group__chevron'
             aria-hidden='true'
             focusable='false'
            />
           </button>
          </h3>

          <div
           className={`account-group__grid${
            isExpanded ? '' : ' account-group__grid--collapsed'
           }`}
           id={gridId}
          >
            {/* Not rendered at all while shut, rather than hidden with CSS: a
                hidden card is still findable by id, and the return anchor
                would spend itself on one it can neither scroll to nor focus. */}
            {isExpanded &&
             accounts!.map((account) => (
              <div
                className='account-card'
                id={`account-card-${account.account_id}`}
                key={account.account_id}
              >
                <AccountingBox
                  title={account.account_name.toUpperCase()}
                  amount={account.account_balance}
                  currency={account.currency_code}
                  account_type={`(${capitalize(account.account_type_name.split('_')[0])})`}
                  onMenuClick={(e) => handleMenuClick(account, e)}
                  isMenuOpen={
                    menuState.isOpen &&
                    menuState.account?.account_id === account.account_id
                  }
                />
              </div>
             ))}
          </div>
        </div>
      );
    });
  };

  //=========================
  // 🎪 MAIN COMPONENT RENDER
  //=========================
  return (
    <>
      <section className='accounting__layout'>
        <TopWhiteSpace variant={'dark'} />

        <div className='accounting__container'>
          <Link to={originRoute} className='accounting__header'>
            <div className='accounting__header--icon'>
              <LeftArrowSvg />
            </div>
            <div className='accounting__title'>{'Accounting'}</div>
          </Link>

          {renderAccountGroups()}
        </div>

        {/* 🚨 TOAST NOTIFICATION */}
        <Toast
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onClose={hideToast}
          duration={3000}
        />

        {/*🆕 ACCOUNT ACTIONS MENU */}
        {menuState.isOpen && menuState.account && (
          <AccountActionsMenu
            accountName={menuState.account.account_name}
            isOpen={menuState.isOpen}
            onClose={handleCloseMenu}
            // 👁‍🗨 onViewDetail
            onViewDetails={() => handleViewDetails(menuState.account!)}
            // ✏️ onEditAccount
            onEditAccount={() => handleEditAccount(menuState.account!)}
            //🗑️ onDeleteAccount
            onDeleteAccount={() => {
              if (menuState.account) {
                handleDeleteAccount(menuState.account);
              }
            }}
          />
        )}
      </section>
    </>
  );
};

export default AccountingDashboard;
