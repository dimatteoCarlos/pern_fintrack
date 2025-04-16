//-------DebtsBigBoxResult---------
//Parent:DebtsLayout.tsx
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

type BigBoxResultPropType = {
  bigScreenInfo: { title: string; amount: number }[];
};
export function DebtsBigBoxResult({ bigScreenInfo }: BigBoxResultPropType) {
  return (
    <div className='bigBox__container flex-col-sb'>
      <div className='bigBox__mainInfo'>
        {bigScreenInfo[0].title.toUpperCase()}
      </div>

      <div className='displayScreen dark flex-row-sb'>
        <div className='displayScreen--concept light'>{'total'}</div>
        <div className='displayScreen--result light'>
          {currencyFormat(
            defaultCurrency,
            bigScreenInfo[0].amount,
            formatNumberCountry
          )}
        </div>
      </div>
    </div>
  );
}

export default DebtsBigBoxResult;
