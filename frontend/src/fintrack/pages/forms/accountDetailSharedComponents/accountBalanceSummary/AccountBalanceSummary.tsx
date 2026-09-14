//frontend/src/fintrack/pages/forms/accountDetailSharedComponents/accountBalanceSummary/AccountBalanceSummary.tsx
import { AccountSummaryBalanceType } from '../../../../types/responseApiTypes';
import {
  currencyFormat,
  formatDateToDDMMYYYY,
} from '../../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../../helpers/currencyConstants';
import { CurrencyType } from '../../../../types/types';

// The API types this component reads carry currency as a plain `string`
// (server-validated, not narrowed on the wire), so the lookup is cast and
// falls back to the default locale for a code CURRENCY_OPTIONS does not list.
const localeFor = (currency: string) =>
  CURRENCY_OPTIONS[currency as CurrencyType] ?? CURRENCY_OPTIONS[DEFAULT_CURRENCY];

import './styles/accountBalanceSummary-styles.css';

type AccountBalanceSummaryPropsType = {
  summaryAccountBalance: AccountSummaryBalanceType;
};
//---------------------------
//MAIN COMPONENT
//---------------------------
const AccountBalanceSummary = ({
  summaryAccountBalance,
}: AccountBalanceSummaryPropsType) => {
  const { initialBalance, finalBalance } = summaryAccountBalance;

  return (
    <div className='balance-summary__container'>
      <div className='balance-summary__item'>
        <span className='balance-summary__label'>Initial Balance</span>
        <span className='balance-summary__value'>
          {currencyFormat(initialBalance.currency, initialBalance.amount, localeFor(initialBalance.currency))}
        </span>
        <span className='balance-summary__date'>
          ({formatDateToDDMMYYYY(initialBalance.date)})
        </span>
      </div>

      <div className='balance-summary__item border-left '>
        <span className='balance-summary__label'>Final Balance</span>
        <span className='balance-summary__value'>
          {currencyFormat(finalBalance.currency, finalBalance.amount, localeFor(finalBalance.currency))}
        </span>
        <span className='balance-summary__date'>
          ({formatDateToDDMMYYYY(finalBalance.date)})
        </span>
      </div>
    </div>
  );
};

export default AccountBalanceSummary;
