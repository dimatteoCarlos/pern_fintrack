// frontend/src/fintrack/pages/forms/accountDetailSharedComponents/summaryDetailBox/SummaryDetailBox.tsx
import { StatusSquare } from '../../../../general_components/boxComponents/BoxComponents';
import {
  budgetRemainWord,
  budgetSquareState,
  isUnbudgeted,
} from '../../../../helpers/budgetStatus';
import { DEFAULT_CURRENCY } from '../../../../helpers/constants';
import {
  currencyMinorUnit,
  getCurrencySymbol,
  numberFormatCurrency,
} from '../../../../helpers/functions';
import { CurrencyType } from '../../../../types/types';
import './styles/summaryDetailBox-style.css';

//------------
const defaultCurrency = DEFAULT_CURRENCY;
//----------------------------
type SummaryDetailPropType = {
  bubleInfo: {
    title: string;
    amount: number;
    subtitle1: string;
    amount1: number;
    status: string | boolean;
    amount2: number;
    currency_code: CurrencyType;
    // Served by the budget module, which is the only caller of this component.
    // Optional so the two percentages keep a definition if a future caller has
    // no served figure to hand over.
    executionPercentage?: number | null;
  };
  // Rendered beside the title, which is the word the control acts on. A slot
  // and not an onEdit callback: this component stays presentational, and only
  // the caller knows whether its box names something editable — level 2's box
  // is a category total, which no single write governs.
  action?: React.ReactNode;
  // The surface the box lands on, not its own colour: the cream panel of the
  // budget levels, the dark app surface of the account detail.
  surface?: 'dark' | 'light';
};

//MAIN UI COMPONENT: SummaryDetailBox.tsx
function SummaryDetailBox({
  bubleInfo,
  action,
  surface = 'light',
}: SummaryDetailPropType) {
  const {
    title,
    amount,
    subtitle1,
    amount1,
    amount2,
    status,
    currency_code,
    executionPercentage,
  } = bubleInfo;

  // amount2 is what is left of the budget: negative means it was exceeded.
  const isOver = amount2 < 0;

  // amount is the budget and amount1 the spend, under this component's older
  // positional names. Nothing budgeted and nothing spent: no square, no word,
  // no share.
  const unbudgeted = isUnbudgeted(amount, amount1);
  const remainWord = budgetRemainWord(amount, amount1, amount2);

  const hasServedPercentage =
    executionPercentage !== null && executionPercentage !== undefined;

  // Both shares are null when the server withholds the execution: a zero
  // budget has no denominator, so the parentheses below hide rather than
  // fabricate the `(0.0%)` a local division used to print over it.

  // What was spent as a share of the budget. |execution| is that same
  // division, so taking it from the server makes the figure inherit its
  // rounding instead of a second formula over the amounts.
  const spentPercentage = hasServedPercentage
    ? Math.abs(executionPercentage)
    : null;

  // What the remaining amount is worth as a share of the budget. The
  // parenthesis qualifies the figure in front of it, so the same number reads
  // for both words: 19.6% over, 100.0% left. |100 - execution| is the same
  // division as |remaining| / budget, for every sign of the remainder.
  const remainPercentage = hasServedPercentage
    ? Math.abs(100 - executionPercentage)
    : null;

  return (
    <>
      <div
        className={`summary__container summary__container--${surface} summary__container--stacked`}
      >
        <div className='summary__titleRow'>
          <div className='summary__title'>{title}</div>
          {action}
        </div>
        <div className='summary__data'>
          <div className='summary__data--amount'>
            {/* The owner's currency is passed as the reader, so their own
                currency shows as a symbol and any other shows as its ISO code.
                Without it, a dollar, a Colombian peso and a Mexican peso all
                render as a bare '$'. */}
            <span>
              {' '}
              {getCurrencySymbol(currency_code ?? defaultCurrency, defaultCurrency)}
            </span>
            {/* No currency argument: the symbol is the span above, and passing
                one here would print it twice. The decimal count still has to
                follow the currency, so it is passed explicitly — the branch
                that derives it only runs when a currency is given. */}
            <span>
              {numberFormatCurrency(
                amount,
                currencyMinorUnit(currency_code ?? defaultCurrency),
              )}
            </span>
          </div>
        </div>

        {/* The two readings of the same budget, on a row of their own at the
            full width of the box. Inside .summary__data they stacked in the
            right half while the left half sat empty under the title. */}
        <div className='summary__breakdown'>
          <div className='summary__data--status '>
            {/* status is the served isOverBudget, typed loosely by this
                component's prop. Boolean() is what narrows it back. */}
            {!unbudgeted && (
              <StatusSquare
                alert={budgetSquareState(executionPercentage, Boolean(status))}
              />
            )}
            <div className='summary__data--subtitle2'>
              {/* Absolute value: the word carries the sign, so a minus in front
                  of it would state the same thing twice. */}
              {numberFormatCurrency(Math.abs(amount2), 2, currency_code)}
              &nbsp;
              {remainWord && (
                <>
                  <span className='summary__remainWord'>{remainWord}</span>
                  {remainPercentage !== null && (
                    <>
                      &nbsp;
                      <span
                        className={`summary__percentage ${
                          isOver
                            ? 'summary__percentage--over'
                            : 'summary__percentage--left'
                        }`}
                      >
                        ({remainPercentage.toFixed(1)}%)
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className='summary__data--subtitle1'>
            {subtitle1} {numberFormatCurrency(amount1, 2, currency_code)}
            {spentPercentage !== null && (
              <>
                &nbsp;
                {/* The same colours and the same condition as the remainder's
                    share: one fact, one reading. Grey on this half while the
                    other half was red said the row disagreed with itself. */}
                <span
                  className={`summary__percentage ${
                    isOver
                      ? 'summary__percentage--over'
                      : 'summary__percentage--left'
                  }`}
                >
                  ({spentPercentage.toFixed(1)}%)
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default SummaryDetailBox;
