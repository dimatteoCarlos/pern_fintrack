Excellent! Having your parent component (`AccountDetail`) is key to a seamless integration. I see you're using `react-router-dom` for navigation, `useFetch` for data fetching, and have a good set of helper functions and UI components already in place.

Here's how we'll integrate the `AccountBalanceSummary` and `AccountTransactionsList` components into your `AccountDetail` component, keeping your existing structure and adapting where necessary:

---

### Key Changes and Adaptations

1.  **Data Flow for Transactions:**
    * You're already fetching `transactionsAccountIdData` using `useFetch`. We'll use this data directly.
    * We'll introduce `useState` hooks for `summary` and `transactions` (from `transactionsAccountIdData.data`) to manage them once the API data is available. This aligns with your previous request.
2.  **Replacing `ListContent`:**
    * Your existing `ListContent` component is designed for `LastMovementType[]`. We'll replace its usage with `AccountTransactionsList`, which is specifically typed for `Transaction[]`.
    * The "Last Movements" `CardTitle` will remain as the section header for the new transaction list.
3.  **Integrating `AccountBalanceSummary`:**
    * The `AccountBalanceSummary` component will be placed prominently, likely after the main account details and before the transaction list, to display the initial and final balances for the period.
4.  **Styling Consistency:**
    * We'll ensure the `AccountTransactions.css` styles complement your existing `forms-styles.css` and the global CSS. The main container for the statement (`account-transactions__container`) will wrap the relevant parts of your form section, as it holds the summary and transactions.
5.  **Date Formatting:** We'll ensure `formatDateToDDMMYYYY` (from your `utils.ts` or `helpers/functions.ts` as you now indicate) is used for all dates within the transaction statement.

---

### Updated Components

First, ensure your `types.ts` and `utils.ts` (or `helpers/functions.ts`) files are set up as discussed in the previous turn.

* `types.ts`: Should contain `BalanceInfo`, `Summary`, `Transaction`, `TransactionData`, and `TransactionsAccountApiResponseType`.
* `helpers/functions.ts`: Should contain `formatDateToDDMMYYYY`, `capitalize`, `truncateText`, `currencyFormat`, and `numberFormatCurrency`. (Note: I've updated `currencyFormat` and `numberFormatCurrency` to use a single source if possible, but I'll stick to what you currently import from `helpers/functions`.)

---

### `AccountBalanceSummary.tsx` (No Changes)

This component remains the same as provided previously.

```tsx
// src/components/AccountBalanceSummary.tsx
import React from 'react';
import { BalanceInfo } from '../types/responseApiTypes'; // Adjust path if needed
import { formatDateToDDMMYYYY } from '../helpers/functions'; // Assuming utils or functions

interface AccountBalanceSummaryProps {
  initialBalance: BalanceInfo;
  finalBalance: BalanceInfo;
}

const AccountBalanceSummary: React.FC<AccountBalanceSummaryProps> = ({
  initialBalance,
  finalBalance,
}) => {
  return (
    <div className="balance-summary__container">
      <div className="balance-summary__item">
        <span className="balance-summary__label">Initial Balance:</span>
        <span className="balance-summary__value">
          {initialBalance.currency.toUpperCase()} {initialBalance.amount.toFixed(2)}
        </span>
        <span className="balance-summary__date">
          ({formatDateToDDMMYYYY(initialBalance.date)})
        </span>
      </div>
      <div className="balance-summary__item">
        <span className="balance-summary__label">Final Balance:</span>
        <span className="balance-summary__value">
          {finalBalance.currency.toUpperCase()} {finalBalance.amount.toFixed(2)}
        </span>
        <span className="balance-summary__date">
          ({formatDateToDDMMYYYY(finalBalance.date)})
        </span>
      </div>
    </div>
  );
};

export default AccountBalanceSummary;
```

---

### `AccountTransactionsList.tsx` (Your `ListContent` Adapted)

This component will now specifically render `Transaction` types.

