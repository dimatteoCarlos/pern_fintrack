//frontend/src/fintrack/pages/budget/BudgetVariance.tsx
// 📊 BUDGET VARIANCE: how far each line landed from its own plan, and in which
// direction.
//
// `variance` is the term the practice uses for the difference between what was
// planned and what was spent, per line. It is NOT the statistical variance,
// which is a different quantity that happens to share the word, and nothing in
// this file computes one. The word is not rendered: the board says
// `Remaining over / left` (Budget.tsx:43) and so does this screen.
//
// A tornado chart: signed bars radiating from a central axis, sorted by
// magnitude. The form is standard, so a reader who has seen one already knows
// that side means direction, length means size and order means importance.
//
// TWO LEVELS, ONE COMPONENT. Without a category in the URL it ranks the
// categories; with one it ranks that category's subcategories. The screen
// names the level over the name column rather than marking it on every row:
// one chart never mixes the two, so a per-row badge would repeat the same word
// on every line.
//
// The second level costs no request. BudgetLayout's single call already fills
// accounts[] with categoryName and subcategory on every row
// (budgetTypes.ts:78-95), so the drill is a filter over what is in memory and
// the two levels can never disagree about a month.
//
// Not a collapsible block. That decision was taken while this was a section
// stacked under the Pareto in Overview, where its head was the only label it
// had; as its own screen it has a heading and a way back, and folding a whole
// route hides the only thing on it.

import {
 Link,
 useNavigate,
 useParams,
 useSearchParams,
} from 'react-router-dom';

// '?react' and not the bare form: only that import carries a React type, so the
// glyph can take a className and be sized by the stylesheet (R34).
import ArrowLeftSolidSvg from '../../../assets/budgetSvg/ArrowLeftSolidSvg.svg?react';

import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../helpers/constants.ts';
import {
 currencyFormat,
 formatBudgetMonthLabel,
} from '../../helpers/functions.ts';
import { useBudgetStatusStore } from '../../stores/useBudgetStatusStore.ts';
import { BudgetCategoryStatus } from '../../types/budgetTypes.ts';
import './styles/budgetVariance.css';

// Budget minus spent, which is what the server already serves as
// remainingBudget: signed, negative once the line is past its plan. Read rather
// than recomputed, so this screen and the list cannot drift.
type VarianceRow = {
 key: string;
 label: string;
 variance: number;
 currency: BudgetCategoryStatus['currency'];
 // The category this row opens, or null when the row is already a subcategory
 // and has nothing under it.
 drillTo: string | null;
};

// `left` and `over`, and not `favorable` and `unfavorable`: budgetRemainWord
// returns exactly these two (budgetStatus.ts:91-98) and every category row on
// the board already ends in one of them. A second vocabulary for the same fact
// would make the reader learn the screen instead of reading it.
const remainWord = (variance: number) => (variance >= 0 ? 'left' : 'over');

// A category opens only when there is a comparison inside it. One bar drawn
// against itself fills half the track whatever its size, which states a
// magnitude the chart cannot support.
const MIN_ROWS_TO_DRILL = 2;

