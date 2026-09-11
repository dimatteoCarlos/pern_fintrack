import { useEffect, useId, useState } from 'react';
import type { FunctionComponent, SVGProps } from 'react';
import { useNavigate } from 'react-router-dom';

import { useClosedAccounts } from '../../hooks/useClosedAccounts.ts';
import { useLanguageTranslation } from '../../hooks/useLangTranslation.ts';
import {
  defaultLanguage,
  isLanguageTypeValid,
  type LanguageKeyType,
} from '../../utils/languages.ts';

import type {
  ClosedAccountRowType,
  ClosedAccountSortKeyType,
} from '../../types/closedAccountsTypes.ts';

import { formatDateToDDMMYYYY } from '../../../helpers/functions.ts';

import BankSvg from '../../../../assets/accountingDashboardSvg/bankAccountSvg.svg?react';
import CashSvg from '../../../../assets/accountingDashboardSvg/cashAccountsSvg.svg?react';
import InvestmentSvg from '../../../../assets/accountingDashboardSvg/investmentAccountsSvg.svg?react';
import DebtorSvg from '../../../../assets/accountingDashboardSvg/debtsAccountsSvg.svg?react';
import CategorySvg from '../../../../assets/accountingDashboardSvg/expenseAccountsSvg.svg?react';
import IncomeSvg from '../../../../assets/accountingDashboardSvg/incomeAccountsSvg.svg?react';
import PocketSvg from '../../../../assets/accountingDashboardSvg/pocketsAccountsSvg.svg?react';
import ArchiveSvg from '../../../../assets/userProfileMenuSvg/archiveSvg.svg?react';

import SearchSvg from '../../../../assets/pocketSvg/SearchSvg.svg?react';
import SortDirectionSvg from '../../../../assets/pocketSvg/SortDirectionSvg.svg?react';

import './closedAccounts.css';

const ACCOUNTING_DASHBOARD_ROUTE = '/fintrack/tracker/accounting';

const FILTERABLE_ACCOUNT_TYPES = [
  'bank',
  'cash',
  'investment',
  'debtor',
  'category_budget',
  'income_source',
  'pocket_saving',
] as const;

type SortOptionType = {
  key: ClosedAccountSortKeyType;
  labelKey:
    | 'closedAccountsSortClosedAt'
    | 'closedAccountsSortName'
    | 'closedAccountsSortType'
    | 'closedAccountsSortCreatedAt';
};

const SORT_OPTIONS: SortOptionType[] = [
  { key: 'closed_at', labelKey: 'closedAccountsSortClosedAt' },
  { key: 'account_name', labelKey: 'closedAccountsSortName' },
  { key: 'account_type_name', labelKey: 'closedAccountsSortType' },
  { key: 'account_created_at', labelKey: 'closedAccountsSortCreatedAt' },
];

const SKELETON_ROW_COUNT = 5;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

const ACCOUNT_TYPE_ICONS: Record<
  string,
  FunctionComponent<SVGProps<SVGSVGElement>>
> = {
  bank: BankSvg,
  cash: CashSvg,
  investment: InvestmentSvg,
  debtor: DebtorSvg,
  category_budget: CategorySvg,
  income_source: IncomeSvg,
  pocket_saving: PocketSvg,
};