```tsx
// src/general_components/listContent/AccountTransactionsList.tsx (or similar path)
import React from 'react';
import { Transaction } from '../../types/responseApiTypes'; // Import the Transaction type
import {
  capitalize,
  truncateText,
  currencyFormat, // Ensure currencyFormat is available
  formatDateToDDMMYYYY, // Your specific date formatter for dd-mm-yyyy
} from '../../helpers/functions';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
} from '../../helpers/constants'; // Your constants

import { BoxContainer, BoxRow } from '../../components/boxComponents'; // Your Box components

// Configuration por defecto
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency]; // This needs CURRENCY_OPTIONS to be an object with country codes

interface AccountTransactionsListProps {
  transactions: Transaction[]; // Now receives an array of Transaction
}

const AccountTransactionsList: React.FC<AccountTransactionsListProps> = ({ transactions }) => {
  return (
    <>
      <div className="list__main__container">
        {transactions.length > 0 ? (
          transactions.map((transaction, indx) => {
            const {
              movement_type_name,
              amount,
              currency_code,
              transaction_actual_date,
              description,
              account_balance_after_tr,
            } = transaction;

            // Convert amount and balance to numbers for formatting
            const parsedAmount = parseFloat(amount);
            const parsedBalanceAfterTr = parseFloat(account_balance_after_tr);

            return (
              <BoxContainer key={indx} className="transaction-item">
                {/* Encabezado: Movement Type, Amount y Date */}
                <BoxRow className="transaction-header">
                  <div className="box__title transaction-movement-type">
                    {capitalize(movement_type_name)}
                  </div>
                  <div className="box__title transaction-amount">
                    {currencyFormat(currency_code, parsedAmount, formatNumberCountry)}
                  </div>
                  <div className="box__subtitle transaction-date">
                    {formatDateToDDMMYYYY(transaction_actual_date)}
                  </div>
                </BoxRow>

                {/* Descripción */}
                <BoxRow>
                  <div
                    className="box__subtitle transaction-description"
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: '200',
                      lineHeight: '1rem',
                      letterSpacing: '1px',
                      textTransform: 'none',
                    }}
                  >
                    {truncateText(capitalize(description), 150)}
                  </div>
                </BoxRow>

                {/* Balance después de la transacción */}
                <BoxRow>
                  <div className="box__subtitle transaction-balance-after">
                    Balance After Transaction:{' '}
                    {currencyFormat(
                      currency_code,
                      parsedBalanceAfterTr,
                      formatNumberCountry
                    )}
                  </div>
                </BoxRow>
                {/* This is the dashed line separator between transactions */}
                <div className="transaction-separator"></div>
              </BoxContainer>
            );
          })
        ) : (
          <p className="no-transactions">No transactions found for this period.</p>
        )}
      </div>
    </>
  );
};

export default AccountTransactionsList;
```

---

### `AccountDetail.tsx` (Your Parent Component - **Modified**)

Here's the main integration within your `AccountDetail` component.

