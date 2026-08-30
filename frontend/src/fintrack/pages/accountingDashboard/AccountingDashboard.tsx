// frontend/src/pages/accountingDashboard/AccountingDashboard.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
//---
import { INITIAL_PAGE_ADDRESS } from '../../helpers/constants';
import { url_get_all_accounting_accounts } from '../../../urlConfig';
//---
import AccountingBox from './AccountingBox';
import LeftArrowSvg from '../../../assets/LeftArrowSvg.svg';
// '?react' and not a bare import: only that specifier carries a React
// component type, so the icon can take a className.
import BankAccountSvg from '../../../assets/accountingDashboardSvg/bankAccountSvg.svg?react';
import DebtsAccountsSvg from '../../../assets/accountingDashboardSvg/debtsAccountsSvg.svg?react';
import ExpenseAccountsSvg from '../../../assets/accountingDashboardSvg/expenseAccountsSvg.svg?react';
import IncomeAccountsSvg from '../../../assets/accountingDashboardSvg/incomeAccountsSvg.svg?react';
import InvestmentAccountsSvg from '../../../assets/accountingDashboardSvg/investmentAccountsSvg.svg?react';
// The disclosure affordance of every group heading. One asset, rotated when
// the group opens, rather than a second drawing for the open state.
import ArrowDownLightSvg from '../../../assets/ArrowDownLightSvg.svg?react';
// The two halves of the filter field. Both draw with currentColor, so they
// take the field's colour rather than declaring one.
import SearchSvg from '../../../assets/budgetListControlsSvg/SearchSvg.svg?react';
import ClearSvg from '../../../assets/budgetListControlsSvg/ClearSvg.svg?react';
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
  category_budget: `/fintrack/budget/account`,
};
//---TYPE DEFINITIONS
type AccountType = keyof typeof ACCOUNT_TYPE_DATA;
type ToastMessageType = 'success' | 'error' | 'info' | 'warning';

