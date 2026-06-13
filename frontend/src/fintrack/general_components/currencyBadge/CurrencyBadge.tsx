// frontend/src/fintrack/general_components/currencyBadge/CurrencyBadge.tsx

import { CurrencyType, VariantType } from '../../types/types';
import './styles/currency-style.css';
import {getNextCurrency } from '../../helpers/functions';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';

type CurrencyBadgePropType = {
  variant: VariantType;
  currency: CurrencyType;
  updateOutsideCurrencyData?: (currency: CurrencyType) => void;
  setCurrency?: React.Dispatch<React.SetStateAction<CurrencyType>>;
};

function CurrencyBadge({
  variant,
  updateOutsideCurrencyData,
  currency,
}: CurrencyBadgePropType) {
  //----functions------------
  //Show currencies cop and usd
  // function toggleCurrency() {
  //   const newCurrency = changeCurrency(currency);
  //   updateOutsideCurrencyData!(newCurrency);
  //   console.log('🚀 ~ toggleCurrency ~ newCurrency:', newCurrency);
  // } //just cop and usd

  // ⚡️ Debounced toggle to prevent rapid multiple updates
  const debouncedToggleCurrency = useDebouncedCallback(() => {
    const newCurrency = getNextCurrency(currency);
    if (updateOutsideCurrencyData) {
      updateOutsideCurrencyData(newCurrency);
    }
    // console.log('🚀 ~ toggleCurrency ~ newCurrency:', newCurrency);
  }, 300);

 function handleClick() {
    // toggleCurrency();
    debouncedToggleCurrency();
  }

  return (
    <div className={`icon-currency ${variant}`} onClick={handleClick}>
      {currency.toUpperCase()}
    </div>
  );
}

export default CurrencyBadge;
