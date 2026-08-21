//------------AccountingBox----------
//frontend/src/pages/accounting/components/AccountingBox.tsx

import { numberFormatCurrency } from '../../helpers/functions';
import { CurrencyType } from '../../types/types';
import AccountActionsTrigger from '../../general_components/accountActionsTrigger/AccountActionsTrigger';

type AccountingBoxPropType = {
  title: string;
  amount: number | string;
  currency?: CurrencyType;
  account_type?: string;
  onMenuClick?: (event: React.MouseEvent) => void;
  // Whether this card's own menu is open. Announced by the trigger, not styled.
  isMenuOpen?: boolean;
};
//----------------------------------
export function AccountingBox({
  title,
  amount,
  currency,
  account_type,
  onMenuClick,
  isMenuOpen,
}: AccountingBoxPropType) {
  return (
    <div className='accountingBox__container flex-col-sb' onClick={onMenuClick}>
      <div className='accountingBox__header'>
       <div className='accountingBox__title'>{title}</div>

       <AccountActionsTrigger
        onClick={(event) => onMenuClick?.(event)}
        accountName={title}
        isOpen={isMenuOpen}
       />
      </div>

      <div className='bubble light'>
        <div className='bubble--result dark'>{account_type}</div>

        <div className='bubble--result dark'>
          {numberFormatCurrency(amount, 2, currency)}
        </div>
      </div>
    </div>
  );
}

export default AccountingBox;
