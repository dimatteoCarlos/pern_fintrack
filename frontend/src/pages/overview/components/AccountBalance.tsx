import { Link } from 'react-router-dom';
import { currencyFormat } from '../../../helpers/functions';
import { CardTitle } from '../../../general_components/CardTitle';
import { CreateNewAccountPropType } from '../Overview';
import { url_get_accounts_by_type } from '../../../endpoints';
import { useFetch } from '../../../hooks/useFetch';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import OpenAddEditBtn from '../../../general_components/OpenAddEditBtn';
import { CurrencyType } from '../../../types/types';
import { AccountByTypeResponseType } from '../../../types/responseApiTypes';
import { useEffect, useState } from 'react';

type AccountToRenderType = {
  nameAccount: string;
  concept: string;
  balance: number;
  account_type?: string;
  type?: string;
  currency?: CurrencyType;
  id?: number;
  date?: Date; //starting_point
};

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

const ACCOUNT_DEFAULT: AccountToRenderType[] = [
  {
    nameAccount: 'acc name_1',
    concept: 'balance',
    balance: 0.932546,
    id: 2001,
    currency: 'cop',
    type: 'type1',
  },
  {
    nameAccount: 'acc name',
    concept: 'balance',
    balance: 9999999.99,
    id: 2002,
    type: 'type2',
  },
  {
    nameAccount: 'acc name',
    concept: 'balance', //field
    balance: 987654.365,
    id: 2003,
    type: 'type2',
    currency: 'eur',
  },
  {
    nameAccount: 'acc name',
    concept: 'balance',
    balance: 123456.02,
    id: 2004,
    type: 'usd',
  },
];

function AccountBalance({
  createNewAccount,
  originRoute,
}: CreateNewAccountPropType): JSX.Element {
  const user = import.meta.env.VITE_USER_ID;
  //STATES---------------------
  const [bankAccountsToRender, setBankAccountsToRender] =
    useState<AccountToRenderType[]>(ACCOUNT_DEFAULT);

  //DATA FETCHING
  //Creo que los data fetching deberian hacerse desde la pagina principal y pasar los props a los componentes.
  //por ahora pasar userId por params, pero deberia manejarse en el backend con auth
  //bank accounts balance
  const urlBankAccounts = `${url_get_accounts_by_type}/?type=bank&user=${user}`;
  const {
    data: bankAccountsData,
    isLoading,
    error,
  } = useFetch<AccountByTypeResponseType>(urlBankAccounts);

  useEffect(() => {
    function updateBankAccounts() {
      const newBankAccounts: AccountToRenderType[] =
        bankAccountsData &&
        !isLoading &&
        !error &&
        !!bankAccountsData.data.accountList?.length
          ? bankAccountsData.data?.accountList?.map((acc, indx) => ({
              nameAccount: acc.account_name,
              concept: 'balance', //it is important to know the data structure from backend
              balance: acc.account_balance,
              type: acc.account_type_name,
              id: acc.account_id ?? `${acc.account_name + '_' + indx}`,
              currency: acc.currency_code ?? defaultCurrency,
            }))
          : ACCOUNT_DEFAULT;

      setBankAccountsToRender(newBankAccounts);
    }
    //---
    updateBankAccounts();
  }, [bankAccountsData, isLoading, error]);

  // const { data, isLoading, error } =
  //   useFetch<ExpenseAccountsType>(url_accounts);
  console.log('accounts:', bankAccountsData, error, isLoading);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {/*EXPENSE ACCOUNTS  */}
      <div className='presentation__card__title__container flx-row-sb'>
        <CardTitle>Account Balance</CardTitle>
        <Link className='flx-col-center icon ' to={'edit'}></Link>
      </div>

      {/* cambiar el nombre de goals__account por bank o expense account*/}
      <article className='goals__account'>
        {/* Account Balance  */}
        {bankAccountsToRender.map((account) => {
          const { nameAccount, balance, type, id, currency } = account;
          {
            return (
              <Link
                to={`/overview/accounts/:${id}`}
                className='tile__container tile__container--account flx-col-sb'
                key={`account-${id}`}
              >
                <div className='tile__subtitle tile__subtitle--account'>
                  {nameAccount} ({type})
                </div>
                <div className='tile__title tile__title--account'>
                  {/* {concept}{' '} */}
                  {currencyFormat(
                    currency ?? defaultCurrency,
                    balance,
                    formatNumberCountry
                  )}
                </div>
              </Link>
            );
          }
        })}
      </article>

      {
        <OpenAddEditBtn
          btnFunction={createNewAccount}
          btnFunctionArg={originRoute}
          btnPreviousRoute={originRoute}
        >
          <div className='open__btn__label'>Add Account</div>
        </OpenAddEditBtn>
      }
    </>
  );
}

export default AccountBalance;
