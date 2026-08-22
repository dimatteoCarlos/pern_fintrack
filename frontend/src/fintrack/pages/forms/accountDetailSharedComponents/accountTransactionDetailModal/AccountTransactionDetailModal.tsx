// frontend/src/fintrack/pages/forms/accountDetailSharedComponents/accountTransactionDetailModal/AccountTransactionDetailModal.tsx
//
// The detail of one movement as the account detail screens present it. Three
// blocks under the hero: the account context, the amount as it was recorded,
// and the conversion when there was one.
//
// Deliberately not the modal in pages/overview/components: that one belongs to
// the overview module and keeps its own structure and styles. The two share the
// contract and the useTransactionDetail hook, nothing else.

import { useEffect, useRef } from 'react';

import {
 capitalize,
 numberFormatCurrency,
} from '../../../../helpers/functions';
import {
 CURRENCY_OPTIONS,
 DEFAULT_CURRENCY,
} from '../../../../helpers/currencyConstants';
import { DATE_TEXT_FORMAT } from '../../../../helpers/constants';
import { TransactionDetailType } from '../../../../types/responseApiTypes';

import './styles/accountTransactionDetailModal-styles.css';

type AccountTransactionDetailModalPropsType = {
 transaction: TransactionDetailType | null;
 onClose: () => void;
};

type DetailRowPropsType = {
 label: string;
 value: string;
 isMono?: boolean;
};

// The accounting currency's number format, the same one the transaction list
// reads. Grouping and decimal separator come from here, the currency symbol
// from the code of the row being rendered.
const AMOUNT_LOCALE = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// A field the API left null is a field with no answer, not a field worth zero.
const MISSING_VALUE = '—';

const asText = (value: string | null | undefined) =>
 capitalize(value ?? undefined) || MISSING_VALUE;

// 'YYYY-MM-DD' + 'HH:MM' -> 'Jul 29, 2026 · 14:52'. Built from the parts and
// never from new Date(dateText): that string is parsed as UTC midnight, so west
// of Greenwich it renders as the previous day — the exact defect the server's
// local date exists to remove.
const formatLocalStamp = (
 dateText: string | null | undefined,
 timeText: string | null | undefined,
) => {
 if (!dateText) return MISSING_VALUE;

 const [year, month, day] = dateText.split('-').map(Number);
 if (!year || !month || !day) return MISSING_VALUE;

 const label = new Date(year, month - 1, day).toLocaleDateString(
  DATE_TEXT_FORMAT,
  { month: 'short', day: 'numeric', year: 'numeric' },
 );

 return timeText ? `${label} · ${timeText}` : label;
};

// The rate lock is an instant stamped by the FX provider, not a date on the
// owner's calendar, so it is read on the clock of whoever is looking.
const formatInstantStamp = (value: string | Date) => {
 const instant = new Date(value);
 if (Number.isNaN(instant.getTime())) return MISSING_VALUE;

 const datePart = instant.toLocaleDateString(DATE_TEXT_FORMAT, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
 });
 const timePart = instant.toLocaleTimeString(DATE_TEXT_FORMAT, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
 });

 return `${datePart} · ${timePart}`;
};

const DetailRow = ({ label, value, isMono = false }: DetailRowPropsType) => (
 <div className='transactionDetail__row'>
  <span className='transactionDetail__label'>{label}</span>
  <span
   className={`transactionDetail__value ${
    isMono ? 'transactionDetail__value--mono' : ''
   }`.trim()}
  >
   {value}
  </span>
 </div>
);

