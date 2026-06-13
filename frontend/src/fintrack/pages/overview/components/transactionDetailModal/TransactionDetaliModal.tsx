// frontend\src\fintrack\pages\overview\components\transactionDetailModal\TransactionDetaliModal.tsx

// 🧩 COMPONENT: TransactionDetailModal
// Displays complete transaction details including FX metadata

import { useEffect, useRef } from 'react';
import { TransactionDataType } from '../../../../types/responseApiTypes';
import { numberFormatCurrency , formatDate} from '../../../../helpers/functions';

import './transactionDetailModal.css';
import { DEFAULT_CURRENCY } from '../../../../helpers/currencyConstants';

// ============================================
// 📦 TYPES
// ============================================
type TransactionDetailModalProps = {
  transaction: TransactionDataType | null;
  onClose: () => void;
};

// ============================================
// 🎯 COMPONENT
// ============================================
export const TransactionDetailModal = ({ transaction, onClose }: TransactionDetailModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // 🎯 Accessibility: Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (transaction) {
      window.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [transaction, onClose]);

  // 🛑 Don't render if no transaction data
  if (!transaction) return null;

  // 💰 Format values with Spanish locale
  const formattedOriginalAmount = numberFormatCurrency(
    transaction.original_amount,
    2,
    transaction.original_currency_code,
    'es-ES'
  );

  const formattedExchangeRate = numberFormatCurrency(
    transaction.exchange_rate,
    4,
    undefined,
    'es-ES'
  );

  const formattedTransactionDate = formatDate(transaction.transaction_actual_date);
  
  const formattedTimestamp = transaction.exchange_rate_timestamp
    ? formatDate(transaction.exchange_rate_timestamp)
    : 'No disponible';

  // Determine movement type display name
  const getMovementTypeName = (movementTypeId: number): string => {
    const types: Record<number, string> = {
      1: 'Expense',
      2: 'Income',
      3: 'Transfer',
      4: 'Debt',
      5: 'Investment',
      6: 'Pocket',
      7: 'PnL',
      8: 'Account Opening',
    };
    return types[movementTypeId] || 'Unknown';
  };

// Determine amount color class based on sign
const amountClass = transaction.amount >= 0 ? 'modal-amount-positive' : 'modal-amount-negative';

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        {/* 🎯 Header */}
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            Transaction Details
          </h2>
          <button
            className="modal-close-btn-top"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* 📋 Transaction basic info */}
        <div className="modal-section">
          <div className="modal-section-title">Transaction Info</div>
          <div className="modal-data-row">
            <span className="modal-label">ID:</span>
            <span className="modal-value">{transaction.transaction_type_id}</span>
          </div>
          <div className="modal-data-row">
            <span className="modal-label">Type:</span>
            <span className="modal-value">{getMovementTypeName(transaction.movement_type_id)}</span>
          </div>
          <div className="modal-data-row">
            <span className="modal-label">Date:</span>
            <span className="modal-value">{formattedTransactionDate}</span>
          </div>
          <div className="modal-data-row">
            <span className="modal-label">Description:</span>
            <span className="modal-value modal-description">{transaction.description}</span>
          </div>
          <div className="modal-data-row">
            <span className="modal-label">Amount ({DEFAULT_CURRENCY.toUpperCase()}):</span>
            <span className={`modal-value ${amountClass}`}>{numberFormatCurrency(transaction.amount, 2, DEFAULT_CURRENCY, 'es-ES')}</span>
          </div>
        </div>

        {/* 💰 FX Metadata section */}
        <div className="modal-section">
          <div className="modal-section-title">Exchange Rate Info</div>
          <div className="modal-data-row">
            <span className="modal-label">Original Amount:</span>
            <span className="modal-value">{formattedOriginalAmount}</span>
          </div>
          <div className="modal-data-row">
            <span className="modal-label">Exchange Rate:</span>
            <span className="modal-value">{formattedExchangeRate}</span>
          </div>
          <div className="modal-data-row">
            <span className="modal-label">Source:</span>
            <span className="modal-value modal-source">{transaction.exchange_rate_source || 'N/A'}</span>
          </div>

        {/* Direction and Rate (similar to preview) */}
        {transaction.exchange_rate && transaction.original_currency_code && (
          <div className="modal-data-row">
            <span className="modal-label">Direction:</span>
            <span className="modal-value">
              {transaction.original_currency_code.toUpperCase()} → {DEFAULT_CURRENCY.toUpperCase()}
            </span>
          </div>
        )}

          <div className="modal-data-row">
            <span className="modal-label">Rate Timestamp:</span>
            <span className="modal-value">{formattedTimestamp}</span>
          </div>
        </div>

        {/* 🧩 Footer */}
        <div className="modal-footer">
          <button className="modal-close-btn-bottom" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};