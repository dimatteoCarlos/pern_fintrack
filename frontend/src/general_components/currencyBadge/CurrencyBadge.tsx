import { CurrencyType, VariantType } from '../../types/types';
import './styles/currency-style.css';
// import { changeCurrency } from '../../helpers/functions';

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
    //THIS FUNCTION WAS DISABLED 'TILL DEFINING A MULTICURRENCY STRATEGY
    console.log(
      'updateOutsideCurrencyData',
      updateOutsideCurrencyData,
      'is disabled'
    );
    //these block is functional but disabled
    // const newCurrency = changeCurrency(currency);
    // updateOutsideCurrencyData!(newCurrency);
    // console.log('🚀 ~ toggleCurrency ~ newCurrency:', newCurrency);
  }

  return (
    <div className={`icon-currency ${variant}`} onClick={toggleCurrency}>
      {currency.toUpperCase()}
    </div>
  );
}

export default CurrencyBadge;