export const AccountTransactionDetailModal = ({
 transaction,
 onClose,
}: AccountTransactionDetailModalPropsType) => {
 const modalRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
   if (event.key === 'Escape') onClose();
  };

  if (transaction) {
   window.addEventListener('keydown', handleKeyDown);
   modalRef.current?.focus();
  }

  return () => window.removeEventListener('keydown', handleKeyDown);
 }, [transaction, onClose]);

 if (!transaction) return null;

 // The currency the account keeps its books in. Served per row and nullable
 // because the join is a left one; the overview modal writes the application
 // default here instead, which mislabels every non-default account.
 const accountingCurrency = transaction.currency_code ?? DEFAULT_CURRENCY;

 // The financial semaphore qualifies the figure, so it follows the sign of the
 // amount rather than the direction the pill states.
 const amountModifier =
  transaction.amount >= 0
   ? 'transactionDetail__amount--positive'
   : 'transactionDetail__amount--negative';

 const amountPrefix = transaction.amount > 0 ? '+' : '';
 const heroAmount = `${amountPrefix}${numberFormatCurrency(
  transaction.amount,
  2,
  accountingCurrency,
  AMOUNT_LOCALE,
 )} ${accountingCurrency.toUpperCase()}`;

 const heroStamp = formatLocalStamp(
  transaction.transaction_local_date,
  transaction.transaction_local_time,
 );

 // The catalog stores five transaction types. account-opening is neither an
 // entry nor an exit, so its direction falls back to the sign of the amount.
 const resolveIsIncoming = () => {
  const type = transaction.transaction_type_name?.toLowerCase();
  if (type === 'deposit' || type === 'borrow') return true;
  if (type === 'withdraw' || type === 'lend') return false;
  return transaction.amount >= 0;
 };

 const isIncoming = resolveIsIncoming();
 const badgeModifier = isIncoming
  ? 'transactionDetail__badge--positive'
  : 'transactionDetail__badge--negative';
 const badgeLabel =
  transaction.transaction_type_name?.toUpperCase() ?? MISSING_VALUE;

 // The movement is what the transaction was for, the type is which way the
 // money went. Two different questions, so two pills rather than one.
 const movementLabel = transaction.movement_type_name?.toUpperCase() ?? null;

 // The colour states the impact on Net Worth, which is a property of the
 // movement type and never of the sign the figure carries in this account: a
 // transfer leaves Net Worth where it was. pnl is the one exception, since a
 // gain and a loss are the same type and only the sign separates them.
 const resolveNetEffect = () => {
  const movement = transaction.movement_type_name?.toLowerCase();
  if (movement === 'income') return 'effectPositive';
  if (movement === 'expense') return 'effectNegative';
  if (movement === 'debt') return 'effectAttention';
  if (movement === 'pnl')
   return transaction.amount >= 0 ? 'effectPositive' : 'effectNegative';
  return 'effectNeutral';
 };

 const movementModifier = `transactionDetail__badge--${resolveNetEffect()}`;

 // A conversion happened when the movement was entered in a currency other
 // than the one the account is kept in.
 const originalCurrencyCode = transaction.original_currency_code;
 const hasConversion = Boolean(
  originalCurrencyCode &&
   originalCurrencyCode.toLowerCase() !== accountingCurrency.toLowerCase(),
 );

 // The amount as it was entered, in the currency it was entered in. Not named
 // base: here that word is the accounting currency, which is the one this row
 // does not show whenever a conversion happened.
 const originalCurrency =
  hasConversion && originalCurrencyCode
   ? originalCurrencyCode
   : accountingCurrency;
 const originalValue =
  hasConversion && transaction.original_amount !== null
   ? transaction.original_amount
   : transaction.amount;
 const originalAmount = `${numberFormatCurrency(
  originalValue,
  2,
  originalCurrency,
  AMOUNT_LOCALE,
 )} ${originalCurrency.toUpperCase()}`;

 // Absolute on both ends: the pathway states a conversion, and its direction is
 // carried by the arrow rather than by a sign repeated twice.
 const pathwayFrom = `${numberFormatCurrency(
  Math.abs(transaction.original_amount ?? 0),
  2,
  originalCurrencyCode ?? undefined,
  AMOUNT_LOCALE,
 )} ${(originalCurrencyCode ?? '').toUpperCase()}`;
 const pathwayTo = `${numberFormatCurrency(
  Math.abs(transaction.amount),
  2,
  accountingCurrency,
  AMOUNT_LOCALE,
 )} ${accountingCurrency.toUpperCase()}`;

 // Stored the other way round, so the reading a person expects is the inverse.
 const directRate =
  transaction.exchange_rate && transaction.exchange_rate > 0
   ? numberFormatCurrency(
      1 / transaction.exchange_rate,
      2,
      undefined,
      AMOUNT_LOCALE,
     )
   : null;
 const exchangeRateLabel = directRate
  ? `1 ${accountingCurrency.toUpperCase()} = ${directRate} ${(
    originalCurrencyCode ?? ''
   ).toUpperCase()}`
  : MISSING_VALUE;

 // The rate exactly as it was stored, with the direction it was stored in.
 const storedRate =
  transaction.exchange_rate !== null
   ? numberFormatCurrency(transaction.exchange_rate, 4, undefined, AMOUNT_LOCALE)
   : null;
 const rateCleanLabel = storedRate
  ? `${storedRate} · ${(
    originalCurrencyCode ?? ''
   ).toUpperCase()} → ${accountingCurrency.toUpperCase()}`
  : MISSING_VALUE;

 const rateLockLabel = transaction.exchange_rate_timestamp
  ? formatInstantStamp(transaction.exchange_rate_timestamp)
  : MISSING_VALUE;

 return (
  <div
   className='transactionDetail'
   onClick={onClose}
   role='dialog'
   aria-modal='true'
   aria-labelledby='transactionDetailTitle'
  >
   <div
    className='transactionDetail__panel'
    onClick={(event) => event.stopPropagation()}
    ref={modalRef}
    tabIndex={-1}
   >
    <div className='transactionDetail__header'>
     <h2 id='transactionDetailTitle' className='transactionDetail__title'>
      {`Transaction Details (#${transaction.transaction_id})`}
     </h2>

     <button
      type='button'
      className='transactionDetail__close'
      onClick={onClose}
      aria-label='Close transaction detail'
     >
      ✕
     </button>
    </div>

    <div className='transactionDetail__badges'>
     {movementLabel && (
      <span className={`transactionDetail__badge ${movementModifier}`}>
       {movementLabel}
      </span>
     )}

     <span className={`transactionDetail__badge ${badgeModifier}`}>
      {badgeLabel}
     </span>
    </div>

    <div className='transactionDetail__hero'>
     <span className={`transactionDetail__amount ${amountModifier}`}>
      {heroAmount}
     </span>
     <span className='transactionDetail__stamp'>{heroStamp}</span>
    </div>

    <div className='transactionDetail__body'>
     <section className='transactionDetail__card'>
      <h3 className='transactionDetail__cardTitle'>Account Context</h3>

      <DetailRow
       label='Account'
       value={`${asText(transaction.account_name)} #${transaction.account_id}`}
      />
      <DetailRow
       label='Account Type'
       value={asText(transaction.account_type_name)}
      />

      {/* Only a transfer has counterparts, so these two are absent on an
          ordinary deposit or withdrawal rather than rendered empty. */}
      {transaction.source_account_id !== null && (
       <DetailRow
        label='Source Account'
        value={`${asText(transaction.source_account_name)} #${
         transaction.source_account_id
        }`}
       />
      )}

      {transaction.destination_account_id !== null && (
       <DetailRow
        label='Destination Account'
        value={`${asText(transaction.destination_account_name)} #${
         transaction.destination_account_id
        }`}
       />
      )}
     </section>

     <section className='transactionDetail__card'>
      <DetailRow label='Original Amount' value={originalAmount} />

      {transaction.description && (
       <div className='transactionDetail__row transactionDetail__row--column'>
        <span className='transactionDetail__label'>Description</span>
        <p className='transactionDetail__description'>
         {transaction.description}
        </p>
       </div>
      )}
     </section>

     {hasConversion && (
      <section className='transactionDetail__card'>
       <h3 className='transactionDetail__cardTitle'>Foreign Exchange</h3>

       <div className='transactionDetail__pathway'>
        <span>{pathwayFrom}</span>
        <svg
         className='transactionDetail__arrow'
         aria-hidden='true'
         viewBox='0 0 24 24'
         fill='none'
         stroke='currentColor'
         strokeWidth='2'
         strokeLinecap='round'
         strokeLinejoin='round'
        >
         <line x1='5' y1='12' x2='19' y2='12' />
         <polyline points='12 5 19 12 12 19' />
        </svg>
        <span>{pathwayTo}</span>
       </div>

       <DetailRow label='Exchange Rate' value={exchangeRateLabel} />
       <DetailRow label='Rate Lock' value={rateLockLabel} />
       <DetailRow label='Rate Clean' value={rateCleanLabel} isMono />
      </section>
     )}
    </div>

    <div className='transactionDetail__footer'>
     <button
      type='button'
      className='transactionDetail__action'
      onClick={onClose}
     >
      Close
     </button>
    </div>
   </div>
  </div>
 );
};
