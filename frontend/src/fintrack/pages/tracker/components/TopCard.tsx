// src/pages/tracker/components/TopCard.tsx
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection';
import RadioInput, {
 RadioInputPropsType,
} from '../../../general_components/radioInput/RadioInput';
import RateTooltip from '../../../general_components/rateTooltip/RateTooltip';

import { capitalize, numberFormatCurrency } from '../../../helpers/functions';

import {
 CurrencyType,
 DropdownOptionType,
 TopCardElementsType,
} from '../../../types/types';

import { ValidationMessagesType } from '../../../validations/types';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation';

import { useCurrencyPreview } from '../../../hooks/useCurrencyPreview';
import TransactionDateTrigger, {
 TransactionDatePropsType,
} from '../../../general_components/transactionDateTrigger/TransactionDateTrigger';

//---------------------------------
type TopCardPropType<TFormDataType extends Record<string, unknown>> = {
  topCardElements: TopCardElementsType;

  validationMessages: ValidationMessagesType<TFormDataType>;

  setValidationMessages: React.Dispatch<
    React.SetStateAction<ValidationMessagesType<TFormDataType>>
  >;

  updateTrackerData: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
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

  // The date the entry is recorded on. Optional: a view that does not pass it
  // records on the day of the request, which is what PnL does with its own
  // labelled calendar and what every view did before back-dating existed.
  transactionDateProps?: TransactionDatePropsType;

  //--handle special case of Transfer
  customSelectHandler?: (selectedOption: DropdownOptionType | null) => void;
  //---
};

//----MAIN COMPONENT--------------
const TopCard = <TFormDataType extends Record<string, unknown>>({
  topCardElements,
  validationMessages,
  setValidationMessages, //could be undefined
  updateTrackerData,
  trackerName,
  currency,
  updateCurrency,

  setSelectState,
  isReset,
  isResetDropdown,
  setIsResetDropdown,
  setIsReset,
  //-------
  radioInputProps,
  transactionDateProps,
  //-------
  customSelectHandler,
  //-------
}: TopCardPropType<TFormDataType>): JSX.Element => {
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
  const errorMessage = validationMessages[accountFieldName] || '';
  //(topCardElements.value as string).trim() !== '';//new
//-----------------------------
//console.log('errorMessage:', errorMessage)
//-----------------------------
  //---show error message
  const shouldShowError = !!validationMessages[accountFieldName];
  // && (topCardElements.value as string).trim() !== ''
  //--------------------------
  //console.log('desde topcard', validationMessages.amount, errorMessage,shouldShowError,(topCardElements.value as string).trim() !== '' )
//-----------------------------
  //selection handler
  function stateSelectHandler(selectedOption: DropdownOptionType | null) {
    // should get the account_id of the selected account_name. it supposes that account_name is unique too.
    setSelectState((prev) => ({
      ...prev,
      [accountFieldName]: selectedOption?.value || '',
    }));

    // //console.log('title2', title2.trim(),'label', selectedOption?.label,'value', selectedOption?.value );

//if setValidationMessages is used, then clean the correspondent validation message
//aqui sin validar con zod,  se asigna el valor, y se asume que es valido, y entonces, se  borra el mensaje de error asociado al campo que se selecciono.

    if (setValidationMessages) {
      setValidationMessages((prev) => {
        const newMessages = { ...prev };
        if (newMessages[accountFieldName]) {
          delete newMessages[accountFieldName];
        }
        return newMessages;
      });
    }
  }
  //**********************************/
  //usage of customSelectHandler if it exists
  const finalSelectHandler = customSelectHandler || stateSelectHandler;
  //  //console.log('isResetDropdown', { isResetDropdown });
  // //console.log('selected value from TopCard:', selectedValue);
  //-----------------------------------
   const { targetCurrencyPreview, rate, direction } = useCurrencyPreview(
   topCardElements.value,
   currency
   );
//--------------------------------
//console.log('🔍 Preview:', { targetCurrencyPreview, rate, direction,  });
//--------------------------------
//  Only treat messages starting with '*' as validation errors
  const isAmountError = validationMessages.amount && validationMessages.amount.trim().startsWith('*');

  const showPreview = !!targetCurrencyPreview && !isAmountError;

   // const tooltipText = rate && direction ? `${direction}\nrate:${rate.toFixed(2)}` : '';

   const tooltipText = rate && direction 
  ? `${direction}\nrate: ${numberFormatCurrency(rate, 2, undefined, 'es-ES')}` 
  : '';
//---------------------------------
//console.log('🔍 Tooltip:', tooltipText);//console.log('🔎 showPreview condition:', { targetCurrencyPreview, validationMessagesAmount: validationMessages?.amount, showPreview });
//------------------------
// =======================
// 🧩 RENDER
// =======================
  return (
   <>
     <div className='state__card--top  '>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

        <LabelNumberValidation
          formDataNumber={{ keyName: title1, title: title1 }}
          validationMessages={validationMessages}
          variant={variant}
        />

        {showPreview && (

       <RateTooltip
       tipText={tooltipText}
       surface="light"
       placement="anchor-left"
       >
        <span className='currency-preview'>
        {targetCurrencyPreview}
        </span>
       </RateTooltip>
        )}
      </div>

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
          {/* The label and the date travel together as the row's left group, so
              justify-content: space-between still sees two children in a view
              that also renders the account-type chips on the right, and the
              glyph keeps the same distance from the label in all of them. */}
          <div className='account__labelGroup'>
            <span className='account-label'>
              {capitalize(label2 ?? title2).trim()}
            </span>

            {transactionDateProps && (
              <TransactionDateTrigger {...transactionDateProps} />
            )}
          </div>

          {radioInputProps && (
            <RadioInput
              radioOptionSelected={radioInputProps.radioOptionSelected}
              inputRadioOptions={radioInputProps.inputRadioOptions}
              setRadioOptionSelected={radioInputProps.setRadioOptionSelected}
              title={radioInputProps.title}
              labelId={title2.trim()}
              disabled={radioInputProps.disabled}
              accountTypeSelectionMode={
                radioInputProps.accountTypeSelectionMode
              }
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
