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

  // The direction of the position, said from the owner's side, BESIDE the
  // counterparty's role and not instead of it. The role names who the other
  // party is; the direction names which way the money runs. The card used to
  // carry only the role and left the owner to work the direction out.
  //
  // The two halves move together off the same flag, so the phrase cannot say
  // one thing while the square says the other.
  const directionPhrase = creditor
    ? `You owe to ${type}`
    : `You're owed by ${type}`;

  const currency = currency_code ?? defaultCurrency;
  const formatNumberCountry = CURRENCY_OPTIONS[currency];

  // Through the shared formatter, like every other amount in the module. A
  // symbol concatenated with toFixed(2) printed '$-10.21' where the rest of the
  // app prints '-$10.21', dropped the thousands separator, and turned an absent
  // figure into the literal string 'NaN'.
  //
  // Coerced rather than type-tested. The balance reaches here as a STRING even
  // though this type calls it a number: account_balance is DECIMAL(15,2) and
  // node-postgres serves DECIMAL as text, so no cent is lost to a float. A
  // typeof check on 'number' rejected every real figure and printed the dash on
  // all of them. What has to be excluded is an ABSENT figure, and that is what
  // Number reports as NaN.
  const numericAmount =
    amount === null || amount === undefined ? NaN : Number(amount);

  // Unsigned, because the line below says which way it runs in words. A minus
  // in front of a figure the card already calls "You owe" states the direction
  // twice, and reads as a negative debt. It is the other half of the rule the
  // movement rows follow the opposite way: there the sign is the only carrier
  // and it stays; here the words are, and it goes.
  const formattedAmount = Number.isNaN(numericAmount)
    ? DASH
    : currencyFormat(currency, Math.abs(numericAmount), formatNumberCountry);

  return (
    <>
      <div className='summaryDebtor__container'>
        <div className='summaryDebtor__title'>{title}</div>
        <div className='summaryDebtor__data'>
          <div className='summaryDebtor__data--amount'>
            {/* Coloured off the same flag as the phrase and the square, so the
                three cannot disagree. On the panel variants of the two tokens:
                the pair calibrated for the app surface falls under the contrast
                floor on cream. */}
            <span
              className={`summaryDebtor__amount summaryDebtor__amount--${
                creditor ? 'owing' : 'owed'
              }`}
            >
              {formattedAmount}
            </span>
          </div>

          <div className='summaryDebtor__data--subtitle1'>{subtitle1}</div>

          <div className='summaryDebtor__data--status '>
            {/* Red when the owner is the one who owes, plain when the money is
                owed to them. Same flag the phrase reads. */}
            <StatusSquare alert={type == 'Lender' ? 'alert' : ''} />
            <div className='summaryDebtor__data--subtitle2'>
              {directionPhrase}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SummaryDebtorDetailBox;
