//src/pages/forms/newAccount/NewAccount.tsx
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AxiosRequestConfig } from 'axios';

import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../../assets/LeftArrowSvg.svg';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import FormDatepicker from '../../../general_components/datepicker/Datepicker.tsx';
import InputNumberFormHandler from '../../../general_components/inputNumberHandler/InputNumberFormHandler.tsx';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation.tsx';
import CharacterCounter from '../../../general_components/characterCounter/CharacterCounter.tsx';
import RateTooltip from '../../../general_components/rateTooltip/RateTooltip.tsx';

import {
  ACCOUNT_TYPE_DEFAULT,
  DEFAULT_CURRENCY,
  VARIANT_FORM,
} from '../../../helpers/constants.ts';

import { url_create_basic_account } from '../../../../urlConfig.ts';

import '../styles/forms-styles.css';

import {
  CurrencyType,
  DropdownOptionType,
  FormNumberInputType,
  VariantType,
} from '../../../types/types.ts';

import { CreateBasicAccountApiResponseType } from '../../../types/responseApiTypes.ts';

import {
  capitalize,
  numberFormatCurrency,
} from '../../../helpers/functions.ts';
import { validationData } from '../../../validations/utils/custom_validation.ts';

import {
  RequestFailureType,
  useFetchLoad,
} from '../../../hooks/useFetchLoad.ts';
import { useCurrencyPreview } from '../../../hooks/useCurrencyPreview.ts';
import useAuth from '../../../../auth/hooks/useAuth.ts';
import { AUTH_ROUTE } from '../../../../auth/auth_constants/constants.ts';

import { NAME_MAX_LENGTHS } from '../../../validations/utils/inputConstraints/nameMaxLengths.ts';

// 📝Import hook for account existence validation
import { useAccountExistence } from '../../../hooks/useAccountExistence.ts';
// 📝Import debounced callback hook
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback.ts';
//-------------------------
//-----handle currency
const defaultCurrency = DEFAULT_CURRENCY;

//---- data config---------
type AccountDataType = {
  name: string;
  date: Date;
  type: string | undefined | null;
  amount: number | ''; //later verifyin and fixed input
  currency: string;
};

const initialNewAccountData: AccountDataType = {
  name: '', //'Account Name',
  type: '', //'Account Type',
  date: new Date(), //'Starting Point'
  amount: '', // 'Value'
  currency: 'usd',
};

//Type Options
export type TypeOptionsType = {
  title: string;
  options: {
    value: string;
    label: string;
  }[];
  variant: VariantType;
};

// The latest opening day the calendar offers. An account cannot have been
// opened after today, and one dated forward is filtered out of every tracker
// selector by isAccountOpenOn with nothing on screen saying why.
const latestOpeningDay = (): Date => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
};

// The earliest opening day the calendar offers. An operative date belongs to
// the month in course, so an earlier one comes back from the server as a 422
// the form cannot explain. Without this the picker falls back to its own 1900
// default, and the year dropdown puts that within two clicks.
const earliestOpeningDay = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
};

// A value the server put in details, only when it really is text.
const asText = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

// What the owner reads when the server refuses to create the account.
//
// Keyed on the stable code the server declares, never on its sentence: that
// sentence is written for a developer, in English, and is rewritten whenever
// the message is improved. A code with no entry here falls through to the
// server's own prose, which reads worse but is never blank.
//
// Only the conditions this form can actually produce are listed. The calendar
// already refuses a day outside the current month, so the two date entries are
// the backstop for a form that got past it, not the normal path.
const openingErrorText = (failure: RequestFailureType | null): string | null => {
  if (!failure) return null;

  const details = failure.details ?? {};

  switch (failure.code) {
    case 'OPENING_DATE_BEFORE_CURRENT_MONTH': {
      const from = asText(details.currentMonthStart);
      return from
        ? `An account can only be opened this month. Pick a day from ${from} onwards.`
        : 'An account can only be opened this month. Pick a day from the first of the month onwards.';
    }
    case 'OPENING_DATE_AFTER_TODAY':
      return 'An account cannot be opened on a future day. Pick today, or an earlier day this month.';
    case 'INVALID_OPENING_DATE':
      return 'The opening date could not be read. Pick the day again from the calendar.';
    case 'FX_RATE_UNAVAILABLE': {
      const day = asText(details.requestedDay);
      return `No exchange rate has been published for ${day ?? 'that day'} yet. Try again in a moment, or open the account dated today.`;
    }
    default:
      return null;
  }
};

