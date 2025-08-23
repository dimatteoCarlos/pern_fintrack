import AccountingBox from './components/AccountingBox';
import LeftArrowSvg from '../../assets/LeftArrowSvg.svg';
import { Link, useLocation } from 'react-router-dom';
import TopWhiteSpace from '../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { url_get_accounting_accounts } from '../../endpoints.ts';
import './styles/accounting-styles.css';
import { useMemo } from 'react';
import { useFetch } from '../../hooks/useFetch.ts';
import { AccountByTypeResponseType } from '../../types/responseApiTypes.ts';
import { capitalize } from '../../helpers/functions.ts';
import { ACCOUNTING_DEFAULT } from '../../helpers/constants.ts';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
// import { AccountingListType } from '../../types/types.ts';
// import { CurrencyType } from '../../types/types.ts';
// import { AccountByTypeResponseType } from '../../types/responseApiTypes.ts';
// import { useFetch } from '../../hooks/useFetch.ts';
// import { useMemo } from 'react';

// const ACCOUNTING_DEFAULT: AccountingListType[] = [];

function Accounting() {
  const location = useLocation();
  const previousRoute =
    location.state?.originRoute || '/fintrack/tracker/expense';
  const user =
    import.meta.env.VITE_USER_ID || 'eacef623-6fb0-4168-a27f-fa135de093e1';

  //DATA FETCHING -------------------------
  const { apiData, isLoading, error } = useFetch<AccountByTypeResponseType>(
    `${url_get_accounting_accounts}&user=${user}`
  );
  //--------------------------------------
  // console.log('accounting url:', `${url_get_accounting_accounts}&user=${user}`);
  
  const accounting = useMemo(() => {
    return !error && !isLoading && apiData?.data.accountList.length
      ? apiData.data.accountList.map((acc) => ({
          title: acc.account_name,
          amount: acc.account_balance,
          currency: acc.currency_code,
          account_type: `(${capitalize(acc.account_type_name).slice(0, 6)})`,
        }))
      : ACCOUNTING_DEFAULT;
  }, [error, isLoading, apiData?.data.accountList]);

  // console.log('accounting:', accounting)
  // const accounting = ACCOUNTING_DEFAULT

  return (
    <>
      <section className='accounting__layout'>
        <TopWhiteSpace variant={'dark'} />

        <div className='accounting__container'>
          {/* <Link to={'/tracker/expense'} className='accounting__header'> */}
          <Link to={previousRoute} className='accounting__header'>
            <div className='accounting__header--icon'>
              <LeftArrowSvg />
            </div>
            <div className='accounting__title'>{'Accounting'}</div>
          </Link>

          {isLoading && <CoinSpinner />}

          {!isLoading && accounting.map((balance, indx) => (
            <AccountingBox {...balance} key={`account-${indx}`} />
          ))}

        </div>
      </section>
    </>
  );
}

export default Accounting;
