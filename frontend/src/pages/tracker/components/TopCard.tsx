import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation';
import RadioInput from '../../../general_components/radioInput/RadioInput';
import { capitalize } from '../../../helpers/functions';
import {
  CurrencyType,
  DropdownOptionType,
  VariantType,
} from '../../../types/types';

//-------------------------------
type RadioInputPropsType = {
  radioOptionSelected: string;

  inputRadioOptions: { value: string; label: string }[];

  setRadioOptionSelected: (option: string) => void;

  title?: string;

  // disabled?: boolean;
};

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

  // selectedValue?: string;
  setSelectState: React.Dispatch<React.SetStateAction<T>>; //generic type

  isReset: boolean;
  setIsReset: React.Dispatch<React.SetStateAction<boolean>>;
  //-----
  isResetDropdown?: boolean;
  setIsResetDropdown?: React.Dispatch<React.SetStateAction<boolean>>;

  radioInputProps?: RadioInputPropsType;

  //--handle special case of Transfer
  customSelectHandler?: (selectedOption: DropdownOptionType | null) => void;
};

//----Component
const TopCard = <T extends Record<string, unknown>>({
  topCardElements,
  validationMessages,
  updateTrackerData,
  trackerName,
  currency,
  updateCurrency,
  // selectedValue,
  setSelectState,
  isReset,
  setIsReset,
  //-------
  isResetDropdown,
  setIsResetDropdown,
  //-------
  radioInputProps,
  //-------
  customSelectHandler,
}: TopCardPropType<T>): JSX.Element => {
  const {
    selectOptions: topCardOptions,
    selectOptions: { variant },
    titles: { title1 }, //amount label or title
    titles: { title2 }, //account label or title
    value, //amount input value
  } = topCardElements;

  // console.log('🚀 ~ title2:', title2.trim().toLowerCase());

  //selection handler
  function stateSelectHandler(selectedOption: DropdownOptionType | null) {
    // get the account_id of the selected account_name. it supposes thet account_name is unique too.
    setSelectState((prev) => ({
      ...prev,
      [title2.trim().toLowerCase()]: selectedOption?.value,
      // ['origin_account']: selectedOption?.value,
    }));
  }

  //usage of customSelectHandler if it exists
  const finalSelectHandler = customSelectHandler || stateSelectHandler;

  // console.log('isResetDropdown', { isResetDropdown });
  // console.log('title2', title2.trim().length, 'origin'.length);

  // console.log('selected value from TopCard:', selectedValue);
  //-------------------------------------------
  return (
    <>
      <div className='state__card--top  '>
        <LabelNumberValidation
          formDataNumber={{ keyName: title1, title: title1 }}
          validationMessages={validationMessages}
          variant={variant}
        />

        <div className='card__screen'>
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

        <div className='account card--title '>
          {capitalize(title2).trim()}

          {radioInputProps && (
            <RadioInput
              radioOptionSelected={radioInputProps.radioOptionSelected}
              inputRadioOptions={radioInputProps.inputRadioOptions}
              setRadioOptionSelected={radioInputProps.setRadioOptionSelected}
              title={radioInputProps.title}
              labelId={title2.trim()}
              // disabled={radioInputProps.disabled}
            />
          )}
        </div>

        <div className='validation__errMsg '>
          {validationMessages[`${title2.toLowerCase().trim()}`]}
        </div>

        <DropDownSelection
          dropDownOptions={topCardOptions}
          updateOptionHandler={finalSelectHandler}
          setIsReset={setIsReset}
          isReset={isReset}
          setIsResetDropdown={setIsResetDropdown}
          isResetDropdown={isResetDropdown}
          // isReset={isReset || isResetDropdown }
        />
      </div>
    </>
  );
};

export default TopCard;
