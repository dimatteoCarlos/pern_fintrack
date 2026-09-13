// frontend/src/fintrack/editionAndDeletion/pages/closedAccounts/ClosedAccountsPage.tsx

import { useEffect, useId, useState } from 'react';
// Only the commented icon map below used these.
// import type { FunctionComponent, SVGProps } from 'react';
import { useNavigate } from 'react-router-dom';

import { useClosedAccounts } from '../../hooks/useClosedAccounts.ts';
import { useLanguageTranslation } from '../../hooks/useLangTranslation.ts';
import {
 defaultLanguage,
 DictionaryDataType,
 isLanguageTypeValid,
 LanguageKeyType,
} from '../../utils/languages.ts';

import {
 ClosedAccountRowType,
 ClosedAccountSortKeyType,
} from '../../types/closedAccountsTypes.ts';

import { formatDateToDDMMYYYY } from '../../../helpers/functions.ts';

// The type icons moved to utils/accountTypeIcons.ts on 2026-09-12, shared with
// the deletion screen's account card. Commented rather than removed.
// import BankSvg from '../../../../assets/accountingDashboardSvg/bankAccountSvg.svg?react';
// import CashSvg from '../../../../assets/accountingDashboardSvg/cashAccountsSvg.svg?react';
// import InvestmentSvg from '../../../../assets/accountingDashboardSvg/investmentAccountsSvg.svg?react';
// import DebtorSvg from '../../../../assets/accountingDashboardSvg/debtsAccountsSvg.svg?react';
// import CategorySvg from '../../../../assets/accountingDashboardSvg/expenseAccountsSvg.svg?react';
// import IncomeSvg from '../../../../assets/accountingDashboardSvg/incomeAccountsSvg.svg?react';
// import PocketSvg from '../../../../assets/accountingDashboardSvg/pocketsAccountsSvg.svg?react';
// import ArchiveSvg from '../../../../assets/userProfileMenuSvg/archiveSvg.svg?react';
import { getAccountTypeIcon } from '../../utils/accountTypeIcons.ts';
// The toolbar's two, from the pocket module's set: the same magnifier and the
// same direction chevron the owner already reads elsewhere in the app.
import SearchSvg from '../../../../assets/pocketSvg/SearchSvg.svg?react';
import SortDirectionSvg from '../../../../assets/pocketSvg/SortDirectionSvg.svg?react';

import './closedAccounts.css';
import ClosedAccountsCountBadge from './ClosedAccountsCountBadge.tsx';

// The same constant AccountDeletionPage.tsx:43 carries, restated rather than
// imported: a page does not depend on a sibling page for a route.
const ACCOUNTING_DASHBOARD_ROUTE = '/fintrack/tracker/accounting';

// ==========================
// 🗂 THE CLOSED-ACCOUNT REGISTRY
//
// WHAT THIS SCREEN IS FOR. Closing an account REMOVES it: the row leaves
// `user_accounts` inside the same transaction that stamps the closure into
// `account_registry`. So a closed account is absent from every list in the app
// except this one, and this one is the only place its name, its reason and the
// date it went are readable at all.
//
// THREE FETCH STATES, NOT TWO. Loading is a set of skeleton rows, an error is a
// message with a retry beside it, and empty is its own screen - and empty
// itself splits in two, because "you have closed nothing" and "your filter
// matched nothing" call for different sentences and only the second one offers
// a way back.
//
// THE TOOLBAR DOES NOT OWN ANYTHING. Search, type, sort, order and page all
// live in the hook as one query object, and the url is derived from it. Every
// control here is a one-line setter.
// ==========================

// The types an owner can close, which is every type they can create. `boundary`
// is deliberately absent: the compensation account cannot be closed by any
// method - the engine refuses it with a 403 before it branches on the deletion
// type - so offering it as a filter would offer a search that can only ever
// come back empty.
const FILTERABLE_ACCOUNT_TYPES = [
 'bank',
 // 'cash',
 'investment',
 'debtor',
 'category_budget',
 'income_source',
 // 'pocket_saving',
] as const;

