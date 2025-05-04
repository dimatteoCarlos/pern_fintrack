import { currencyFormat } from '../../../helpers/functions';
import { StatusSquare } from '../../../general_components/boxComponents';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';

// Valores temporales
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

const income = {
  title: 'Monthly Income (Avg.)',
  amount: 0,
  status: '% status',
};
const expenses = {
  title: 'Monthly Expenses (Avg.)',
  amount: 0,
  status: '% status',
};

function MonthlyAverage() {
  return (
    <div className='tiles__container flx-row-sb'>
      {/* Monthly info left column */}
      <div className='tile__container tile__container__col tile__container__col--goalInfo'>
        <div className='tile__subtitle letterSpaceSmall'>
          {income.title}
        </div>
        <div className='tile__title '>
          {currencyFormat(
            defaultCurrency,
            income.amount,
            formatNumberCountry
          )}
        </div>

        <div className='tile__status__container flx-row-sb'>
          <StatusSquare
            alert={0.5 - Math.random() < 0 ? 'alert' : ''} // Valores temporales
          ></StatusSquare>
          <div className='tile__subtitle tile__status--goal'>
            {income.status}
          </div>
        </div>
      </div>

      {/* Monthly info right column */}
      <div className='tile__container tile__container__col tile__container__col--goalInfo'>
        <div className='tile__subtitle letterSpaceSmall'>
          {expenses.title}
        </div>
        <div className='tile__title '>
          {currencyFormat(
            defaultCurrency,
            expenses.amount,
            formatNumberCountry
          )}
        </div>
        <div className='tile__status__container flx-row-sb'>
          <StatusSquare
            alert={0.5 - Math.random() < 0 ? 'alert' : ''} // Valores temporales
          ></StatusSquare>
          <div className='tile__subtitle tile__status--goal'>
            {expenses.status}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonthlyAverage;
