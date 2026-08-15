//frontend\src\fintrack\pages\budget\BudgetLayout.tsx
import { useEffect, useMemo, useState } from 'react';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import { useBudgetStatusStore } from '../../stores/useBudgetStatusStore.ts';
import BudgetBigBoxResult from './components/BudgetBigBoxResult.tsx';
import './styles/budget-styles.css';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
import { Outlet } from 'react-router-dom';

function BudgetLayout() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The module's single request. This header and the category list below are
  // both drawn from it, which is why it is issued here and not in either one.
  const totals = useBudgetStatusStore((state) => state.totals);
  const notices = useBudgetStatusStore((state) => state.notices);
  const isLoading = useBudgetStatusStore((state) => state.isLoading);
  const error = useBudgetStatusStore((state) => state.error);
  const fetchStatus = useBudgetStatusStore((state) => state.fetchStatus);

  // No month: the server resolves the current one on the owner's calendar.
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (error) {
      setErrorMessage(error);
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  //--------------------------------------
  // Served, never summed here: totals is the server's own fold of the rows the
  // list below renders, so the header and the list cannot disagree.
  //
  // Passed through as they arrive, null included. These used to collapse to 0,
  // which announced a budget of zero while the answer was still on the wire and
  // again in the mixed-currency case, where the contract withholds the totals on
  // purpose rather than adding two currencies at an implicit rate of 1:1.
  const {
    budgetAmount,
    actualSpent,
    remainingBudget,
    executionPercentage,
    currency,
  } = useMemo(
    () => ({
      budgetAmount: totals?.budgetAmount ?? null,
      actualSpent: totals?.actualSpent ?? null,
      remainingBudget: totals?.remainingBudget ?? null,
      executionPercentage: totals?.executionPercentage ?? null,
      currency: totals?.currency ?? undefined,
    }),
    [totals],
  );

  // Only the totals-level notice belongs in the header. A category-level one
  // names its category and belongs beside it, in the list below.
  const notice =
    totals !== null && totals.currency === null ? notices[0] ?? null : null;

  return (
    <>
      <div className='budgetLayout'>
        <div className='layout__header'>
          <div className='headerContent__container'>
            <TitleHeader></TitleHeader>
          </div>
        </div>

        {isLoading && (
          <div
            className='loader__container'
            style={{
              position: 'absolute',
              left: '50%',
              top: '20%',
              zIndex: '1',
            }}
          >
            <CoinSpinner />
          </div>
        )}

        <BudgetBigBoxResult
          budgetAmount={budgetAmount}
          actualSpent={actualSpent}
          remainingBudget={remainingBudget}
          executionPercentage={executionPercentage}
          currency={currency}
          notice={notice}
        />

        {error && (
          <p
            style={{
              color: 'red',
              position: 'absolute',
              top: '1.5%',
              left: '10%',
              zIndex: '150',
            }}
          >
            {/* Error:  */}
            {errorMessage}
          </p>
        )}
        <Outlet />
      </div>
    </>
  );
}

export default BudgetLayout;
