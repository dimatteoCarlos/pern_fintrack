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

  return (
    <div className={`icon-currency ${variant} ${disabled ? 'disabled' : ''}`}
    onClick={handleClick}
     style={{ cursor: disabled ? 'not-allowed' : 'pointer' }} 
    >
      {currency.toUpperCase()}
    </div>
  );
}

export default CurrencyBadge;
