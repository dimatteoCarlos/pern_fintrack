//-------DebtsBigBoxResult---------
//Parent:DebtsLayout.tsx
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { CurrencyType } from '../../../types/types';

type BigBoxResultPropType = {
  bigScreenInfo: { title: string; amount: number }[];
  currency: CurrencyType | undefined;
};

export function DebtsBigBoxResult({
  bigScreenInfo,
  currency,
}: BigBoxResultPropType) {
  //temporary values------------
  const defaultCurrency = currency ?? DEFAULT_CURRENCY;
  const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

  const totalTitle = bigScreenInfo[0].title;
  const totalAmount = bigScreenInfo[0].amount;

  const receivable = bigScreenInfo[1].title;
  const receivableAmount = bigScreenInfo[1].amount;

  const debtors = bigScreenInfo[2].title;
  const debtorCount = bigScreenInfo[2].amount;

  const payable = bigScreenInfo[3].title;
  const payableAmount = bigScreenInfo[3].amount;

  const creditors = bigScreenInfo[4].title;
  const creditorCount = bigScreenInfo[4].amount;

  return (
    <div className='bigBox__container flex-col-sb'>
      <div className='bigBox__mainInfo'>
        {bigScreenInfo[0].title.toUpperCase()} {totalAmount}
      </div>

      <div className='displayScreen dark flex-row-sb'>
        <div className='displayScreen--concept light'>{totalTitle}</div>
        <div className='displayScreen--result light'>
          {currencyFormat(
            defaultCurrency,
            receivableAmount,
            formatNumberCountry
          )}
        </div>
      </div>

      {/***/}

      <div
        className='displayScreen dark flex-row-sb'
        style={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div
          className='debtInfo '
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          <div className='displayScreen--concept light'>{receivable}</div>
          <div className='displayScreen--result light'>
            {currencyFormat(
              defaultCurrency,
              bigScreenInfo[0].amount,
              formatNumberCountry
            )}
          </div>

          <div className='displayScreen--concept light'>{debtors}</div>
          <div className='displayScreen--result light'>{debtorCount}</div>
        </div>

        <div
          className='debtInfo '
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          <div className='displayScreen--concept light'>
            {payable}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          </div>
          <div className='displayScreen--result light'>
            {currencyFormat(
              defaultCurrency,
              payableAmount,
              formatNumberCountry
            )}
          </div>

          <div className='displayScreen--concept light'>{creditors}</div>
          <div className='displayScreen--result light'>{creditorCount}</div>
        </div>
      </div>
    </div>
  );
}

export default DebtsBigBoxResult;
