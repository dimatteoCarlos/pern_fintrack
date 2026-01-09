// src/pages/tracker/components/TopCard.tsx
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation';
import RadioInput from '../../../general_components/radioInput/RadioInput';
import { capitalize } from '../../../helpers/functions';
// import { AccountListType } from '../../../types/responseApiTypes';
import {
  CurrencyType,
  DropdownOptionType,
  TopCardElementsType,
} from '../../../types/types';
import { ValidationMessagesType } from '../../../validations/types';

//------------------------------------
type RadioInputPropsType = {
  radioOptionSelected: string;
  inputRadioOptions: { value: string; label: string }[];
  setRadioOptionSelected: (option: string) => void;
  disabled:boolean;
  title?: string;
};
//---------------------------------
type TopCardPropType<TFormDataType  extends Record<string, unknown>> = {
  topCardElements: TopCardElementsType;
  // validationMessages: { [key: string]: string };
  validationMessages: ValidationMessagesType<TFormDataType>;

  setValidationMessages: React.Dispatch<React.SetStateAction<ValidationMessagesType<TFormDataType>>>;

  updateTrackerData: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  trackerName: string;

  currency: CurrencyType;
  updateCurrency: (x: CurrencyType) => void;

  // selectedValue?: string;
  setSelectState: React.Dispatch<React.SetStateAction<TFormDataType>>; 

  //general reset
  isReset: boolean;
  setIsReset: React.Dispatch<React.SetStateAction<boolean>>;

  //select dropdown reset
  isResetDropdown?: boolean;
  setIsResetDropdown?: React.Dispatch<React.SetStateAction<boolean>>;

  radioInputProps?: RadioInputPropsType;

  //--handle special case of Transfer
  customSelectHandler?: (selectedOption: DropdownOptionType | null) => void;
//---
};

//----Component------------------------
const TopCard = <TFormDataType  extends Record<string, unknown>>({
  topCardElements,
  validationMessages,
  setValidationMessages,//could be undefined
  updateTrackerData,
  trackerName,
  currency,
  updateCurrency,

  setSelectState,
  isReset,
  isResetDropdown,
  setIsResetDropdown,
  //-------
  setIsReset,
  //-------
  radioInputProps,
  //-------
  customSelectHandler,
  //--------------
 }: TopCardPropType<TFormDataType >): JSX.Element => {
  const {
    selectOptions: topCardOptions,
    selectOptions: { variant },
    titles: { title1 }, //amount 
    titles: { title2 }, //account
    titles: { label2 }, //account label or title
    value, //formData.amount
  } = topCardElements;

    const accountFieldName = title2.trim().toLowerCase() as keyof TFormDataType;
//---
const errorMessage = validationMessages[accountFieldName] || ''
//(topCardElements.value as string).trim() !== '';//new

//---show error message
const shouldShowError = !!validationMessages[accountFieldName]
// && (topCardElements.value as string).trim() !== ''
;
//---
// console.log('desde topcardzod', validationMessages.amount, errorMessage,shouldShowError,(topCardElements.value as string).trim() !== '' )
 
  //selection handler
  function stateSelectHandler(selectedOption: DropdownOptionType | null) {
  // should get the account_id of the selected account_name. it supposes that account_name is unique too.
    setSelectState((prev) => (
      {
      ...prev,
  [accountFieldName]: selectedOption?.value || '',
      }));

    // console.log('title2', title2.trim(),'label', selectedOption?.label,'value', selectedOption?.value );

  //if setValidationMessages is used, then clean the correspondent validation message
  //aqui sin validar con zod,  se asigna el valor, y se asume que es valido, y entonces, se  borra el mensaje de error asociado al campo que se selecciono.
        
    if (setValidationMessages) {
      setValidationMessages((prev) => {
        const newMessages = { ...prev };
        if (newMessages[accountFieldName])
           {
          delete newMessages[accountFieldName];
        }
        return newMessages;
      });
    }
  }
//**********************************/
//usage of customSelectHandler if it exists
  const finalSelectHandler = customSelectHandler || stateSelectHandler;
  //  console.log('isResetDropdown', { isResetDropdown });
   // console.log('selected value from TopCard:', selectedValue);
//-----------------------------------
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
         <span className ='account-label'>{capitalize(label2??title2).trim()}</span>
          
         {radioInputProps && (
            <RadioInput
              radioOptionSelected={radioInputProps.radioOptionSelected}

              inputRadioOptions={radioInputProps.inputRadioOptions}

              setRadioOptionSelected={radioInputProps.setRadioOptionSelected}

              title={radioInputProps.title}
              labelId={title2.trim()}
              disabled={radioInputProps.disabled}

            />
          )}
        </div>

      {/*show validation message for account field  */}
        <span className='validation__errMsg '>
          {shouldShowError ? errorMessage : ''}
          {/* {validationMessages[`${title2.toLowerCase().trim()}`]} */}
        </span>

      <DropDownSelection
        dropDownOptions={topCardOptions}
        updateOptionHandler={finalSelectHandler}
        isReset={isReset}
        isResetDropdown={isResetDropdown}
        setIsReset={setIsReset}
        setIsResetDropdown={setIsResetDropdown}
          />
      </div>
    </>
  );
};

export default TopCard;
