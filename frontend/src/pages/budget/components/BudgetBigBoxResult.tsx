//-------BudgetBigBoxResult---------
//Parent:BudgetLayout.tsx
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { CurrencyType } from '../../../types/types';

type BigBoxResultPropType = {
  bigScreenInfo: { title: string; amount: number }[];
  currency: CurrencyType | undefined;
};

function BudgetBigBoxResult({ bigScreenInfo, currency }: BigBoxResultPropType) {
  const resultAmount = bigScreenInfo[0].amount;
  const title = bigScreenInfo[1].title;
  const remaining = bigScreenInfo[1].amount;
  const currency_code = currency ?? DEFAULT_CURRENCY;
  
  const formatNumberCountry = CURRENCY_OPTIONS[currency_code];

  return (
    <div className='total__container flex-col-sb'>
      <div className='total__amount'>
        {currencyFormat(currency_code, resultAmount, formatNumberCountry)}
      </div>

      <div className={`flex-row-sb displayScreen ${'light'}`}>
        <div className={`displayScreen--concept ${'dark'}`}>{title}</div>

        <div className={`displayScreen--result ${'dark'}`}>
          {currencyFormat(currency_code, remaining, formatNumberCountry)}
        </div>
      </div>
    </div>
  );
}

export default BudgetBigBoxResult;