const SORT_OPTIONS: {
 key: ClosedAccountSortKeyType;
 labelKey:
  | 'closedAccountsSortClosedAt'
  | 'closedAccountsSortName'
  | 'closedAccountsSortType'
  | 'closedAccountsSortCreatedAt';
}[] = [
 { key: 'closed_at', labelKey: 'closedAccountsSortClosedAt' },
 { key: 'account_name', labelKey: 'closedAccountsSortName' },
 { key: 'account_type_name', labelKey: 'closedAccountsSortType' },
 { key: 'account_created_at', labelKey: 'closedAccountsSortCreatedAt' },
];

// How many skeleton rows a loading screen shows. Matched to the default page
// size's first screenful rather than to the page size itself: five rows read as
// "a list is coming", twenty read as a list that is already there.
const SKELETON_ROW_COUNT = 5;

const PAGE_SIZE_OPTIONS = [10, 20, 50];

// One icon per account type, so a closure is recognisable before its name is
// read. Keyed by the value account_types.account_type_name actually holds.
//
// A type with no entry - including the null a registry row carries when the
// catalog row was erased before the registry existed - falls back to the
// archive mark rather than to an empty box, which would misalign the row.
// Moved to utils/accountTypeIcons.ts as ACCOUNT_TYPE_ICONS and
// getAccountTypeIcon; the fallback described above lives there now.
// const ACCOUNT_TYPE_ICONS: Record<
//  string,
//  FunctionComponent<SVGProps<SVGSVGElement>>
// > = {
//  bank: BankSvg,
//  cash: CashSvg,
//  investment: InvestmentSvg,
//  debtor: DebtorSvg,
//  category_budget: CategorySvg,
//  income_source: IncomeSvg,
//  pocket_saving: PocketSvg,
// };

// The dictionary entry that names each type, so the pill reads "Banco" rather
// than the catalog's "bank". A type with no entry shows its raw name.
const ACCOUNT_TYPE_LABEL_KEYS: Record<string, keyof DictionaryDataType> = {
 bank: 'bank',
 cash: 'cash',
 investment: 'investment',
 debtor: 'debtor',
 category_budget: 'category_budget',
 income_source: 'income_source',
 pocket_saving: 'pocket_saving',
};

