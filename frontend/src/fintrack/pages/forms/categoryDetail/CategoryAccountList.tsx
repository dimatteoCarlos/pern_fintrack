// frontend/src/pages/forms/categoryDetail/CategoryAccountList.tsx
import { useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import LeftArrowLightSvg from '../../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../../assets/Dots3LightSvg.svg';

import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import SummaryDetailBox from '../accountDetailSharedComponents/summaryDetailBox/SummaryDetailBox.tsx';
import ListAccountOfCategory from './ListAccountOfCategory.tsx';
import CoinSpinner from '../../../loader/coin/CoinSpinner.tsx';

import { capitalize } from '../../../helpers/functions.ts';
import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';

import { useBudgetStatusStore } from '../../../stores/useBudgetStatusStore.ts';

import '../styles/forms-styles.css';

//==============================
function CategoryAccountList() {
  const location = useLocation();
  const { categoryName } = useParams();

  // Only the return path still travels in location.state. The figures used to
  // travel with it, which is why a reload straight into this screen rendered a
  // category summary built out of nothing.
  const state = location.state ?? {};
  const { previousRoute: budgetPageAddress = `/fintrack/budget` } = state as {
    previousRoute?: string;
  };

  //--DATA-------------------------
  // No request of its own: the module's single call is issued at level 1 and
  // this reads two slices of that one answer.
  const accounts = useBudgetStatusStore((state) => state.accounts);
  const categories = useBudgetStatusStore((state) => state.categories);
  const isLoading = useBudgetStatusStore((state) => state.isLoading);
  const error = useBudgetStatusStore((state) => state.error);
  const fetchStatus = useBudgetStatusStore((state) => state.fetchStatus);

  // Level 1 normally fills the store before this screen mounts. A reload or a
  // bookmark landing here does not, so the call is issued from here too: the
  // store's guard turns it into a no-op when the month is already loaded.
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const categoryAccounts = useMemo(
    () => accounts.filter((account) => account.categoryName === categoryName),
    [accounts, categoryName],
  );

  // The server's own fold of the rows listed below, not a sum over them: a
  // header and the rows under it cannot disagree if only one is computed.
  const categorySummary = useMemo(
    () =>
      categories.find((category) => category.categoryName === categoryName) ??
      null,
    [categories, categoryName],
  );

  //===============================
  // RETIRED by commit 9b — remove in the cleanup block (V1 §9.4, D8).
  // It summed account_balance and budget across the accounts of the category
  // to rebuild what the server already folds, and assumed 'usd' twice while
  // doing it. categories[] serves the four figures.
  //
  // const calculateCategorySummaryInfo = useCallback(
  //   (accounts, categoryName, currency_code: CurrencyType = 'usd') => {
  //     const summary: CategorySummaryInfoType = {
  //       category_name: categoryName, currency_code: 'usd',
  //       total_balance: 0, total_budget: 0, total_remaining: 0,
  //       statusAlert: false, remain: 0,
  //     };
  //     for (let i = 0; i < accounts.length; i++) {
  //       summary.total_balance += Number(accounts[i].account_balance);
  //       summary.total_budget += +accounts[i].budget;
  //     }
  //     summary.remain = -summary.total_balance + summary.total_budget;
  //     summary.statusAlert = summary.remain <= 0;
  //     summary.currency_code = accounts[0].currency_code ?? currency_code;
  //     summary.category_name = categoryName;
  //     return summary;
  //   }, []);
  //
  // And the effect that ran it whenever location.state arrived empty:
  //
  // useEffect(() => {
  //   if (!categorySummaryDetailed && categoryAccountsExists) {
  //     setCategorySummaryInfo(calculateCategorySummaryInfo(...));
  //   }
  // }, [...]);
  //===============================

  // Every category figure is nullable for one case: accounts in more than one
  // currency, which V1 does not allow. Unreachable under a single accounting
  // currency, and the box is withheld rather than showing a zero if the model
  // ever widens.
  const summaryData =
    categorySummary &&
    categorySummary.budgetAmount !== null &&
    categorySummary.actualSpent !== null &&
    categorySummary.remainingBudget !== null
      ? {
          title: 'Budget',
          amount: categorySummary.budgetAmount,
          subtitle1: 'Spent',
          amount1: categorySummary.actualSpent,
          status: categorySummary.isOverBudget ?? false,
          amount2: categorySummary.remainingBudget,
          currency_code: categorySummary.currency ?? DEFAULT_CURRENCY,
          executionPercentage: categorySummary.executionPercentage,
        }
      : null;
  //===============================
  return (
    <>
      <section className='page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div className='main__title--container'>
            <Link
              to={budgetPageAddress}
              relative='path'
              className='iconLeftArrow'
            >
              <LeftArrowLightSvg />
            </Link>

            <div className='form__title'>{capitalize(categoryName!)}</div>

            {/* <Link to='edit' className='flx-col-center icon3dots'>
              <Dots3LightSvg />
            </Link> */}

            <div id='edit' className='flx-col-center icon3dots'>
              <Dots3LightSvg />
            </div>
          </div>
        </div>

        {summaryData && <SummaryDetailBox bubleInfo={summaryData} />}

        <CardTitle legend='Spent / Budget'>{capitalize(categoryName!)}</CardTitle>

        {/* Loading, error and empty are three states, not one fallback: a
            category still on the wire is not a category without accounts. */}
        {isLoading && <CoinSpinner />}

        {!isLoading && error && <p className='box__subtitle'>Error loading data: {error}</p>}

        {!isLoading && !error && categoryAccounts.length === 0 && (
          <p className='box__subtitle'>
            This category has no budget accounts this month.
          </p>
        )}

        {!isLoading && !error && categoryAccounts.length > 0 && (
          <ListAccountOfCategory
            previousRoute={`${budgetPageAddress}/category/${categoryName}`}
            accounts={categoryAccounts}
            //categoryName={categoryName}
          />
        )}
      </section>
    </>
  );
}

export default CategoryAccountList;
