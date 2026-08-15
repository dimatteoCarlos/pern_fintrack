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
  const { budgetAmount, actualSpent, remainingBudget, currency } = useMemo(
    () => ({
      budgetAmount: totals?.budgetAmount ?? 0,
      actualSpent: totals?.actualSpent ?? 0,
      remainingBudget: totals?.remainingBudget ?? 0,
      currency: totals?.currency ?? undefined,
    }),
    [totals],
  );

  const bigScreenInfo = [
    { title: 'total budget', amount: budgetAmount },
    { title: 'Remaining', amount: remainingBudget },
    { title: 'expenses', amount: actualSpent },
  ];

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

        <BudgetBigBoxResult bigScreenInfo={bigScreenInfo} currency={currency} />

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
