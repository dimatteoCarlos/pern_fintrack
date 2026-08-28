// frontend/src/fintrack/pages/forms/debtorDetail/summaryDebtorDetailBox/SummaryDebtorDetailBox.tsx

import { DEFAULT_CURRENCY } from '../../../../helpers/constants';
import { getCurrencySymbol } from '../../../../helpers/functions';

import { DebtorListType } from '../../../../types/responseApiTypes';
import { StatusSquare } from '../../../../general_components/boxComponents/BoxComponents';

import './styles/summaryDebtorDetailBox-style.css';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
//----------------------------
type SummaryDetailPropType = {
  bubleInfo: DebtorListType;
};

function SummaryDebtorDetailBox({ bubleInfo }: SummaryDetailPropType) {
  const title = 'amount';
  const subtitle1 = '';
  const { creditor, total_debt_balance: amount, currency_code } = bubleInfo;
  const type = creditor ? 'Lender' : 'Debtor';

  return (
    <>
      <div className='summaryDebtor__container'>
        <div className='summaryDebtor__title'>{title}</div>
        <div className='summaryDebtor__data'>
          <div className='summaryDebtor__data--amount'>
            <span> {getCurrencySymbol(currency_code ?? defaultCurrency)}</span>
            <span>{Number(amount).toFixed(2)}</span>
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
