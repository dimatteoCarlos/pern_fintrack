//-------BudgetBigBoxResult---------
//Parent:BudgetLayout.tsx
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

function BudgetBigBoxResult() {
  //these data are coming from: backend calculations fetched here or will be received as props?
  const resultAmount = 0;
  const remaining = 0;

  return (
    <div className='total__container flex-col-sb'>
      <div className='total__amount'>
        {currencyFormat(defaultCurrency, resultAmount, formatNumberCountry)}
      </div>

      <div className={`flex-row-sb displayScreen ${'light'}`}>
        <div className={`displayScreen--concept ${'dark'}`}>{'Remaining'}</div>

        <div className={`displayScreen--result ${'dark'}`}>
          {currencyFormat(defaultCurrency, remaining, formatNumberCountry)}
        </div>
      </div>
    </div>
  );
}

export default BudgetBigBoxResult;
