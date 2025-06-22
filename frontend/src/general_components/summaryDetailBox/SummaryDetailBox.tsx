import { DEFAULT_CURRENCY } from '../../helpers/constants';
import { getCurrencySymbol } from '../../helpers/functions';
import { DebtorListType } from '../../types/responseApiTypes';
import { StatusSquare } from '../boxComponents';
import './styles/summaryDetailBox-style.css';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
//----------------------------
type SummaryDetailPropType = {
  bubleInfo: DebtorListType
};

function SummaryDetailBox({ bubleInfo }:SummaryDetailPropType ) {
  const title='amount'
  const subtitle1=''
  const {  creditor,  total_debt_balance:amount, currency_code} = bubleInfo;
  const type = creditor?'Lender':'Debtor'

  return (
    <>
      <div className='summary__container'>
        <div className='summary__title'>{title}</div>
        <div className='summary__data'>
          <div className='summary__data--amount'>
            <span> {getCurrencySymbol(currency_code??defaultCurrency)}</span>
            <span>
            {Number(amount).toFixed(2)}
             </span>
          </div>

          <div className='summary__data--subtitle1'>{subtitle1}</div>

          <div className='summary__data--status '>
            {/* status: */}
            <StatusSquare alert={type == 'Lender' ? 'alert' : ''}/>
            <div className='summary__data--subtitle2'>{type}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SummaryDetailBox;
