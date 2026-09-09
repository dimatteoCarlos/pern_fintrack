// frontend/src/pages/overview/components/AccountBalance.tsx
import { Link } from 'react-router-dom';
import { currencyFormat } from '../../../helpers/functions.ts';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
} from '../../../helpers/constants.ts';
import { AccountListType } from '../../../types/responseApiTypes.ts';
import PanelState from './PanelState.tsx';
import { PanelTotal } from '../../../general_components/panelTotal/PanelTotal.tsx';
import { useOverviewStore } from '../../../stores/useOverviewStore.ts';
import { monthLabel } from '../helpers/monthLabel.ts';
import { useEffect, useState } from 'react';

//----------------------------
// The card no longer fetches. Overview.tsx asks the route once for
// bank_and_investment and hands each card its own type, so the two cards that
// used to make one request each now share one.
export type AccountPropType = {
  previousRoute: string;
  // null while nothing has arrived; an empty array means the owner has no
  // account of this type, which is a different state and renders as nothing.
  accounts: AccountListType[] | null;
  isLoading: boolean;
  error: string | null;
  // Asks the shared accounts request again. Overview.tsx owns the fetch, so the
  // retry the error state offers has to come down with the state it belongs to.
  onRetry: () => void;
};

//--default values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
const concept = 'balance';

//----------------------------
function AccountBalance({
  previousRoute,
  accounts,
  isLoading,
  error,
  onRetry,
}: AccountPropType) {
  // THE TOTAL IS READ, NEVER SUMMED. hero.cashPosition is what the owner can
  // spend without selling a position or collecting a debt, computed by the page
  // statement at the close of the served month. Adding the tiles up here would
  // be a second answer to the same question, and the two part company the
  // moment the panel shows a different set of accounts than the figure covers.
  //
  // WHICH IS ALREADY TRUE, and it is stated rather than hidden: cashPosition
  // covers bank AND cash (makeHeroSection.js:207-211, D45), while this panel
  // lists only the bank accounts - the route it is fed from answers
  // bank_and_investment and cash is not in it (getAccountController.js:440).
  // No cash account can be created today, because the new-account form offers
  // bank, investment and income_source (ACCOUNT_TYPE_DEFAULT), so the two sets
  // coincide for every owner there is. The label names the wider one.
  const hero = useOverviewStore((state) => state.hero);
  const referenceMonth = useOverviewStore((state) => state.referenceMonth);
  const servedWindow = useOverviewStore((state) => state.window);

 //--STATES---------------------
  const [accountsToRender, setAccountsToRender] = useState<AccountListType[]>(
    [],
  );
  //------------------------------
  useEffect(() => {
    function updateAccounts() {
      const newBankAccounts: AccountListType[] =
        accounts && !isLoading && !error && !!accounts.length
          ? accounts.map((acc, indx) => ({
              account_id: acc.account_id ?? indx,
              account_name: acc.account_name,
              concept: { concept },
              account_balance: acc.account_balance,
              account_type_name: acc.account_type_name,
              currency_code: acc.currency_code ?? defaultCurrency,
              account_start_date: acc.account_start_date ?? acc.created_at,
              account_type_id: acc.account_type_id,
            }))
          : [];
      // ACCOUNT_DEFAULT
      setAccountsToRender(newBankAccounts);
    }
    //---
    updateAccounts();
  }, [accounts, isLoading, error]);

  // Loading and error both live in PanelState, which returns null when it has
  // nothing to say. The inline #fff this replaces was the only hardcoded colour
  // left in the block, and "Loading..." was a word where the rule asks for a
  // skeleton.
  if (isLoading || error) {
    return (
      <PanelState
        title='Account Balance'
        subject='Your bank accounts'
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
      />
    );
  }

  // An owner with no bank account is the third state and it is not an error, so
  // the panel renders nothing rather than a message about a failure.
  if (!accountsToRender.length) return null;

  // The tiles carry today's balance and the total carries the close of the
  // served month. For the month in course they are the same figure, because the
  // statement's upper bound is the start of next month and nothing has happened
  // past it. For an earlier month they are two different questions, so the
  // second clause is added only then.
  const totalNote =
    servedWindow && !servedWindow.isCurrentMonth
      ? `At the close of ${monthLabel(referenceMonth)} · the accounts below show today's balance`
      : `At the close of ${monthLabel(referenceMonth)}`;
  //--------
  return (
    <>
      {/*BANK ACCOUNTS  */}
      <div className='presentation__card__title__container flx-row-sb'>
        <CardTitle>Account Balance</CardTitle>
        <Link className='flx-col-center icon ' to={'edit'}></Link>
      </div>

      {/* Null until the page payload lands, which renders a dash: this panel
          and the payload are two requests and either can be first. */}
      <PanelTotal
        label='Bank and cash'
        amount={hero?.cashPosition ?? null}
        currency={hero?.currency ?? defaultCurrency}
        note={hero ? totalNote : null}
      />

      <article className='goals__account'>
        {/* Account Balance  */}
        {accountsToRender.map((account) => {
          const {
            account_name,
            account_balance,
            account_type_name,
            account_id,
            currency_code,
          } = account;
          {
            return (
              <Link
                to={`account/${account_id}`} //OverviewAccountReading.tsx -- singular, not AccountDetail.tsx's plural "accounts"
                state={{ previousRoute, detailedData: account }}
                className='tile__container tile__container--account flx-col-sb'
                key={`account-${account_id}`}
              >
                <div className='tile__subtitle tile__subtitle--account'>
                  {account_name} ({account_type_name})
                </div>

                <div className='tile__title tile__title--account'>
                  {/* {concept}{' '} */}
                  {currencyFormat(
                    currency_code ?? defaultCurrency,
                    account_balance,
                    formatNumberCountry,
                  )}
                </div>
              </Link>
            );
          }
        })}
      </article>
    </>
  );
}

export default AccountBalance;
