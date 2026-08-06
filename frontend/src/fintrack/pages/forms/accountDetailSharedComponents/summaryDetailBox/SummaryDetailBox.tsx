// frontend/src/fintrack/pages/forms/accountDetailSharedComponents/summaryDetailBox/SummaryDetailBox.tsx
import { StatusSquare } from '../../../../general_components/boxComponents/BoxComponents';
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
  };
};

//MAIN UI COMPONENT: SummaryDetailBox.tsx
function SummaryDetailBox({ bubleInfo }: SummaryDetailPropType) {
  const { title, amount, subtitle1, amount1, amount2, status, currency_code } =
    bubleInfo;

  // amount2 is what is left of the budget: negative means it was exceeded.
  const isOver = amount2 < 0;

  // What the remaining amount is worth as a share of the budget. The
  // parenthesis qualifies the figure in front of it, so the same number reads
  // for both words: 19.6% over, 100.0% left.
  const remainPercentage =
    amount !== 0 ? (Math.abs(amount2) / amount) * 100 : 0;

  return (
    <>
      <div className='summary__container'>
        <div className='summary__title'>{title}</div>
        <div className='summary__data'>
          <div className='summary__data--amount'>
            <span> {getCurrencySymbol(currency_code ?? defaultCurrency)}</span>
            {/* No currency argument: the symbol is the span above, and passing
                one here would print it twice. */}
            <span>{numberFormatCurrency(amount, 2)}</span>
          </div>

          <div className='summary__data--subtitle1'>
            {subtitle1} {numberFormatCurrency(amount1, 2, currency_code)}&nbsp;(
            {(amount !== 0 && amount1
              ? Math.abs((amount1! / amount) * 100)
              : 0
            ).toFixed(1)}
            %)
          </div>

          <div className='summary__data--status '>
            <StatusSquare alert={status ? 'alert' : ''} />
            <div className='summary__data--subtitle2'>
              {/* Absolute value: the word carries the sign, so a minus in front
                  of it would state the same thing twice. */}
              {numberFormatCurrency(Math.abs(amount2), 2, currency_code)}
              &nbsp;
              <span className='summary__remainWord'>
                {isOver ? 'over' : 'left'}
              </span>
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SummaryDetailBox;
