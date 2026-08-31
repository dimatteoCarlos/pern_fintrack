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
import { BUDGET_NEAR_LIMIT_PERCENT } from '../../../../helpers/budgetStatus';
import {
  capitalize,
  currencyFormat,
  formatDateToDDMMYYYY,
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

// Which way a movement moved the account, for the colour that reinforces the
// sign. Coerced rather than type-tested: an amount can reach here as text, the
// way every DECIMAL column node-postgres serves does, and a figure the answer
// did not carry must colour as nothing rather than as an outflow.
const amountDirection = (amount: number | string | null | undefined) => {
  const value = amount === null || amount === undefined ? NaN : Number(amount);

  if (Number.isNaN(value) || value === 0) return 'flat';

  return value > 0 ? 'in' : 'out';
};

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
  // Zero IS a budget, and spending against it IS an overrun — the summary above
  // this list says exactly that, with the served isOverBudget and a red square.
  // Requiring a positive one here made the rows contradict it: the panel read
  // "Over $43.71" while no row admitted to having crossed anything.
  //
  // What zero really lacks is a denominator, and that is a separate question,
  // settled at spentShare below. The two were one test, so the missing
  // percentage took the marker down with it.
  const budget =
    typeof monthBudget === 'number' && monthBudget >= 0 ? monthBudget : null;

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

  // The other half of the same story. The list said where the month broke but
  // never where it started to be at risk, so a month that ends under budget
  // reads exactly like one that never came close.
  //
  // Same technique for the same reason: the accumulator only adds, so the
  // threshold is crossed once and the oldest qualifying row is the crossing.
  //
  // A zero budget is excluded here although it is included above: 75% of zero
  // is zero, so every row would qualify and the marker would state nothing.
  // Spending against zero is still a real overrun, which is why the row above
  // keeps it — the proximity is what has no meaning, not the excess.
  const nearThreshold =
    budget !== null && budget > 0
      ? budget * (BUDGET_NEAR_LIMIT_PERCENT / 100)
      : null;

  const nearTransactionId =
    nearThreshold === null
      ? null
      : transactions.reduce<number | null>((near, item) => {
          const spent = item.month_cumulative_spent;
          return typeof spent === 'number' && spent >= nearThreshold
            ? item.transaction_id
            : near;
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
              transaction_local_time,
              month_cumulative_spent,
              account_balance_after_tr,
              // transaction_actual_date,
            } = item;

            const isClickable = Boolean(onTransactionClick);
            const openDetail = () => onTransactionClick?.(transaction_id);

            // What share of the budget the month had consumed by this row. One
            // decimal, the same as the summary above the list, so the top row
            // and the summary read as the same figure and not as two.
            //
            // A budget of zero has no share: the division yields Infinity, and
            // the row would print '(Infinity%)'. Withheld the same way the
            // server withholds executionPercentage over the same denominator.
            const spentShare =
              budget !== null &&
              budget > 0 &&
              typeof month_cumulative_spent === 'number'
                ? (month_cumulative_spent / budget) * 100
                : null;

            const isCrossing = transaction_id === crossingTransactionId;

            // A row that jumps straight past the budget is the crossing and
            // nothing else. Marking it twice would print two verdicts on one
            // movement, and the overrun is the one that matters.
            const isNear = transaction_id === nearTransactionId && !isCrossing;

            return (
              <BoxContainer
                key={transaction_id}
                className={[
                  'transaction-item',
                  isClickable ? 'transaction-item--clickable' : '',
                  isCrossing ? 'transaction-item--overBudget' : '',
                  isNear ? 'transaction-item--nearBudget' : '',
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

                  {/* The sign STAYS. These rows are deltas that accumulate
                      against the opening balance above them, so the sign is the
                      operator of that sum and the owner needs it to check the
                      total against the movements. The colour only reinforces
                      it — the opposite of the debtor row, where the direction is
                      written in words and the colour replaces the sign. */}
                  <div
                    className={`box__title transactionRow__amount--${amountDirection(
                      amount,
                    )}`}
                    style={{ marginLeft: '0.8rem' }}
                  >
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
                        {/* Day and hour both resolved by the server on the
                            owner's calendar, so the two halves of this stamp
                            cannot name different days. The time is omitted, not
                            dashed: a row that predates the column still has a
                            date worth reading. */}
                        Date:{' '}
                        {transaction_local_date
                          ? `${formatDateToDDMMYYYY(transaction_local_date)}${
                              transaction_local_time
                                ? ` · ${transaction_local_time}`
                                : ''
                            }`
                          : DASH}
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
                        {/* Coloured by the same rule as the summary above the
                            list: past the budget is red, short of it is teal.
                            One fact, one reading, wherever it is printed. */}
                        {spentShare !== null && (
                          <>
                            {' '}
                            <span
                              className={`transaction-item__spentShare ${
                                spentShare > 100
                                  ? 'transaction-item__spentShare--over'
                                  : 'transaction-item__spentShare--left'
                              }`}
                            >
                              ({spentShare.toFixed(1)}%)
                            </span>
                          </>
                        )}
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

                {/* The percentage is read from the constant, not written into
                    the sentence: the threshold is a business rule and it lives
                    in budgetStatus.ts, where the square and the pill read it
                    from too. */}
                {isNear && (
                  <BoxRow className='transaction-item__nearRow'>
                    <div className='transaction-item__budgetNear'>
                      <StatusSquare alert='warning' />
                      {BUDGET_NEAR_LIMIT_PERCENT}% of budget reached here
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
