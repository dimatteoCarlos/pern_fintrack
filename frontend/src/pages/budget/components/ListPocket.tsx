//ListPocket.tsx
// import { Link } from 'react-router-dom';
import { Link, } from 'react-router-dom';
// import { Link, NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import { StatusSquare } from '../../../general_components/boxComponents';
import {
  DEFAULT_CURRENCY,
  // DEFAULT_POCKET_LIST,
} from '../../../helpers/constants';
import {
  currencyFormat,
  numberFormatCurrency,
} from '../../../helpers/functions';
import { PocketsToRenderType } from '../../../types/types';
import { url_summary_balance_ByType, USER_ID } from '../../../endpoints.ts';
import {
  // BalancePocketRespType,
  // PocketListType,
  PocketListSummaryType,
} from '../../../types/responseApiTypes.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';

const defaultPocket: PocketsToRenderType[] = [{
    pocketName: 'pocket name',
    description: 'note',
    saved: 0,
    goal: 0,
    currency:DEFAULT_CURRENCY,
    pocket_id: 1,
    desired_date:new Date()
          }];
//================================================
function ListPocket({previousRoute}:{previousRoute:string}) {
console.log('originRoute', previousRoute)
  //DATA FETCHING
  //List Pocket - get accounts by type:pocket_saving
  const { apiData, isLoading, error } = useFetch<PocketListSummaryType>(
    `${url_summary_balance_ByType}?type=pocket_saving&user=${USER_ID}`
  );

  // console.log('🚀 ~ ListPocket ~ apiData:', apiData);
//mapping raw api resp to local variable pocketList
  const pocketList: PocketsToRenderType[] =
    apiData?.data && !isLoading && !error && apiData?.data.length
      ? apiData?.data.map(
          // (pocket:PocketListType)
          ({
            account_name,
            account_id,
            currency_code,
            total_balance,
            total_target,
            note,
            desired_date
          }) => ({
            pocketName: account_name,
            description: note ?? 'note',
            saved: total_balance,
            goal: total_target,
            currency: currency_code ?? DEFAULT_CURRENCY,
            pocket_id: account_id,
            desired_date
            // status:?,
          })
        )
      : defaultPocket;

  return (
    <article className='list__main__container'>
      {pocketList.map((pocket, indx) => {
        const { pocketName, description, saved, goal, currency, pocket_id,desired_date } =
          pocket;
        return (
          <Link
          to={`pockets/:${pocket_id}`}
          state={{pocketData:pocket, previousRoute}}
            className='card__tile__pocket line__container'
            key={`pockect-${indx}-${pocket_id}`}
          >
            {/* <PocketLeftTile> */}
            <div className='tile__left'>
              <div className='tile__title'>{pocketName}</div>
              <div className='tile__subtitle'>{`${description}`}</div>
              <div className='tile__subtitle'>{`(${ new Date(desired_date).toLocaleDateString('es-ES',{})})`}</div>
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
        
                <StatusSquare alert={(saved - goal) < 0 ? 'alert' : ''} />
              </div>
            </div>
          </Link>
        );
      })}
    </article>
  );
}

export default ListPocket;
