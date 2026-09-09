// frontend\src\pages\overview\components\InvestmentAccBalance.tsx
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents.tsx';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import { currencyFormat } from '../../../helpers/functions.ts';
import { AccountListType } from '../../../types/responseApiTypes.ts';
import PanelState from './PanelState.tsx';
import { PanelTotal } from '../../../general_components/panelTotal/PanelTotal.tsx';
import { useOverviewStore } from '../../../stores/useOverviewStore.ts';
import { monthLabel } from '../helpers/monthLabel.ts';

import {
  //ACCOUNT_DEFAULT ,
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
} from '../../../helpers/constants.ts';

// The card no longer fetches. Overview.tsx asks the route once for
// bank_and_investment and hands each card its own type, so this card and
// AccountBalance.tsx share the request that each of them used to make.
type AccountPropType = {
  previousRoute: string;
  // null while nothing has arrived; an empty array means the owner holds no
  // investment account, which is a different state and renders as nothing.
  accounts: AccountListType[] | null;
  isLoading: boolean;
  error: string | null;
  // Asks the shared accounts request again. Overview.tsx owns the fetch, so the
  // retry the error state offers has to come down with the state it belongs to.
  onRetry: () => void;
};

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
const subtitle = 'Capital Invested';
const concept = 'Factual Balance';

// An account that arrives without a starting amount has no denominator, so the
// result is unknown rather than zero.
const DASH = '—';

