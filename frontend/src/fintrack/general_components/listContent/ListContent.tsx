// frontend/src/general_components/listContent/ListContent.tsx
// ====================================
// 🎯 COMPONENT: ListContent
// ===================================

import {
  CURRENCY_OPTIONS,
  DATE_TIME_FORMAT_DEFAULT,
  DEFAULT_CURRENCY,
} from '../../helpers/constants';

import {
  // capitalize,
  currencyFormat,
  isDateValid,
} from '../../helpers/functions';

import { LastMovementType } from '../../pages/overview/components/LastMovements';

import { BoxContainer, BoxRow } from '../boxComponents/BoxComponents';

import './styles/listContent-style.css';

import { useTransactionDetail } from '../../hooks/useTransactionDetail';
import { TransactionDetailModal } from '../../pages/overview/components/transactionDetailModal/TransactionDetailModal';

// Default configuration
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

// ====================================
// MAIN COMPONENT
// ====================================
function ListContent({ listOfItems }: { listOfItems: LastMovementType[] }) {
 // State for modal
  const { selectedTransaction, isLoading, openTransaction, closeTransaction } =
    useTransactionDetail();

  const formatDate = (dateInput: Date | string | number): string => {
    const date = new Date(dateInput);
    return new Intl.DateTimeFormat(DATE_TIME_FORMAT_DEFAULT).format(date);
  };

//==============================
  return (
    <div className='listContent__container '>
      {listOfItems.map((item, index) => {

        const { accountName, record, description, date, currency, transactionId } = item;

       return (
        <BoxContainer key={index} className='listContent__item '
          onClick={() => openTransaction(transactionId)}
          style={{ cursor: 'pointer' }}
          >
        {/* -----------------------------------
        📝 DETAILS ROW: Description and date
        ----------------------------------- */}
           <BoxRow className='listContent__item-header'>
           <span className='listContent__account'>{accountName}</span>
           <span className='listContent__amount'>
           {currencyFormat(currency, record, formatNumberCountry)}
           </span>
           </BoxRow>

        {/*  📝 DETAILS ROW: Description and date - */}
         <div className='listContent__details-row'>
          <p className='listContent__description'>
          {(description.split('Transaction')[0])}
          </p>
          <p>
          {date && isDateValid(date) && (
          <time className='listContent__date'>{formatDate(date)}</time>
          )}

          </p>
         </div>
        </BoxContainer>

        );
      })}

 {/* Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={closeTransaction}
      />
      {/* Optional loading indicator */}
      {isLoading && (
        <div className='modal-loading' style={{ textAlign: 'center', padding: '1rem' }}>
          Loading...
        </div>
      )}

    </div>
  );
}

export default ListContent;
