// frontend/src/fintrack/pages/overview/components/ExpenseByCategory.tsx
// The expense ranking, mounted. This file is the ADAPTER and holds no drawing:
// it turns the server's expense rows into the shape ParetoBar.tsx reads, and
// everything visual lives there so the level-2 expense screen and the level-3
// category screen mount the same bar without a second implementation.
//
// THE DATA IS ALREADY ON THE WIRE AT LEVEL 1. overviewExpenseService.js:156
// serves makeCategoryBreakdown unconditionally - outside the withAnalysis
// spread, because a running total is only correct over the complete set - and
// overviewPageService.js:216 publishes it as charts.expenseCategories. No
// request is added here and no field was asked of the backend.

import ParetoBar, { ParetoRow } from './ParetoBar';
import DonutChart from './DonutChart';
import CollapsibleBlock from './CollapsibleBlock';
import { CardTitle } from '../../../general_components/CardTitle';
import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import { monthLabel } from '../helpers/monthLabel';
import {
 OverviewExpenseCard,
 OverviewExpenseCategory,
} from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// actualSpent is typed as a number and arrives null when the category's
// accounts span currencies - the row the server ranks last. Defended here
// rather than in ParetoBar so the drawing never receives a null at all.
const spentOf = (category: OverviewExpenseCategory) => category.actualSpent ?? 0;

// A ROW'S OWN SHARE IS A SUBTRACTION OF TWO PUBLISHED FIGURES, never a division
// of its amount by the total. The server publishes the running share and not
// the individual one, and dividing here would give a second arithmetic for the
// same quantity: the widths would come from this division and the percentages
// printed beside them from the server's, and the two would part company at the
// fourth decimal the server rounds to.
const toParetoRows = (categories: OverviewExpenseCategory[]): ParetoRow[] =>
 categories.map((category, index) => ({
  // The category name and not the index: the ranking reorders every month, and
  // ExpenseCategoryStatus carries no id for the page to use instead. The name
  // is unique inside one owner's breakdown, which is what a key needs to be.
  key: category.categoryName,
  label: category.categoryName,
  amount: spentOf(category),
  share:
   category.cumulativePercentage -
   (index === 0 ? 0 : categories[index - 1].cumulativePercentage),
  cumulativeShare: category.cumulativePercentage,
  isFlagged: category.isOverBudget,
 }));

// THE DRAWING TAKES ITS ROWS AND NOT A STORE, so the level-2 expense screen
// mounts the same two readings from the domain answer. Level 1 reads
// charts.expenseCategories off the page payload; level 2 reads categories off
// GET /overview/expense. Same array, two routes to it, one component.
type ExpenseByCategoryProps = {
 categories: OverviewExpenseCategory[];
 card: OverviewExpenseCard;
 // 'YYYY-MM-01', the month both titles name. A prop because level 2 reads it
 // off its own answer rather than off the store.
 referenceMonth: string | null;
};

// The store-backed level-1 mount. A wrapper and not a copy: the store read is
// the only thing that belongs to level 1, and the drawing below belongs to both.
function ExpenseByCategory() {
 const charts = useOverviewStore((state) => state.charts);
 const domainCards = useOverviewStore((state) => state.domainCards);
 const referenceMonth = useOverviewStore((state) => state.referenceMonth);

 if (!charts || !domainCards) return null;

 return (
  <ExpenseBreakdown
   categories={charts.expenseCategories}
   card={domainCards.expense}
   referenceMonth={referenceMonth}
  />
 );
}

export function ExpenseBreakdown({
 categories,
 card,
 referenceMonth,
}: ExpenseByCategoryProps) {
 // EMPTY IS A REAL ANSWER AND IT IS NOT AN ERROR. An owner who spent nothing
 // with a category this month has no ranking to draw, and a bar of one empty
 // track would say the figures failed to arrive. The block renders nothing and
 // the expense card above it already states the month's total.
 if (categories.length === 0) return null;

 const expense = card;

 // The last row's running total IS the denominator the server divided by
 // (makeCategoryBreakdown.js:70), so the figure above the bar and the
 // percentages inside it come from one sum. categorizedExpense on the card is
 // the same quantity by a different route, and taking it from there would put
 // two paths behind one number.
 const total = categories[categories.length - 1].cumulativeActual;

 // Stated in words under the bar and NOT drawn as a segment. The uncategorized
 // amount sits outside the set the server ranked, so a segment for it would
 // make every drawn width a share of one total while the percentage printed
 // beside it stays a share of another. The card publishes the flag and the two
 // terms of the subtraction (overviewTypes.ts:108-112); the amount is stated
 // here as the reason the ranking does not cover the whole month.
 const uncategorized = expense.hasUncategorizedExpense
  ? currencyFormat(
     expense.currency,
     expense.totalAmount - expense.categorizedExpense,
     formatNumberCountry,
    )
  : null;

 const rows = toParetoRows(categories);

 // Stated once and handed to both drawings, so the advisory line cannot say one
 // thing under the bar and another under the ring.
 const caption = uncategorized
  ? `${uncategorized} more was spent without a category and is not ranked here`
  : undefined;

 // TWO FOLDS AND NOT ONE, on Carlos's instruction of 2026-09-11: "el Pareto y el
 // futuro donut serian desplegables cada uno". They are two readings of ONE
 // array and answer different questions - the bar says how few categories carry
 // the month, the ring says what share each one is of it - so a reader who wants
 // one closes the other and the colour of a category is the same in both.
 //
 // The ring opens CLOSED. The ranking is the primary reading and the one the
 // block is titled for; the shares are the same figures seen a second way, and
 // a block that opens with two drawings of one array on screen reads as the page
 // saying the same thing twice.
 return (
  <>
   <CollapsibleBlock
    head={
     <CardTitle subtitle={monthLabel(referenceMonth, 'long')}>
      Expense by category
     </CardTitle>
    }
    isRuled
   >
    {/* The single-column modifier, which the sheet already carries for a block
        that is one card wide (overview-styles.css:396): the bar is one figure
        across the row and not one of a pair. */}
    <section className='domainCards domainCards--single'>
     <ParetoBar
      rows={rows}
      currency={expense.currency}
      total={total}
      totalLabel='categorised spending'
      unitLabel='categories'
      caption={caption}
     />
    </section>
   </CollapsibleBlock>

   <CollapsibleBlock
    head={
     <CardTitle subtitle={monthLabel(referenceMonth, 'long')}>
      Share of the month
     </CardTitle>
    }
    defaultOpen={false}
    isRuled
   >
    <section className='domainCards domainCards--single'>
     <DonutChart
      rows={rows}
      currency={expense.currency}
      total={total}
      totalLabel='categorised spending'
      unitLabel='categories'
      caption={caption}
     />
    </section>
   </CollapsibleBlock>
  </>
 );
}

export default ExpenseByCategory;
