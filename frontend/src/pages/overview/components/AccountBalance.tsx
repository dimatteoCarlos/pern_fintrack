import { Link } from 'react-router-dom';
import { currencyFormat } from '../../../helpers/functions';
import { CardTitle } from '../../../general_components/CardTitle';
import { url_get_accounts_by_type } from '../../../endpoints';
import { useFetch } from '../../../hooks/useFetch';
import { ACCOUNT_DEFAULT, CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
// import { CurrencyType } from '../../../types/types';
import { AccountByTypeResponseType, AccountListType } from '../../../types/responseApiTypes';
import { useEffect, useState } from 'react';
// import { CreateNewAccountPropType } from '../Overview';
// import CoinSpinner from '../../../loader/coin/CoinSpinner';
// import OpenAddEditBtn from '../../../general_components/OpenAddEditBtn';
// export type AccountToRenderType = Omit<AccountListType,'account_type_id' > & {concept:string}

export type AccountPropType={previousRoute:string}

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
const concept = 'balance'

//-----------
function AccountBalance({
  // createNewAccount,
  previousRoute,
}:AccountPropType): JSX.Element {
  const user = import.meta.env.VITE_USER_ID;

  //--STATES---------------------
  const [bankAccountsToRender, setBankAccountsToRender] =
    useState<AccountListType[]>(ACCOUNT_DEFAULT);

  //DATA FETCHING
  const urlBankAccounts = `${url_get_accounts_by_type}/?type=bank&user=${user}`;
  const {
    apiData: bankAccountsData,
    isLoading,
    error,
  } = useFetch<AccountByTypeResponseType>(urlBankAccounts);

  useEffect(() => {
    function updateBankAccounts() {
      const newBankAccounts: AccountListType[] =
        bankAccountsData &&
        !isLoading &&
        !error &&
        !!bankAccountsData.data.accountList?.length
          ? bankAccountsData.data?.accountList?.map((acc, indx) => ({
              account_name: acc.account_name,
              concept: {concept}, 
              account_balance: acc.account_balance,
              account_type_name: acc.account_type_name,
              account_id: acc.account_id ?? indx,
              currency_code: acc.currency_code ?? defaultCurrency,
              account_start_date: acc.account_start_date ?? acc.created_at,
              account_type_id:acc.account_type_id ,

            }))
          : ACCOUNT_DEFAULT;

      setBankAccountsToRender(newBankAccounts);
    }
    //---
    updateBankAccounts();
  }, [bankAccountsData, isLoading, error]);


  console.log('accounts:', bankAccountsData, error, isLoading);

  if (isLoading) {
    return <span style={{color:'cyan', width:'100%', textAlign:'center'}}>Loading...</span>;
  }
//------------------------------
  return (
    <>
      {/*BANK ACCOUNTS  */}
      <div className='presentation__card__title__container flx-row-sb'>
     
        <CardTitle>Account Balance</CardTitle>
        <Link className='flx-col-center icon ' to={'edit'}></Link>
      </div>

      {/* cambiar el nombre de goals__account por bank o expense account*/}
      <article className='goals__account'>
        {/* Account Balance  */}
        {bankAccountsToRender.map((account) => {
          const { account_name, account_balance, account_type_name, account_id, currency_code } = account;
          {
            return (
              <Link
                to={`accounts/${account_id}`}
                state = {{previousRoute, detailedData:account}}
                className='tile__container tile__container--account flx-col-sb'
                key={`account-${account_id}`}
              >
                <div className='tile__subtitle tile__subtitle--account'>
                  {account_name} ({account_type_name})x
                </div>
                <div className='tile__title tile__title--account'>
                  {/* {concept}{' '} */}
                  {currencyFormat(
                    currency_code ?? defaultCurrency,
                    account_balance,
                    formatNumberCountry
                  )}
                </div>
              </Link>
            );
          }
        })}
      </article>

      {/* {
        <OpenAddEditBtn
          btnFunction={createNewAccount}
          btnFunctionArg={originRoute}
          btnPreviousRoute={originRoute}
        >
          <div className='open__btn__label'>Add Account</div>
        </OpenAddEditBtn>
      } */}
    </>
  );
}

export default AccountBalance;