function BudgetVariance() {
 const [searchParams] = useSearchParams();
 const month = searchParams.get('month');
 const navigate = useNavigate();

 // Present only on budget/variance/:categoryName. useParams decodes the
 // segment, so a name with a space arrives here as it is stored.
 const { categoryName: drilledCategory } = useParams();

 const accounts = useBudgetStatusStore((state) => state.accounts);
 const referenceMonth = useBudgetStatusStore((state) => state.referenceMonth);
 const categories = useBudgetStatusStore((state) => state.categories);
 const isLoading = useBudgetStatusStore((state) => state.isLoading);
 const error = useBudgetStatusStore((state) => state.error);

 // A line with no budget has no plan to be away from, so it has no variance -
 // not a variance of zero, which would draw a bar at the axis and claim the
 // line landed exactly on a plan it never had.
 const budgetedAccounts = accounts.filter(
  (account) => account.budgetAmount > 0,
 );

 // How many budgeted subcategories each category folds. Counted from
 // accounts[] and not read from the category's own accountCount, which counts
 // every account in the group including the unbudgeted ones - so it would
 // offer a drill into a chart with one bar, or none.
 const drillableRows = budgetedAccounts.reduce<Record<string, number>>(
  (perCategory, account) => {
   perCategory[account.categoryName] =
    (perCategory[account.categoryName] ?? 0) + 1;
   return perCategory;
  },
  {},
 );

 const categoryRows: VarianceRow[] = categories
  .filter(
   (category): category is BudgetCategoryStatus & { remainingBudget: number } =>
    category.budgetAmount !== null &&
    category.budgetAmount > 0 &&
    category.remainingBudget !== null,
  )
  .map((category) => ({
   key: category.categoryName,
   label: category.categoryName,
   variance: category.remainingBudget,
   currency: category.currency,
   drillTo:
    (drillableRows[category.categoryName] ?? 0) >= MIN_ROWS_TO_DRILL
     ? category.categoryName
     : null,
  }));

 // subcategory ?? accountName is the same fallback level 2 of the list uses
 // (CategoryAccountList.tsx:313): the column is nullable and the account name
 // is what the owner typed, so the cell is never blank.
 const subcategoryRows: VarianceRow[] = budgetedAccounts
  .filter((account) => account.categoryName === drilledCategory)
  .map((account) => ({
   key: String(account.accountId),
   label: account.subcategory ?? account.accountName,
   variance: account.remainingBudget,
   currency: account.currency,
   drillTo: null,
  }));

 const rows = (drilledCategory ? subcategoryRows : categoryRows).sort(
  (a, b) => Math.abs(b.variance) - Math.abs(a.variance),
 );

 const monthLabel = formatBudgetMonthLabel(referenceMonth);

 const levelWord = drilledCategory ? 'subcategory' : 'category';
 const levelWordPlural = drilledCategory ? 'subcategories' : 'categories';

 const unbudgeted = drilledCategory
  ? accounts.filter((account) => account.categoryName === drilledCategory)
    .length - rows.length
  : categories.length - rows.length;

 // The axis is shared, so every bar is drawn against the same scale and their
 // lengths can be compared. Without a common denominator the longest bar would
 // always fill the track and the chart would say nothing. Recomputed per level:
 // a subcategory is compared against its siblings, never against a category
 // total that already contains it.
 const widest = Math.max(0, ...rows.map((row) => Math.abs(row.variance)));

 // An object and not withMonthParam('..', month): that helper concatenates,
 // which would produce the string '..?month=2026-09-01' and leave the router to
 // decide where the path ends. The two parts are separate here, so they cannot
 // be read as one.
 //
 // One expression for both levels, because relative='path' resolves it against
 // the URL: from the drilled chart it lands on the chart of categories, and
 // from there on the category list.
 const backTo = { pathname: '..', search: month ? `?month=${month}` : '' };
 const backLabel = drilledCategory ? 'All categories' : 'Category list';

 const openCategory = (categoryName: string) =>
  navigate({
   pathname: encodeURIComponent(categoryName),
   search: month ? `?month=${month}` : '',
  });

 return (
  <section className='budgetVariance' aria-label='Spent vs budget'>
   <div className='budgetVariance__head'>
    {/* The board's own words, which the list header already taught as
        `Spent / Budget`. The name the reader drilled into is ochre through the
        token added for exactly this - the one word on the screen that was
        chosen rather than listed, separated from the white the rest of the
        heading is written in. */}
    <h2 className='budgetVariance__title'>
     Spent vs budget
     {drilledCategory && (
      <>
       {' · '}
       <span className='budgetVariance__subject'>{drilledCategory}</span>
      </>
     )}
    </h2>

    {/* After the heading in the DOM as well as on screen: the reading order and
        the visual order agree, so nothing has to be reordered in CSS.

        relative and not an absolute path: this route is a child of budget, and
        the same link then works wherever the module is mounted. */}
    <Link className='budgetVariance__back' to={backTo} relative='path'>
     <ArrowLeftSolidSvg
      className='budgetVariance__backArrow'
      aria-hidden='true'
     />
     {backLabel}
    </Link>
   </div>

   {/* What a bar measures, in money, and when. `this month` would be a claim
       the screen cannot make: the picker above (BudgetLayout.tsx:115) can stand
       on any month the owner owns, so the label is the month the server
       resolved and returned. The sentence about the ordering came out - the
       foot already states it, one screen below. */}
   <p className='budgetVariance__caption'>
    {`The difference between budget and actual spending, per ${levelWord}`}
    {monthLabel && `, in ${monthLabel}`}.
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
     {drilledCategory
      ? `No subcategory of ${drilledCategory} carries a budget this month, so there is no plan to measure against.`
      : 'No category carries a budget this month, so there is no plan to measure against.'}
    </p>
   )}

   {!error && !isLoading && rows.length > 0 && (
    <>
     {/* The level, named over the column that holds it, the same way the board
         heads its rows `Category List` (Budget.tsx:46) and level 2 of the list
         heads its own `Subcategory` (CategoryAccountList.tsx:276). Without it
         a reader who lands here cannot tell which of the two is being ranked,
         since the names alone look alike. */}
     <div className='budgetVariance__columns'>
      <span>{drilledCategory ? 'Subcategory' : 'Category'}</span>

      {/* aria-hidden: each row already ends in `over` or `left` as text, so a
          reader who is not looking at the bars has the direction anyway. */}
      <span className='budgetVariance__columnAxis' aria-hidden='true'>
       Over / left
      </span>

      {/* `Remaining` and not `Balance`. The apparent contradiction - a row
          reading `$171.83 (over)` is not a remainder of anything - is settled
          by the module rather than by this screen: the hero states the same
          figure under the same word (BudgetBigBoxResult.tsx:134) and the board
          heads the same column `Remaining over / left` (Budget.tsx:43). The
          qualifier lives over the chart here, so the header row reads
          `over / left` and then `remaining`, which is that phrase split across
          the two columns it describes. */}
      <span className='budgetVariance__columnAmount'>Remaining</span>
     </div>

     <ol className='budgetVariance__rows'>
      {rows.map((row) => {
       const currencyCode = row.currency ?? DEFAULT_CURRENCY;
       const formatNumberCountry = CURRENCY_OPTIONS[currencyCode];
       const word = remainWord(row.variance);

       // Half the track is the widest variance, so a bar never crosses the
       // axis into the other half's meaning.
       const share = widest === 0 ? 0 : (Math.abs(row.variance) / widest) * 50;

       const cells = (
        <>
         <span className='budgetVariance__name'>
          <span className='budgetVariance__nameText'>{row.label}</span>
          {row.drillTo && (
           <span className='budgetVariance__chevron' aria-hidden='true'>
            ›
           </span>
          )}
         </span>

         {/* aria-hidden: the figure beside it already states the same fact in
             words and in money, and a bar announced as well would be the
             third reading of one number. */}
         <span className='budgetVariance__track' aria-hidden='true'>
          <span className='budgetVariance__axis' />
          {/* No bar at all when the line landed exactly on its plan. The
              stylesheet floors every bar at 2px so a small variance still
              paints something, and without this branch that floor would draw
              2px for a variance of nothing. */}
          {row.variance !== 0 && (
           <span
            className={`budgetVariance__bar budgetVariance__bar--${word}`}
            style={{ inlineSize: `${share}%` }}
           />
          )}
         </span>

         <span
          className={`budgetVariance__amount budgetVariance__amount--${word}`}
         >
          {currencyFormat(
           currencyCode,
           Math.abs(row.variance),
           formatNumberCountry,
          )}
          {/* Absolute value above: the word carries the sign, so a minus in
              front of it would state the same thing twice. The board's own
              rows are written this way (ListCategory.tsx:311-318). */}
          <span className='budgetVariance__direction'>({word})</span>
         </span>
        </>
       );

       return (
        <li className='budgetVariance__row' key={row.key}>
         {/* A button and not a Link: the label says what opens, because the
             three cells alone read as three unconnected values to a screen
             reader, and `Break X down by subcategory` is the action rather
             than the destination. */}
         {row.drillTo ? (
          <button
           type='button'
           className='budgetVariance__cells budgetVariance__cells--drill'
           onClick={() => openCategory(row.drillTo as string)}
           aria-label={`Break ${row.label} down by subcategory`}
          >
           {cells}
          </button>
         ) : (
          <div className='budgetVariance__cells'>{cells}</div>
         )}
        </li>
       );
      })}
     </ol>

     {/* The denominator of the ranking, named. Without it a reader cannot tell
         whether the lines missing from the chart were left out or simply do
         not exist. */}
     <p className='budgetVariance__foot'>
      {`${rows.length} budgeted ${
       rows.length === 1 ? levelWord : levelWordPlural
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
