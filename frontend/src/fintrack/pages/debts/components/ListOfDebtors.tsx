import { BoxContainer, BoxRow } from './boxComponents.tsx';
import { currencyFormat } from '../../../helpers/functions.ts';
import { useFetch } from '../../../hooks/useFetch.ts';
import { url_summary_balance_ByType } from '../../../../urlConfig.ts';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents.tsx';
import { Link, useSearchParams } from 'react-router-dom';
import {
  DebtorListSummaryType,
  DebtorListType,
} from '../../../types/responseApiTypes.ts';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
} from '../../../helpers/constants.ts';
import { NAME_MAX_LENGTHS } from '../../../validations/utils/inputConstraints/nameMaxLengths.ts';
import {
  DEFAULT_SORT_DIRECTION,
  useDebtorListFilter,
  type DebtorQuickFilter,
  type DebtorSortDirection,
  type DebtorSortKey,
} from '../hooks/useDebtorListFilter.ts';
import DebtsToolbar from './DebtsToolbar.tsx';

export type DebtsToRenderType = DebtorListType[];

type AccountPropType = { previousRoute: string; accountType: string };
//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
// const user = import.meta.env.VITE_USER_ID;

// A figure the answer did not carry. Never 0: in a financial list a zero is a
// balance, and it does not mean "not loaded".
const DASH = '—';

// How many placeholder rows the loading state draws. Enough to hold the list's
// place so the page does not jump when the answer lands, few enough not to
// claim a count the answer has not given yet.
const SKELETON_ROWS = 3;

// A URL is typed by anyone. An unrecognised key falls back to the value that
// changes nothing.
const SORT_KEYS: DebtorSortKey[] = ['balance', 'name'];
const toSortKey = (value: string | null): DebtorSortKey =>
  SORT_KEYS.includes(value as DebtorSortKey) ? (value as DebtorSortKey) : 'balance';

const FILTER_KEYS: DebtorQuickFilter[] = ['all', 'debtor', 'lender'];
const toQuickFilter = (value: string | null): DebtorQuickFilter =>
  FILTER_KEYS.includes(value as DebtorQuickFilter)
    ? (value as DebtorQuickFilter)
    : 'all';

const toSortDirection = (
  value: string | null,
  sort: DebtorSortKey,
): DebtorSortDirection =>
  value === 'asc' || value === 'desc' ? value : DEFAULT_SORT_DIRECTION[sort];

