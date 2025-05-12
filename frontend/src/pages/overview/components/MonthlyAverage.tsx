import { currencyFormat } from '../../../helpers/functions';
import { StatusSquare } from '../../../general_components/boxComponents';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { CurrencyType } from '../../../types/types';
import { ResultType, MovementType } from '../CalculateMonthlyAverage';

// Configuración por defecto
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

//Data to display type
type DataToRenderType = {
  title: string;
  amount: number;
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

function MonthlyAverage({ data }: { data: ResultType | null }) {
  //convert input data structure into data to render structure
  const convertMovementData = (
    movement: MovementType,
    data: ResultType | null
  ): DataToRenderType[] => {
    console.log(movement, data);

    if (
      data === null ||
      !data?.[movement] ||
      Object.keys(data[movement]!).length === 0
    ) {
      return [
        {
          title: `Monthly ${movement} (Avg.) (${defaultCurrency})`,
          amount: 0,
          currency: defaultCurrency,
          status: 'N/A',
        },
      ];
    }
    //convert movement-currency object to andarray of DataToRenderType
    return Object.entries(data[movement]).map(([currency, financialDatum]) => ({
      title: `Monthly ${movement} (Avg.) (${currency})`,
      amount: financialDatum.monthlyAverage || 0,
      currency: currency as CurrencyType,
      status: '% status',
    }));
  };
  // title: 'Monthly Income (Avg.)',

  const expense = convertMovementData('expense', data);
  const income = convertMovementData('income', data);
  const saving = convertMovementData('saving', data);
  console.log('🚀 ~ MonthlyAverage ~ expense:', expense);
  console.log('🚀 ~ MonthlyAverage ~ income:', income);
  console.log("🚀 ~ MonthlyAverage ~ saving:", saving)
  //HACER ESTE RESPONSIVE lt 428 una cell , despuesd e633 3 cells
  const renderCardFinancialData = (items: DataToRenderType[]) => (
    <div className='monthly__card tile__container tile__container__col tile__container__col--goalInfo '>
      {items.map((item, indx) => (
        <article className='' key={indx}>
          <div className='tile__subtitle letterSpaceSmall '>{item.title}</div>
          <div className='tile__title '>
            {currencyFormat(item.currency, item.amount, formatNumberCountry)}
          </div>
          <div className='tile__status__container flx-row-start '>
            <StatusSquare
              alert={0.5 - Math.random() < 0 ? 'alert' : ''} // Valores temporales hay que definir la funcion a aplicar
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
      {/* Monthly info left column */}
      {renderCardFinancialData(income)}
      {/* Monthly info right column */}
      {renderCardFinancialData(expense)}
      {renderCardFinancialData(saving)}
    </div>
  );
}

export default MonthlyAverage;
