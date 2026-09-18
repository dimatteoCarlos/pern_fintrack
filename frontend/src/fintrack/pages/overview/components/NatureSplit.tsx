// frontend/src/fintrack/pages/overview/components/NatureSplit.tsx
//
// How the month's spending splits across the four nature tags.
//
// A COMPOSITION AND NOT A RANKING, which is why it is four fixed rows and not a
// Pareto: four values ordered by size discover nothing, and the four are read
// against the same four of last month — which rows that move cannot be. The
// order is the catalog's, from the server, and this file never re-sorts it.
//
// THE SCOPE IS RESTATED THREE TIMES on purpose. The block follows the chart's
// selection, so it is the whole domain on one render and one category on the
// next, and a share with an unnamed denominator is the defect that makes: the
// heading names it, every row repeats it, and the caption states it in money.
//
// No hue is assigned to a nature. The two inks are the chart's own — solid for
// spent, an outline for budget — because the semaphore is reserved for
// qualifying a figure, and a 'must' painted with it would read as over budget.

import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { countNoun, percent } from '../helpers/rankedBreakdown';
import { OverviewNatureSplit } from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

type NatureSplitProps = {
 split: OverviewNatureSplit;
 currency: string;
};

function NatureSplit({ split, currency }: NatureSplitProps) {
 const money = (value: number) =>
  currencyFormat(currency, value, formatNumberCountry);

 const scope = split.categoryName;
 // One scale for all eight bars, so the rows compare in money while the
 // percentage on each row carries the composition.
 const ceiling = Math.max(
  0,
  ...split.rows.map((row) => Math.max(row.spent, row.budget)),
 );
 const widthOf = (value: number) =>
  ceiling > 0 ? `${(value / ceiling) * 100}%` : '0%';

 return (
  <section
   className={`natureSplit${scope ? ' natureSplit--narrowed' : ''}`}
   aria-label={`Spending by nature${scope ? ` in ${scope}` : ''}`}
  >
   <div className='natureSplit__head'>
    <h4 className='natureSplit__title'>
     Spending by nature
     {scope && <span className='natureSplit__scope'>{` · ${scope}`}</span>}
    </h4>
    <span className='natureSplit__meta'>
     {`${money(split.spentTotal)} of ${money(split.budgetTotal)} budgeted`}
    </span>
   </div>

   <ul className='natureSplit__rows'>
    {split.rows.map((row) => {
     const empty = row.accountCount === 0;

     return (
      <li
       className={`natureSplit__row${empty ? ' natureSplit__row--empty' : ''}`}
       key={row.nature}
      >
       <span className='natureSplit__name'>{row.nature}</span>

       <span className='natureSplit__bars'>
        <span
         className='natureSplit__bar natureSplit__bar--spent'
         style={{ width: widthOf(row.spent) }}
        />
        <span
         className='natureSplit__bar natureSplit__bar--budget'
         style={{ width: widthOf(row.budget) }}
        />
       </span>

       <span className='natureSplit__figures'>
        {/* A row nobody used keeps its place and says so in words: four are
            always four, or two months are two different blocks. */}
        {empty ? (
         <span className='natureSplit__none'>— no accounts</span>
        ) : (
         <>
          <span className='natureSplit__spent'>{money(row.spent)}</span>
          <span className='natureSplit__share'>
           {`${percent(row.share)}${scope ? ` of ${scope}` : ''}`}
          </span>
          <span className='natureSplit__budget'>
           {`of ${money(row.budget)} budgeted`}
          </span>
         </>
        )}
       </span>
      </li>
     );
    })}
   </ul>

   <p className='natureSplit__caption'>
    {`Each share is of the ${money(split.spentTotal)} spent ${
     scope ? `in ${scope}, not of the month` : 'across every expense category'
    }. Solid is spent, the outline is the budget, both on one scale.`}
    {/* Counted outside the four rather than folded into 'other', which is a
        value somebody chose: an absent tag is a gap. */}
    {split.untaggedCount > 0 &&
     ` ${split.untaggedCount} ${countNoun(
      split.untaggedCount,
      'accounts',
     )} ${split.untaggedCount === 1 ? 'carries' : 'carry'} no nature and ${
      split.untaggedCount === 1 ? 'is' : 'are'
     } outside the four, holding ${money(split.untaggedSpent)}.`}
   </p>
  </section>
 );
}

export default NatureSplit;
