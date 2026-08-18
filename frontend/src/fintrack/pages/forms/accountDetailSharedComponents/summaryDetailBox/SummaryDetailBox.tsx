// frontend/src/fintrack/pages/forms/accountDetailSharedComponents/summaryDetailBox/SummaryDetailBox.tsx
import { StatusSquare } from '../../../../general_components/boxComponents/BoxComponents';
import {
  budgetRemainWord,
  budgetSquareState,
  isUnbudgeted,
} from '../../../../helpers/budgetStatus';
import { DEFAULT_CURRENCY } from '../../../../helpers/constants';
import {
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
};

//MAIN UI COMPONENT: SummaryDetailBox.tsx
function SummaryDetailBox({ bubleInfo }: SummaryDetailPropType) {
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
  // no share. This box printed the fullest version of the wrong claim —
  // `$0.00 left (0.0%)` — because its own fallback fabricated that 0.0 rather
  // than reading the null the server sends.
  const unbudgeted = isUnbudgeted(amount, amount1);
  const remainWord = budgetRemainWord(amount, amount1, amount2);

  const hasServedPercentage =
    executionPercentage !== null && executionPercentage !== undefined;

  // What was spent as a share of the budget. |execution| is that same
  // division, so taking it from the server makes the figure inherit its
  // rounding instead of a second formula over the amounts.
  const spentPercentage = hasServedPercentage
    ? Math.abs(executionPercentage)
    : amount !== 0 && amount1
      ? Math.abs((amount1 / amount) * 100)
      : 0;

  // What the remaining amount is worth as a share of the budget. The
  // parenthesis qualifies the figure in front of it, so the same number reads
  // for both words: 19.6% over, 100.0% left. |100 - execution| is the same
  // division as |remaining| / budget, for every sign of the remainder.
  const remainPercentage = hasServedPercentage
    ? Math.abs(100 - executionPercentage)
    : amount !== 0
      ? (Math.abs(amount2) / amount) * 100
      : 0;

  return (
    <>
      <div className='summary__container summary__container--stacked'>
        <div className='summary__title'>{title}</div>
        <div className='summary__data'>
          <div className='summary__data--amount'>
            <span> {getCurrencySymbol(currency_code ?? defaultCurrency)}</span>
            {/* No currency argument: the symbol is the span above, and passing
                one here would print it twice. */}
            <span>{numberFormatCurrency(amount, 2)}</span>
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
                  &nbsp;
                  <span
                    className={
                      isOver
                        ? 'summary__percentage--over'
                        : 'summary__percentage--left'
                    }
                  >
                    ({remainPercentage.toFixed(1)}%)
                  </span>
                </>
              )}
            </div>
          </div>

          <div className='summary__data--subtitle1'>
            {subtitle1} {numberFormatCurrency(amount1, 2, currency_code)}&nbsp;(
            {spentPercentage.toFixed(1)}
            %)
          </div>
        </div>
      </div>
    </>
  );
}

export default SummaryDetailBox;
