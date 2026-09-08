// frontend/src/fintrack/pages/overview/components/ListContent.tsx
// Renders the transaction rows of an Overview list. It lives beside its caller
// and not in general_components/: LastMovements is its only consumer and the
// row type it renders comes from that same page component.

import {
 CURRENCY_OPTIONS,
 DATE_TIME_FORMAT_DEFAULT,
 DEFAULT_CURRENCY,
} from '../../../helpers/constants';

import { currencyFormat, isDateValid } from '../../../helpers/functions';

import { LastMovementType } from './LastMovements';

import './listContent-style.css';

import { useTransactionDetail } from '../../../hooks/useTransactionDetail';
import { TransactionDetailModal } from './transactionDetailModal/TransactionDetailModal';

// Default configuration
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

// A row the owner never annotated renders as this, never as blank space.
const DASH = '—';

function ListContent({ listOfItems }: { listOfItems: LastMovementType[] }) {
 // State for modal
 const { selectedTransaction, isLoading, openTransaction, closeTransaction } =
  useTransactionDetail();

 const formatDate = (dateInput: Date | string | number): string => {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat(DATE_TIME_FORMAT_DEFAULT).format(date);
 };

 // Empty is a declared state and not an absent block. It is not the loading
 // state, which the page owns, and it is not an error.
 if (listOfItems.length === 0) {
  return <p className='listContent__empty'>No movements to show</p>;
 }

 return (
  <div className='listContent__container'>
   {listOfItems.map((item) => {
    const { accountName, record, note, date, currency, transactionId } = item;

    return (
     // A button and not a div carrying an onClick: the row takes keyboard
     // focus, gives :focus-visible something to attach to, and announces
     // itself as activatable.
     //
     // Keyed on the transaction and not on the map index: once the list
     // accumulates pages or drops a row, React reuses the node of a row that
     // shifted, and the click opens a transaction other than the one under
     // the pointer.
     <button
      type='button'
      key={transactionId}
      className='listContent__item'
      onClick={() => openTransaction(transactionId)}
     >
      <span className='listContent__item-header'>
       <span className='listContent__account'>{accountName}</span>
       <span className='listContent__amount'>
        {currencyFormat(currency, record, formatNumberCountry)}
       </span>
      </span>

      <span className='listContent__details-row'>
       {/* Served, not split here. The same cut used to live in this line and
           was wrong three ways: it left an empty paragraph when there was no
           note, it showed the server's reversal prefix as if the owner had
           typed it, and it swallowed any note opening with the word
           Transaction. */}
       <span className='listContent__description'>{note ?? DASH}</span>

       {date && isDateValid(date) && (
        <time className='listContent__date'>{formatDate(date)}</time>
       )}
      </span>
     </button>
    );
   })}

   {/* Modal */}
   <TransactionDetailModal
    transaction={selectedTransaction}
    onClose={closeTransaction}
   />

   {/* Optional loading indicator */}
   {isLoading && (
    <div
     className='modal-loading'
     style={{ textAlign: 'center', padding: '1rem' }}
    >
     Loading...
    </div>
   )}
  </div>
 );
}

export default ListContent;
