//DebtsLayout.tsx
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader';
import Budget from './components/Budget';
import BudgetBigBoxResult from './components/BudgetBigBoxResult';
import './styles/budget-styles.css';

function BudgetLayout() {
  //temporary values------------
  //get the categories and pockets info from endpoints (unknowns yet):
  //data: from expenses? or budget movements, group the movements related to budget? by category, compare - total expenses from grouped or totalized expense movements - to  budget (this budget has to be attatched to a timestep or date, and so the expenses), then calculate the remaining and reder it. It is important to define the currency rules handling to follow when totalizing amounts of any kind.

  //yo diria que es tener el presupuesto total, y la distribucion del ppto en el tiempo, y comparar con los gastos totales y con los gastos distribuidos en el tiempo, es decir, comparar el plan vs. el real.

  // me imagino que hay que hacer los mismo con los pocket, solo que los pockets se muestran con cards, y sus movimientos van agrupados por pocket name, con su descripcion y el total ahorrado, y abajo el goal, y la comparacion estaria dada segun el color del square debajo de Saved, creo que se debe agregar los labels y al lado los valores.

  //establecer el procedimiento apra el manejo de distintas divisas, o currencies, sobre todo para los calculos agrupados, o totales.

  // const CURRENCY_OPTIONS = { usd: 'en-US', cop: 'cop-CO', eur: 'en-US' };
  // const defaultCurrency = 'usd';
  // const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

  // const resultAmount = 0;
  // const remaining = 0;
  // get for total balance,total budget and remaining, also the state and funtion to update the hese numbers, asn and passit to budget and its child components, for new category, also wehn creating a nuew caetegory, then summary categori list should be updated.bueno este ultimo se haria automatico, pus al regresar a la pagina se deberia renderizar , esaria la busquea en un useEffect? osea al regresar a la pagina todo se renderizaria de nuevo? o sin necesidad de que este en un useEffect?

  return (
    <>
      <div className='budgetLayout '>
        <div className='layout__header'>
          <div className='headerContent__container'>
            <TitleHeader></TitleHeader>
          </div>
        </div>
        <BudgetBigBoxResult />
        <Budget />
      </div>
    </>
  );
}

export default BudgetLayout;
