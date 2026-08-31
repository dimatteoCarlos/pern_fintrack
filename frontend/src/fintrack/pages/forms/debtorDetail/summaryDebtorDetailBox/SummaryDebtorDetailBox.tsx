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

// The direction of the position, from the owner's side of it. It replaces
// Lender and Debtor, which named the counterparty's role and left the owner to
// work out which way the money runs.
//
// Three readings and not two. A position at zero is neither direction, and
// calling it "you're owed" — which is where it fell when the test was a single
// comparison against zero — states a claim the balance does not support.
//
// "Settled" here means this account's own balance is zero, and nothing more. It
// is NOT the settled-debtor definition the domain contract is still deciding:
// that one additionally requires a prior movement and counts soft-deleted rows.
// Two definitions under one word is the trap; this one is the row in front of
// the owner, not a population.
const DIRECTION_WORD = {
  owed: `You're owed`,
  owing: 'You owe',
  settled: 'Settled',
} as const;

type SummaryDetailPropType = {
  bubleInfo: DebtorListType;
};

function SummaryDebtorDetailBox({ bubleInfo }: SummaryDetailPropType) {
  const title = 'amount';
  const { total_debt_balance: amount, currency_code } = bubleInfo;

  const currency = currency_code ?? defaultCurrency;
  const formatNumberCountry = CURRENCY_OPTIONS[currency];

  // Coerced rather than type-tested. The balance reaches here as a STRING even
  // though this type calls it a number: account_balance is DECIMAL(15,2) and
  // node-postgres serves DECIMAL as text, so no cent is lost to a float. What
  // has to be excluded is an ABSENT figure, and that is what Number reports as
  // NaN.
  const numericAmount =
    amount === null || amount === undefined ? NaN : Number(amount);

  const isAmountKnown = !Number.isNaN(numericAmount);

  const direction = !isAmountKnown
    ? null
    : numericAmount > 0
      ? 'owed'
      : numericAmount < 0
        ? 'owing'
        : 'settled';

  // Unsigned, because the line beneath already says which way it runs. The
  // accounting contract carries both legs as positive magnitudes and puts the
  // direction in the name; a minus beside "You owe" says the same thing twice
  // and reads as a negative debt.
  const formattedAmount = isAmountKnown
    ? currencyFormat(currency, Math.abs(numericAmount), formatNumberCountry)
    : DASH;

  return (
    <div className='summaryDebtor__container'>
      <div className='summaryDebtor__heading'>
        <span className='summaryDebtor__title'>{title}</span>

        {/* No direction when there is no figure: an absent balance runs in no
            direction, and the dash above already says so. */}
        {direction && (
          <span className='summaryDebtor__direction'>
            <StatusSquare alert={direction === 'owing' ? 'alert' : ''} />

            <span className='summaryDebtor__directionWord'>
              {DIRECTION_WORD[direction]}
            </span>
          </span>
        )}
      </div>

      <div className='summaryDebtor__data'>
        <span className='summaryDebtor__amount'>{formattedAmount}</span>
      </div>
    </div>
  );
}

export default SummaryDebtorDetailBox;
