import LogoMenuIcon from '../../general_components/header/LogoMenuIcon';
import TrackerNavbar from '../../general_components/trackerNavbar/TrackerNavbar';
import { Outlet } from 'react-router-dom';
import { currencyFormat } from '../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../helpers/constants';
import { useFetch } from '../../hooks/useFetch';
import { BalanceBankRespType } from '../../types/responseApiTypes';
import { url_get_total_account_balance_by_type } from '../../endpoints';
import CoinSpinner from '../../loader/coin/CoinSpinner';
import { MessageToUser } from '../../general_components/messageToUser/MessageToUser';
import { useEffect, useState } from 'react';
import './styles/tracker-style.css';
import useBalanceStore from '../../stores/useBalanceStore';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
//------------------------------
function TrackerLayout() {
  const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
  //---------------------------------

  //------states---------------------
  const [messageToUser, setMessageToUser] = useState<string | null | Error>(
    null
  );
  //---store states
  const availableBudget = useBalanceStore((state) => state.availableBudget);
  const setAvailableBudget = useBalanceStore((state) => state.setAvailableBudget);

  //-----------------------------------

  //DATA FETCHING -------------------
  const user = import.meta.env.VITE_USER_ID;
  const userId = user;

  // const userId = useAuthStore((state) => state.userData?.userId);
  console.log('🚀 ~ TrackerLayout ~ userId:', userId);

  const { apiData, isLoading, error, status } = useFetch<BalanceBankRespType>(
    `${url_get_total_account_balance_by_type}/?type=bank&user=${userId}`
  );

  console.log(
    'http status code',
    status,
    'data',
    apiData,
    isLoading,
    'error',
    error,
    'user',
    userId
  );

  useEffect(() => {
    if (apiData?.data.total_balance !== undefined) {
      setAvailableBudget(apiData.data.total_balance ?? 0);
    }
  }, [apiData,setAvailableBudget]);

  useEffect(() => {

    let timer: ReturnType<typeof setTimeout>;
    if (apiData && !isLoading && !error) {
      // Success response
      setMessageToUser(apiData.message || '');
      // console.log('Received data:', data);

      //resetting message to user
      timer = setTimeout(() => {
        setMessageToUser(null);
      }, 3000);
    } else if (error) {
      setMessageToUser(error);
      timer = setTimeout(() => setMessageToUser(null), 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [apiData, isLoading, error]);

  return (
    <>
      {/* <div className='trackerLayout bordered'> */}
      <div className='layout__header'>
        <div className='headerContent__container '>
          <LogoMenuIcon />
          <div className={`displayScreen ${'light'}`}>
            {isLoading && (
              <div className='tracker-layout-container'>
                <CoinSpinner />
              </div>
            )}

            <div className={`displayScreen--concept ${'dark'}`}>
              {'Available Budget'}
            </div>
            <div className={`displayScreen--result ${'dark'}`}>
              {currencyFormat(
                defaultCurrency,
                availableBudget,
                formatNumberCountry
              )}
            </div>
          </div>
        </div>
      </div>

      <TrackerNavbar />
      <div className='cards__presentation--tracker'>
        <Outlet />
        {messageToUser && (
          <MessageToUser
            isLoading={isLoading}
            messageToUser={apiData?.message}
            error={error}
            variant={'tracker'}
          />
        )}
      </div>
    </>
  );
}

export default TrackerLayout;
