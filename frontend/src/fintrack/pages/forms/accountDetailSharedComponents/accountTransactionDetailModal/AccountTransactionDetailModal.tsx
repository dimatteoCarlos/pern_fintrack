// frontend/src/fintrack/pages/forms/accountDetailSharedComponents/accountTransactionDetailModal/AccountTransactionDetailModal.tsx
//
// The detail of one movement as the account detail screens present it. Three
// blocks under the hero: the account context, the amount as it was recorded,
// and the conversion when there was one.
//
// Deliberately not the modal in pages/overview/components: that one belongs to
// the overview module and keeps its own structure and styles. The two share the
// contract and the useTransactionDetail hook, nothing else.

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
import FxPathwayCard from '../../../../general_components/fxPathwayCard/FxPathwayCard';
import { useModalDialog } from '../../../../../hooks/useModalDialog';

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

// The guard, and nothing else. All three detail screens mount this component
// once and leave it mounted, handing it null until a row is clicked, so the
// dialog below has to be a component of its own: a hook cannot be called after
// an early return, and the caret only comes back to the row it left because the
// dialog UNMOUNTS on close.
export const AccountTransactionDetailModal = ({
 transaction,
 onClose,
}: AccountTransactionDetailModalPropsType) => {
 if (!transaction) return null;

 return (
  <AccountTransactionDetailDialog transaction={transaction} onClose={onClose} />
 );
};

type AccountTransactionDetailDialogPropsType = {
 transaction: TransactionDetailType;
 onClose: () => void;
};

const AccountTransactionDetailDialog = ({
 transaction,
 onClose,
}: AccountTransactionDetailDialogPropsType) => {
 // Not portalled, so the page behind is not made inert: aria-modal hides it from
 // a screen reader and the hook's Tab cycle keeps the caret inside.
 const { titleId, dialogProps } = useModalDialog({
  onClose,
  lockPageBehind: false,
 });

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

 return (
  <div className='transactionDetail' onClick={onClose}>
   <div
    className='transactionDetail__panel'
    onClick={(event) => event.stopPropagation()}
    {...dialogProps}
   >
    <div className='transactionDetail__header'>
     <h2 id={titleId} className='transactionDetail__title'>
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

     {/* The conversion block is the shared one: the pocket's allocation
         history shows exactly this and a second copy would drift. It renders
         nothing at all when the figure was typed in the accounting currency. */}
     <FxPathwayCard
      originalAmount={transaction.original_amount}
      originalCurrency={originalCurrencyCode}
      storedAmount={transaction.amount}
      accountingCurrency={accountingCurrency}
      exchangeRate={transaction.exchange_rate}
      exchangeRateTimestamp={transaction.exchange_rate_timestamp}
     />
    </div>
   </div>
  </div>
 );
};
