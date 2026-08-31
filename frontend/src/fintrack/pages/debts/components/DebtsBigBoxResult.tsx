//-------DebtsBigBoxResult---------
//Parent:DebtsLayout.tsx
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { CurrencyType } from '../../../types/types';

// A figure the answer did not carry. Never 0: on a debts board a zero is a
// balance and a zero count is a statement about the owner's debtors, and
// neither of them means 'the server did not send this field'.
const DASH = '—';

type BigBoxResultPropType = {
  // Nullable per field, as the endpoint declares them. A field the answer
  // omitted used to be coalesced to 0 by the layout and printed as $0.00.
  bigScreenInfo: { title: string; amount: number | null }[];
  currency: CurrencyType | undefined;
};

export function DebtsBigBoxResult({
  bigScreenInfo,
  currency,
}: BigBoxResultPropType) {
  //temporary values------------
  const defaultCurrency = currency ?? DEFAULT_CURRENCY;
  const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

  const formatAmount = (amount: number | null) =>
    amount === null
      ? DASH
      : currencyFormat(defaultCurrency, amount, formatNumberCountry);

  const totalTitle = bigScreenInfo[0].title;
  const totalAmount = bigScreenInfo[0].amount;

  const receivable = bigScreenInfo[1].title;
  const receivableAmount = bigScreenInfo[1].amount;

  const debtors = bigScreenInfo[2].title;
  const debtorCount = bigScreenInfo[2].amount;

  const payable = bigScreenInfo[3].title;

  // The magnitude of what is owed, and only here. The server sums the negative
  // balances and serves the payable negative, which is the accounting truth and
  // does not move; the label beside this figure already carries the direction in
  // words, so printing the sign as well asks the reader to apply two conventions
  // at once. Presentation is not accounting representation.
  const payableAmount =
    bigScreenInfo[3].amount === null ? null : Math.abs(bigScreenInfo[3].amount);

  const lenders = bigScreenInfo[4].title;
  const creditorCount = bigScreenInfo[4].amount;

  return (
    <div className='bigBox__container flex-col-sb'>
      <div className='bigBox__mainInfo'>{totalTitle.toUpperCase()}</div>

      <div className='displayScreen dark flex-row-sb'>
        <div className='displayScreen--concept light'>{'total'}</div>
        <div className='displayScreen--result light'>
          {formatAmount(totalAmount)}
        </div>
      </div>

      {/***/}
      <div className='debtIndicatorContainer '>
        <div className='debtInfo '>
          <div className='displayScreen--concept light'>{receivable}:</div>
          <div className='displayScreen--result light'>
            {formatAmount(receivableAmount)}
          </div>

          <div className='displayScreen--concept light'>{debtors}:</div>
          <div className='displayScreen--result light'>
            {debtorCount ?? DASH}
          </div>
        </div>
        {}

        <div className='debtInfo '>
          <div className='displayScreen--concept light'>{payable}:</div>

          <div className='displayScreen--result light'>
            {formatAmount(payableAmount)}
          </div>

          <div className='displayScreen--concept light'>{lenders}:</div>
          <div className='displayScreen--result light'>
            {creditorCount ?? DASH}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DebtsBigBoxResult;
