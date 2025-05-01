import React, { useState } from 'react';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { Link, useLocation } from 'react-router-dom';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import '../styles/forms-styles.css';
import { useFetch } from '../../../hooks/useFetch.tsx';
import {
  DropdownOptionType,
  ExpenseAccountsType,
} from '../../../types/types.ts';
import { url_accounts } from '../../../endpoints.ts';
import {
  ACCOUNT_OPTIONS_DEFAULT,
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  TYPEDEBTS_OPTIONS_DEFAULT,
  VARIANT_FORM,
} from '../../../helpers/constants.ts';
import { capitalize, validationData } from '../../../helpers/functions.ts';
import { FormNumberInputType } from '../../../types/types.ts';
import InputNumberFormHandler from '../../../general_components/inputNumberHandler/InputNumberFormHandler.tsx';

//-----temporarily 'till decide how to handle currencies
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
console.log('', { formatNumberCountry });

//----Temporary initial values----------
type ProfileDataType = {
  name: string;
  lastname: string;
  account: string;
  type: string;
  amount: number | '';
};
const initialNewProfileData: ProfileDataType = {
  name: '',
  lastname: '',
  account: '',
  type: '',
  amount: '',
};
//Type Options
const typeSelectionProp = {
  title: 'select type', //select type
  options: TYPEDEBTS_OPTIONS_DEFAULT,
  variant: VARIANT_FORM, //this set the customStyle to use in selection dropdown component
};
// const initialFormData: FormNumberInputType = {
//   amount: '',
// };
const formDataNumber = { keyName: 'amount', title: 'value' };
const initialFormData: FormNumberInputType = {
  [formDataNumber.keyName]: '',
};
// const initialFormData: FormNumberInputType = {
//   value: '',
// };

// type CreateDebtorAccountPayload = {
//   value: number; // Puede ser number aquí y convertirse a string después
//   debtor_name: string;
//   debtor_lastname: string;
//   selected_account_id?: number; // Opcional para creación
//   currency_code: CurrencyCode;