```tsx
import { Link, useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import { CardTitle } from '../../../general_components/CardTitle';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge';
import {
  ACCOUNT_DEFAULT,
  DEFAULT_CURRENCY,
  VARIANT_FORM,
} from '../../../helpers/constants';
import { capitalize, formatDate, numberFormatCurrency, formatDateToDDMMYYYY } from '../../../helpers/functions'; // Ensure formatDateToDDMMYYYY is imported
import '../styles/forms-styles.css';
import { AccountByTypeResponseType, AccountListType, TransactionsAccountApiResponseType, Summary, Transaction } from '../../../types/responseApiTypes'; // Import necessary types
import { url_get_account_by_id, url_get_transactions_by_account_id } from '../../../endpoints';
import { useFetch } from '../../../hooks/useFetch';

// NEW IMPORTS FOR TRANSACTION STATEMENT
import AccountBalanceSummary from '../../components/AccountBalanceSummary'; // Adjust path
import AccountTransactionsList from '../../general_components/listContent/AccountTransactionsList'; // Adjust path to your new component

const user = import.meta.env.VITE_USER_ID;

type LocationStateType = {
  previousRoute: string;
  detailedData: AccountListType;
};

// temporary datas (used if API data is not available or for initial state)
const initialAccountDetail = ACCOUNT_DEFAULT[0];
const DEFAULT_TRANSACTIONS_DATA: TransactionsAccountApiResponseType['data'] = {
  "totalTransactions": 0,
  "summary": {
    "initialBalance": { "amount": 0, "date": new Date().toISOString(), "currency": DEFAULT_CURRENCY },
    "finalBalance": { "amount": 0, "date": new Date().toISOString(), "currency": DEFAULT_CURRENCY },
    "periodStartDate": formatDateToDDMMYYYY(new Date().toISOString()), // Use your function
    "periodEndDate": formatDateToDDMMYYYY(new Date().toISOString()),   // Use your function
  },
  "transactions": [],
};

function AccountDetail() {
  const location = useLocation();
  const state = location.state as LocationStateType | null;
  const detailedDataFromState = state?.detailedData; // Renamed to avoid conflict
  const previousRouteFromState = state?.previousRoute ?? "/";
  const { accountId } = useParams<{ accountId: string }>(); // Specify type for useParams

  // --states
  const [accountDetail, setAccountDetail] = useState<AccountListType>(initialAccountDetail);
  const [previousRoute, setPreviousRoute] = useState<string>("/fintrack/overview");

  // States for transaction data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>(DEFAULT_TRANSACTIONS_DATA.summary);

  //-------------------------------------
  // Fetch Data
  const urlBankAccountById = `${url_get_account_by_id}/${accountId}?&user=${user}`;
  const {
    apiData: bankAccountsData,
    isLoading,
    error,
  } = useFetch<AccountByTypeResponseType>(
    detailedDataFromState ? "" : urlBankAccountById // Only fetch if not coming from state
  );
  //-----
  // Define start and end dates for transaction query. You might want to make these dynamic
  // For now, let's use some fixed or derive from current month.
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Format dates to YYYY-MM-DD for the API call
  const apiStartDate = firstDayOfMonth.toISOString().split('T')[0]; // YYYY-MM-DD
  const apiEndDate = lastDayOfMonth.toISOString().split('T')[0];   // YYYY-MM-DD


  const urlTransactionsAccountById = `${url_get_transactions_by_account_id}/${accountId}/?user=${user}&start=${apiStartDate}&end=${apiEndDate}`;
  const {
    apiData: transactionsAccountIdData,
    isLoading: isLoadingTransactions,
    error: errorTransactions,
  } = useFetch<TransactionsAccountApiResponseType>(
    urlTransactionsAccountById
  );

  //-------------------------------------
  // Effect to update accountDetail from state or API
  useEffect(() => {
    if (detailedDataFromState) {
      setAccountDetail(detailedDataFromState);
      if (previousRouteFromState) {
        setPreviousRoute(previousRouteFromState);
      }
    }
  }, [detailedDataFromState, previousRouteFromState]);

  useEffect(() => {
    if (!detailedDataFromState && bankAccountsData?.data?.accountList?.length) {
      const account = bankAccountsData.data.accountList.find((acc) => acc.account_id === Number(accountId));
      if (account) setAccountDetail(account);
    }
  }, [bankAccountsData, detailedDataFromState, accountId]);

  // Effect to update transactions and summary when transactions data arrives
  useEffect(() => {
    if (transactionsAccountIdData?.data) {
      setTransactions(transactionsAccountIdData.data.transactions);
      setSummary(transactionsAccountIdData.data.summary);
    } else {
      // Reset to default if no data or data is null
      setTransactions(DEFAULT_TRANSACTIONS_DATA.transactions);
      setSummary(DEFAULT_TRANSACTIONS_DATA.summary);
    }
  }, [transactionsAccountIdData]);

  //==============================================
  return (
    <section className='page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='page__content'>
        <div className='main__title--container'>
          <Link to={previousRoute} relative='path' className='iconLeftArrow'>
            <LeftArrowLightSvg />
          </Link>
          <div className='form__title'>{capitalize(accountDetail?.account_name).toUpperCase()}</div>
          <Link to='edit' className='flx-col-center icon3dots'>
            <Dots3LightSvg />
          </Link>
        </div>

        <form className='form__box'>
          <div className='form__container'>
            <div className='input__box'>
              <div className='label form__title'>{`Current Balance`}</div>

              <div className='input__container' style={{ padding: '0.5rem' }}>
                {numberFormatCurrency(accountDetail?.account_balance)}
              </div>
            </div>

            <div className='input__box'>
              <label className='label form__title'>{'Account Type'}</label>

              <p className='input__container' style={{ padding: '0.5rem' }}>
                {capitalize(accountDetail.account_type_name!.toLocaleString())}
              </p>
            </div>

            <div className='account__dateAndCurrency'>
              <div className='account__date'>
                <label className='label form__title'>{'Starting Point'}</label>
                <div
                  className='form__datepicker__container'
                  style={{ textAlign: 'center', color: 'white' }}
                >
                  {formatDate(new Date(accountDetail.account_start_date))}
                </div>
              </div>

              <div className='account__currency'>
                <div className='label form__title'>{'Currency'}</div>

                <CurrencyBadge
                  variant={VARIANT_FORM}
                  currency={accountDetail.currency_code ?? DEFAULT_CURRENCY}
                />
              </div>
            </div>
          </div>

          {/* --- TRANSACTION STATEMENT SECTION --- */}
          {/* Apply the general container for statement to this section to match styles */}
          <div className="account-transactions__container" style={{ margin: '2rem 0' }}>
            <div className="period-info">
              <span className="period-info__label">Period:</span>
              <span className="period-info__dates">
                {formatDateToDDMMYYYY(summary.periodStartDate)} -{' '}
                {formatDateToDDMMYYYY(summary.periodEndDate)}
              </span>
            </div>

            <AccountBalanceSummary
              initialBalance={summary.initialBalance}
              finalBalance={summary.finalBalance}
            />

            <div className='presentation__card__title__container'>
              <CardTitle>{'Last Movements'}</CardTitle> {/* Reusing your CardTitle */}
            </div>

            {/* Render the new AccountTransactionsList */}
            <AccountTransactionsList transactions={transactions} />
          </div>
          {/* --- END TRANSACTION STATEMENT SECTION --- */}

        </form>

        {(isLoading || isLoadingTransactions) && <p>Loading...</p>}
        {(error || errorTransactions) && <p>Error fetching data: {error ?? errorTransactions}</p>}
      </div>
    </section>
  );
}

export default AccountDetail;
```