//--- FUNCTIONS DECLARATION
// 🔎 SEARCH NORMALISATION
// Strips the accents and the case so an account typed 'Café' answers to
// 'cafe'. localeCompare has a sensitivity option that does this for sorting,
// but there is no equivalent for a substring test.
const normalizeForSearch = (value: string): string =>
 value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

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

  // Alphabetical and not by balance: a group runs past a hundred accounts in
  // production, where the only navigable order is the one that matches the
  // name being looked for. 'es' with base sensitivity so ñ and á land where a
  // reader expects them, whatever collation the database happens to carry.
  Object.values(groups).forEach((accountsOfType) =>
    accountsOfType?.sort((first, second) =>
      first.account_name.localeCompare(second.account_name, 'es', {
        sensitivity: 'base',
      }),
    ),
  );

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
  // ⬆️⬇️ SCROLL JUMP
  // One control, two destinations. Which one it offers is decided by where the
  // reader already is: past a screenful, the way back is up; before it, the far
  // end is what a long inventory makes expensive to reach.
  //
  // Half of what can actually be scrolled, not half a viewport: on a list barely
  // taller than the window the bottom is reached before a viewport is travelled,
  // so a viewport-relative threshold leaves the arrow pointing down at the end
  // of the list and the click does nothing.
  const [jumpsToTop, setJumpsToTop] = useState(false);
  // Nothing to scroll is also nothing to jump to, and the control takes itself
  // off screen rather than offering a trip of zero pixels.
  const [canJump, setCanJump] = useState(false);

  useEffect(() => {
    const decideDirection = () => {
      // innerHeight is fractional on a zoomed viewport, so a document that does
      // not scroll can still report a fraction of a pixel of distance.
      const scrollableDistance =
        document.documentElement.scrollHeight - window.innerHeight;

      setCanJump(scrollableDistance >= 1);
      setJumpsToTop(window.scrollY > scrollableDistance / 2);
    };

    decideDirection();
    window.addEventListener('scroll', decideDirection, { passive: true });
    // Rotating the device changes innerHeight and expanding a group changes
    // scrollHeight. Neither fires a scroll event, and both move the threshold.
    window.addEventListener('resize', decideDirection);

    const watchDocumentHeight = new ResizeObserver(decideDirection);
    watchDocumentHeight.observe(document.documentElement);

    return () => {
      window.removeEventListener('scroll', decideDirection);
      window.removeEventListener('resize', decideDirection);
      watchDocumentHeight.disconnect();
    };
  }, []);

  const jumpToEdge = useCallback(() => {
    // Honoured here and not only in CSS: scroll-behavior does not govern a
    // programmatic scroll that names its own behavior.
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    window.scrollTo({
      top: jumpsToTop ? 0 : document.documentElement.scrollHeight,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [jumpsToTop]);

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

    // No loading toast: the skeleton already reports the wait, and a toast for
    // it fires on every mount and covers the jump button while it shows.

    if (apiData?.data.accountList.length === 0) {
      showToast(`${groupResponseMessage.notFound}`, 'warning');
    }
  }, [error, apiData, showToast, groupResponseMessage]);
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
  // 🔎 SEARCH
  // Filtered in the client and not asked of the server: the inventory already
  // arrives whole in one payload, so the filter costs no request and answers
  // on the keystroke.
  const [searchTerm, setSearchTerm] = useState('');
  const searchQuery = normalizeForSearch(searchTerm.trim());

  const visibleGroups = useMemo(() => {
    if (!searchQuery) {
      return groupedAccounts;
    }

    const matches: Partial<Record<AccountType, AccountListType[]>> = {};

    Object.entries(groupedAccounts).forEach(([accountType, accounts]) => {
      const hits = accounts?.filter((account) =>
        normalizeForSearch(account.account_name).includes(searchQuery),
      );

      // A group with no hit is dropped rather than shown empty: the heading
      // would otherwise claim a type that matched nothing.
      if (hits?.length) {
        matches[accountType as AccountType] = hits;
      }
    });

    return matches;
  }, [groupedAccounts, searchQuery]);
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

    // No `behavior`: the default defers to the scrolling box, which for this
    // route is the document, and :root in index.css declares smooth there —
    // with the reduced-motion override beside it, so the setting is honoured.
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
    // Two different empty states: an inventory with nothing in it asks for an
    // account, a filter that matched nothing asks for another word.
    if (Object.keys(visibleGroups).length === 0 && !isLoading) {
      const isFiltered = Boolean(searchQuery);

      return (
        <div className='accounting-empty'>
          <div className='accounting-empty__emoji'>
            {isFiltered ? '🔎' : '📁'}
          </div>
          <h3 className='accounting-empty__title'>
            {isFiltered ? 'No matching accounts' : 'No Accounts Found'}
          </h3>
          <p className='accounting-empty__message'>
            {isFiltered
              ? `No account name contains "${searchTerm.trim()}".`
              : 'Get started by creating your first account to manage your finances.'}
          </p>
        </div>
      );
    }
    //------
    return Object.entries(visibleGroups).map(([accountType, accounts]) => {
      const safeAccountType = accountType as AccountType;
      const accountTypeData = getAccountTypeIconAndName(safeAccountType);
      // A capitalised binding: JSX reads a lowercase tag as an HTML element, so
      // accountTypeData.Icon cannot be rendered where it stands.
      const AccountTypeIcon = accountTypeData.Icon;
      // Bound once so the heading's aria-controls and the grid's id cannot
      // drift apart.
      const gridId = `account-group-grid-${accountType}`;
      // A search opens every group it matched: leaving them shut would hide
      // the very rows the filter just selected.
      const isExpanded =
        Boolean(searchQuery) || expandedGroups.has(accountType);

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
             {formatAccountTypeName(accountTypeData.name as AccountType)}
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
                  // Read from the same map that decided which group this card
                  // is standing in. Split off the row's own type name, a row
                  // of a type the map does not know announced its first word
                  // as its kind — so a retired pocket account read "(Pocket)"
                  // under a heading that said Other.
                  account_type={`(${capitalize(
                    ACCOUNT_TYPE_DATA[
                      account.account_type_name as AccountType
                    ]?.name ?? ACCOUNT_TYPE_DATA['other'].name,
                  )})`}
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
      {/* No TopWhiteSpace here: the top space is inside .accounting__stickyHead
          so the header docks from the first pixel instead of travelling to it. */}
      <section className='accounting__layout'>
        <div className='accounting__container'>
          {/* The title and the filter travel as one pinned box. Two sticky
              siblings would need the second offset by the first's height, and
              that height is not a constant. */}
          <div className='accounting__stickyHead'>
            <Link to={originRoute} className='accounting__header'>
              <div className='accounting__header--icon'>
                <LeftArrowSvg />
              </div>
              <div className='accounting__title'>{'Accounting'}</div>
            </Link>

            {/* Always rendered, whatever the inventory holds: a field that
                appears past a threshold shifts every group down the moment
                it arrives. type='text' and not 'search' so the browser does
                not draw a second clear button beside ours. */}
            <div className='accountingSearch'>
              <SearchSvg
                className='accountingSearch__icon'
                aria-hidden='true'
                focusable='false'
              />
              <input
                type='text'
                className='accountingSearch__field'
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder='Search accounts'
                aria-label='Search accounts by name'
              />
              {searchTerm && (
                <button
                  type='button'
                  className='accountingSearch__clear'
                  onClick={() => setSearchTerm('')}
                  aria-label='Clear search'
                >
                  <ClearSvg
                    className='accountingSearch__clear-glyph'
                    aria-hidden='true'
                    focusable='false'
                  />
                </button>
              )}
            </div>
          </div>

          {renderAccountGroups()}
        </div>

        {/* Sits outside the container so its offsets are measured against the
            viewport and not against a column that is capped and centred.
            Unmounted rather than hidden: a control that cannot act should not
            hold a tab stop either. */}
        {canJump && (
          <button
            type='button'
            className='accounting__scrollJump'
            onClick={jumpToEdge}
            aria-label={
              jumpsToTop ? 'Scroll to top of list' : 'Scroll to bottom of list'
            }
            title={jumpsToTop ? 'Back to top' : 'Go to the end'}
          >
            <ArrowDownLightSvg
              className={`accounting__scrollJump-glyph${
                jumpsToTop ? ' accounting__scrollJump-glyph--up' : ''
              }`}
              aria-hidden='true'
              focusable='false'
            />
          </button>
        )}

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
