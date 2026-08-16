//frontend\src\fintrack\pages\budget\BudgetLayout.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import { useBudgetStatusStore } from '../../stores/useBudgetStatusStore.ts';
import BudgetBigBoxResult from './components/BudgetBigBoxResult.tsx';
import MonthPicker from '../../general_components/monthPicker/MonthPicker.tsx';
import './styles/budget-styles.css';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
import { Outlet, useSearchParams } from 'react-router-dom';

function BudgetLayout() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The module's single request. This header and the category list below are
  // both drawn from it, which is why it is issued here and not in either one.
  const totals = useBudgetStatusStore((state) => state.totals);
  const notices = useBudgetStatusStore((state) => state.notices);
  const referenceMonth = useBudgetStatusStore((state) => state.referenceMonth);
  const currentMonth = useBudgetStatusStore((state) => state.currentMonth);
  const isLoading = useBudgetStatusStore((state) => state.isLoading);
  const error = useBudgetStatusStore((state) => state.error);
  const fetchStatus = useBudgetStatusStore((state) => state.fetchStatus);

  // The month lives in the URL, so it survives the drill-down: levels 2 and 3
  // are routes beside this layout, not children of it, and a month held here
  // would die the moment a category is opened.
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month');

  // Absent, nothing is sent and the server resolves the current month on the
  // owner's calendar. Only a month the user picked ever travels.
  useEffect(() => {
    fetchStatus(monthParam ?? undefined);
  }, [fetchStatus, monthParam]);

  // Replaced, not pushed: the month is the scope of the board, not a step the
  // back button should walk through one month at a time.
  const selectMonth = useCallback(
    (month: string) => {
      setSearchParams({ month }, { replace: true });
    },
    [setSearchParams],
  );

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
    isOverBudget,
  } = useMemo(
    () => ({
      budgetAmount: totals?.budgetAmount ?? null,
      actualSpent: totals?.actualSpent ?? null,
      remainingBudget: totals?.remainingBudget ?? null,
      executionPercentage: totals?.executionPercentage ?? null,
      currency: totals?.currency ?? undefined,
      // Derived here because BudgetStatusTotals carries no flag: the server
      // serves isOverBudget per category row, not for the total. Serving it
      // would remove this derivation, and belongs with commit 9.
      isOverBudget: totals ? totals.remainingBudget < 0 : null,
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

            {/* Floated out of the header's flow: the header is positioned from
                a constant height, so a child that added to it would move every
                absolute box below.

                The label is the month the server resolved, never the one the
                client asked for — the two differ on the first request, which
                asks for none. */}
            <MonthPicker
              month={referenceMonth}
              currentMonth={currentMonth}
              onSelect={selectMonth}
            />
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
          isOverBudget={isOverBudget}
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