//-------------------------------------
function InvestmentAccountBalance({
  previousRoute,
  accounts,
  isLoading,
  error,
  onRetry,
}: AccountPropType) {
  // THE TOTAL IS READ, NEVER SUMMED, for the reason AccountBalance.tsx states.
  // domainCards.investment.ledgerBalance is the sum of the derived balances of
  // the investment accounts at the close of the served month
  // (overviewInvestmentRepository.js:219), and it is the same set this panel
  // lists - the route filters on the account type and so does the statement.
  const investment = useOverviewStore((state) => state.domainCards?.investment);
  const referenceMonth = useOverviewStore((state) => state.referenceMonth);
  const servedWindow = useOverviewStore((state) => state.window);

  //--STATES---------------------
  const [investmentAccountsToRender, setInvestmentAccountsToRender] = useState<
    AccountListType[]
  >(
    //ACCOUNT_DEFAULT
    [],
  );
  //------------------------------
  useEffect(() => {
    function updateInvestmentAccounts() {
      const newInvestmentAccounts: AccountListType[] =
        accounts && !isLoading && !error && !!accounts.length
          ? accounts.map((acc, indx) => ({
              account_id: acc.account_id ?? indx,
              account_name: acc.account_name,
              concept: { concept },
              account_balance: acc.account_balance,
              // Carried, not dropped. getAccountController.js:352 serves it as
              // CAST(ua.account_starting_amount AS FLOAT); leaving it out of
              // this literal made capital undefined for every account, so the
              // card reported 0 % profit whatever the balance was.
              account_starting_amount: acc.account_starting_amount,
              account_type_name: acc.account_type_name,
              currency_code: acc.currency_code ?? defaultCurrency,
              account_start_date: acc.account_start_date ?? acc.created_at,
              account_type_id: acc.account_type_id,
            }))
          : [];
      //ACCOUNT_DEFAULT
      setInvestmentAccountsToRender(newInvestmentAccounts);
    }
    //---
    updateInvestmentAccounts();
  }, [accounts, isLoading, error]);

 // MAIN RENDER ----------------------
 // Loading and error both live in PanelState, which returns null when it has
 // nothing to say. Returning null on error was a dead end: no message, no way
 // back, and indistinguishable from an owner who holds no investment account.
  if (isLoading || error) {
    return (
      <PanelState
        title='Investment Accounts'
        subject='Your investment accounts'
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
      />
    );
  }

 // accounts is null until the one request Overview makes has answered, which is
 // the state this card used to read off its own apiData. An owner with no
 // investment account is the third state and renders nothing, because it is a
 // real answer and not a failure.
  if (!accounts || !investmentAccountsToRender.length) return null;

  // Same two clocks as the bank panel: the tiles hold today's balance and the
  // total holds the close of the served month, which are one figure for the
  // month in course and two questions for an earlier one.
  const totalNote =
    servedWindow && !servedWindow.isCurrentMonth
      ? `At the close of ${monthLabel(referenceMonth)} · the accounts below show today's balance`
      : `At the close of ${monthLabel(referenceMonth)}`;

  return (
    <>
      {/*ACCOUNTS  */}
      <div className='presentation__card__title__container flx-row-sb'>
       <CardTitle>Investment Accounts</CardTitle>
        <Link className='flx-col-center icon ' to={'edit'}></Link>
      </div>

      {/* Not "capital invested", which is the tile's own subtitle and a
          different figure: capitalContributed is what went in, this is what the
          accounts hold. */}
      <PanelTotal
        label='Accounts balance'
        amount={investment?.ledgerBalance ?? null}
        currency={investment?.currency ?? defaultCurrency}
        note={investment ? totalNote : null}
      />

      <article className='goals__investment'>
        {/* Account Factual Balance  */}
        {investmentAccountsToRender!.map((account) => {
          const {
            account_name,
            account_balance,
            account_type_name,
            account_id,
            currency_code,
            account_starting_amount,
          } = account;

          // Null and not 0: an account with no starting amount, or one opened
          // at zero, has nothing to measure the result against. Zero would
          // claim the account broke even.
          const capital = account_starting_amount;
          const balance = account_balance;

          let balanceType: 'Profit' | 'Loss' | null = null;
          let percentage: number | null = null;

          if (capital != null && capital !== 0) {
            balanceType = balance < capital ? 'Loss' : 'Profit';
            // The denominator takes the magnitude so a negative opening cannot
            // flip the sign of a result the name already carries.
            percentage = (Math.abs(balance - capital) / Math.abs(capital)) * 100;
          }

          //--RENDER LINK BUBBLE ---------
          {
            return (
              <Link
                to={`account/${account_id}`} //OverviewAccountReading.tsx -- singular, not AccountDetail.tsx's plural "accounts"
                state={{ previousRoute, detailedData: account }}
                className='tile__container tile__container--account flx-col-sb'
                key={`account-${account_id}`}
              >
                <div className='tile__container tile__container--investment flx-row-sb'>
                  <div className='tile__container__col tile__container__col--investment col--investment'>
                    <div className='tile__title tile__title--account'>
                      {account_name} ({account_type_name})
                    </div>

                    <div className='tile__subtitle tile__subtitle--account'>
                      {' '}
                      {subtitle}:
                      <span className='tile__title tile__title--account'>
                        {/* The capital, not the balance. This line published
                            account_balance, so the card printed the same
                            figure twice under two names and the percentage
                            beside it had no visible denominator. */}
                        {capital == null
                          ? DASH
                          : currencyFormat(
                              currency_code ?? defaultCurrency,
                              capital,
                              formatNumberCountry,
                            )}
                      </span>
                    </div>
                  </div>

                  <div className='tile__container__col tile__container__col--investment col--investment--right'>
                    <div className='tile__title  tile__title--account'>
                      <span style={{ fontWeight: 'normal' }}>{concept}:</span>{' '}
                      {currencyFormat(
                        currency_code ?? defaultCurrency,
                        account_balance,
                        formatNumberCountry,
                      )}
                    </div>

                    <div className='tile__status--investment--right '>
                      <StatusSquare
                        alert={balanceType === 'Loss' ? 'alert' : ''}
                      />
                      <div className='tile__subtitle subtitle__status__investment--right '>
                        <span style={{ color: 'black', fontSize: '0.875rem' }}>
                          {/* The sign was in front of the number and the
                              number had none: '% Profit' followed by 12 read
                              as a percent sign belonging to the word. */}
                          {percentage === null
                            ? DASH
                            : `${balanceType} ${Math.floor(percentage)} %`}
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