//-----------
function ListOfDebtors({ previousRoute, accountType }: AccountPropType) {
  //DATA FETCHING
  const { apiData, isLoading, error, status, refetch } =
    useFetch<DebtorListSummaryType>(
      `${url_summary_balance_ByType}?type=${accountType}`,
    );

  // The toolbar's own state lives in the URL, not in a useState here, for the
  // same reason pocket's and budget's do: opening a debtor's detail route
  // unmounts this list, and a term held in component state would not survive
  // the trip back from it.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = (searchParams.get('q') ?? '').slice(
    0,
    NAME_MAX_LENGTHS.account_name,
  );
  const sort = toSortKey(searchParams.get('sort'));
  const direction = toSortDirection(searchParams.get('dir'), sort);
  const quickFilter = toQuickFilter(searchParams.get('status'));

  const setListParams = (values: Record<string, string>) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        Object.entries(values).forEach(([key, value]) => {
          if (value) next.set(key, value);
          else next.delete(key);
        });
        return next;
      },
      { replace: true },
    );
  };

  // Nothing has been asked yet on the very first render: the hook starts idle
  // and raises isLoading inside its effect. Without this the empty state would
  // paint for a frame before the request has even left.
  const hasAnswer = status !== null || error !== null;

  // Read unconditionally, ahead of the state guards below: a hook cannot sit
  // behind an early return. Filtering an empty or stale array while the
  // request is still in flight costs nothing — the guards decide what
  // actually renders.
  const {
    rows: visibleDebtors,
    matched,
    total,
    isFiltered,
  } = useDebtorListFilter({
    rows: apiData?.data ?? [],
    search,
    sort,
    direction,
    quickFilter,
  });

  // Four outcomes, and none of them is a debtor. A request that failed, one
  // still in flight and an owner with no debtors used to collapse into the same
  // fabricated row — a debtor named 'account_name' owing $0.00, indistinguishable
  // from a real one.
  if (error) {
    return (
      <article className='list__main__container debtorList'>
        <div className='debtorList__state'>
          <p className='debtorList__stateText'>
            The debtor list could not be loaded.
          </p>

          <button
            type='button'
            className='debtorList__retry'
            onClick={refetch}
          >
            Try again
          </button>
        </div>
      </article>
    );
  }

  if (isLoading || !hasAnswer) {
    return (
      <article className='list__main__container debtorList'>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div
            className='box__container debtorList__skeleton'
            key={`debtor-skeleton-${index}`}
            aria-hidden='true'
          >
            <div className='debtorList__skeletonRow'>
              <div className='debtorList__skeletonBar debtorList__skeletonBar--title'></div>
              <div className='debtorList__skeletonBar'></div>
            </div>

            <div className='debtorList__skeletonRow'>
              <div className='debtorList__skeletonBar debtorList__skeletonBar--status'></div>
            </div>
          </div>
        ))}
      </article>
    );
  }

  // The board's own empty state, never the toolbar's: an owner with no
  // debtors at all is a different answer from a search or filter that
  // matched nothing, and only the second one is the toolbar's to word.
  if ((apiData?.data ?? []).length === 0) {
    return (
      <article className='list__main__container debtorList'>
        <div className='debtorList__state'>
          <p className='debtorList__stateText'>
            No debtors yet. Create one to track what is lent and what is owed.
          </p>
        </div>
      </article>
    );
  }

  return (
    <>
      <DebtsToolbar
        search={search}
        onSearchChange={(value) => setListParams({ q: value })}
        sort={sort}
        onSortChange={(value) =>
          setListParams({ sort: value === 'balance' ? '' : value, dir: '' })
        }
        direction={direction}
        onDirectionChange={(value) => setListParams({ dir: value })}
        quickFilter={quickFilter}
        onQuickFilterChange={(value) =>
          setListParams({ status: value === 'all' ? '' : value })
        }
        matched={matched}
        total={total}
        isFiltered={isFiltered}
      />

      <article className='list__main__container debtorList'>
        {visibleDebtors.map((debtor) => {
          const {
            account_name,
            account_id,
            currency_code,
            total_debt_balance,
            // debtor: debtorInd,
            // creditor: creditorInd,
          } = debtor;

          // The row's own net, not a sum of the two magnitudes: debt_payable
          // and debt_receivable are both positive on the contract, with
          // direction in the field name rather than the sign, so adding them
          // only reads as a net because exactly one of the two is zero on any
          // given row. total_debt_balance is the field that is actually the
          // net, and is what the hero above reads for the same distinction.
          const transactionType = total_debt_balance < 0 ? 'lender' : 'debtor';

          return (
            <BoxContainer key={account_id}>
              <BoxRow>
                {/* Absolute on purpose. The detail route is declared once, at
                    /fintrack/debts/debtors/:debtorId, and a relative `to`
                    resolves against whichever route currently renders this
                    list — a destination that moves when the list is mounted
                    somewhere else. */}
                <Link
                  to={`/fintrack/debts/debtors/${account_id}`}
                  state={{ previousRoute, debtorDetailedData: debtor }}
                >
                  <div className='debtor box__title hover'>{account_name}</div>
                </Link>
                <div className='box__title'>
                  {' '}
                  {typeof total_debt_balance === 'number'
                    ? currencyFormat(
                        currency_code ?? defaultCurrency,
                        total_debt_balance,
                        formatNumberCountry,
                      )
                    : DASH}
                </div>
              </BoxRow>

              <BoxRow>
                <BoxRow>
                  <div className='flx-row-sb'>
                    <StatusSquare
                      alert={transactionType == 'lender' ? 'alert' : ''}
                    />
                    <div className='box__subtitle'>
                      &nbsp; {transactionType}{' '}
                    </div>
                  </div>
                </BoxRow>
              </BoxRow>
            </BoxContainer>
          );
        })}
      </article>
    </>
  );
}

export default ListOfDebtors;
