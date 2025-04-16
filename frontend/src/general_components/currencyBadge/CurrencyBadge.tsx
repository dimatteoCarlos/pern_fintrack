import { changeCurrency } from '../../helpers/functions';
import { CurrencyType, VariantType } from '../../types/types';
import './styles/currency-style.css';

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
  function toggleCurrency() {
    const newCurrency = changeCurrency(currency);
    updateOutsideCurrencyData!(newCurrency);
    // console.log('🚀 ~ toggleCurrency ~ newCurrency:', newCurrency);
  }
  return (
    <div className={`icon-currency ${variant}`} onClick={toggleCurrency}>
      {currency.toUpperCase()}
    </div>
  );
}

export default CurrencyBadge;
