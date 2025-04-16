import React, { useEffect, useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { Link, useLocation } from 'react-router-dom';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import FormDatepicker from '../../../general_components/datepicker/Datepicker.tsx';
import {
  ACCOUNT_TYPE_DEFAULT,
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  VARIANT_FORM,
} from '../../../helpers/constants.ts';
import '../styles/forms-styles.css';
import {
  CurrencyType,
  DropdownOptionType,
  VariantType,
} from '../../../types/types.ts';
import { capitalize, validationData } from '../../../helpers/functions.ts';
import { FormNumberInputType } from '../../../types/types.ts';
import InputNumberFormHandler from '../../../general_components/inputNumberHandler/InputNumberFormHandler.tsx';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation.tsx';
// import { UserStoreType, useUserStore } from '../../../stores/userStore.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';

import {
  // url_account_type_list,
  url_create_basic_account,
} from '../../../endpoints.ts';
import { CreateBasicAccountApiResponseType } from '../../../types/responseApiTypes.ts';
import { AxiosRequestConfig } from 'axios';

// import { useFetch } from '../../../hooks/useFetch.tsx';
//------------------------

//-----temporarily 'till decide how to handle currencies
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
console.log('', { formatNumberCountry });

//---- data config---------
type AccountDataType = {
  name: string;
  date: Date;
  type: string | undefined | null;
  amount: number | string; //later verifyin and fixed input
  currency: string;
};
const initialNewAccountData = {
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

const formDataNumber = { keyName: 'amount', title: 'value' };

const initialFormData: FormNumberInputType = {
  [formDataNumber.keyName]: '',
};
//-------------------------------
function NewAccount() {
  const location = useLocation();
  //get userId from stores
  // const user = useUserStore((state: UserStoreType) => state.userData.userId);
  const user = import.meta.env.VITE_USER_ID;
  // console.log('🚀 ~ NewAccount ~ user:', user);

  //---states------
  const [accountData, setAccountData] = useState<AccountDataType>(
    initialNewAccountData
  );

  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [isReset, setIsReset] = useState<boolean>(false);

  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );

  //endpoint: http://localhost:5000/api/fintrack/account/${type}
  //--------------------------------------------
  //DATA FETCHING
  //OPTION SELECTION: ACCOUNT TYPE
  //account types from account_types table
  // const url = url_account_type_list;
  // const { data, isLoading, error } = useFetch<DropdownOptionType[]>(url);
  const title = 'type';
  const optionsTypeAccounts =
    // !error && !isLoading && data?.length //this is for more general cases where types could change
    //   ? data.map((type) => ({
    //       value: title, //Object.keys(type)[0],
    //       label: Object.values(type)[0], //this is the option name rendered
    //     }))
    //   :
    ACCOUNT_TYPE_DEFAULT;

  // console.log('arreglo:', optionsTypeAccounts);

  //POST: NEW ACCOUNT DATA

  const { data, isLoading, error, requestFn } = useFetchLoad<
    CreateBasicAccountApiResponseType,
    AccountDataType
  >({ url: url_create_basic_account, method: 'POST' });

  //--------------------------------------
  //--used in drop down selection
  const accountSelectionProp = {
    title,
    options: optionsTypeAccounts,
    variant: VARIANT_FORM, //this stablishes the custom styles to use in selection dropdown component
  };
  //---functions-----
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;
    // const valueToSave = name === 'value' ? parseFloat(value) : value;
    setAccountData((prev) => ({ ...prev, [name]: value }));
  }

  function accountTypeSelectHandler(selectedOption: DropdownOptionType | null) {
    if (selectedOption) {
      setAccountData((acc: AccountDataType) => ({
        ...acc,
        type: selectedOption?.label,
      }));
    } else {
      console.log(`No option selected for ${'account type'}`);

      setAccountData((acc: AccountDataType) => ({
        ...acc,
        type: undefined,
      }));
    }
  }
  //---------
  function changeStartingPoint(selectedDate: Date) {
    setAccountData((acc) => ({ ...acc, date: selectedDate }));
    console.log('selected starting point:', selectedDate);
  }
  //---------
  function updateDataCurrency(currency: CurrencyType) {
    setCurrency(currency);
    setAccountData((acc) => ({ ...acc, currency: currency }));
  }
  //--------------------------------------
  async function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On submit Form');
    e.preventDefault();
    //--data form validation
    const newValidationMessages = { ...validationData(accountData) };
    // console.log('mensajes:', { newValidationMessages });

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //-------------------------------------------------------
    //POST TO THE ENDPOINT FOR ACCOUNT DATA HERE
    try {
      const { name, type, currency, amount, date } = accountData;
      const payload = { name, type, currency, amount, date, user };
      // console.log('data to post:',{ ...accountData, user});

      //final URL, url is dynamic depending on type variable
      const finalUrl = `${url_create_basic_account}/${type}`;

      console.log('🚀 ~ onSubmitForm ~ finalUrl:', finalUrl);
      await requestFn(payload, {
        url: finalUrl,
      } as AxiosRequestConfig);

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from New Account request:', data);
      }
      //resetting form values
      setIsReset(true);
      setAccountData(initialNewAccountData);
      setCurrency(defaultCurrency);
      setValidationMessages({});
      setFormData(initialFormData);

      //delay isReset so dropdown type selection updates to null
      setTimeout(() => {
        setIsReset(false);
      }, 1000);
    } catch (error) {
      console.error('Submission error:', error);
    }
  }
  //----------------------------------------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (data && !isLoading && !error) {
      // Success response
      setMessageToUser(data.message || 'Account created successfully!');
      // console.log('Received data:', data);

      //resetting message to user
      timer = setTimeout(() => {
        setMessageToUser(null);
      }, 10000);
    } else if (error) {
      setMessageToUser(error);
      timer = setTimeout(() => setMessageToUser(null), 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [data, isLoading, error]);

  //----
  return (
    <section className='account__page__container page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='account__page__content page__content'>
        <div className='main__title--container'>
          <Link
            to={location.state.previousRoute}
            relative='path'
            className='iconLeftArrow'
          >
            <LeftArrowLightSvg />
          </Link>
          <div className='form__title'>{'New Account'}</div>
        </div>

        <form className='form__box'>
          <div className=' form__container'>
            <div className='input__box'>
              <label htmlFor='name' className='label form__title'>
                {'Account Name'} &nbsp;
                <span className='validation__errMsg'>
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
              />
            </div>
            <div className='input__box'>
              <label className='label form__title'>
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
              />
            </div>

            <div className='account__dateAndCurrency'>
              <div className='account__date'>
                <label className='label form__title'>{'Starting Point'}</label>
                <div className='form__datepicker__container'>
                  <FormDatepicker
                    changeDate={changeStartingPoint}
                    date={accountData.date}
                    variant={'form'}
                    isReset={isReset}
                  ></FormDatepicker>
                </div>
              </div>

              <div className='account__currency'>
                <div className='label form__title'>Currency</div>
                <CurrencyBadge
                  variant={'form'}
                  updateOutsideCurrencyData={updateDataCurrency}
                  currency={currency}
                />
              </div>
            </div>

            <div className='input__box'>
              <LabelNumberValidation
                formDataNumber={formDataNumber}
                validationMessages={validationMessages}
                variant={VARIANT_FORM}
              />

              <InputNumberFormHandler
                validationMessages={validationMessages}
                setValidationMessages={setValidationMessages}
                keyName={formDataNumber.keyName}
                placeholderText={formDataNumber.keyName}
                formData={formData}
                setFormData={setFormData}
                setStateData={setAccountData}
              />
              {/* <input
                style={{ fontSize: '1.25rem', padding: '0 0.75rem' }}
              /> FIGMA STYLE*/}
            </div>
          </div>

          <div className='submit__btn__container'>
            <FormSubmitBtn onClickHandler={onSubmitForm} disabled={isLoading}>
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
              color: 'var(--error,  #d32f2f)',
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
      {/* )
      } */}
    </section>
  );
}

export default NewAccount;
