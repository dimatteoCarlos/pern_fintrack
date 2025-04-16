import LogoMenuIcon from '../../general_components/header/LogoMenuIcon';
import TrackerNavbar from '../../general_components/trackerNavbar/TrackerNavbar';
import { Outlet } from 'react-router-dom';
import { currencyFormat } from '../../helpers/functions';

import './styles/tracker-style.css';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../helpers/constants';
import { useFetch } from '../../hooks/useFetch';
import { BalanceBankRespType } from '../../types/responseApiTypes';
import { url_get_total_account_balance_by_type } from '../../endpoints';
import CoinSpinner from '../../loader/coin/CoinSpinner';
import { MessageToUser } from '../../general_components/messageToUser/MessageToUser';
import { useEffect, useState } from 'react';

function TrackerLayout() {
  //temporary values------------
  const defaultCurrency = DEFAULT_CURRENCY;
  const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
  //---------------------------------
  //DATA FETCHING -------------------
  const user = import.meta.env.VITE_USER_ID;
  const { data, isLoading, error } = useFetch<BalanceBankRespType>(
    `${url_get_total_account_balance_by_type}/?type=bank&user=${user}`
  );

  //------states-----------
  const [availableBudget, setAvailableBudget] = useState(0);
  const [messageToUser, setMessageToUser] = useState<string | null | Error>('');

  useEffect(() => {
    if (data?.data.total_balance !== undefined) {
      setAvailableBudget(data?.data.total_balance ?? 0);
    }

    let timer: ReturnType<typeof setTimeout>;
    if (data && !isLoading && !error) {
      // Success response
      setMessageToUser(data.message || '');
      // console.log('Received data:', data);

      //resetting message to user
      timer = setTimeout(() => {
        setMessageToUser(null);
      }, 1000);
    } else if (error) {
      setMessageToUser(error);
      timer = setTimeout(() => setMessageToUser(null), 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [data, isLoading, error]);

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
            messageToUser={data?.message}
            error={error}
            variant={'tracker'}
          />
        )}
      </div>
    </>
  );
}

export default TrackerLayout;