export const ClosedAccountsPage = () => {
 const navigate = useNavigate();

 // The same persistence every other screen in this module uses: the choice
 // lives in localStorage under 'userLang' and falls back rather than throwing on
 // a value that is no longer a language.
 const [language, setLanguage] = useState<LanguageKeyType>(defaultLanguage);

 useEffect(() => {
  const savedLang = localStorage.getItem('userLang');
  if (savedLang && isLanguageTypeValid(savedLang)) {
   setLanguage(savedLang);
  }
 }, []);

 const { translateText: t } = useLanguageTranslation(language);

 const searchFieldId = useId();
 const typeFieldId = useId();
 const sortFieldId = useId();
 const limitFieldId = useId();

 const {
  query,
  isFiltered,
  accountList,
  total,
  pageCount,
  isLoading,
  error,
  refetch,
  setSearch,
  setType,
  setSort,
  setOrder,
  setPage,
  setLimit,
  resetFilters,
 } = useClosedAccounts();

 // A row's amount is text all the way from the server, so it is rendered as it
 // arrived. A missing one is a dash, never a zero: an account whose starting
 // amount was never stamped did not start at nothing.
 const renderAmount = (row: ClosedAccountRowType) => {
  if (!row.accountStartingAmount) return '—';
  return row.currencyCode
   ? `${row.accountStartingAmount} ${row.currencyCode.toUpperCase()}`
   : row.accountStartingAmount;
 };

 const renderCategory = (row: ClosedAccountRowType) => {
  if (!row.categoryName) return '—';
  return row.subcategory
   ? `${row.categoryName} / ${row.subcategory}`
   : row.categoryName;
 };

 return (
  <main className='closed-accounts'>
   <header className='closed-accounts__header'>
    <h1 className='closed-accounts__title'>{t('closedAccountsPageTitle')}</h1>
    <p className='closed-accounts__lede'>{t('closedAccountsLede')}</p>
   </header>

   {/* 🔎 THE TOOLBAR. Search, filter, sort and page size, in the order the
       owner reaches for them. Each control resets the page to 1 in the hook,
       because page 4 of the old result is not a page of the new one. */}
   <section className='closed-accounts__toolbar' aria-label={t('closedAccountsSearchLabel')}>
    <div className='closed-accounts__field closed-accounts__field--search'>
     <label className='closed-accounts__label' htmlFor={searchFieldId}>
      {t('closedAccountsSearchLabel')}
     </label>
     {/* The magnifier sits inside the field rather than beside it: a label
         already names the control, and an icon on the outside would be a
         second thing claiming to name it. */}
     <span className='closed-accounts__input-wrap'>
      <SearchSvg className='closed-accounts__input-icon' aria-hidden='true' />
      <input
       id={searchFieldId}
       className='closed-accounts__input closed-accounts__input--with-icon'
       type='search'
       value={query.search}
       onChange={(event) => setSearch(event.target.value)}
       placeholder={t('closedAccountsSearchPlaceholder')}
      />
     </span>
    </div>

    <div className='closed-accounts__field closed-accounts__field--type'>
     <label className='closed-accounts__label' htmlFor={typeFieldId}>
      {t('closedAccountsTypeLabel')}
     </label>
     <select
      id={typeFieldId}
      className='closed-accounts__select'
      value={query.type}
      onChange={(event) => setType(event.target.value)}
     >
      <option value=''>{t('closedAccountsTypeAll')}</option>
      {FILTERABLE_ACCOUNT_TYPES.map((accountType) => (
       <option key={accountType} value={accountType}>
        {accountType.replace(/_/g, ' ')}
       </option>
      ))}
     </select>
    </div>

    {/* Per page sits beside the type filter rather than after the sort group.
        Both are narrow, so on a phone they share one row instead of taking a
        full-width row each, and the reader reaches the sort key next to the
        direction that modifies it. */}
    <div className='closed-accounts__field closed-accounts__field--limit'>
     <label className='closed-accounts__label' htmlFor={limitFieldId}>
      {t('closedAccountsPerPage')}
     </label>
     <select
      id={limitFieldId}
      className='closed-accounts__select'
      value={query.limit}
      onChange={(event) => setLimit(Number(event.target.value))}
     >
      {PAGE_SIZE_OPTIONS.map((size) => (
       <option key={size} value={size}>
        {size}
       </option>
      ))}
     </select>
    </div>

    {/* The sort key and its direction are ONE decision, so they are one group.
        The button used to be a sibling of the three fields, which made the
        layout treat a modifier of the sort key as a fourth control and gave it
        a row of its own on a phone. */}
    <div className='closed-accounts__field closed-accounts__field--sort'>
     <label className='closed-accounts__label' htmlFor={sortFieldId}>
      {t('closedAccountsSortLabel')}
     </label>
     <div className='closed-accounts__sort-row'>
      <select
       id={sortFieldId}
       className='closed-accounts__select'
       value={query.sort}
       onChange={(event) =>
        setSort(event.target.value as ClosedAccountSortKeyType)
       }
      >
       {SORT_OPTIONS.map((option) => (
        <option key={option.key} value={option.key}>
         {t(option.labelKey)}
        </option>
       ))}
      </select>

      {/* The direction is a button rather than a second select: it has exactly
          two states and it says which one it is in, which a two-option
          dropdown does with one more click. */}
      <button
       type='button'
       className='closed-accounts__order'
       onClick={() => setOrder(query.order === 'desc' ? 'asc' : 'desc')}
       // The visible text is the short DESC/ASC of the proposal; the full
       // sentence stays for a screen reader, which cannot read an abbreviation.
       aria-label={`${t('closedAccountsOrderToggle')}: ${
        query.order === 'desc'
         ? t('closedAccountsOrderDesc')
         : t('closedAccountsOrderAsc')
       }`}
      >
       {/* One chevron, turned. Two icons for one axis would make the reader
           compare shapes to learn which way the list runs; turning the same
           one states it. */}
       <SortDirectionSvg
        className={`closed-accounts__order-icon${
         query.order === 'asc' ? ' is-ascending' : ''
        }`}
        aria-hidden='true'
       />
       <span className='closed-accounts__order-text' aria-hidden='true'>
        {query.order === 'desc'
         ? t('closedAccountsOrderDescShort')
         : t('closedAccountsOrderAscShort')}
       </span>
      </button>
     </div>
    </div>
   </section>

   {/* ⏳ LOADING. Skeleton rows, never a spinner over an empty table: the
       shape of what is coming is what keeps the page from jumping when it
       arrives. */}
   {isLoading && (
    <ul className='closed-accounts__list' aria-busy='true'>
     {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
      <li key={index} className='closed-accounts__row closed-accounts__row--skeleton'>
       <span className='closed-accounts__skeleton-bar' />
       <span className='closed-accounts__skeleton-bar closed-accounts__skeleton-bar--short' />
      </li>
     ))}
    </ul>
   )}

   {/* ⚠️ ERROR. A message and a retry, which is the pair the project's own
       frontend rule requires - a failed read with no way back is a dead end. */}
   {!isLoading && error && (
    <div className='closed-accounts__notice' role='alert'>
     <p className='closed-accounts__notice-message'>
      {t('closedAccountsErrorMessage')}
     </p>
     <button
      type='button'
      className='closed-accounts__notice-action'
      onClick={refetch}
     >
      {t('closedAccountsRetry')}
     </button>
    </div>
   )}

   {/* 📭 EMPTY, in its two distinct shapes. A filter that matched nothing
       offers a way back; an owner who has closed nothing is told what the page
       is for instead, because there is nothing here for them to undo. */}
   {!isLoading && !error && accountList.length === 0 && (
    <div className='closed-accounts__notice' role='status'>
     <p className='closed-accounts__notice-title'>
      {isFiltered
       ? t('closedAccountsNoMatchTitle')
       : t('closedAccountsEmptyTitle')}
     </p>
     <p className='closed-accounts__notice-message'>
      {isFiltered
       ? t('closedAccountsNoMatchMessage')
       : t('closedAccountsEmptyMessage')}
     </p>
     {isFiltered && (
      <button
       type='button'
       className='closed-accounts__notice-action'
       onClick={resetFilters}
      >
       {t('closedAccountsClearFilters')}
      </button>
     )}
    </div>
   )}

   {/* Dynamic close count indicator */}
   {!isLoading && !error && accountList.length > 0 && (
     <ClosedAccountsCountBadge
       total={total}
       label={t('closedAccountsTotal')}
     />
   )}

   {/* 🗂 THE LIST. One article per closure rather than a table row: the same
       markup reads as a card on a phone and as a row on a wide screen, and a
       table cannot be made to stack without losing its headers. */}
   {!isLoading && !error && accountList.length > 0 && (
    <ul className='closed-accounts__list'>
     {accountList.map((row) => {
      const TypeIcon = getAccountTypeIcon(row.accountTypeName);

      return (
      <li key={row.accountId} className='closed-accounts__row'>
       <div className='closed-accounts__identity'>
        <span className='closed-accounts__badge' aria-hidden='true'>
         <TypeIcon className='closed-accounts__badge-icon' />
        </span>

        <span className='closed-accounts__identity-text'>
         <span
          className={`closed-accounts__name${
           row.accountName ? '' : ' closed-accounts__name--unknown'
          }`}
         >
          {row.accountName ?? t('closedAccountsNameUnknown')}
         </span>
         <span className='closed-accounts__type'>
          {row.accountTypeName
           ? ACCOUNT_TYPE_LABEL_KEYS[row.accountTypeName]
            ? t(ACCOUNT_TYPE_LABEL_KEYS[row.accountTypeName])
            : row.accountTypeName.replace(/_/g, ' ')
           : t('closedAccountsTypeUnknown')}
         </span>
        </span>
       </div>

       <dl className='closed-accounts__facts'>
        <div className='closed-accounts__fact'>
         <dt className='closed-accounts__fact-label'>
          {t('closedAccountsColumnClosedAt')}
         </dt>
         {/* The one fact every row on this screen is here for, so it is the
             one fact given weight. The rest read at the same level. */}
         <dd className='closed-accounts__fact-value closed-accounts__fact-value--key'>
          {formatDateToDDMMYYYY(row.closedAt)}
         </dd>
        </div>

        <div className='closed-accounts__fact'>
         <dt className='closed-accounts__fact-label'>
          {t('closedAccountsColumnOpened')}
         </dt>
         <dd className='closed-accounts__fact-value'>
          {row.accountCreatedAt
           ? formatDateToDDMMYYYY(row.accountCreatedAt)
           : '—'}
         </dd>
        </div>

        <div className='closed-accounts__fact'>
         <dt className='closed-accounts__fact-label'>
          {t('closedAccountsColumnStartingAmount')}
         </dt>
         <dd className='closed-accounts__fact-value'>{renderAmount(row)}</dd>
        </div>

        {/* Only a category budget carries these two, and only that type shows
            the line - an empty Category row on a bank account is a question
            the reader has to answer for themselves. */}
        {row.categoryName && (
         <div className='closed-accounts__fact'>
          <dt className='closed-accounts__fact-label'>
           {t('closedAccountsColumnCategory')}
          </dt>
          <dd className='closed-accounts__fact-value'>
           {renderCategory(row)}
          </dd>
         </div>
        )}
       </dl>

       <p className='closed-accounts__reason'>
        <span className='closed-accounts__fact-label'>
         {t('closedAccountsColumnReason')}
        </span>
        {row.closeReason}
       </p>
      </li>
      );
     })}
    </ul>
   )}

   {/* 📄 THE PAGER. Hidden on a single page rather than shown disabled: a
       control that can never do anything is noise. Back on the left and the
       pager on the right, one row, as in the proposal; the footer always
       renders because the back button lives in it. */}
   <footer className='closed-accounts__pager'>
    <button
     type='button'
     className='closed-accounts__back'
     onClick={() => navigate(ACCOUNTING_DASHBOARD_ROUTE)}
    >
     {t('closedAccountsBackButton')}
    </button>

    {/* The count moved to ClosedAccountsCountBadge above the list; a second
        copy here repeated it.
    <span className='closed-accounts__count'>
     {t('closedAccountsTotal').replace('{total}', String(total))}
    </span> */}

     {!isLoading && !error && pageCount > 1 && (
      <div className='closed-accounts__pager-controls'>
       <button
        type='button'
        className='closed-accounts__page-button'
        onClick={() => setPage(query.page - 1)}
        disabled={query.page <= 1}
       >
        {t('closedAccountsPreviousPage')}
       </button>

       {/* The two numbers in bold, as in the proposal. The sentence is split on
           its placeholders so each language keeps its own word order. */}
       <span className='closed-accounts__page-status'>
        {t('closedAccountsPageStatus')
         .split(/(\{page\}|\{pageCount\})/)
         .map((part, index) =>
          part === '{page}' ? (
           <strong key={index}>{query.page}</strong>
          ) : part === '{pageCount}' ? (
           <strong key={index}>{pageCount}</strong>
          ) : (
           part
          ),
         )}
       </span>

       <button
        type='button'
        className='closed-accounts__page-button'
        onClick={() => setPage(query.page + 1)}
        disabled={query.page >= pageCount}
       >
        {t('closedAccountsNextPage')}
       </button>
      </div>
     )}
   </footer>
  </main>
 );
};

export default ClosedAccountsPage;
