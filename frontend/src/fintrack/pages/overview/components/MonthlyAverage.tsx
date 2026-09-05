import { currencyFormat } from '../../../helpers/functions';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { CurrencyType } from '../../../types/types';
import { ResultType, MovementType } from '../CalculateMonthlyAverage';
import { YearlyTotalsType } from '../../../types/responseApiTypes';

// Configuración por defecto
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

//Data to display type
type DataToRenderType = {
  title: string;
  amount: number;
  months: number;
  currency: CurrencyType;
  status: string;
};

/*example of input data
data:ResultType = {
    expense?: {
        usd?: { monthlyAverage: 5000, status: "+5%", totalAmount: number ,currency: CurrencyType;
          monthCounter: number;} | undefined;
        cop?: FinancialResultType | undefined;
        eur?: FinancialResultType | undefined;
    } | undefined;
    income?: {
        usd?: FinancialResultType | undefined;
        cop?: FinancialResultType | undefined;
        eur?: FinancialResultType | undefined;
    } | undefined;
    saving?: {
        usd?: FinancialResultType | undefined;
        cop?: FinancialResultType | undefined;
        eur?: FinancialResultType | undefined;
    } | undefined;
    other?: {
        usd?: FinancialResultType | undefined;
        cop?: FinancialResultType | undefined;
        eur?: FinancialResultType | undefined;
    } | undefined;
}
    */

function MonthlyAverage({
  data,
  yearlyTotals,
}: {
  data: ResultType | null;
  yearlyTotals: YearlyTotalsType | null;
}) {
  // The year beside the monthly average, on the card that already names the
  // movement. A dash and never a zero when the backend withheld the figure:
  // a withheld total is one it refused to invent, not one that came to nothing.
  const yearToDate = (movement: MovementType) => {
    const total = yearlyTotals?.[movement];

    if (!total || total.amount === null || total.currency === null) {
      return '—';
    }

    // Income is stored as a withdrawal from its source account, so it arrives
    // negative. The same factor the averages above already apply.
    const sign = movement === 'income' ? -1 : 1;

    // The locale is the reader's, never the amount's — the same one every other
    // figure on this card already uses. Taken from the amount's own currency,
    // Intl leaves every currency unmarked and the dollar, the Colombian peso
    // and the Mexican peso all narrow to '$'.
    return currencyFormat(total.currency, sign * total.amount, formatNumberCountry);
  };
  //convert input data structure into data to render structure
  const convertMovementData = (
    movement: MovementType,
    data: ResultType | null,
  ): DataToRenderType[] => {
    // console.log(movement, data);

    if (
      data === null ||
      !data?.[movement] ||
      Object.keys(data[movement]!).length === 0
    ) {
      return [
        {
          title: `Monthly ${movement} (Avg.) (${defaultCurrency})`,
          amount: 0,
          months: 0,
          currency: defaultCurrency,
          status: 'N/A',
        },
      ];
    }

    //convert movement-currency object to an array of DataToRenderType
    const movementData = data[movement];
    if (!movementData) return [];
    return Object.entries(movementData).map(([currency, financialDatum]) => {
      const incomeFactor = movement === 'income' ? -1 : 1;
      return {
        amount: incomeFactor * (financialDatum?.monthlyAverage ?? 0),
        months: financialDatum?.monthCounter ?? 0,

        title: `Monthly ${movement} (Avg.) (${currency})`,
        currency: currency as CurrencyType,
        status: '% status',
      };
    });
  };
  // title: 'Monthly Income (Avg.)',

  const expense = convertMovementData('expense', data);
  const income = convertMovementData('income', data);
  const saving = convertMovementData('saving', data);

  // console.log('🚀 ~ MonthlyAverage ~ expense:', expense);
  // console.log('🚀 ~ MonthlyAverage ~ income:', income[0].amount);
  // console.log('🚀 ~ MonthlyAverage ~ saving:', saving[0].amount);

  //HACER ESTE RESPONSIVE lt 428 una cell , despues de 633 3 cells
  const renderCardFinancialData = (
    items: DataToRenderType[],
    movement: MovementType,
  ) => (
    <div className='monthly__card tile__container tile__container__col tile__container__col--goalInfo '>
      {items.map((item, indx) => (
        <article className='' key={indx}>
          <div className='tile__subtitle letterSpaceSmall '>{item.title}</div>
          <div className='tile__title '>
            {currencyFormat(item.currency, item.amount, formatNumberCountry)}
            {` (m:${item.months ?? 0})`}
          </div>
          <div className='monthlyAverage__year'>
            <span className='monthlyAverage__year-label'>Year to date</span>
            <span className='monthlyAverage__year-amount'>
              {yearToDate(movement)}
            </span>
          </div>

          <div className='tile__status__container flx-row-start '>
            <StatusSquare
              alert={0.5 - Math.random() < 0 ? 'alert' : ''} // temporary values needs to define rule to apply
            />
            <span className='tile__subtitle tile__status--goal'>
              {item.status}
            </span>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <div className='tiles__container flx-row-sb '>
      {/* Monthly info row */}
      {renderCardFinancialData(income, 'income')}
      {renderCardFinancialData(expense, 'expense')}
      {renderCardFinancialData(saving, 'saving')}
    </div>
  );
}

export default MonthlyAverage;
