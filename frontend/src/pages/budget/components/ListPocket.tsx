//ListPocket.tsx
//parent:
import { Link, } from 'react-router-dom';
import { StatusSquare } from '../../../general_components/boxComponents';
import {
  DEFAULT_CURRENCY,
  // DEFAULT_POCKET_LIST,
} from '../../../helpers/constants';
import {
  currencyFormat,
  numberFormatCurrency,
} from '../../../helpers/functions';
import { url_summary_balance_ByType, USER_ID } from '../../../endpoints.ts';
import {
  // BalancePocketRespType,
  // PocketListType,
  PocketListSummaryType,
  PocketListType,
} from '../../../types/responseApiTypes.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';

//============================================
function ListPocket({previousRoute}:{previousRoute:string}) {
  // console.log('component', 'ListPocket')
// console.log('originRoute', previousRoute)

 //DATA FETCHING
 //List Pocket - get accounts by type:pocket_saving
  const { apiData, isLoading, error } = useFetch<PocketListSummaryType>(
    `${url_summary_balance_ByType}?type=pocket_saving&user=${USER_ID}`
  );
  // console.log('🚀 ~ ListPocket ~ apiData:', apiData);
  //----------
  const pocketList: PocketListType[] =
    apiData?.data && !isLoading && !error && apiData?.data.length
      ? apiData?.data
      : []//DEFAULT_POCKET_LIST;

      // console.log('apidata', pocketList)
//--------------------------------------------
  return (
    <article className='list__main__container '>
      {pocketList.map((pocket, indx) => {
        const { account_name, note, balance, target, currency_code, account_id,desired_date } =
          pocket;
          
        return (
          <Link
          to={`pockets/${account_id}`}
          state={{ previousRoute}}
            className='card__tile__pocket line__container'
            key={`pockect-${indx}-${account_id}`}
          >
            {/* <PocketLeftTile> */}
            <div className='tile__left'>
              <div className='tile__title'>{account_name}</div>
              <div className='tile__subtitle'>{`${note}`}</div>
              <div className='tile__subtitle'>{`(${new Date(desired_date).toLocaleDateString('es-ES',{})})`}</div>
            </div>

            {/* <PocketRightTile> */}
            <div className='tile__right'>
              <div className='tile__title'>
                saved:{' '}
                {currencyFormat(currency_code ?? DEFAULT_CURRENCY, balance, 'en-US')}
              </div>
              <div className='tile__subtitle flx-row-sb'>
                <span className='tile__subtitle tile__subtitle--opc'>
                  goal:{' '} 
                  {numberFormatCurrency(
                    target,
                    0,
                    currency_code ?? DEFAULT_CURRENCY,
                    'en-US'
                  )}
                  &nbsp;
                </span>
        
                <StatusSquare alert={(balance - target) < 0 ? 'alert' : ''} />
              </div>
            </div>
          </Link>
        );
      })}
    </article>
  );
}

export default ListPocket;
