//frontend/src/fintrack/pages/budget/BudgetVariance.tsx
// 📊 BUDGET VARIANCE: how far each category landed from its own plan, and in
// which direction.
//
// `variance` is the term the practice uses for the difference between what was
// planned and what was spent, per line. It is NOT the statistical variance,
// which is a different quantity that happens to share the word, and nothing in
// this file computes one.
//
// A tornado chart: signed bars radiating from a central axis, sorted by
// magnitude. The form is standard, so a reader who has seen one already knows
// that side means direction, length means size and order means importance.
//
// It owns no state and issues no request. BudgetLayout makes the one call and
// this reads the same store the list does, so the two screens can never
// disagree about a month.
//
// Not a collapsible block. That decision was taken while this was a section
// stacked under the Pareto in Overview, where its head was the only label it
// had; as its own screen it has a heading and a way back, and folding a whole
// route hides the only thing on it.

import { Link, useSearchParams } from 'react-router-dom';

import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../helpers/constants.ts';
import { currencyFormat } from '../../helpers/functions.ts';
import { useBudgetStatusStore } from '../../stores/useBudgetStatusStore.ts';
import { BudgetCategoryStatus } from '../../types/budgetTypes.ts';
import './styles/budgetVariance.css';

// Budget minus spent, which is what the server already serves as
// remainingBudget: signed, negative once the category is past its plan. Read
// rather than recomputed, so this screen and the list cannot drift.
type VarianceRow = {
 categoryName: string;
 variance: number;
 currency: BudgetCategoryStatus['currency'];
};

// Positive is money that was not spent and negative is money spent past the
// plan. The words are the practice's own: an expense under its budget is
// favorable, over it is unfavorable. They say the direction without assigning
// fault, which a word like "failed" would.
const isFavorable = (variance: number) => variance >= 0;

function BudgetVariance() {
 const [searchParams] = useSearchParams();
 const month = searchParams.get('month');

 const categories = useBudgetStatusStore((state) => state.categories);
 const isLoading = useBudgetStatusStore((state) => state.isLoading);
 const error = useBudgetStatusStore((state) => state.error);

 // A category with no budget has no plan to be away from, so it has no
 // variance - not a variance of zero, which would draw a bar at the axis and
 // claim the category landed exactly on a plan it never had.
 const rows: VarianceRow[] = categories
  .filter(
   (category): category is BudgetCategoryStatus & { remainingBudget: number } =>
    category.budgetAmount !== null &&
    category.budgetAmount > 0 &&
    category.remainingBudget !== null,
  )
  .map((category) => ({
   categoryName: category.categoryName,
   variance: category.remainingBudget,
   currency: category.currency,
  }))
  .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

 const unbudgeted = categories.length - rows.length;

 // The axis is shared, so every bar is drawn against the same scale and their
 // lengths can be compared. Without a common denominator the longest bar would
 // always fill the track and the chart would say nothing.
 const widest = Math.max(0, ...rows.map((row) => Math.abs(row.variance)));

 // An object and not withMonthParam('..', month): that helper concatenates,
 // which would produce the string '..?month=2026-09-01' and leave the router to
 // decide where the path ends. The two parts are separate here, so they cannot
 // be read as one.
 const backTo = { pathname: '..', search: month ? `?month=${month}` : '' };

 return (
  <section className='budgetVariance' aria-label='Budget variance'>
   <div className='budgetVariance__head'>
    {/* relative and not an absolute path: this route is a child of budget, and
        the same link then works wherever the module is mounted. */}
    <Link className='budgetVariance__back' to={backTo} relative='path'>
     <span className='budgetVariance__backArrow' aria-hidden='true'>
      ←
     </span>
     Category list
    </Link>

    <h2 className='budgetVariance__title'>Budget variance</h2>
   </div>

   {/* What a bar measures, stated once and in money. A chart whose unit the
       reader has to infer from the numbers beside it is being read twice. */}
   <p className='budgetVariance__caption'>
    Budget minus spent, per category. To the right is budget not spent
    (favorable); to the left is spending past the plan (unfavorable).
   </p>

   {error && (
    <p className='budgetVariance__notice' role='alert'>
     The budget summary could not be loaded.
    </p>
   )}

   {!error && isLoading && (
    <p className='budgetVariance__notice' role='status'>
     Loading the month…
    </p>
   )}

   {!error && !isLoading && rows.length === 0 && (
    <p className='budgetVariance__notice'>
     No category carries a budget this month, so there is no plan to measure
     against.
    </p>
   )}

   {!error && !isLoading && rows.length > 0 && (
    <>
     <ol className='budgetVariance__rows'>
      {rows.map((row) => {
       const currencyCode = row.currency ?? DEFAULT_CURRENCY;
       const formatNumberCountry = CURRENCY_OPTIONS[currencyCode];
       const favorable = isFavorable(row.variance);

       // Half the track is the widest variance, so a bar never crosses the
       // axis into the other half's meaning.
       const share =
        widest === 0 ? 0 : (Math.abs(row.variance) / widest) * 50;

       return (
        <li className='budgetVariance__row' key={row.categoryName}>
         <span className='budgetVariance__name'>{row.categoryName}</span>

         {/* aria-hidden: the figure beside it already states the same fact in
             words and in money, and a bar announced as well would be the
             third reading of one number. */}
         <span className='budgetVariance__track' aria-hidden='true'>
          <span className='budgetVariance__axis' />
          <span
           className={`budgetVariance__bar budgetVariance__bar--${
            favorable ? 'favorable' : 'unfavorable'
           }`}
           style={{ inlineSize: `${share}%` }}
          />
         </span>

         <span
          className={`budgetVariance__amount budgetVariance__amount--${
           favorable ? 'favorable' : 'unfavorable'
          }`}
         >
          {currencyFormat(
           currencyCode,
           Math.abs(row.variance),
           formatNumberCountry,
          )}
          <span className='budgetVariance__direction'>
           {favorable ? 'under' : 'over'}
          </span>
         </span>
        </li>
       );
      })}
     </ol>

     {/* The denominator of the ranking, named. Without it a reader cannot tell
         whether the categories missing from the chart were left out or simply
         do not exist. */}
     <p className='budgetVariance__foot'>
      {`${rows.length} budgeted ${
       rows.length === 1 ? 'category' : 'categories'
      }, ranked by how far each landed from its plan`}
      {unbudgeted > 0 &&
       `. ${unbudgeted} more ${
        unbudgeted === 1 ? 'carries' : 'carry'
       } no budget and are not drawn`}
     </p>
    </>
   )}
  </section>
 );
}

export default BudgetVariance;
