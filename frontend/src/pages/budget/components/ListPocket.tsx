//ListPocket.tsx
import { Link } from 'react-router-dom';
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

const defaultPocket: PocketsToRenderType[] = [];

function ListPocket() {

  // const originRoute = useLocation().pathname;
  // const navigateTo: NavigateFunction = useNavigate();


  //DATA FETCHING
  //List Pocket - get accounts by type:pocket_saving

  const { apiData, isLoading, error } = useFetch<PocketListSummaryType>(
    `${url_summary_balance_ByType}?type=pocket_saving&user=${USER_ID}`
  );

  // console.log('🚀 ~ ListPocket ~ apiData:', apiData);

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
            // total_remaining,
          }) => ({
            pocketName: account_name,
            description: note ?? '',
            saved: total_balance,
            goal: total_target,
            currency: currency_code ?? DEFAULT_CURRENCY,
            // status:?,
            pocket_id: account_id,
          })
        )
      : defaultPocket;

  return (
    <article className='list__main__container'>
      {pocketList.map((pocket, indx) => {
        const { pocketName, description, saved, goal, currency, pocket_id } =
          pocket;
        return (
          <Link
            to={`pockets/:${pocket_id}`}
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
                <StatusSquare alert={saved - goal < 0 ? 'alert' : ''} />
              </div>
            </div>
          </Link>
        );
      })}
    </article>
  );
}

export default ListPocket;
