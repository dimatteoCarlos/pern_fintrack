// src/pages/tracker/components/TopCard.tsx
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection';
import RadioInput, {
 RadioInputPropsType,
} from '../../../general_components/radioInput/RadioInput';
import RateTooltip from '../../../general_components/rateTooltip/RateTooltip';

import {
 capitalize,
 numberFormatCurrency,
 toCalendarDay,
} from '../../../helpers/functions';

import {
 CurrencyType,
 DropdownOptionType,
 TopCardElementsType,
} from '../../../types/types';

import { ValidationMessagesType } from '../../../validations/types';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation';

import { useServerCurrencyConversion } from '../../../hooks/useServerCurrencyConversion';
import { useCurrencyStore } from '../../../stores/useCurrencyStore';
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

  // The chosen day as 'YYYY-MM-DD', for a view that owns its own calendar and so
  // never passes transactionDateProps. Without it that view previews at today's
  // rate while storing the one resolved for the day it actually sends.
  day?: string;

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
  day,
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
  // The day the row will be dated on, which is what the rate has to be resolved
  // for. A view with no calendar of its own records on the day of the request and
  // sends nothing, exactly as it did before back-dating existed.
  const chosenDay =
    day ??
    (transactionDateProps ? toCalendarDay(transactionDateProps.date) : undefined);

  // Asked of the SERVER, not divided on the client. The client-side preview read
  // the live in-memory rate, so a form dated three weeks back showed today's
  // figure while the row stored the one the server resolved for that day — the
  // owner was shown a number the row would not carry. This asks the same service
  // the write path uses, for the same day, so the two cannot disagree.
  const conversion = useServerCurrencyConversion(
    topCardElements.value,
    currency,
    chosenDay,
  );

  // The currency the amount is stored in, as the server declares it.
  const accountingCurrency = useCurrencyStore((state) => {
    return state.accountingCurrency;
  });

  //  Only treat messages starting with '*' as validation errors
  const isAmountError =
    validationMessages.amount && validationMessages.amount.trim().startsWith('*');

  const showPreview = conversion.status !== 'inactive' && !isAmountError;

  const previewText =
    conversion.convertedAmount !== null
      ? `≈ ${numberFormatCurrency(conversion.convertedAmount, 2, undefined, 'es-ES')} ${accountingCurrency}`
      : '';

  // The QUOTE, never the conversion's own rate. Converting a peso to a dollar
  // gives a rate of 0.00031, which two decimals render as 0,00 — the owner is
  // told there is no rate when there is one. The quote is the same figure the
  // provider published, in the direction it published it.
  //
  // Four decimals below ten, because a currency worth less than an accounting
  // unit carries its information after the second place: the euro quotes around
  // 0.8470, which two decimals flatten to 0,85.
  const quotedRate = conversion.quote
    ? numberFormatCurrency(
        conversion.quote.rate,
        Math.abs(conversion.quote.rate) < 10 ? 4 : 2,
        undefined,
        'es-ES',
      )
    : '';

  // Numeric only (day/month/year, es-ES order and separators), not
  // formatCalendarDate's word-month default: that default is en-US on
  // purpose (helpers/constants.ts:57-59) so a spelled-out month doesn't read
  // as the interface itself switching language. Built from the parts and not
  // from new Date(effectiveDate), for the same UTC-midnight reason
  // formatCalendarDate is.
  const effectiveDateLabel = conversion.effectiveDate
    ? (() => {
        const [year, month, day] = conversion.effectiveDate!
          .split('-')
          .map(Number);
        if (!year || !month || !day) return '';
        return new Date(year, month - 1, day).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      })()
    : '';

  // Three lines, and the third is the one that was missing: which day the rate
  // belongs to. A market closed on the chosen day is valued by the last one that
  // quoted, and without saying so the owner cannot tell a rate FOR that day from
  // a rate IN FORCE on it.
  const tooltipText = [
    conversion.quote
      ? `${accountingCurrency}→${conversion.quote.currency}`
      : '',
    quotedRate ? `rate: ${quotedRate}` : '',
    effectiveDateLabel ? `for ${effectiveDateLabel}` : '',
  ]
    .filter(Boolean)
    .join('\n');
// =======================
// 🧩 RENDER
// =======================
  return (
   <>
     <div className='state__card--top  '>

      {/* position: relative so the rate chip can anchor to this whole row
          instead of to the narrow preview span at its right end -- the span
          leaves it no room to sit anywhere but over the navbar above. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>

        <LabelNumberValidation
          formDataNumber={{ keyName: title1, title: title1 }}
          validationMessages={validationMessages}
          variant={variant}
        />

        {/* Three states, and they are not degrees of one another. A rate the
            server could not resolve used to render exactly like an amount that
            needs no conversion — nothing at all — which is the one case where
            the owner most needs to be told. */}
        {showPreview && conversion.status === 'querying' && (
          <span
            className='currency-preview currency-preview--querying'
            aria-live='polite'
            aria-label={`Converting to ${accountingCurrency}`}
          />
        )}

        {showPreview && conversion.status === 'resolved' && previewText && (
          <RateTooltip
            tipText={tooltipText}
            surface='light'
            placement='row-centred'
          >
            <span className='currency-preview'>{previewText}</span>
          </RateTooltip>
        )}

        {showPreview && conversion.status === 'failed' && (
          <span
            className='currency-preview currency-preview--failed'
            role='status'
          >
            No rate — the server resolves it on save.
            <button
              type='button'
              className='currency-preview__retry'
              onClick={conversion.retry}
            >
              Retry
            </button>
          </span>
        )}
      </div>

        <div className='card__screen'>
          {/* The error for this field is rendered by LabelNumberValidation as
              a sibling above; these two attributes are what tie it to the
              input, so a screen reader announces the field as invalid and
              reads the reason. InputField.tsx does the same for the auth
              forms — this raw input is the one place that did not. */}
          {/* The date leads the field it qualifies. The amount is the headline
              of the movement and the date is a fact about that movement, so
              "this much, on this day" is one reading; on the account's line it
              was a fact about the account. The field was already a row of two —
              the figure and its unit — so a third element costs it no row. */}
          {transactionDateProps && (
            <TransactionDateTrigger {...transactionDateProps} />
          )}

          <input
            className='inputNumber'
            id={title1}
            name={title1}
            type='text'
            /* The browser's own form history was offering past amounts over
               the account selector below it. Same setting PocketCashModal's
               amount field already carries. */
            autoComplete='off'
            placeholder={trackerName}
            value={value} //amountValue
            onChange={updateTrackerData} //onAmountChange
            aria-invalid={Boolean(validationMessages[title1])}
            aria-describedby={
              validationMessages[title1] ? `${title1}-validation` : undefined
            }
          />

          <CurrencyBadge
            variant={variant}
            updateOutsideCurrencyData={updateCurrency}
            currency={currency}
          />
        </div>

        <div className='account card--title '>
          {/* The label alone now. The date used to sit beside it, where it read
              as a property of the ACCOUNT rather than of the movement — and in
              Transfer, whose label is the word "From:", the pair came out as a
              date range: "From: 30 Aug ... Today". It moved into the amount
              field above, which is the movement's own headline. */}
          <div className='account__labelGroup'>
            <span className='account-label'>
              {capitalize(label2 ?? title2).trim()}
            </span>
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
