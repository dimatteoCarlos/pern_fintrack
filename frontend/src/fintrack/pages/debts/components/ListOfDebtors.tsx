import { BoxContainer, BoxRow } from './boxComponents.tsx';
import { currencyFormat } from '../../../helpers/functions.ts';
import { useFetch } from '../../../hooks/useFetch.ts';
import { url_summary_balance_ByType } from '../../../../urlConfig.ts';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents.tsx';
import { Link } from 'react-router-dom';
import {
  DebtorListSummaryType,
  DebtorListType,
} from '../../../types/responseApiTypes.ts';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
} from '../../../helpers/constants.ts';

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

//-----------
function ListOfDebtors({ previousRoute, accountType }: AccountPropType) {
  //DATA FETCHING
  const { apiData, isLoading, error, status, refetch } =
    useFetch<DebtorListSummaryType>(
      `${url_summary_balance_ByType}?type=${accountType}`,
    );

  // Nothing has been asked yet on the very first render: the hook starts idle
  // and raises isLoading inside its effect. Without this the empty state would
  // paint for a frame before the request has even left.
  const hasAnswer = status !== null || error !== null;

  // Four outcomes, and none of them is a debtor. A request that failed, one
  // still in flight and an owner with no debtors used to collapse into the same
  // fabricated row — a debtor named 'account_name' owing $0.00, indistinguishable
  // from a real one.
  if (error) {
    return (
      <article className='list__main__container'>
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
      <article className='list__main__container'>
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

  const debtors: DebtsToRenderType = apiData?.data ?? [];

  if (debtors.length === 0) {
    return (
      <article className='list__main__container'>
        <div className='debtorList__state'>
          <p className='debtorList__stateText'>
            No debtors yet. Create one to track what is lent and what is owed.
          </p>
        </div>
      </article>
    );
  }

  // On a copy: the array being sorted is the hook's own state, and sorting in
  // place rewrites what the hook holds.
  const debtList: DebtsToRenderType = [...debtors].sort((a, b) => {
    if (a.creditor && !b.creditor) return -1;
    if (!a.creditor && b.creditor) return 1;

    if (a.creditor && b.creditor) {
      return Math.abs(b.total_debt_balance) - Math.abs(a.total_debt_balance);
    }

    return b.total_debt_balance - a.total_debt_balance;
  });

  return (
    <>
      <article className='list__main__container'>
        {debtList.map((debtor, indx) => {
          const {
            account_name,
            account_id,
            currency_code,
            total_debt_balance,
            debt_receivable,
            debt_payable,
            // debtor: debtorInd,
            // creditor: creditorInd,
          } = debtor;

          const transactionType =
            debt_payable + debt_receivable < 0 ? 'lender' : 'debtor';

          return (
            <BoxContainer key={indx}>
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
