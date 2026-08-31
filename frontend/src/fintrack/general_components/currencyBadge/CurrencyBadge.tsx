// frontend/src/fintrack/general_components/currencyBadge/CurrencyBadge.tsx

import { CurrencyType, VariantType } from '../../types/types';
import {getNextCurrency } from '../../helpers/functions';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';

import './styles/currency-style.css';

type CurrencyBadgePropType = {
  variant: VariantType;
  currency: CurrencyType;
  updateOutsideCurrencyData?: (currency: CurrencyType) => void;
  setCurrency?: React.Dispatch<React.SetStateAction<CurrencyType>>;
   disabled?: boolean;
};

function CurrencyBadge({
  variant,
  updateOutsideCurrencyData,
  currency, disabled
}: CurrencyBadgePropType) {
  //----functions------------
  // ⚡️ Debounced toggle to prevent rapid multiple updates
  const debouncedToggleCurrency = useDebouncedCallback(() => {
    const newCurrency = getNextCurrency(currency);
    if (updateOutsideCurrencyData) {
      updateOutsideCurrencyData(newCurrency);
    }

  }, 300);

 function handleClick() {
   if (disabled) return;
    debouncedToggleCurrency();
  }

  // A button and not a div. It was a div carrying an onClick, which no
  // keyboard can reach, which a screen reader announces as nothing, and which
  // offers no focus ring to draw. The label says what pressing it DOES: the
  // face of the control shows the current currency, and a reader meeting
  // "USD" alone cannot tell a state from a command.
  //
  // disabled is the attribute now rather than a class and an inline cursor.
  // The class only ever dimmed it; the control stayed clickable.
  return (
    <button
      type='button'
      className={`icon-currency ${variant}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={`Currency: ${currency.toUpperCase()}. Change it.`}
    >
      {currency.toUpperCase()}
    </button>
  );
}

export default CurrencyBadge;
