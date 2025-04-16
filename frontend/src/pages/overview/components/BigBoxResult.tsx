//-------BigBoxResult---------
//Parent:OverviewLayout.tsx

import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
type BigBoxResultPropType = {
  bigScreenInfo: { title: string; amount: number }[];
};

export function BigBoxResult({ bigScreenInfo }: BigBoxResultPropType) {
  return (
    <div className='bigBox__container'>
      <div className='bigBox__frame'>
        {bigScreenInfo.map((info, indx) => {
          const { title, amount } = info;

          return (
            <div
              className='bigBox__frame__screenRow flx-row-sb'
              key={`row-${indx}`}
            >
              <div className='bigBox__screenRow--title '>{title}</div>
              <div className='bigBox__screenRow--amount'>
                {currencyFormat(defaultCurrency, amount, formatNumberCountry)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
//------------------