---

### `AccountTransactions.css` (Updated for better integration)

Ensure this file is properly imported in `AccountDetail.tsx` (e.g., `import './AccountTransactions.css';` at the top).

```css
/* AccountTransactions.css */

/* General container for the transaction statement part within the form */
/* Using an inline style for margin in AccountDetail.tsx to avoid overriding existing form__box padding/margin */
/* .account-transactions__container {
  background-color: var(--black);
  color: var(--creme);
  padding: 1.5rem;
  border-radius: 0.75rem;
  max-width: 900px;
  margin: 2rem auto;
} */ /* Removed this margin to be controlled by parent component */

/* Título de la sección principal (reused from your existing CardTitle) */
/* .account-transactions__title {
  font-size: 1.8rem;
  color: var(--white);
  text-align: center;
  margin-bottom: 1.5rem;
  letter-spacing: 1px;
} */ /* CardTitle handles this styling */

/* Información del período */
.period-info {
  text-align: center;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  color: var(--creme);
  padding: 0 1rem; /* Add some padding if needed */
}

.period-info__label {
  font-weight: 600;
  margin-right: 0.5rem;
}

.period-info__dates {
  font-weight: 400;
}

/* Balance Summary Styles */
.balance-summary__container {
  display: flex;
  justify-content: space-around;
  background-color: #2a2a2a; /* A slightly lighter tone than main background */
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
  border: 1px solid var(--creme);
}

.balance-summary__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
}

.balance-summary__label {
  font-size: 1rem;
  font-weight: 600;
  color: var(--white);
}

.balance-summary__value {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--creme);
}

.balance-summary__date {
  font-size: 0.8rem;
  color: #a0a0a0; /* A softer gray for the date */
}

/* Transactions List Styles (for the container of the list of transactions) */
/* CardTitle will manage the 'Last Movements' title style */
/* .transactions-list__title {
  font-size: 1.5rem;
  color: var(--white);
  margin-bottom: 1rem;
  padding-left: 0.5rem;
} */

/* Estilos para cada item de transacción (BoxContainer) */
.transaction-item {
  /* BoxContainer already has border-bottom: 1px solid var(--light); */
  /* We will adjust it to be dashed and more subtle */
  border-bottom: 1px dashed var(--creme) !important; /* Overrides BoxContainer's solid border */
  opacity: 0.7; /* Makes the line more subtle */
  padding: 0.8rem 0.5rem !important; /* Adjust padding for BoxContainer */
}

.transaction-item:last-child {
  border-bottom: none !important; /* No line after the last transaction */
}

/* Estilos para el encabezado de cada transacción (BoxRow) */
.transaction-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline; /* Aligns items at their baseline */
  margin-bottom: 0.4rem;
}

.transaction-movement-type {
  /* box__title default styles apply */
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--white);
  flex: 1; /* Allows it to take available space */
}

.transaction-amount {
  /* box__title default styles apply */
  font-size: 1.1rem;
  font-weight: 700;
  margin-left: 1rem; /* Space before the amount */
  color: var(--creme);
}

.transaction-date {
  /* box__subtitle default styles apply */
  font-size: 0.85rem;
  color: #a0a0a0;
  margin-left: 0.8rem; /* Space before the date */
}

/* Descripción de la transacción (BoxRow) */
.transaction-description {
  /* box__subtitle default styles apply, complemented by inline style in component */
  color: var(--creme);
  margin-bottom: 0.4rem;
  line-height: 1.4;
  white-space: pre-wrap; /* Preserves line breaks if any in the description */
}

/* Balance después de la transacción (BoxRow) */
.transaction-balance-after {
  /* box__subtitle default styles apply */
  color: #bdb1b1; /* A color similar to your .tile__subtitle */
  font-weight: 400;
}

/* No hay transacciones */
.no-transactions {
  text-align: center;
  color: var(--creme);
  padding: 1rem;
  font-style: italic;
}

/* Media Queries for basic responsiveness */
@media (max-width: 600px) {
  .balance-summary__container {
    flex-direction: column;
    gap: 1rem;
  }

  .transaction-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .transaction-amount,
  .transaction-date {
    margin-left: 0;
    margin-top: 0.2rem;
  }
}
```

