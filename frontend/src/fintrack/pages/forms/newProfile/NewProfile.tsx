//frontend/src/pages/forms/newProfile/NewProfile.tsx
// 🎯 IMPORTS
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
// 📦 COMPONENTS
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import InputNumberFormHandler from '../../../general_components/inputNumberHandler/InputNumberFormHandler.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';

import '../styles/forms-styles.css';

// 🖼️ ASSETS
import LeftArrowLightSvg from '../../../../assets/LeftArrowSvg.svg';

// 🛠️ CUSTOM HOOKS & UTILITIES
import { useFetch } from '../../../hooks/useFetch.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
import useAuth from '../../../../auth/hooks/useAuth.ts';
//UTILITIES
import { capitalize } from '../../../helpers/functions.ts';
import { validationData } from '../../../validations/utils/custom_validation.ts';

// 🏷️ ENPOINTS
import {
  url_create_debtor_account,
  url_get_accounts_by_type,
} from '../../../../endpoints.ts';

// 🏷️ TYPES & CONSTANTS
import { CurrencyType, DropdownOptionType } from '../../../types/types.ts';
import {
  AccountByTypeResponseType,
  CreateDebtorAccountApiResponseType,
} from '../../../types/responseApiTypes.ts';
//CONSTANTS
import {
  ACCOUNT_OPTIONS_DEFAULT,
  DEFAULT_CURRENCY,
  TYPEDEBTS_OPTIONS_DEFAULT,
  VARIANT_FORM,
} from '../../../helpers/constants.ts';
import { AUTH_ROUTE } from '../../../../auth/auth_constants/constants.ts';
import { NAME_MAX_LENGTHS } from '../../../validations/inputConstraints/nameMaxLengths.ts';
import CharacterCounter from '../../../general_components/characterCounter/CharacterCounter.tsx';

//-----default 'till decide how to handle multi currencies
const defaultCurrency = DEFAULT_CURRENCY;

// 📋 --TYPE DEFINITIONS, INITIALIZATION AND CONSTANTS ------
type ProfileInputDataType = {
  name: string;
  lastname: string;
  account: string;
  type: string;
  amount: string | '';
  currency?: CurrencyType;
};

type ProfilePayloadType = {
  name: string;
  lastname: string;
  transaction_type: string;
  account_type: string;
  amount: number | '';
  currency?: CurrencyType;
  selected_account_name: string;
  selected_account_type: string;
  user?: string;
};

// ⚙️ INITIAL STATES
const initialNewProfileData: ProfileInputDataType = {
  name: '',
  lastname: '',
  type: '',
  amount: '',
  account: '',
};
//Type transaction Options
const typeSelectionProp = {
  title: 'select type',
  options: TYPEDEBTS_OPTIONS_DEFAULT,
  variant: VARIANT_FORM, //set customStyle in selection dropdown component
};
// === INITIAL STATE DATA ===
const formDataNumber: { keyName: keyof ProfileInputDataType; title: string } = {
  keyName: 'amount',
  title: 'value',
};
const initialFormData: Partial<ProfileInputDataType> = {
  [formDataNumber.keyName]: '',
};

const selected_account_type = 'bank',
  account_type = 'debtor';

