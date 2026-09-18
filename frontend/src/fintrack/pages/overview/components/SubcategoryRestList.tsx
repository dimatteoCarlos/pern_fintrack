// frontend/src/fintrack/pages/overview/components/SubcategoryRestList.tsx
//
// What the folded bar of the flat ranking holds, opened.
//
// A LIST AND NOT A SECOND PARETO. Its members are small by construction, so
// ranking them graphically would invite reading importance into amounts the
// chart already placed in the tail, and it would raise the question of what
// happens to the rest of the rest. The share column keeps a concentrated tail
// visible without any of that (owner decision 2026-09-17).
//
// EVERY FOLDED ACCOUNT IS LISTED, with no limit of its own: a cut here would
// need a rest of the rest, which is the exact question this list exists to
// close. The box scrolls instead.

import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { countNoun, percent } from '../helpers/rankedBreakdown';
import { OverviewExpenseSubcategory } from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

type SubcategoryRestListProps = {
 rows: OverviewExpenseSubcategory[];
 currency: string;
 // The scope's whole spending, so a row's share is of the month and not of the
 // fold — a share of the fold would call a small account large.
 spentTotal: number;
};

function SubcategoryRestList({
 rows,
 currency,
 spentTotal,
}: SubcategoryRestListProps) {
 const money = (value: number) =>
  currencyFormat(currency, value, formatNumberCountry);

 return (
  <div className='restList'>
   <table className='restList__table'>
    <caption className='restList__caption'>
     {`The ${rows.length} ${countNoun(
      rows.length,
      'budget accounts',
     )} below the cut, ordered by spending`}
    </caption>
    <thead>
     <tr>
      <th className='restList__head' scope='col'>
       Account
      </th>
      <th className='restList__head restList__head--figure' scope='col'>
       Spent
      </th>
      <th className='restList__head restList__head--figure' scope='col'>
       Budget
      </th>
      <th className='restList__head restList__head--figure' scope='col'>
       Share
      </th>
     </tr>
    </thead>
    <tbody>
     {rows.map((row) => (
      <tr className='restList__row' key={row.accountId}>
       <td className='restList__cell'>
        <span className='restList__name'>
         {row.subcategoryName}
         {row.nature && (
          <span className='restList__nature'>{` (${row.nature})`}</span>
         )}
        </span>
        <span className='restList__category'>{row.categoryName ?? '—'}</span>
       </td>
       <td className='restList__cell restList__cell--figure'>
        {/* Nothing spent is said in words: a zero in a column of amounts reads
            as a figure that was measured and came out zero, which it is, but
            the reader is scanning for size and would skip it. */}
        {row.actualSpent === 0 ? (
         <span className='restList__zero'>nothing spent</span>
        ) : (
         money(row.actualSpent)
        )}
       </td>
       <td className='restList__cell restList__cell--figure'>
        {row.budgetAmount > 0 ? (
         money(row.budgetAmount)
        ) : (
         <span className='restList__zero'>no budget</span>
        )}
        {row.isOverBudget && (
         <span className='restList__over'> · over</span>
        )}
       </td>
       <td className='restList__cell restList__cell--figure'>
        {spentTotal > 0 ? percent(row.actualSpent / spentTotal) : '—'}
       </td>
      </tr>
     ))}
    </tbody>
   </table>
  </div>
 );
}

export default SubcategoryRestList;
