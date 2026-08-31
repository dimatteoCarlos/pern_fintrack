// frontend/src/fintrack/pages/forms/debtorDetail/summaryDebtorDetailBox/SummaryDebtorDetailBox.tsx

import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
} from '../../../../helpers/constants';
import { currencyFormat } from '../../../../helpers/functions';

import { DebtorListType } from '../../../../types/responseApiTypes';
import { StatusSquare } from '../../../../general_components/boxComponents/BoxComponents';

import './styles/summaryDebtorDetailBox-style.css';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
//----------------------------

// A figure the answer did not carry. Never 0 and never NaN: on this card a zero
// is a settled debtor, which is a statement of fact the answer has not made.
const DASH = '—';

type SummaryDetailPropType = {
  bubleInfo: DebtorListType;
};

function SummaryDebtorDetailBox({ bubleInfo }: SummaryDetailPropType) {
  const title = 'amount';
  const subtitle1 = '';
  const { creditor, total_debt_balance: amount, currency_code } = bubleInfo;
  const type = creditor ? 'Lender' : 'Debtor';

  const currency = currency_code ?? defaultCurrency;
  const formatNumberCountry = CURRENCY_OPTIONS[currency];

  // Through the shared formatter, like every other amount in the module. A
  // symbol concatenated with toFixed(2) printed '$-10.21' where the rest of the
  // app prints '-$10.21', dropped the thousands separator, and turned an absent
  // figure into the literal string 'NaN'.
  const formattedAmount =
    typeof amount === 'number'
      ? currencyFormat(currency, amount, formatNumberCountry)
      : DASH;

  return (
    <>
      <div className='summaryDebtor__container'>
        <div className='summaryDebtor__title'>{title}</div>
        <div className='summaryDebtor__data'>
          <div className='summaryDebtor__data--amount'>
            <span className='summaryDebtor__amount'>{formattedAmount}</span>
          </div>

          <div className='summaryDebtor__data--subtitle1'>{subtitle1}</div>

          <div className='summaryDebtor__data--status '>
            {/* status: */}
            <StatusSquare alert={type == 'Lender' ? 'alert' : ''} />
            <div className='summaryDebtor__data--subtitle2'>{type}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SummaryDebtorDetailBox;