// };
//-----------------------
function NewProfile() {
  const location = useLocation();
  //-----states------
  const [profileData, setProfileData] = useState<ProfileDataType>(
    initialNewProfileData
  );
  // const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [isReset, setIsReset] = useState<boolean>(false);
  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);

  //DATA FETCHING for option selection
  const {
    apiData,
    isLoading,
    error: accountError,
  } = useFetch<ExpenseAccountsType>(url_accounts);

  const optionsExpenseAccounts =
    !accountError && !isLoading && apiData?.accounts?.length
      ? apiData.accounts.map((acc) => ({
          value: acc.name,
          label: acc.name,
        }))
      : ACCOUNT_OPTIONS_DEFAULT;

  //--for drop down selection
  const accountSelectionProp = {
    title: 'Available Account',
    options: optionsExpenseAccounts,
    variant: VARIANT_FORM, //this stablishes the custom styles to use in selection dropdown component
  };
  //---functions-----
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  }

  function typeSelectHandler(selectedOption: DropdownOptionType | null) {
    //check any
    if (selectedOption) {
      // console.log('selectedOption desde typeSelectHandler', { selectedOption });
      setProfileData((prev: ProfileDataType) => ({
        ...prev,
        type: selectedOption.value,
      })); //check any
    } else {
      console.log(`No option selected for ${'type'}`);
    }
  }

  //Esta funcion "accountSelectHandler" se puede definir dentro del componente DropDownSelection y solo pasar como prop, la funcion para modificar el estado correspondiente, en este caso setProfileData. selectedOption es manejado internamente por la libreria Select.

  function accountSelectHandler(selectedOption: DropdownOptionType | null) {
    //check any
    setProfileData((prev: ProfileDataType) => ({
      ...prev,
      account: selectedOption!.value,
    }));
  }
  //------------------
  function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    console.log('onSubmitForm');
    //--data form validation
    const newValidationMessages = { ...validationData(profileData) }; // console.log('mensajes:', { newValidationMessages });
    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //-------------------------------------------------------
    //POST the new profile debtor data into database
    // type ProfileDataType = {
    //   name: string;
    //   lastname: string;
    //   account: string | number;
    //   type: string;
    //   amount: number | '';
    // };

    console.log('New debtor data to POST:', { profileData });
    console.log('check this:', formData, formDataNumber);

    const debtorAccountData = {
      type: 'debtor',
      name: `${profileData.name}, ${profileData.lastname}`, //name, lastname
      currency: 'usd',
      amount: formDataNumber.keyName || profileData.amount,
      date: new Date(),
      //---
      debtor_lastname: profileData.lastname,
      debtor_name: profileData.name,
      value: formDataNumber.keyName || profileData.amount,
      selected_account_name: profileData.account, //
      // selected_account_id: profileData.account_id, //
      selected_account_id: 1, //
      debtor_transaction_type_name: profileData.type,
    };
    console.log(debtorAccountData);

    //-------------------------------------------------------
    //POST the new profile data into database
    console.log('data to POST:', { profileData });
    //resetting form values
    setIsReset(true);
    setValidationMessages({});
    setProfileData(initialNewProfileData);
    console.log('submit form button');
    setFormData(initialFormData);
    // after a delay, change isReset to false
    setTimeout(() => setIsReset(false), 500);
  }
  //input number form params
  const keyName = 'amount',
    title = 'value';
  return (
    <section className='profile__page__container page__container '>
      <TopWhiteSpace variant={'dark'} />
      <div className='profile__page__content page__content'>
        <div className='main__title--container '>
          <Link
            to={location.state.previousRoute}
            relative='path'
            className='iconLeftArrow'
          >
            <LeftArrowLightSvg />
          </Link>
          <div className='form__title'>{'New Profile'}</div>
        </div>
        <form className='form__box'>
          <div className='container--profileName form__container '>
            <div className='input__box'>
              <label htmlFor='name' className='label form__title'>
                {'Name'}
                <span className='validation__errMsg'>
                  {validationMessages['name']}
                </span>
              </label>
              <input
                type='text'
                className={`input__container`}
                placeholder={`Name`}
                name={'name'}
                onChange={inputHandler}
                value={profileData.name}
              />
            </div>

            <div className='input__box'>
              <label htmlFor='lastname' className='label form__title'>
                {'Last Name'}
                <span className='validation__errMsg'>
                  {validationMessages['lastname']}
                </span>
              </label>
              <input
                type='text'
                className={`input__container`}
                placeholder={`last name`}
                name={'lastname'}
                onChange={inputHandler}
                value={profileData.lastname}
              />
            </div>
            <div className='input__box'>
              {/* <label className='label form__title'>{'Add Money'}</label> */}
              <label className='label form__title'>
                Account &nbsp;
                <span className='validation__errMsg'>
                  {validationMessages['account']}
                </span>
              </label>
              {/* accounts*/}
              <DropDownSelection
                dropDownOptions={accountSelectionProp}
                updateOptionHandler={accountSelectHandler}
                // optionKeySelected='account'
                isReset={isReset}
                setIsReset={setIsReset}
              />

              <label htmlFor={keyName} className='label form__title'>
                {capitalize(title)}&nbsp;
                <span
                  className='validation__errMsg'
                  style={{
                    color: validationMessages[keyName]
                      ?.toLowerCase()
                      .includes('format:')
                      ? 'var(--lightSuccess)'
                      : 'var(--error)',
                  }}
                >
                  {validationMessages[keyName]?.replace('Format:', '')}
                </span>
              </label>

              <InputNumberFormHandler
                validationMessages={validationMessages}
                setValidationMessages={setValidationMessages}
                keyName={keyName}
                placeholderText={keyName}
                formData={formData}
                setFormData={setFormData}
                setStateData={setProfileData}
              />
              {/* style={{ fontSize: '1.25rem', padding: '0 0.75rem' }} */}
            </div>
            <div className='input__box'>
              <label className='label form__title'>
                {'Type'}
                <span className='validation__errMsg'>
                  {validationMessages['type']}
                </span>
              </label>
              {/* action debtor type */}
              <DropDownSelection
                dropDownOptions={typeSelectionProp}
                updateOptionHandler={typeSelectHandler}
                isReset={isReset}
                setIsReset={setIsReset}
              />
            </div>
          </div>
          {/* save */}
          <div className='submit__btn__container'>
            <FormSubmitBtn onClickHandler={onSubmitForm}>save</FormSubmitBtn>
          </div>
        </form>
      </div>
    </section>
  );
}

export default NewProfile;