const formDataNumber = { keyName: 'amount', title: 'value' };
const initialFormData: FormNumberInputType = {
  [formDataNumber.keyName]: '',
};
//=============================
//MAIN COMPONENTE NEW ACCOUNT
//=============================
function NewAccount() {
  const location = useLocation();
  const navigateTo = useNavigate();
  const { isAuthenticated } = useAuth();

  //---states------
  const [accountData, setAccountData] = useState<AccountDataType>(
    initialNewAccountData,
  );

  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);

  const [isCurrencyDisabled, setIsCurrencyDisabled] = useState<boolean>(false);

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [isDisabledValue, setIsDisabledValue] = useState<boolean>(false);

  const [isReset, setIsReset] = useState<boolean>(false);

  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null,
  );

  // 📝Hook for autocomplete and duplicate checking
   const { getSuggestions, checkDuplicate } = useAccountExistence();
  
  // 📝 ADDED: Debounced duplicate check (300ms)
   const debouncedCheckDuplicate = useDebouncedCallback((name: string, type: string) => {
     const trimmed = name.trim();
     if (trimmed.length > 0 && type && checkDuplicate(trimmed, type)) {
       setValidationMessages(prev => ({
         ...prev,
         name: 'ℹ️ This account name already exists for this type'
       }));
     } else {
       setValidationMessages(prev => ({ ...prev, name: '' }));
     }
   }, 300);

  //---------------------------
  // 🆕 VERIFICAR AUTENTICACIÓN AL INICIO
  useEffect(() => {
    if (!isAuthenticated) {
      setMessageToUser('Please log in to create an account');
      // 🆕 OPCIONAL: Redirigir al login después de un tiempo
      setTimeout(() => navigateTo(AUTH_ROUTE), 3500);
    }
  }, [isAuthenticated, navigateTo]);

  //---------------------------
  //endpoint: http://localhost:5000/api/fintrack/account/${type}
  //DATA FETCHING
  //OPTION SELECTION: ACCOUNT TYPE
  //account types from account_types table

  const title = 'type';
  const optionsTypeAccounts = ACCOUNT_TYPE_DEFAULT;

  //POST: NEW ACCOUNT DATA
  const { data, isLoading, error, failure, requestFn } = useFetchLoad<
    CreateBasicAccountApiResponseType,
    AccountDataType
  >({ url: url_create_basic_account, method: 'POST' });

  //--------------------------------
  //--used in drop down selection
  const accountSelectionProp = {
    title,
    options: optionsTypeAccounts,
    variant: VARIANT_FORM, //this stablishes the custom styles to use in selection dropdown component
  };
  //---functions---------------
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;

   // Update state 
    setAccountData((prev) => ({ ...prev, [name]: value }));

  // Only validate 'name' field for duplicates (with debounce)
   if (name === 'name') {
    debouncedCheckDuplicate(value, accountData.type || '');
   }
  }

  //---
  function amountIncomeSource() {
    setIsDisabledValue(true);
    setAccountData((prev) => ({ ...prev, ['amount']: 0 }));
  }
  //---
  function accountTypeSelectHandler(selectedOption: DropdownOptionType | null) {
    if (selectedOption) {
      setAccountData((acc: AccountDataType) => ({
        ...acc,
        type: selectedOption?.label,//newType
      }));

      if (selectedOption.label === 'income_source') {
        amountIncomeSource();
        setIsDisabledValue(true);
        setCurrency(defaultCurrency);
        setAccountData(prev => ({ ...prev, currency: defaultCurrency }));
       setIsCurrencyDisabled(true);         
        return;
      } else {
        setAccountData((acc: AccountDataType) => ({ ...acc, type: selectedOption?.label,
        }));
        setIsDisabledValue(false);
        setIsCurrencyDisabled(false);
      }
    } else {
    // console.log(`No option selected for ${'account type'}`);
      setAccountData((acc: AccountDataType) => ({
        ...acc,
        type: undefined,
      }));
      setIsDisabledValue(false);
      setIsCurrencyDisabled(false);
    }

   // 📝 Validate duplicate when type changes (if name is already written)
  const currentName = accountData.name.trim();
  if (currentName.length > 0 && selectedOption?.label) {
    const newType = selectedOption.label;
    if (checkDuplicate(currentName, newType)) { setValidationMessages(prev => ({
        ...prev,
        name: 'ℹ️ This account name already exists for this type'
      }));
    } else {
     setValidationMessages(prev => ({ ...prev, name: '' }));
    }
   } 
  }
  //---------
  function changeStartingPoint(selectedDate: Date) {
    setAccountData((acc) => ({ ...acc, date: selectedDate }));
    // console.log('selected starting point:', selectedDate);
  }
  //---------
  function updateDataCurrency(currency: CurrencyType) {
    setCurrency(currency);
    setAccountData((acc) => ({ ...acc, currency: currency }));
   }
  //---------
  // States what the backend will actually store for the opening balance. Reads
  // the rates already held in the store, so it issues no request.
  const { targetCurrencyPreview, rate, direction } = useCurrencyPreview(
    formData[formDataNumber.keyName],
    currency,
  );

  const isAmountError = !!validationMessages[formDataNumber.keyName]
    ?.trim()
    .startsWith('*');

  const showRatePreview = !!targetCurrencyPreview && !isAmountError;

  const rateTooltipText =
    rate && direction
      ? `${direction}\nrate: ${numberFormatCurrency(rate, 2, undefined, 'es-ES')}`
      : '';

   //--FORM SUBMISSION ------------
  async function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    // console.log('On submit Form');

    // 🆕 VERIFY AUTH BEFORE SENDING
    if (!isAuthenticated) {
      setMessageToUser('Please log in to create an account');
      return;
    }

    // ✅ DATA FORM VALIDATION
    const newValidationMessages = { ...validationData(accountData) };
    // console.log('message validation:', { newValidationMessages });

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //-------------------------------------
    //POST TO THE ENDPOINT FOR ACCOUNT DATA
    try {
      const { name, type, currency, amount, date } = accountData;

      const payload: AccountDataType = {
        name,
        type,
        currency,
        amount,
        date,
      } as AccountDataType;

      console.log('data to post:', { ...accountData });

      //final URL, url is dynamic depending on type variable
      const finalUrl = `${url_create_basic_account}/${type}`;

      // console.log('🚀 ~ onSubmitForm ~ finalUrl:', finalUrl);

      await requestFn(payload, {
        url: finalUrl,
      } as AxiosRequestConfig);

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from New Account request:', data);
      }

      //resetting form values
      setIsReset(true);
      setValidationMessages({});
      setFormData(initialFormData);
      setAccountData(initialNewAccountData);
      // setCurrency(defaultCurrency);
      setIsDisabledValue(false);
      setMessageToUser(null);

      //delay isReset so dropdown type selection updates to null
      setTimeout(() => {
        setIsReset(false);
      }, 1000);
    } catch (error) {
      const messageError = 'Submission error';
      console.error(messageError, error);
      setMessageToUser(messageError);
    }
  }
  //-----------------------------------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (data && !isLoading && !error) {
      // Success response
      setMessageToUser(data.message || 'Account successfully  created!');
      // console.log('Received data:', data);

      //resetting message to user
      timer = setTimeout(() => {
        setMessageToUser(null);
      }, 4000);
    } else if (error) {
      // This form's own wording when the server named the condition, and the
      // server's sentence when it did not.
      setMessageToUser(openingErrorText(failure) ?? error);
      timer = setTimeout(() => setMessageToUser(null), 4000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [data, isLoading, error, failure]);

  // 🆕 DESHABILITAR FORMULARIO SI NO ESTÁ AUTENTICADO
  const isFormDisabled = !isAuthenticated;
  //----
  return (
    <section className='account__page__container page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='account__page__content page__content'>
        <div className='main__title--container'>
          <Link
            to={location.state.previousRoute || '/dashboard'}
            relative='path'
            className='iconLeftArrow'
          >
            <LeftArrowLightSvg />
          </Link>
          <div className='form__title'>{'New Account'}</div>
        </div>

        {/* 🆕 MESSAGE FOR NOT AUTHENTICATED */}
        {!isAuthenticated && (
          <div
            className='error-message'
            style={{ margin: '1rem 0', padding: '1rem' }}
          >
            Please log in to create a new account
          </div>
        )}

        <form className='form__box' autoComplete='off'>
          <div className=' form__container'>
           
            <div className='input__box'>
              <label className='label forms__label'>
                Account Type &nbsp;
                <span className='validation__errMsg'>
                  {validationMessages['type']}
                </span>
              </label>

              <DropDownSelection
                dropDownOptions={accountSelectionProp}
                updateOptionHandler={accountTypeSelectHandler}
                isReset={isReset}
                setIsReset={setIsReset}
                //disabled={isFormDisabled} // 🆕 DESHABILITAR SI NO AUTENTICADO
              />
            </div>

            <div className='input__box'>
              <label htmlFor='name' className='label forms__label'>
                {'Account Name'}
                <CharacterCounter
                  value={accountData.name}
                  maxLength={NAME_MAX_LENGTHS.account_name}
                />
                &nbsp;
                <span className={`validation__errMsg ${validationMessages['name']?.includes('ℹ️') ? 'validation__msg--info' : ''}`}>
                 {validationMessages['name']}
                </span>
              </label>

              <input
                type='text'
                className='input__container'
                placeholder='Account Name'
                name='name'
                onChange={inputHandler}
                value={accountData.name}
                disabled={isFormDisabled} //if not auth
                maxLength={NAME_MAX_LENGTHS.account_name}
                list='account-names'
              />
            </div>

            <datalist id='account-names'>
             {getSuggestions(accountData.type || '').map((name) => (
               <option key={name} value={name} />
             ))}
           </datalist>

            <div className='account__dateAndCurrency'>
              <div className='account__date'>
                <label className='label forms__label'>{'Starting Point'}</label>
                <div className='form__datepicker__container'>
                  <FormDatepicker
                    changeDate={changeStartingPoint}
                    date={accountData.date}
                    variant={'form'}
                    minDate={earliestOpeningDay()}
                    maxDate={latestOpeningDay()}
                    // disabled={isFormDisabled}
                  ></FormDatepicker>
                </div>
              </div>

              <div className='account__currency'>
                <div className='label forms__label'>Currency</div>
                <CurrencyBadge
                  variant={'form'}
                  updateOutsideCurrencyData={updateDataCurrency}
                  currency={currency}
                  disabled={isCurrencyDisabled}
                />
              </div>
            </div>

            {!isDisabledValue && (
              <div className='input__box'>
                {/* Label and conversion message share a row, as in New Category:
                    the message states what will be stored, and the rate tooltip
                    opens over it. */}
                <div className='form__label-row'>
                  <LabelNumberValidation
                    formDataNumber={formDataNumber}
                    validationMessages={validationMessages}
                    variant={VARIANT_FORM}
                  />

                  {showRatePreview && (
                    <RateTooltip
                      tipText={rateTooltipText}
                      surface='dark'
                      placement='anchor-left'
                    >
                      <span className='form__fx-preview'>
                        {targetCurrencyPreview}
                      </span>
                    </RateTooltip>
                  )}
                </div>

                <InputNumberFormHandler
                  validationMessages={validationMessages}
                  setValidationMessages={setValidationMessages}
                  keyName={formDataNumber.keyName as keyof AccountDataType}
                  placeholderText={formDataNumber.keyName}
                  formData={formData}
                  setFormData={setFormData}
                  setStateData={setAccountData}
                  // disabled={isFormDisabled}
                />
           
              </div>
            )}
          </div>

          <div className='submit__btn__container'>
            <FormSubmitBtn
              onClickHandler={onSubmitForm}
              disabled={isLoading || isFormDisabled}
            >
              save
            </FormSubmitBtn>
          </div>
        </form>
      </div>

      {isLoading && <div style={{ color: 'cyan' }}>Loading...</div>}

      {error && (
        <div className='error-message'>
          <span
            className='validation__errMsg'
            style={{
              color: 'var(--error, #d32f2f)',
              borderRadius: '4px',
              margin: '1rem 0',
              fontSize: '1rem',
              fontWeight: '200',
              lineHeight: '1.5rem',
            }}
          >
            {/* Error: {error} */}
            {messageToUser}
          </span>
        </div>
      )}

      {!error && messageToUser && (
        <div className='success-message'>
          <span
            style={{
              color: 'lightgreen',
              fontSize: '1rem',
              marginTop: '1rem',
              textAlign: 'center',
              fontWeight: '200',
              lineHeight: '1.5rem',
            }}
          >
            {capitalize(messageToUser)}
          </span>
        </div>
      )}
    </section>
  );
}

export default NewAccount;
