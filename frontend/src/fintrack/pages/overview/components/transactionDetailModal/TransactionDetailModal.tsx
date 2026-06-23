// frontend/src/fintrack/pages/overview/components/transactionDetailModal/TransactionDetailModal.tsx
// 🧩 COMPONENT: TransactionDetailModal - Versión final (sin dos columnas, botón responsive, Rate Clean con dirección)

import { useEffect, useRef } from 'react';
import { numberFormatCurrency, formatDate, capitalize } from '../../../../helpers/functions';
import { MOVEMENT_TYPES } from '../../../../helpers/constants';
import { DEFAULT_CURRENCY } from '../../../../helpers/currencyConstants';
import { TransactionDataType } from '../../../../types/responseApiTypes';
import './transactionDetailModal.css';

type TransactionDetailModalProps = {
  transaction: TransactionDataType | null;
  onClose: () => void;
};

export const TransactionDetailModal = ({ transaction, onClose }: TransactionDetailModalProps) => {
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

  // =========================================
  // 💰 FORMAT VALUES
  // =========================================
  const formattedTransactionDate = formatDate(transaction.transaction_actual_date);
  const formattedTimestamp = transaction.exchange_rate_timestamp
    ? formatDate(transaction.exchange_rate_timestamp)
    : 'N/A';

  // Valores absolutos para la tarjeta FX (sin signo)
  const absOriginalAmount = Math.abs(transaction.original_amount || 0);
  const absConvertedAmount = Math.abs(transaction.amount);
  
  // const formattedOriginalAbs = numberFormatCurrency(absOriginalAmount, 2, transaction.original_currency_code || DEFAULT_CURRENCY, 'es-ES');
  // const formattedConvertedAbs = numberFormatCurrency(absConvertedAmount, 2, DEFAULT_CURRENCY, 'es-ES');

  // Monto con signo para el hero
  const formattedAmountSigned = numberFormatCurrency(transaction.amount, 2, DEFAULT_CURRENCY, 'es-ES');
  const isPositive = transaction.amount >= 0;
  const amountClass = isPositive ? 'fx-amount-positive' : 'fx-amount-negative';
  const amountPrefix = isPositive ? '+' : '';

  // Tasa almacenada (para Rate Clean)
  const formattedExchangeRate = transaction.exchange_rate
    ? numberFormatCurrency(transaction.exchange_rate, 4, undefined, 'es-ES')
    : 'N/A';

  // Movement & Transaction Types
  const movementTypeRaw = MOVEMENT_TYPES[transaction.movement_type_id];
  const displayMovementType = movementTypeRaw ? capitalize(movementTypeRaw.replace('-', ' ')) : 'Unknown';
  const displayTransactionType = transaction.transaction_type_name ? capitalize(transaction.transaction_type_name) : 'N/A';

  // Badge color based on transaction type (incoming/outgoing)
  const isIncoming = (() => {
    const type = displayTransactionType;
    if (type === 'Deposit' || type === 'Income' || type === 'Borrow') return true;
    if (type === 'Withdraw' || type === 'Expense' || type === 'Lend') return false;
    return transaction.amount >= 0;
  })();
  const badgeClass = isIncoming ? 'fx-badge-income' : 'fx-badge-expense';

  // FX Card visibility
  const showFXCard = transaction.original_currency_code && transaction.original_currency_code !== DEFAULT_CURRENCY;

  // Direct rate for display (e.g., 1 USD = X COP)
  let directRateFormatted = '';
  if (showFXCard && transaction.exchange_rate && transaction.exchange_rate > 0) {
    const directRate = 1 / transaction.exchange_rate;
    directRateFormatted = numberFormatCurrency(directRate, 2, undefined, 'es-ES');
  }

  // Badges text in uppercase
  const displayMovementUpper = displayMovementType.toUpperCase();
  const displayTransactionUpper = displayTransactionType.toUpperCase();

  // Direction for Rate Clean (original -> target)
  const rateCleanDirection = transaction.original_currency_code && transaction.exchange_rate
    ? `${transaction.original_currency_code.toUpperCase()} → ${DEFAULT_CURRENCY.toUpperCase()}`
    : '';

  return (
    <div className="fx-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="fx-modal-title">
      <div className="fx-modal-container" onClick={(e) => e.stopPropagation()} ref={modalRef} tabIndex={-1}>

        {/* HEADER */}
        <div className="fx-modal-header">
          <div>
            <h2 id="fx-modal-title" className="fx-modal-id">Transaction #{transaction.transaction_id}</h2>
            <div className="fx-badge-container">
              <span className="fx-movement-badge-large">{displayMovementUpper}</span>
              <span className={`fx-modal-badge ${badgeClass}`}>{displayTransactionUpper}</span>
            </div>
          </div>
          <button className="fx-modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {/* HERO SECTION */}
        <div className="fx-modal-hero">
          <span className={`fx-hero-amount ${amountClass}`}>{amountPrefix}{formattedAmountSigned}</span>
          <span className="fx-hero-date">{formattedTransactionDate}</span>
        </div>

        {/* BODY (single column) */}
        <div className="fx-modal-body">

          {/* Core Details */}
          <div className="fx-details-card">
            <div className="fx-info-row">
              <span className="fx-label">Account</span>
              <span className="fx-value fx-capitalize">{transaction.account_name || 'N/A'}</span>
            </div>
            {transaction.description && (
              <div className="fx-info-row fx-column">
                <span className="fx-label">Description</span>
                <span className="fx-value-description">{transaction.description}</span>
              </div>
            )}
          </div>

          {/* Foreign Exchange Card */}
          {showFXCard && (
            <div className="fx-container">
              <div className="fx-header">FOREIGN EXCHANGE</div>
              <div className="fx-body">
                <span className="amount-primary">
                  {transaction.original_currency_code?.toUpperCase()} {absOriginalAmount}
                </span>
                <svg className="fx-arrow-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
                <span className="amount-secondary">
                  {DEFAULT_CURRENCY.toUpperCase()} {absConvertedAmount}
                </span>
              </div>
              <div className="fx-footer">
                <div className="fx-footer-row">
                  <span className="rate-info">
                    Exchange Rate: 1 {DEFAULT_CURRENCY.toUpperCase()} = {directRateFormatted} {transaction.original_currency_code?.toUpperCase()}
                  </span>
                  <span className="rate-timestamp">Rate Lock: {formattedTimestamp}</span>
                </div>
                <div className="fx-footer-row">
                  <span className="rate-clean">
                    Rate Clean: {formattedExchangeRate} {rateCleanDirection}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="fx-modal-footer">
          <button className="fx-btn-primary" onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  );
};