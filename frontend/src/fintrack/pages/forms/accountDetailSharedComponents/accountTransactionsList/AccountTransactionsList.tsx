//frontend/src/fintrack/pages/forms/accountDetailSharedComponents/accountTransactionsList/AccountTransactionsList.tsx

import {
  BoxContainer,
  BoxRow,
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

// A row the owner never annotated renders as this, never as blank space.
const DASH = '—';

type AccountTransactionsListPropsType = {
  transactions: AccountTransactionType[];
  // Optional on purpose: only the screen that mounts the detail modal passes it,
  // so the other three screens sharing this list stay inert.
  onTransactionClick?: (transactionId: number) => void;
};
//==================
//MAIN COMPONENT
//==================
const AccountTransactionsList = ({
  transactions,
  onTransactionClick,
}: AccountTransactionsListPropsType) => {
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
              description,
              note,
              account_balance_after_tr,
              // transaction_actual_date,
            } = item;

            const isClickable = Boolean(onTransactionClick);
            const openDetail = () => onTransactionClick?.(transaction_id);

            return (
              <BoxContainer
                key={transaction_id}
                className={`transaction-item ${
                  isClickable ? 'transaction-item--clickable' : ''
                }`.trim()}
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

                      {/* The date is still cut out of the narrative, so it is
                          the only half that depends on the narrative existing. */}
                      {description && (
                        <div className='paragraph'>
                          Date:{' '}
                          {(description.split('Date:')[1] || '')
                            .split('GMT')[0]
                            .trim()}
                        </div>
                      )}
                    </div>
                  </BoxRow>
                </BoxRow>

                {/* Balance after transacción */}
                <BoxRow>
                  <div className='box__title transaction-balance-after'>
                    Balance:{' '}
                    {currencyFormat(
                      currency_code,
                      account_balance_after_tr,
                      formatNumberCountry,
                    )}
                  </div>
                </BoxRow>
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
