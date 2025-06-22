//InvestmentAccBalance.tsx
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { url_get_accounts_by_type } from '../../../endpoints';
import { StatusSquare } from '../../../general_components/boxComponents';
import { CardTitle } from '../../../general_components/CardTitle';
import {currencyFormat} from '../../../helpers/functions';
import { useFetch } from '../../../hooks/useFetch';
import { AccountByTypeResponseType, AccountListType } from '../../../types/responseApiTypes';

import { ACCOUNT_DEFAULT , CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';

type AccountPropType={previousRoute:string, accountType:string}

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
const subtitle = 'Capital Invested'
const concept = 'Factual Balance'

//-------------------------------------
function InvestmentAccountBalance({
  previousRoute,accountType
}: AccountPropType) {
  const user = import.meta.env.VITE_USER_ID;

 //--STATES---------------------
  const [investmentAccountsToRender, setInvestmentAccountsToRender] = useState<AccountListType[]>(ACCOUNT_DEFAULT)

  //DATA FETCHING
  const urlInvestmentAccounts = `${url_get_accounts_by_type}/?type=${accountType}&user=${user}`;

  const { apiData, isLoading, error } = useFetch<AccountByTypeResponseType>(
    urlInvestmentAccounts
  );
  // console.log('Investment_accounts:', data, error, isLoading);
  //------------------------------
  useEffect(() => {
    function updateInvestmentAccounts() {
      const newInvestmentAccounts:AccountListType[] =
        apiData && !isLoading && !error && !!apiData.data.accountList?.length
          ? apiData.data?.accountList?.map((acc, indx) => 
             ({
          account_id: acc.account_id ?? indx,
          account_name: acc.account_name,
          concept: {concept}, 
          account_balance: acc.account_balance,
          account_type_name: acc.account_type_name,
          currency_code: acc.currency_code ?? defaultCurrency,
          account_start_date: acc.account_start_date ?? acc.created_at,
          account_type_id:acc.account_type_id ,
           }))
           : ACCOUNT_DEFAULT;
      setInvestmentAccountsToRender(newInvestmentAccounts);
    }
  //---
    updateInvestmentAccounts();
  }, [apiData, isLoading, error]);

    console.log('accounts:', apiData, error, isLoading);

    // if (isLoading) {
    // return <span style={{color:'cyan', width:'100%', textAlign:'center'}}>Loading...</span>;  }
  //-------------------------------------
  return (
    <>
      {/*ACCOUNTS  */}
      <div className='presentation__card__title__container flx-row-sb'>
        <CardTitle>Investment</CardTitle>
        <Link className='flx-col-center icon ' to={'edit'}></Link>
      </div>

      <article className='goals__investment'>
        {/* Account Factual Balance  */}
        {investmentAccountsToRender!.map((account) => {
        const { account_name, account_balance, account_type_name,account_id, currency_code,account_starting_amount } = account;
        // console.log('🚀 ~ {investment.map ~ capital:', capital);
         const capital = account_starting_amount ?? 0;
         const balance = account_balance;
         let balanceType, percentage;
            if(capital !==0){
            if (balance > capital) {
              balanceType = '% Profit';
              percentage = ((balance - capital) / capital) * 100;
            } else if (balance < capital) {
              balanceType = '% Loss';
              percentage = ((capital - balance) / capital) * 100; 
            } else {
              balanceType = '% Profit'; // Si es igual, es 0% de ganancia
              percentage = 0;
            }}else{balanceType = '% Profit'; 
              percentage = 0;}
          
          console.log(balance, capital, percentage)
          //-----------------------------------------
          {
            return (
            <Link
              to={`accounts/${account_id}`} //AccountDetail.tsx
              state = {{previousRoute, detailedData:account}}
              className='tile__container tile__container--account flx-col-sb'
              key={`account-${account_id}`}
              >
              <div
                className='tile__container tile__container--investment flx-row-sb'
              >
              <div className='tile__container__col tile__container__col--investment col--investment--left'>
                <div className='tile__title tile__title--account'>
                  {account_name} ({account_type_name})
                </div>

                <div className='tile__subtitle tile__subtitle--account'> {subtitle}:<span className='tile__title tile__title--account'>
                  {currencyFormat(currency_code ?? defaultCurrency,account_balance,formatNumberCountry)}</span>
                </div>
              </div>

              <div className='tile__container__col tile__container__col--investment col--investment--right'>
                <div className='tile__title  tile__title--account'>
                 <span style={{ fontWeight: 'normal' }}>{concept}:</span>{' '}
                  {currencyFormat(currency_code ?? defaultCurrency,account_balance,formatNumberCountry)}
                </div>
                
                <div className='tile__status--investment--right '>
                 <StatusSquare
                      alert={balanceType == '% Loss' ? 'alert' : ''}
                 />
                  <div className='tile__subtitle subtitle__status__investment--right '>
                    <span style={{ color: 'black', fontSize: '0.875rem' }}>
                      {balanceType}{' '}
                      {Math.floor((percentage))}
                      </span>
                    </div>
                  </div>
                  </div>
                </div>
              </Link>
            );
          }
        })}
      </article>
    </>
  );
}

export default InvestmentAccountBalance;