export const ClosedAccountsPage = () => {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<LanguageKeyType>(defaultLanguage);

  useEffect(() => {
    const savedLang = localStorage.getItem('userLang');
    if (savedLang && isLanguageTypeValid(savedLang)) {
      setLanguage(savedLang as LanguageKeyType);
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
    <main className="closed-accounts">
      <header className="closed-accounts__header">
        <h1 className="closed-accounts__title">{t('closedAccountsPageTitle')}</h1>
        <p className="closed-accounts__lede">{t('closedAccountsLede')}</p>
      </header>

      <section
        className="closed-accounts__toolbar"
        aria-label={t('closedAccountsSearchLabel')}
      >
        <div className="closed-accounts__field closed-accounts__field--search">
          <label className="closed-accounts__label" htmlFor={searchFieldId}>
            {t('closedAccountsSearchLabel')}
          </label>
          <span className="closed-accounts__input-wrap">
            <SearchSvg className="closed-accounts__input-icon" aria-hidden="true" />
            <input
              id={searchFieldId}
              className="closed-accounts__input closed-accounts__input--with-icon"
              type="search"
              value={query.search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('closedAccountsSearchPlaceholder')}
            />
          </span>
        </div>

        <div className="closed-accounts__field closed-accounts__field--type">
          <label className="closed-accounts__label" htmlFor={typeFieldId}>
            {t('closedAccountsTypeLabel')}
          </label>
          <select
            id={typeFieldId}
            className="closed-accounts__select"
            value={query.type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">{t('closedAccountsTypeAll')}</option>
            {FILTERABLE_ACCOUNT_TYPES.map((accountType) => (
              <option key={accountType} value={accountType}>
                {accountType.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="closed-accounts__field closed-accounts__field--limit">
          <label className="closed-accounts__label" htmlFor={limitFieldId}>
            {t('closedAccountsPerPage')}
          </label>
          <select
            id={limitFieldId}
            className="closed-accounts__select"
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

        <div className="closed-accounts__field closed-accounts__field--sort">
          <label className="closed-accounts__label" htmlFor={sortFieldId}>
            {t('closedAccountsSortLabel')}
          </label>
          <div className="closed-accounts__sort-row">
            <select
              id={sortFieldId}
              className="closed-accounts__select"
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

            <button
              type="button"
              className="closed-accounts__order"
              onClick={() => setOrder(query.order === 'desc' ? 'asc' : 'desc')}
              aria-label={t('closedAccountsOrderToggle')}
            >
              <SortDirectionSvg
                className={`closed-accounts__order-icon${
                  query.order === 'asc' ? ' is-ascending' : ''
                }`}
                aria-hidden="true"
              />
              <span className="closed-accounts__order-text">
                {query.order === 'desc'
                  ? t('closedAccountsOrderDesc')
                  : t('closedAccountsOrderAsc')}
              </span>
            </button>
          </div>
        </div>
      </section>

      {isLoading && (
        <ul className="closed-accounts__list" aria-busy="true">
          {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
            <li
              key={index}
              className="closed-accounts__row closed-accounts__row--skeleton"
            >
              <span className="closed-accounts__skeleton-bar" />
              <span className="closed-accounts__skeleton-bar closed-accounts__skeleton-bar--short" />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && error && (
        <div className="closed-accounts__notice" role="alert">
          <p className="closed-accounts__notice-message">
            {t('closedAccountsErrorMessage')}
          </p>
          <button
            type="button"
            className="closed-accounts__notice-action"
            onClick={refetch}
          >
            {t('closedAccountsRetry')}
          </button>
        </div>
      )}

      {!isLoading && !error && accountList.length === 0 && (
        <div className="closed-accounts__notice" role="status">
          <p className="closed-accounts__notice-title">
            {isFiltered
              ? t('closedAccountsNoMatchTitle')
              : t('closedAccountsEmptyTitle')}
          </p>
          <p className="closed-accounts__notice-message">
            {isFiltered
              ? t('closedAccountsNoMatchMessage')
              : t('closedAccountsEmptyMessage')}
          </p>
          {isFiltered && (
            <button
              type="button"
              className="closed-accounts__notice-action"
              onClick={resetFilters}
            >
              {t('closedAccountsClearFilters')}
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && accountList.length > 0 && (
        <ul className="closed-accounts__list">
          {accountList.map((row) => {
            const TypeIcon = row.accountTypeName
              ? ACCOUNT_TYPE_ICONS[row.accountTypeName]
              : undefined;

            return (
              <li key={row.accountId} className="closed-accounts__row">
                <div className="closed-accounts__identity">
                  <span className="closed-accounts__badge" aria-hidden="true">
                    {TypeIcon ? (
                      <TypeIcon className="closed-accounts__badge-icon" />
                    ) : (
                      <ArchiveSvg className="closed-accounts__badge-icon" />
                    )}
                  </span>

                  <span className="closed-accounts__identity-text">
                    <span
                      className={`closed-accounts__name${
                        row.accountName ? '' : ' closed-accounts__name--unknown'
                      }`}
                    >
                      {row.accountName ?? t('closedAccountsNameUnknown')}
                    </span>
                    <span className="closed-accounts__type">
                      {row.accountTypeName
                        ? row.accountTypeName.replace(/_/g, ' ')
                        : t('closedAccountsTypeUnknown')}
                    </span>
                  </span>
                </div>

                <dl className="closed-accounts__facts">
                  <div className="closed-accounts__fact">
                    <dt className="closed-accounts__fact-label">
                      {t('closedAccountsColumnClosedAt')}
                    </dt>
                    <dd className="closed-accounts__fact-value closed-accounts__fact-value--key">
                      {formatDateToDDMMYYYY(row.closedAt)}
                    </dd>
                  </div>

                  <div className="closed-accounts__fact">
                    <dt className="closed-accounts__fact-label">
                      {t('closedAccountsColumnOpened')}
                    </dt>
                    <dd className="closed-accounts__fact-value">
                      {row.accountCreatedAt
                        ? formatDateToDDMMYYYY(row.accountCreatedAt)
                        : '—'}
                    </dd>
                  </div>

                  <div className="closed-accounts__fact">
                    <dt className="closed-accounts__fact-label">
                      {t('closedAccountsColumnStartingAmount')}
                    </dt>
                    <dd className="closed-accounts__fact-value">
                      {renderAmount(row)}
                    </dd>
                  </div>

                  {row.categoryName && (
                    <div className="closed-accounts__fact">
                      <dt className="closed-accounts__fact-label">
                        {t('closedAccountsColumnCategory')}
                      </dt>
                      <dd className="closed-accounts__fact-value">
                        {renderCategory(row)}
                      </dd>
                    </div>
                  )}
                </dl>

                <p className="closed-accounts__reason">
                  <span className="closed-accounts__fact-label">
                    {t('closedAccountsColumnReason')}
                  </span>
                  {row.closeReason}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && !error && total > 0 && (
        <footer className="closed-accounts__pager">
          <span className="closed-accounts__count">
            {t('closedAccountsTotal').replace('{total}', String(total))}
          </span>

          {pageCount > 1 && (
            <div className="closed-accounts__pager-controls">
              <button
                type="button"
                className="closed-accounts__page-button"
                onClick={() => setPage(query.page - 1)}
                disabled={query.page <= 1}
              >
                {t('closedAccountsPreviousPage')}
              </button>

              <span className="closed-accounts__page-status">
                {t('closedAccountsPageStatus')
                  .replace('{page}', String(query.page))
                  .replace('{pageCount}', String(pageCount))}
              </span>

              <button
                type="button"
                className="closed-accounts__page-button"
                onClick={() => setPage(query.page + 1)}
                disabled={query.page >= pageCount}
              >
                {t('closedAccountsNextPage')}
              </button>
            </div>
          )}
        </footer>
      )}

      <button
        type="button"
        className="closed-accounts__back"
        onClick={() => navigate(ACCOUNTING_DASHBOARD_ROUTE)}
      >
        {t('closedAccountsBackButton')}
      </button>
    </main>
  );
};

export default ClosedAccountsPage;