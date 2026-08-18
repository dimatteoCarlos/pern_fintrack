//frontend/src/fintrack/pages/forms/accountDetailSharedComponents/accountTransactionsList/AccountTransactionsList.tsx

import {
  BoxContainer,
  BoxRow,
  StatusSquare,
} from '../../../../general_components/boxComponents/BoxComponents';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  // DATE_TIME_FORMAT_DEFAULT,
} from '../../../../helpers/constants';
import {
  capitalize,
  currencyFormat,
  // isDateValid,
} from '../../../../helpers/functions';
import { AccountTransactionType } from '../../../../types/responseApiTypes';

import './styles/accountTransactionsList-styles.css';

// Configuración por defecto / default config
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

// What the row cannot state renders as this, never as blank space: a note the
// owner never wrote, or a date the server did not serve.
const DASH = '—';

type AccountTransactionsListPropsType = {
  transactions: AccountTransactionType[];
  // Optional on purpose: a screen with no detail to open leaves its rows inert
  // rather than rendering a control that answers nothing.
  onTransactionClick?: (transactionId: number) => void;
  // The month's budget, so a row can state its share of it. Only a category has
  // one, which is the same account type the server serves the accumulator for.
  monthBudget?: number;
};
//==================
//MAIN COMPONENT
//==================
const AccountTransactionsList = ({
  transactions,
  onTransactionClick,
  monthBudget,
}: AccountTransactionsListPropsType) => {
  // Only a positive budget is a budget: dividing by zero has no reading, and a
  // budget of zero would make the first spend of the month an overrun.
  const budget =
    typeof monthBudget === 'number' && monthBudget > 0 ? monthBudget : null;

  // The accumulator only ever adds, so a month crosses its budget once and
  // never comes back. The crossing is therefore the oldest row already past it,
  // and since the list runs newest first, it is the last one that qualifies.
  const crossingTransactionId =
    budget === null
      ? null
      : transactions.reduce<number | null>((crossing, item) => {
          const spent = item.month_cumulative_spent;
          return typeof spent === 'number' && spent > budget
            ? item.transaction_id
            : crossing;
        }, null);

  // const formatDate = (dateInput: Date | string | number): string => {
  //   const date = new Date(dateInput);
  //   return new Intl.DateTimeFormat(DATE_TIME_FORMAT_DEFAULT).format(date);
  // };

  return (
    <>
      <div className='list__main__container'>
        {transactions.length > 0 ? (
          transactions.map((item) => {
            const {
              transaction_id,
              movement_type_name,
              amount,
              currency_code,
              note,
              transaction_local_date,
              month_cumulative_spent,
              account_balance_after_tr,
              // transaction_actual_date,
            } = item;

            const isClickable = Boolean(onTransactionClick);
            const openDetail = () => onTransactionClick?.(transaction_id);

            // What share of the budget the month had consumed by this row. One
            // decimal, the same as the summary above the list, so the top row
            // and the summary read as the same figure and not as two.
            const spentShare =
              budget !== null && typeof month_cumulative_spent === 'number'
                ? (month_cumulative_spent / budget) * 100
                : null;

            const isCrossing = transaction_id === crossingTransactionId;

            return (
              <BoxContainer
                key={transaction_id}
                className={[
                  'transaction-item',
                  isClickable ? 'transaction-item--clickable' : '',
                  isCrossing ? 'transaction-item--overBudget' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={isClickable ? openDetail : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={
                  isClickable
                    ? (event) => {
                        // Space scrolls the page by default, which a row acting as
                        // a button must not do.
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openDetail();
                        }
                      }
                    : undefined
                }
              >
                <BoxRow className='transaction-header'>
                  <div className='box__title transaction-movement-type'>
                    {capitalize(movement_type_name)}
                  </div>

                  {/* {transaction_actual_date &&
                    isDateValid(transaction_actual_date) && (
                      <div className='box__subtitle'>
                        {formatDate(transaction_actual_date)}
                      </div>
                    )} */}

                  <div className='box__title' style={{ marginLeft: '0.8rem' }}>
                    {currencyFormat(currency_code, amount, formatNumberCountry)}
                  </div>
                </BoxRow>
                {/* Description */}
                <BoxRow>
                  <BoxRow>
                    <div
                      className='box__subtitle'
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '200',
                        lineHeight: '1rem',
                        letterSpacing: '1px',
                      }}
                    >
                      {/* The note alone, served already split from the
                          narrative. The row used to print the whole sentence
                          the server composes - account ids, account types and
                          the amount restated in the accounting currency. That
                          still exists and the detail modal still shows it.

                          Not capitalized: these are the owner's own words, and
                          the row is not the place to correct them. */}
                      <div className='paragraph'>{note ?? DASH}</div>

                      {/* Resolved in SQL on the account owner's calendar. The
                          row used to cut this out of the narrative, which broke
                          whenever the narrative did; deriving it here instead
                          would be worse, since the stored value is an instant
                          and would name the neighbouring day near midnight. */}
                      <div className='paragraph'>
                        Date: {transaction_local_date ?? DASH}
                      </div>
                    </div>
                  </BoxRow>
                </BoxRow>

                {/* Balance after transacción */}
                <BoxRow className='transaction-item__totals'>
                  <div className='transaction-item__figure'>
                    <span className='transaction-item__figureLabel'>
                      Balance
                    </span>
                    <div className='box__title transaction-balance-after'>
                      {currencyFormat(
                        currency_code,
                        account_balance_after_tr,
                        formatNumberCountry,
                      )}
                    </div>
                  </div>

                  {/* Only category_budget serves this, and only on the month
                      window. The line is omitted rather than dashed: an account
                      with no budget has no accumulated spend to withhold. How
                      far it accumulates is the Date the row already states. */}
                  {typeof month_cumulative_spent === 'number' && (
                    <div className='transaction-item__figure'>
                      <span className='transaction-item__figureLabel'>
                        Accumulated spent
                      </span>
                      <div className='transaction-item__accumulated-spent'>
                        {currencyFormat(
                          currency_code,
                          month_cumulative_spent,
                          formatNumberCountry,
                        )}
                        {spentShare !== null && ` (${spentShare.toFixed(1)}%)`}
                      </div>
                    </div>
                  )}
                </BoxRow>

                {/* Only on the row that crossed, not on every row above it:
                    that the month ended over budget is what the summary says,
                    and which movement broke it is what only this row can. */}
                {isCrossing && (
                  <BoxRow className='transaction-item__breakRow'>
                    <div className='transaction-item__budgetBreak'>
                      <StatusSquare alert='alert' />
                      Budget exceeded here
                    </div>
                  </BoxRow>
                )}
              </BoxContainer>
            );
          })
        ) : (
          <p className='no-transactions'>No transactions found</p>
        )}
      </div>
    </>
  );
};

export default AccountTransactionsList;
