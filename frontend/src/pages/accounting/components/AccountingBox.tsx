//------------AccountingBox---------------
//frontend/src/pages/accounting/components/AccountingBox.tsx

import { numberFormatCurrency } from '../../../helpers/functions';
import { CurrencyType } from '../../../types/types';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg'; 


type AccountingBoxPropType = {
  title: string;
  amount: number | string;
  currency?: CurrencyType;account_type?:string;
  onMenuClick?:(event:React.MouseEvent)=>void;
};
//----------------------------------------
export function AccountingBox({
  title,
  amount,
  currency, account_type, onMenuClick
  }: AccountingBoxPropType) {
  return (
    <div className='accountingBox__container flex-col-sb'
        onClick={onMenuClick}
    >
    {/* 🆕 3 DOTS BUTTON - ALWAYS VISIBLE */}
    <div className="accountingBox__menu"
    style={{display:'flex',width:'100%'}}
    >

      <div className='accountingBox__title'>
      {title}
      </div>

     <button 
      className="accountingBox__menu"
      onClick={onMenuClick}
      aria-label="Account options"
      >
        <div className="flx-col-center icon3dots">
          <Dots3LightSvg/>
        </div>   
     </button>

    </div>
    {/* <div className='accountingBox__title'>
      {title}
    </div> */}


    <div className='bubble light'>
     <div className='bubble--result dark'>
      {account_type}
     </div>

     <div className='bubble--result dark'>
      {numberFormatCurrency(amount, 2, currency)}
     </div>

    </div>
   </div>
  );
}

export default AccountingBox;
