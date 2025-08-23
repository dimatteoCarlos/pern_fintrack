// SummaryPocketDetailBox.tsx
import { StatusSquare } from "../../../../general_components/boxComponents";
import { DEFAULT_CURRENCY } from "../../../../helpers/constants";
import { getCurrencySymbol, numberFormatCurrency } from "../../../../helpers/functions";
import { PocketSavingAccountListType } from "../../../../types/responseApiTypes";
import './styles/summaryDetailBox-style.css'

//default values------------
const defaultCurrency = DEFAULT_CURRENCY;
//----------------------------
type SummaryDetailPropType = {
  bubleInfo: PocketSavingAccountListType
};

function SummaryPocketDetailBox({ bubleInfo }:SummaryDetailPropType ) {
  const title='target amount'
  const subtitle1='Saved '
  const { 
    currency_code,
    account_balance,
    target,
   } = bubleInfo;
  const remaining = (target - account_balance)

//  console.log('bubleInfo', bubleInfo,'target', target, 'account_balance', account_balance, currency_code)
 
  return (
    <>
      <div className='summary__container'>
        <div className='summary__title'>{title}</div>
        <div className='summary__data'>
          <div className='summary__data--amount'>
            <span> {getCurrencySymbol(currency_code??defaultCurrency)}</span>
            <span>
            {target}
             </span>
          </div>

          <div className='summary__data--subtitle1'>{subtitle1} {numberFormatCurrency(account_balance, 2,currency_code)}</div>

          <div className='summary__data--status '>
            {/* status: */}
            <StatusSquare alert={remaining >0 ? 'alert' : ''}/>
            <div className='summary__data--subtitle2'>{(target !==0 ? Math.abs(remaining/(target)*100):0).toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SummaryPocketDetailBox;
