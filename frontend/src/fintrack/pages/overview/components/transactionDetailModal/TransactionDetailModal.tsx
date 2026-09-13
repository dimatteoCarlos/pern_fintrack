// frontend/src/fintrack/pages/overview/components/transactionDetailModal/TransactionDetailModal.tsx
// 🧩 COMPONENT: TransactionDetailModal - Versión final (sin dos columnas, botón responsive, Rate Clean con dirección)

import { useModalDialog } from '../../../../../hooks/useModalDialog';
import { numberFormatCurrency, formatDate, capitalize, currencyMinorUnit } from '../../../../helpers/functions';
import { DEFAULT_CURRENCY } from '../../../../helpers/currencyConstants';
import { TransactionDetailType } from '../../../../types/responseApiTypes';
import { resolveTransactionPresentation } from '../../../../helpers/transactionPresentation';
import './transactionDetailModal.css';

type TransactionDetailModalProps = {
  transaction: TransactionDetailType | null;
  onClose: () => void;
};

// The guard, and nothing else. ListContent mounts this component once and leaves
// it mounted, handing it null until a row is clicked, so the dialog below has to
// be a component of its own: a hook cannot be called after an early return, and
// the caret only comes back to the row because the dialog UNMOUNTS on close.
export const TransactionDetailModal = ({ transaction, onClose }: TransactionDetailModalProps) => {
  if (!transaction) return null;

  return <TransactionDetailDialog transaction={transaction} onClose={onClose} />;
};

type TransactionDetailDialogProps = {
  transaction: TransactionDetailType;
  onClose: () => void;
};

const TransactionDetailDialog = ({ transaction, onClose }: TransactionDetailDialogProps) => {
  // Not portalled, so the page behind is not made inert: aria-modal hides it
  // from a screen reader and the hook's Tab cycle keeps the caret inside.
  const { titleId, dialogProps } = useModalDialog({
    onClose,
    lockPageBehind: false,
  });

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

  // Each figure carries its own currency's decimals: printed raw, a JPY row
  // written before per-currency rounding read "JPY 157.57".
  const originalCurrency = transaction.original_currency_code || DEFAULT_CURRENCY;
  const formattedOriginalAbs = numberFormatCurrency(absOriginalAmount, currencyMinorUnit(originalCurrency), undefined, 'es-ES');
  const formattedConvertedAbs = numberFormatCurrency(absConvertedAmount, currencyMinorUnit(DEFAULT_CURRENCY), undefined, 'es-ES');

  // Monto con signo para el hero
  const formattedAmountSigned = numberFormatCurrency(transaction.amount, 2, DEFAULT_CURRENCY, 'es-ES');
  const isPositive = transaction.amount >= 0;
  const amountClass = isPositive ? 'fx-amount-positive' : 'fx-amount-negative';
  const amountPrefix = isPositive ? '+' : '';

  // Tasa almacenada (para Rate Clean)
  // const formattedExchangeRate = transaction.exchange_rate
  //   ? numberFormatCurrency(transaction.exchange_rate, 4, undefined, 'es-ES')
  //   : 'N/A';
  // A rate is a ratio, not money: four decimals cut 0.00650195 to 0,0065, which
  // no longer reproduces the 153,80 shown above it. Six significant digits do.
  const formattedExchangeRate = transaction.exchange_rate
    ? new Intl.NumberFormat('es-ES', { maximumSignificantDigits: 6 }).format(transaction.exchange_rate)
    : 'N/A';

  // What this transaction means from the perspective of transaction.account_id
  // (the account this row is filed under), not the raw transaction_type
  // string. Replaces the old pair of badges - movement type coloured by net
  // worth effect, transaction type coloured by incoming/outgoing - which is
  // exactly the "DEPOSIT + EXPENSE" double badge on a category_budget row the
  // plan reports. See helpers/transactionPresentation.ts.
  const presentation = resolveTransactionPresentation({
    movementType: transaction.movement_type_name,
    accountType: transaction.account_type_name,
    amount: transaction.amount,
    legacy: { transactionTypeName: transaction.transaction_type_name },
  });

  const badgeColorClass = `fx-movement-badge-large--effect${capitalize(presentation.badgeColor)}`;

  // FX Card visibility
  const showFXCard = transaction.original_currency_code && transaction.original_currency_code !== DEFAULT_CURRENCY;

  // Direct rate for display (e.g., 1 USD = X COP)
  let directRateFormatted = '';
  if (showFXCard && transaction.exchange_rate && transaction.exchange_rate > 0) {
    const directRate = 1 / transaction.exchange_rate;
    directRateFormatted = numberFormatCurrency(directRate, 2, undefined, 'es-ES');
  }

  // Direction for Rate Clean (original -> target)
  const rateCleanDirection = transaction.original_currency_code && transaction.exchange_rate
    ? `${transaction.original_currency_code.toUpperCase()} → ${DEFAULT_CURRENCY.toUpperCase()}`
    : '';

  return (
    <div className="fx-modal-overlay" onClick={onClose}>
      <div className="fx-modal-container" onClick={(e) => e.stopPropagation()} {...dialogProps}>

        {/* HEADER */}
        <div className="fx-modal-header">
          <div>
            <h2 id={titleId} className="fx-modal-id">Transaction #{transaction.transaction_id}</h2>
            <div className="fx-badge-container">
              <span className={`fx-movement-badge-large ${badgeColorClass}`}>{presentation.badgeLabel}</span>
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
                  {transaction.original_currency_code?.toUpperCase()} {formattedOriginalAbs}
                </span>
                <svg className="fx-arrow-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
                <span className="amount-secondary">
                  {DEFAULT_CURRENCY.toUpperCase()} {formattedConvertedAbs}
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
                    Rate Clean: {formattedExchangeRate} x {rateCleanDirection}
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