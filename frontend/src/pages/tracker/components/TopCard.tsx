import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation';
import { capitalize } from '../../../helpers/functions';
import {
  CurrencyType,
  DropdownOptionType,
  VariantType,
} from '../../../types/types';

type TopCardPropType<T extends Record<string, unknown>> = {
  topCardElements: {
    titles: { title1: string; title2: string };
    value: string;
    selectOptions: {
      title: string;
      options: {
        value: string;
        label: string;
      }[];
      variant: VariantType;
    };
  };

  validationMessages: { [key: string]: string };
  updateTrackerData: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;

  trackerName: string;
  updateCurrency: (x: CurrencyType) => void;
  currency: CurrencyType;
  selectedValue?: string;
  setSelectState: React.Dispatch<React.SetStateAction<T>>; //generic type
  isReset: boolean;
  setIsReset: React.Dispatch<React.SetStateAction<boolean>>;
};
//----Component
const TopCard = <T extends Record<string, unknown>>({
  topCardElements,
  validationMessages,
  updateTrackerData,
  trackerName,
  currency,
  updateCurrency,
  selectedValue,
  setSelectState,
  isReset,
  setIsReset,
}: TopCardPropType<T>): JSX.Element => {
  const {
    selectOptions: topCardOptions,
    selectOptions: { variant },
    titles: { title1 }, //amount label or title
    titles: { title2 }, //account label or title
    value, //amount input value
  } = topCardElements;

  function stateSelectHandler(selectedOption: DropdownOptionType | null) {
    setSelectState((prev) => ({
      ...prev,
      [title2]: selectedOption?.value,
    }));
  }

  console.log('selected value from TopCard:', selectedValue);

  return (
    <>
      <div className='state__card--top  '>
        <LabelNumberValidation
          formDataNumber={{ keyName: title1, title: title1 }}
          validationMessages={validationMessages}
          variant={variant}
        />

        <div className='card__screen'>
          {/* make the input number a component? */}
          <input
            className='inputNumber'
            name={title1}
            type='text'
            placeholder={trackerName}
            value={value} //amountValue
            onChange={updateTrackerData} //onAmountChange
          />

          <CurrencyBadge
            variant={variant}
            updateOutsideCurrencyData={updateCurrency}
            currency={currency}
          />
        </div>

        <div className='card--title'>
          {capitalize(title2)}
          <span className='validation__errMsg'>
            {' '}
            {validationMessages[title2]}
          </span>
        </div>

        <DropDownSelection
          dropDownOptions={topCardOptions}
          updateOptionHandler={stateSelectHandler}
          isReset={isReset}
          setIsReset={setIsReset}
        />
      </div>
    </>
  );
};

export default TopCard;