---

### Summary of Integration

1.  **Imports:** Added imports for `AccountBalanceSummary`, `AccountTransactionsList`, and the `Summary` and `Transaction` types.
2.  **State Management:** Introduced `transactions` and `summary` states within `AccountDetail` to hold the data fetched by `useFetch` for `transactionsAccountIdData`.
3.  **`useEffect` for Transactions:** Added an `useEffect` hook to populate `transactions` and `summary` states when `transactionsAccountIdData` is available. It also handles resetting to default if no data is present.
4.  **API Date Range:** Added a basic logic to define `apiStartDate` and `apiEndDate` for the `url_get_transactions_by_account_id` endpoint, defaulting to the current month. You can later make these dynamic with date pickers if needed.
5.  **Rendering:**
    * The `AccountBalanceSummary` component is placed to display the initial and final balances.
    * The `CardTitle` for "Last Movements" is reused.
    * Your original `ListContent listOfItems={lastMovements}` is replaced with `<AccountTransactionsList transactions={transactions} />`.
    * The transaction statement part is wrapped in a `div` with `account-transactions__container` class to apply its specific styling, with an inline margin adjustment to fit well within your `form__box` layout.

This setup should give you a well-integrated and properly typed account statement section within your existing `AccountDetail` component.

Do you have any further questions or need more adjustments?