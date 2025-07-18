// SummaryDetailBox.tsx
import { StatusSquare } from "../../../../general_components/boxComponents";
import { DEFAULT_CURRENCY } from "../../../../helpers/constants";
import { getCurrencySymbol, numberFormatCurrency } from "../../../../helpers/functions";
import { CurrencyType } from "../../../../types/types";
import './styles/summaryDetailBox-style.css'

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
//----------------------------
type SummaryDetailPropType = {
  bubleInfo: {
    title: string;
    amount: number;
    subtitle1: string;
    amount1: number;
    status: string | boolean;
    amount2:number;
    currency_code:CurrencyType;
     };
};

function SummaryDetailBox({ bubleInfo }:SummaryDetailPropType ) {
  const { 
    title,
    amount,
    subtitle1,
    amount1,
    amount2,
    status,
    currency_code,
   } = bubleInfo;

//  console.log('bubleInfo', bubleInfo)
 
  return (
    <>
      <div className='summary__container'>
        <div className='summary__title'>{title}</div>
        <div className='summary__data'>
          <div className='summary__data--amount'>
            <span> {getCurrencySymbol(currency_code??defaultCurrency)}</span>
            <span>
            {amount}
             </span>
          </div>

          <div className='summary__data--subtitle1'>{subtitle1} {numberFormatCurrency(amount1, 2,currency_code)}&nbsp;({(amount !==0 &&amount1 ? Math.abs(amount1!/(amount)*100):0).toFixed(1)}%)</div>

          <div className='summary__data--status '>
            {/* status: */}
            <StatusSquare alert={status? 'alert' : ''}/>
            {/* <StatusSquare alert={amount2 >0 ? 'alert' : ''}/> */}
            <div className='summary__data--subtitle2'>{(amount !==0 && amount2 ? Math.abs(amount2!/(amount)*100):0).toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SummaryDetailBox;
