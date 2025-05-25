//DebtsLayout.tsx
import { useEffect, useMemo, useState } from 'react';
import { url_get_total_account_balance_by_type } from '../../endpoints';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader';
import { useFetch } from '../../hooks/useFetch';
import { BalanceCategoryRespType } from '../../types/responseApiTypes';
import Budget from './components/Budget';
import BudgetBigBoxResult from './components/BudgetBigBoxResult';
import './styles/budget-styles.css';
import CoinSpinner from '../../loader/coin/CoinSpinner';

function BudgetLayout() {
  //temporary values------------
  //get the categories and pockets info from endpoints (unknowns yet):
  //data: from expenses? or budget movements, group the movements related to budget? by category, compare - total expenses from grouped or totalized expense movements - to  budget (this budget has to be attatched to a timestep or date, and so the expenses), then calculate the remaining and reder it. It is important to define the currency rules handling to follow when totalizing amounts of any kind.

  //yo diria que es tener el presupuesto total, y la distribucion del ppto en el tiempo, y comparar con los gastos totales y con los gastos distribuidos en el tiempo, es decir, comparar el plan vs. el real. en un dASHBOADRD

  // me imagino que hay que hacer los mismo con los pocket, solo que los pockets se muestran con cards, y sus movimientos van agrupados por pocket name, con su descripcion y el total ahorrado, y abajo el goal, y la comparacion estaria dada segun el color del square debajo de Saved, creo que se debe agregar los labels y al lado los valores.

  //establecer el procedimiento apra el manejo de distintas divisas, o currencies, sobre todo para los calculos agrupados, o totales.

  // const CURRENCY_OPTIONS = { usd: 'en-US', cop: 'cop-CO', eur: 'en-US' };
  // const defaultCurrency = 'usd';
  // const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

  // const resultAmount = 0;
  // const remaining = 0;
  // get for total balance,total budget and remaining, also the state and funtion to update the hese numbers, asn and passit to budget and its child components, for new category, also wehn creating a nuew caetegory, then summary categori list should be updated.bueno este ultimo se haria automatico, pus al regresar a la pagina se deberia renderizar , esaria la busquea en un useEffect? osea al regresar a la pagina todo se renderizaria de nuevo? o sin necesidad de que este en un useEffect?

  const userId = import.meta.env.VITE_USER_ID;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const budgetUrl = `${url_get_total_account_balance_by_type}?type=category_budget&user=${userId}`;

  const { apiData, isLoading, error } =
    useFetch<BalanceCategoryRespType>(budgetUrl);

  useEffect(() => {
    if (error) {
      setErrorMessage(error);
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const { total_balance, total_budget, total_remaining, currency } =
    useMemo(() => {
      return {
        total_balance: apiData?.data.total_balance ?? 0,
        total_budget: apiData?.data.total_budget ?? 0,
        total_remaining: apiData?.data.total_remaining ?? 0,
        currency: apiData?.data.currency_code,
      };
    }, [
      apiData?.data.total_balance,
      apiData?.data.total_budget,
      apiData?.data.total_remaining,
      apiData?.data.currency_code,
    ]);

  // const bigScreenInfo = [
  const bigScreenInfo = [
    { title: 'total budget', amount: total_budget },
    { title: 'remaining', amount: total_remaining },
    { title: 'expenses', amount: total_balance },
  ];

  return (
    <>
      <div className='budgetLayout '>
        <div className='layout__header'>
          <div className='headerContent__container'>
            <TitleHeader></TitleHeader>
          </div>
        </div>

        {isLoading && (
          <div
            className='loader__container'
            style={{
              position: 'absolute',
              left: '50%',
              top: '20%',
              zIndex: '1',
            }}
          >
            <CoinSpinner />
          </div>
        )}

        <BudgetBigBoxResult bigScreenInfo={bigScreenInfo} currency={currency} />

        {error && (
          <p
            style={{
              color: 'red',
              position: 'absolute',
              top: '1.5%',
              left: '10%',
              zIndex: '150',
            }}
          >
            Error: {errorMessage}
          </p>
        )}
        <Budget />
      </div>
    </>
  );
}

export default BudgetLayout;
