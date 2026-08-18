//-------BudgetBigBoxResult---------
//Parent:BudgetLayout.tsx
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { CurrencyType } from '../../../types/types';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents';
import {
  budgetRemainWord,
  budgetSquareState,
  isUnbudgeted,
} from '../../../helpers/budgetStatus';

// Named, not positional. The array this replaced was read by index, and its
// third entry — the spending — was built by the parent and never rendered.
//
// Every amount is nullable because the contract withholds them in two cases:
// the answer is still on the wire, or the accounts hold more than one currency
// and V1 refuses to add them. Neither of those is an amount of zero.
type BudgetHeroPropType = {
  budgetAmount: number | null;
  actualSpent: number | null;
  remainingBudget: number | null;
  // Served by the module, never recomputed here. null when the budget is 0:
  // there is no percentage of zero, and its absence is the fact.
  executionPercentage: number | null;
  currency: CurrencyType | null | undefined;
  // Resolved by the parent, so the two squares below cannot disagree. null
  // while the answer is on the wire and in the mixed-currency case.
  isOverBudget: boolean | null;
  // Why the figures read as dashes, in the server's own words. null when there
  // is nothing to explain.
  notice: string | null;
};

const MISSING = '—';

function BudgetBigBoxResult({
  budgetAmount,
  actualSpent,
  remainingBudget,
  executionPercentage,
  currency,
  isOverBudget,
  notice,
}: BudgetHeroPropType) {
  const currency_code = currency ?? DEFAULT_CURRENCY;
  const formatNumberCountry = CURRENCY_OPTIONS[currency_code];

  const amount = (value: number | null) =>
    value === null
      ? MISSING
      : currencyFormat(currency_code, value, formatNumberCountry);

  const share = (value: number | null) =>
    value === null ? MISSING : `${Math.abs(value).toFixed(1)}%`;

  // Neither half states a share and neither states a side: a dash says a figure
  // was withheld, and here there is no figure to withhold. The two amounts
  // stay, because a spend of zero against a budget of zero is what happened.
  const unbudgeted = isUnbudgeted(budgetAmount, actualSpent);

  const spentShare = unbudgeted ? null : share(executionPercentage);

  // Derived from the served percentage rather than recomputed over the amounts:
  // |100 - execution| is the same figure and it inherits the server's rounding
  // instead of introducing a second one.
  //
  // Parenthesised because the word in front of it is what qualifies it: the
  // same number reads as 61.3% over or 38.7% left. Bare, it stated its own
  // opposite. Same shape as SummaryDetailBox, the level-3 hero.
  const remainingShare = unbudgeted
    ? null
    : executionPercentage === null
      ? MISSING
      : `(${share(100 - executionPercentage)})`;

  const remainWord = budgetRemainWord(
    budgetAmount,
    actualSpent,
    remainingBudget,
  );

  const remainingAmount =
    remainingBudget === null ? MISSING : amount(Math.abs(remainingBudget));

  // The server withheld every total and said why. The sentence is the answer,
  // so it stands where the figures would: printing four dashes above it repeats
  // in symbols what the line below is about to say in words, and a dash cannot
  // tell the reader which of the three absences it is.
  //
  // Guarded on the sentence, not on the withheld figures: if the contract ever
  // withholds them without explaining, the dashes are all there is and they
  // stay.
  if (notice) {
    return (
      <div className='total__container flex-col-sb'>
        <p className='displayScreen__notice'>{notice}</p>
      </div>
    );
  }

  return (
    <div className='total__container flex-col-sb'>
      <div className='total__amount'>{amount(budgetAmount)}</div>

      {/* One strip, not two. The pair are the halves of a single budget and now
          read as a split of it — and the strip that went is height the list
          gets back. */}
      <div className='displayScreen__rows'>
        <div className={`displayScreen budgetHero__figures ${'light'}`}>
          <div className='budgetHero__figure'>
            <div className={`displayScreen--concept ${'dark'}`}>Spent</div>

            <div className={`displayScreen--result ${'dark'}`}>
              {amount(actualSpent)}
              {spentShare && (
                <span className='displayScreen__percentage'>{spentShare}</span>
              )}
            </div>
          </div>

          <div className='budgetHero__figure'>
            <div className={`displayScreen--concept ${'dark'}`}>
              Remaining
              {/* Nothing budgeted and nothing spent is not a healthy budget,
                  it is no budget. isOverBudget arrives false there — 0 > 0 —
                  so the square would paint its neutral state and claim a
                  reading over something nobody measured. */}
              {!unbudgeted && isOverBudget !== null && (
                <StatusSquare
                  alert={budgetSquareState(executionPercentage, isOverBudget)}
                />
              )}
            </div>

            <div className={`displayScreen--result ${'dark'}`}>
              {remainingAmount}
              {remainWord && (
                <span className='budgetHero__remainWord'>&nbsp;{remainWord}</span>
              )}
              {remainingShare && (
                <span className='displayScreen__percentage'>
                  {remainingShare}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BudgetBigBoxResult;
