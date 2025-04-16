//ListPocket.tsx

import { Link } from 'react-router-dom';
import { StatusSquare } from '../../../general_components/boxComponents';
import {
  DEFAULT_CURRENCY,
  DEFAULT_POCKET_LIST,
} from '../../../helpers/constants';
import {
  currencyFormat,
  numberFormatCurrency,
} from '../../../helpers/functions';
import { PocketsToRenderType } from '../../../types/types';

// import { useFetch } from '../../../hooks/useFetch.tsx';

function ListPocket() {
  //List Pocket
  //DATA FETCHING
  // const{ data, isLoading, error } = useFetch<PocketsType>(url_budget_pocket);//Data Fetching //Este endpoint no existe

  //temporary values
  const data: PocketsToRenderType[] = [],
    isLoading = false,
    error = null;

  const pocketList: PocketsToRenderType[] =
    !isLoading && !error && data?.length
      ? data?.map(
          ({ pocketName, description, saved, goal, currency, pocket_id }) => ({
            pocketName,
            description,
            saved,
            goal,
            currency,
            pocket_id,
          })
        )
      : DEFAULT_POCKET_LIST;

  // en el backend: generar la data segun estructura de los datos a renderizar, es decir,
  //agrupar para cada pocket el saved y el goal, de cada uno de los movimientos almacenados, la sumatoria de saved se refleja en el saved, ,  y el status seria el resultado de la resta entre el budget - expense de cada categoria, o si se prefiere reflejar el status de una vez, haciendo calculo en backend.
  //no estoy claro, si los valores o informacion se obtendra de los movimientos de expense realizados en cada categoria, seria desde backend.

  return (
    <article className='list__main__container '>
      {pocketList.map((pocket, indx) => {
        const { pocketName, description, saved, goal, currency, pocket_id } =
          pocket;
        return (
          <Link
            to={`/budget/pockets/:${pocket_id}`}
            className='card__tile__pocket line__container'
            key={`pockect-${indx}-${pocket_id}`}
          >
            {/* <PocketLeftTile> */}
            <div className='tile__left'>
              <div className='tile__title'>{pocketName}</div>
              <div className='tile__subtitle '>{description}</div>
            </div>

            {/* <PocketRightTile> */}
            <div className='tile__right'>
              <div className='tile__title'>
                saved:{' '}
                {currencyFormat(currency ?? DEFAULT_CURRENCY, saved, 'en-US')}
              </div>
              <div className='tile__subtitle flx-row-sb'>
                <span className='tile__subtitle tile__subtitle--opc'>
                  goal:{' '}
                  {/* {currencyFormat(currency ?? DEFAULT_CURRENCY, goal, 'en-US')}{' '} */}
                  {numberFormatCurrency(
                    goal,
                    0,
                    currency ?? DEFAULT_CURRENCY,
                    'en-US'
                  )}
                  &nbsp;
                </span>

                {/* {'definir regla de negocio, ejemplo: diferencia entre los montos saved y goal'} */}
                <StatusSquare alert={saved - goal <= 0 ? 'alert' : ''} />
              </div>
            </div>
          </Link>
        );
      })}
    </article>
  );
}

export default ListPocket;