//========================
//🎯 COMPONENT DEFINITION ===
//========================
function NewProfile() {
  const location = useLocation();
  const navigateTo = useNavigate();

  // 🏁 STATE MANAGEMENT
  const { isAuthenticated } = useAuth();

  // === STATE INITIALIZATION ===
  const [formData, setFormData] =
    useState<Partial<ProfileInputDataType>>(initialFormData);

  const [profileData, setProfileData] = useState<ProfileInputDataType>(
    initialNewProfileData,
  );

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [isReset, setIsReset] = useState<boolean>(false);

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null,
  );

  const [reloadTrigger, setReloadTrigger] = useState(0);

  //✅ CHECK IF USER IS AUTHENTICATED
  useEffect(() => {
    if (!isAuthenticated) {
      setMessageToUser('Please log in to create an account');
      setTimeout(() => navigateTo(AUTH_ROUTE), 5000);
    }
  }, [isAuthenticated, navigateTo]);
  //----------------------------------------------
  // 🌐 DATA FETCHING for option selection
  //GET: AVAILABLE ACCOUNTS OF TYPE BANK
  //http://localhost:5000/api/fintrack/account/new_account/debtor
  const fetchUrl = `${url_get_accounts_by_type}/?type=bank&${reloadTrigger}`;

  const {
    apiData: BankAccountsResponse,
    isLoading: isLoadingBankAccounts,
    error: fetchedErrorBankAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchUrl as string);

  const optionAccounts = useMemo(() => {
    if (fetchedErrorBankAccounts) {
      return ACCOUNT_OPTIONS_DEFAULT;
    }
    const accountList = BankAccountsResponse?.data?.accountList ?? [];

    return accountList.length
      ? accountList.map((acc) => ({
          value: acc.account_name,
          label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})`,
          // label: acc.account_name,
        }))
      : ACCOUNT_OPTIONS_DEFAULT;
  }, [BankAccountsResponse?.data.accountList, fetchedErrorBankAccounts]);

  //--for drop down selection
  const accountSelectionProp = {
    title: 'Select Account',
    options: optionAccounts,
    variant: VARIANT_FORM, //this stablishes the custom styles to use in selection dropdown component
  };
  //---------------------
  // 🚀 API REQUEST EXECUTION
  //DATA FETCHING POST
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  //endpoint: http://localhost:5000/api/fintrack/account/new_account/debtor
  const { data, isLoading, error, requestFn } = useFetchLoad<
    CreateDebtorAccountApiResponseType,
    ProfilePayloadType
  >({ url: url_create_debtor_account, method: 'POST' });
  //---functions------------
  // ✨ INPUT HANDLERS
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  }
  //---
  function typeSelectHandler(selectedOption: DropdownOptionType | null) {
    const newValue = selectedOption === null ? '' : selectedOption?.value || '';
    setProfileData((prev) => ({
      ...prev,
      type: newValue,
    }));

    //Immediate validation / Validación inmediata
    if (selectedOption === null) {
      setValidationMessages((prev) => ({
        ...prev,
        type: '* Please provide the Type',
      }));
    } else {
      setValidationMessages((prev) => ({
        ...prev,
        type: '',
      }));
    }
  }
  //---
  function accountSelectHandler(selectedOption: DropdownOptionType | null) {
    const newValue = selectedOption === null ? '' : selectedOption?.value || '';
    setProfileData((prev) => ({
      ...prev,
      account: newValue,
    }));

    // Immediate Validation Validación inmediata
    if (selectedOption === null) {
      setValidationMessages((prev) => ({
        ...prev,
        account: '* Please provide the Account',
      }));
    } else {
      setValidationMessages((prev) => ({
        ...prev,
        account: '',
      }));
    }
  }
  //--------------------
  // 📤 FORM SUBMISSION LOGIC (onSubmitForm)
  async function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    // console.log('onSubmitForm');
    //--data form validation
    const newValidationMessages = validationData(profileData);
    // console.log('mensajes:', { newValidationMessages });
    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //-----------------
    try {
      const finalAmount =
        profileData.amount === ''
          ? 0 // Si es cadena vacía, pasa cadena vacía (compatible)
          : Number(profileData.amount); // Si es string de número, conviértelo a number

      const payload: ProfilePayloadType = {
        account_type,
        currency: defaultCurrency,
        amount: finalAmount,
        //---
        lastname: capitalize(profileData.lastname),
        name: capitalize(profileData.name),
        transaction_type: profileData.type,
        selected_account_name: profileData.account,
        selected_account_type,
      };
      const data = await requestFn(payload);
      if (data.error) {
        //setValidationMessages({});
        return;
      }

      if (import.meta.env.VITE_ENVIRONMENT === 'developmentX') {
        console.log('Data from New Debtor request:', data);
      }
      //--------------------
      //POST the new profile data into database
      // console.log('data to POST:', { profileData });

      // 🔄 RESET FORM ON SUCCESS
      setIsReset(true);
      setValidationMessages({});
      setProfileData(initialNewProfileData);
      setFormData(initialFormData);
      setReloadTrigger((prev) => prev + 1);
      // after a delay, change isReset to false
      setTimeout(() => setIsReset(false), 300);
    } catch (error) {
      console.log('Error when posting data:', error);
    }
  }
  //-----------------------
  useEffect(() => {
    if (data && !isLoading && !error) {
      //success response
      setMessageToUser(
        data.message || 'New Profile account successfully created!',
      );
      // console.log('Received data:', data);
    } else if (!isLoading && error) {
      setMessageToUser(error);
    }

    //resetting message to user
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      setMessageToUser(null);
    }, 5000);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [data, error, isLoading]);

  //-----------------------
  // 🎨 RENDERING COMPONENT
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

        {/* 📝 FORM SECTION */}
        <form className='form__box' autoComplete='off'>
          <div className='container--profileName form__container '>
            <div className='input__box'>
              <label htmlFor='name' className='label forms__label'>
                {'Name'}

                <CharacterCounter
                  value={profileData.name}
                  maxLength={NAME_MAX_LENGTHS.debtor_name}
                />

                <span className='validation__errMsg'>
                  {validationMessages['name']}
                </span>
              </label>

              <input
                type='text'
                className={`input__container`}
                placeholder={`Name`}
                name={'name'}
                id={'name'}
                onChange={inputHandler}
                value={profileData.name}
                maxLength={NAME_MAX_LENGTHS.debtor_name}
              />
            </div>

            <div className='input__box'>
              <label htmlFor='lastname' className='label forms__label'>
                {'Last Name'}

                <CharacterCounter
                  value={profileData.lastname}
                  maxLength={NAME_MAX_LENGTHS.debtor_lastname}
                />

                <span className='validation__errMsg'>
                  {validationMessages['lastname']}
                </span>
              </label>

              <input
                type='text'
                className={`input__container`}
                placeholder={`last name`}
                name={'lastname'}
                id={'lastname'}
                onChange={inputHandler}
                value={profileData.lastname}
                maxLength={NAME_MAX_LENGTHS.debtor_lastname}
              />
            </div>

            <div className='input__box'>
              <label className='label forms__label'>
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

              <label
                // htmlFor={formDataNumber.keyName}
                className='label forms__label'
              >
                {capitalize(formDataNumber.title)}&nbsp;
                <span
                  className='validation__errMsg'
                  style={{
                    color: validationMessages[formDataNumber.keyName]
                      ?.toLowerCase()
                      .includes('format:')
                      ? 'var(--lightSuccess)'
                      : 'var(--error)',
                  }}
                >
                  {validationMessages[formDataNumber.keyName]?.replace(
                    'Format:',
                    '',
                  )}
                </span>
              </label>

              <InputNumberFormHandler
                validationMessages={validationMessages}
                setValidationMessages={setValidationMessages}
                keyName={formDataNumber.keyName}
                placeholderText={formDataNumber.title}
                formData={formData}
                setFormData={setFormData}
                setStateData={setProfileData}
              />
              {/* style={{ fontSize: '1.25rem', padding: '0 0.75rem' }} */}
            </div>

            <div className='input__box'>
              <label className='label forms__label'>
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

          {/* 💾 SUBMIT BUTTON */}
          <div className='submit__btn__container'>
            <FormSubmitBtn onClickHandler={onSubmitForm}>save</FormSubmitBtn>
          </div>
        </form>

        {/* 💬 USER MESSAGES */}
        <MessageToUser
          isLoading={isLoading || isLoadingBankAccounts}
          error={error || fetchedErrorBankAccounts}
          messageToUser={messageToUser}
          variant='form'
        />
      </div>
    </section>
  );
}

export default NewProfile;
