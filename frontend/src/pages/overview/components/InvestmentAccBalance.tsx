import { url_get_accounts_by_type } from '../../../endpoints';
import { StatusSquare } from '../../../general_components/boxComponents';
import { CardTitle } from '../../../general_components/CardTitle';
import {
  currencyFormat,
  numberFormatCurrency,
} from '../../../helpers/functions';
import { useFetch } from '../../../hooks/useFetch';

import { CreateNewAccountPropType } from '../Overview';
import OpenAddEditBtn from '../../../general_components/OpenAddEditBtn';
import { AccountByTypeResponseType } from '../../../types/responseApiTypes';
import { useEffect, useState } from 'react';
// import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { CurrencyType } from '../../../types/types';
import { DEFAULT_CURRENCY } from '../../../helpers/constants';

export type InvestmentAccountToRenderType = {
  id?: string | number;
  title1: string;
  subtitle1: string;
  title2: string;
  balance: number;
  capital: number;
  balanceType: string;
  type: string;
  currency: CurrencyType;
};
//--TEMPORARY VALUES
// const defaultCurrency = DEFAULT_CURRENCY;
// const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

//Investment account temporary data
const DEFAULT_INVESTMENT_ACC: InvestmentAccountToRenderType[] = [
  {
    title1: 'acc name',
    subtitle1: 'capital invested',
    title2: 'factual balance',
    capital: 500123,
    balance: 450012.0,
    balanceType: '% Loss',
    type: 'type',
    currency: 'eur',
  },
  {
    title1: 'acc name',
    subtitle1: 'capital invested',
    capital: 100000,
    balance: 111111,
    title2: 'factual balance',
    balanceType: '% Profit',
    currency: 'cop',
    type: 'type',
  },
  {
    title1: 'acc name',
    subtitle1: 'capital invested',
    capital: 2750000,
    balance: 3100000,
    title2: 'factual balance',
    balanceType: '% Profit',
    currency: 'usd',
    type: 'type',
  },
  {
    title1: 'acc name',
    subtitle1: 'capital invested',
    capital: 987654.55,
    balance: 870101.0,
    title2: 'factual balance',
    balanceType: '% Loss',
    currency: 'cop',
    type: 'type',
  },
];

//PENDIENTE DEFINIR REGLA DE NEGOCIO PARA VALORAR EL STATUS SQUARE Y PASAR EL ALERT
//questions: does status have some conditional or variable style? semaforo? cual es la regla de negocio?
//seems that balanceType has at least two possible values: loss / profit or earned
//capital could be the amount of the investment or not needed?
//factual balance is datum or calculated?
//DE DONDE SE TOMA EL CAPITAL INVESTED?
//-------------------------------------
function InvestmentAccountBalance({
  createNewAccount,
  originRoute,
}: CreateNewAccountPropType) {
  const user = import.meta.env.VITE_USER_ID;
  //STATES---------------------
  const [investmentAccountsToRender, setInvestmentAccountsToRender] = useState<
    InvestmentAccountToRenderType[]
  >(DEFAULT_INVESTMENT_ACC);

  //DATA FETCHING
  const urlInvestmentAccounts = `${url_get_accounts_by_type}/?type=investment&user=${user}`;
  const { apiData, isLoading, error } = useFetch<AccountByTypeResponseType>(
    urlInvestmentAccounts
  );
  // console.log('Investment_accounts:', data, error, isLoading);

  //-------------------------------------

  useEffect(() => {
    function updateInvestmentAccounts() {
      const newInvestmentAccounts: InvestmentAccountToRenderType[] =
        apiData && !isLoading && !error && !!apiData.data.accountList?.length
          ? apiData.data?.accountList?.map((acc, indx) => {
              const isProfit =
                acc.account_balance >= (acc.account_starting_amount ?? 0);
              const balanceType = isProfit ? '% Profit' : '% Loss';
              return {
                id: acc?.account_id ?? `${acc.account_name + '_' + indx}`,
                title1: acc.account_name,
                subtitle1: 'capital invested',
                title2: 'factual balance',
                balance: acc.account_balance,
                capital: acc.account_starting_amount ?? 0,
                balanceType: balanceType,
                type: acc.account_type_name,
                currency: acc.currency_code || DEFAULT_CURRENCY,
              };
            })
          : DEFAULT_INVESTMENT_ACC;

      setInvestmentAccountsToRender(newInvestmentAccounts);
    }
    //---
    updateInvestmentAccounts();
  }, [apiData, isLoading, error]);

  //-------------------------------------

  return (
    <>
      {/*GOALS INVESTMENT  */}
      <div className='presentation__card__title__container flx-row-sb'>
        <CardTitle>Investment</CardTitle>
      </div>

      <article className='goals__investment'>
        {/* Account Factual Balance  */}

        {investmentAccountsToRender!.map((investment, indx) => {
          const {
            title1,
            subtitle1,
            title2,
            balanceType,
            balance,
            capital,
            type,
            currency,
          } = investment;

          // console.log('🚀 ~ {investment.map ~ capital:', capital);

          {
            return (
              <div
                className='tile__container tile__container--investment flx-row-sb'
                key={`account-${indx}`}
              >
                <div className='tile__container__col tile__container__col--investment col--investment--left'>
                  <div className='tile__title tile__title--account'>
                    {title1} ({type})
                  </div>
                  <div className='tile__subtitle tile__subtitle--account'>
                    {subtitle1} :
                    <span className='tile__title tile__title--account'>
                      {currencyFormat(
                        currency,
                        capital
                        // ,
                        // formatNumberCountry
                      )}
                    </span>
                  </div>
                </div>

                <div className='tile__container__col tile__container__col--investment col--investment--right'>
                  <div className='tile__title  tile__title--account'>
                    <span style={{ fontWeight: 'normal' }}>{title2}:</span>{' '}
                    {numberFormatCurrency(balance, 0, currency)}
                  </div>
                  <div className='tile__status--investment--right '>
                    <StatusSquare
                      alert={balanceType == '% Loss' ? 'alert' : ''}
                    ></StatusSquare>
                    <div className='tile__subtitle subtitle__status__investment--right '>
                      <span style={{ color: 'black', fontSize: '0.875rem' }}>
                        {balanceType}{' '}
                        {Math.floor(
                          Math.abs(((balance - capital) * 100) / capital)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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

export default InvestmentAccountBalance;
