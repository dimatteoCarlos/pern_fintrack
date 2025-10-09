//-------AccountingBox---------
//frontend/src/pages/accounting/components/AccountingBox.tsx

import { numberFormatCurrency } from '../../../helpers/functions';
import { CurrencyType } from '../../../types/types';

type AccountingBoxPropType = {
  title: string;
  amount: number | string;
  currency?: CurrencyType;account_type?:string;
};

export function AccountingBox({
  title,
  amount,
  currency,account_type
}: AccountingBoxPropType) {
  return (
    <div className='accountingBox__container flex-col-sb'>
      {/* <input type="text" className="balance" /> */}
      <div className='accountingBox__title'>{title}</div>

      <div className='bubble light  '>

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
//------------------

export default AccountingBox;
