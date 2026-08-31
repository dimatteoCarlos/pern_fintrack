//frontend\src\fintrack\pages\debts\DebtsLayout.tsx
import DebtsBigBoxResult from './components/DebtsBigBoxResult.tsx';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import { DEFAULT_CURRENCY } from '../../helpers/constants.ts';
import { url_get_total_account_balance_by_type } from '../../../urlConfig.ts';
import { useMemo } from 'react';
import { useFetch } from '../../hooks/useFetch.ts';
import { DebtorRespType } from '../../types/responseApiTypes.ts';
import { Outlet } from 'react-router-dom';
import './styles/debts-styles.css';

//default values------------
const defaultCurrency = DEFAULT_CURRENCY;
//--------------------------------------
function DebtsLayout() {
  const debtUrl = `${url_get_total_account_balance_by_type}?type=debtor`;

  const { apiData, isLoading, error, status, refetch } =
    useFetch<DebtorRespType>(debtUrl);

  //--------------------------------------
  //--FETCH STATES
  // The hook starts idle and raises isLoading inside its effect, so a status or
  // an error is what says an answer has actually come back.
  const hasAnswer = status !== null || error !== null;
  const hasFailed = Boolean(error);
  const isPending = !hasFailed && (isLoading || !hasAnswer);

  // An owner with no debts. The endpoint answers 400 'No available accounts of
  // type debtor', which useFetch classifies as not-found: no error and no
  // payload. That is not the same answer as a total of zero, and the board used
  // to print both as a confident $0.00.
  const isEmpty = !isPending && !hasFailed && !apiData?.data;
  //-----------------------------------
  const {
    total_debt_balance,
    debt_receivable,
    debt_payable,
    debtors,
    lenders,
    // debtors_without_debt,
    currency,
  } = useMemo(() => {
    // null, never 0. A field the answer did not carry is not a figure, and the
    // box below prints a dash for it; the currency is the one exception, since
    // it is the formatter's configuration and not a figure.
    return {
      total_debt_balance: apiData?.data.total_debt_balance ?? null,

      debt_payable: apiData?.data.debt_payable ?? null,
      lenders: apiData?.data.lenders ?? null,

      debtors: apiData?.data.debtors ?? null,
      debt_receivable: apiData?.data.debt_receivable ?? null,

      debtors_without_debt: apiData?.data.debtors_without_debt ?? null,

      currency: apiData?.data.currency_code ?? defaultCurrency,
    };
  }, [
    apiData?.data.total_debt_balance,
    apiData?.data.debt_payable,
    apiData?.data.debt_receivable,
    apiData?.data.debtors,
    apiData?.data.lenders,
    apiData?.data.debtors_without_debt,
    apiData?.data.currency_code,
  ]);

  // Rewritten 2026-08-31 against Carlos's decision: a net does not tell 'owed
  // 550' from 'owed 1,750 and owing 2,300' apart, and those are opposite
  // situations behind the same −550. The two directions are the primary
  // figures now; the net is a derived third line, subordinate to both.
  //
  // Direction lives in these two titles unconditionally, not behind a
  // sign-of-the-net ternary: receivable is always what is owed TO the owner,
  // payable is always what the owner owes, regardless of which side the net
  // falls on. The net's own title needs no direction claim once the two
  // figures above it already state theirs.
  const bigScreenInfo = [
    {
      title: 'net',
      amount: total_debt_balance,
    },
    {
      title: "you're owed",
      amount: debt_receivable,
    },
    {
      title: 'debtors',
      amount: debtors,
    },
    {
      title: 'you owe',
      amount: debt_payable,
    },

    {
      title: 'lenders',
      amount: lenders,
    },
  ];

  return (
    <div className='debtsLayout'>
      <div className='layout__header'>
        <div className='headerContent__container'>
          <TitleHeader />
        </div>
      </div>

      {/* Three answers, three panels, all of them the shape of the board hero
          so the page below does not move when the answer lands. The request in
          flight used to be a spinner floating over a board of zeros, and the
          failure a red line that erased itself after three seconds while those
          same zeros stayed on screen. */}
      {isPending ? (
        <div
          className='bigBox__container debtsBoard__skeleton'
          aria-hidden='true'
        >
          <div className='debtsBoard__skeletonBar debtsBoard__skeletonBar--title'></div>
          <div className='debtsBoard__skeletonBar debtsBoard__skeletonBar--total'></div>
          <div className='debtsBoard__skeletonBar debtsBoard__skeletonBar--wide'></div>
          <div className='debtsBoard__skeletonBar debtsBoard__skeletonBar--wide'></div>
        </div>
      ) : hasFailed ? (
        <div className='bigBox__container debtsBoard__state'>
          <p className='debtsBoard__stateText'>
            The debts summary could not be loaded.
          </p>

          <button
            type='button'
            className='debtsBoard__retry'
            onClick={refetch}
          >
            Try again
          </button>
        </div>
      ) : isEmpty ? (
        <div className='bigBox__container debtsBoard__state'>
          <p className='debtsBoard__stateText'>
            Nothing lent and nothing owed. The totals appear once there is a
            debtor.
          </p>
        </div>
      ) : (
        <DebtsBigBoxResult
          bigScreenInfo={bigScreenInfo}
          currency={currency}
        ></DebtsBigBoxResult>
      )}

      {/* The board comes from the route table, like every other section's
          layout. Rendering it here directly left the two declared child
          routes inert, so both debts URLs painted the same screen and no
          redirect between them could ever run. */}
      <Outlet />
    </div>
  );
}

export default DebtsLayout;
