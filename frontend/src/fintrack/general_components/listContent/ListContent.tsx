// frontend/src/general_components/listContent/ListContent.tsx
// ====================================
// 🎯 COMPONENT: ListContent
// ===================================

import { useState } from 'react';
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
import { authFetch } from '../../../auth/auth_utils/authFetch';
import { TransactionDataType } from '../../types/responseApiTypes';
import { TransactionDetailModal } from '../../pages/overview/components/transactionDetailModal/TransactionDetailModal';
import { url_get_transaction_by_id } from '../../../urlConfig';

// Default configuration
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

// ====================================
// MAIN COMPONENT
// ====================================
function ListContent({ listOfItems }: { listOfItems: LastMovementType[] }) {
 // State for modal
  const [selectedTransaction, setSelectedTransaction] =  useState<TransactionDataType | null>(null);

  const [isLoadingModal, setIsLoadingModal] = useState(false);

  const formatDate = (dateInput: Date | string | number): string => {
    const date = new Date(dateInput);
    return new Intl.DateTimeFormat(DATE_TIME_FORMAT_DEFAULT).format(date);
  };

  // Fetch transaction details by ID
  const handleTransactionClick = async (transactionId: number) => {
   // console.log('🔍 Click en transacción, ID:', transactionId);

    if (!transactionId || transactionId === 0) return;
    setIsLoadingModal(true);
    try {
      const response = await authFetch<TransactionDataType>(`${url_get_transaction_by_id}${transactionId}`);

//----DEBUG-------------------------------
// console.log('🔍 Respuesta completa:', response);
// console.log('🔍 Datos recibidos (data):', response.data);
// console.log('🔍 original_amount:', response.data?.original_amount);
// console.log('🔍 exchange_rate:', response.data?.exchange_rate);
//----DEBUG-------------------------------

      setSelectedTransaction(response.data);
    } catch (error) {
      console.error('Failed to fetch transaction details:', error);
    } finally {
      setIsLoadingModal(false);
    }
  };

  // console.log('🔍 Modal state:', { selectedTransaction, isLoadingModal });

//==============================
  return (
    <div className='listContent__container '>
      {listOfItems.map((item, index) => {

        const { accountName, record, description, date, currency, transactionId } = item;

       return (
        <BoxContainer key={index} className='listContent__item '
          onClick={() => handleTransactionClick(transactionId)}
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
        onClose={() => setSelectedTransaction(null)}
      />
      {/* Optional loading indicator */}
      {isLoadingModal && (
        <div className='modal-loading' style={{ textAlign: 'center', padding: '1rem' }}>
          Loading...
        </div>
      )}

    </div>
  );
}

export default ListContent;
