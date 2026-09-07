//-------BigBoxResult---------
//Parent:OverviewLayout.tsx

import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
// amount is nullable because a figure that failed to load is not a figure of
// zero. The three rows are the user's own money, and printing 0 for a request
// that never answered states they hold nothing.
type BigBoxResultPropType = {
  bigScreenInfo: { title: string; amount: number | null }[];
};

// What an unknown figure renders as. A dash, per the fetch-state rule: loading,
// error and empty are three different states and none of them is a number.
const NO_FIGURE = '—';

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
                {amount === null
                  ? NO_FIGURE
                  : currencyFormat(defaultCurrency, amount, formatNumberCountry)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
//------------------
