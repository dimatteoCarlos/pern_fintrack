import React, { useEffect, useMemo, useState } from 'react';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { Link, useLocation } from 'react-router-dom';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import '../styles/forms-styles.css';
import { useFetch } from '../../../hooks/useFetch.ts';
import {
  CurrencyType,
  DropdownOptionType,
  // ExpenseAccountsType,
} from '../../../types/types.ts';
import {
  // url_accounts,
  url_create_debtor_account,
  url_get_accounts_by_type,
} from '../../../endpoints.ts';
import {
  ACCOUNT_OPTIONS_DEFAULT,
  DEFAULT_CURRENCY,
  TYPEDEBTS_OPTIONS_DEFAULT,
  VARIANT_FORM,
} from '../../../helpers/constants.ts';
import { capitalize, } from '../../../helpers/functions.ts';
import { validationData } from '../../../validations/utils/custom_validation.ts';
import { FormNumberInputType } from '../../../types/types.ts';
import InputNumberFormHandler from '../../../general_components/inputNumberHandler/InputNumberFormHandler.tsx';
import {
  AccountByTypeResponseType,
  CreateDebtorAccountApiResponseType,
} from '../../../types/responseApiTypes.ts';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
// import ProtectedRoute from '../../auth/ProtectedRoute.tsx';

//-----temporarily 'till decide how to handle currencies
const defaultCurrency = DEFAULT_CURRENCY;
// const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
// console.log('', { formatNumberCountry });

//----Type definitions, initialization and constants ------
type ProfileInputDataType = {
  name: string;
  lastname: string;
  account: string;
  type: string;
  amount: number | '';
  currency?: CurrencyType;
};

type ProfilePayloadType = {
  name: string;
  lastname: string;
  transaction_type: string;
  account_type: string;
  amount: number | '';
  currency?: CurrencyType;
  user: string;
  selected_account_name: string;
  selected_account_type: string;
};
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

const formDataNumber = { keyName: 'amount', title: 'value' };

const initialFormData: FormNumberInputType = {
  [formDataNumber.keyName]: '',
};

const selected_account_type = 'bank',
  account_type = 'debtor';

//-----------------------
function NewProfile() {
  const location = useLocation();
  //get userId from stores
  // const user = useUserStore((state: UserStoreType) => state.userData.userId);
  const user: string = import.meta.env.VITE_USER_ID;

  //-----states------
  const [profileData, setProfileData] = useState<ProfileInputDataType>(
    initialNewProfileData
  );
  // const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [isReset, setIsReset] = useState<boolean>(false);

  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );
  //-----------------------------------------
  //DATA FETCHING for option selection
  //GET: AVAILABLE ACCOUNTS OF TYPE BANK
  const fetchUrl = user
    ? `${url_get_accounts_by_type}/?type=bank&user=${user}`
    : // <Navigate to='/auth' />
      undefined; //forzar un error de user en el backend / force an error inthe backend

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
          label: acc.account_name,
        }))
      : ACCOUNT_OPTIONS_DEFAULT;
  }, [BankAccountsResponse?.data.accountList, fetchedErrorBankAccounts]);

  //--for drop down selection
  const accountSelectionProp = {
    title: 'Select Account',
    options: optionAccounts,
    variant: VARIANT_FORM, //this stablishes the custom styles to use in selection dropdown component
  };

  //----------------------------------------
  //DATA FETCHING POST
  ////OBTAIN THE REQUESTFN FROM userFetchLoad
  //endpoint: http://localhost:5000/api/fintrack/account/new_account/debtor
  const { data, isLoading, error, requestFn } = useFetchLoad<
    CreateDebtorAccountApiResponseType,
    ProfilePayloadType
  >({ url: url_create_debtor_account, method: 'POST' });
  //------------------------------------------
  //---functions------------------------------
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  }

  function typeSelectHandler(selectedOption: DropdownOptionType | null) {
    if (selectedOption) {
      // console.log('selectedOption desde typeSelectHandler', { selectedOption });

      setProfileData((prev: ProfileInputDataType) => ({
        ...prev,
        type: selectedOption.label,
        // type: selectedOption.value,
      }));
    } else {
      console.log(`No option selected for ${'type'}`);
    }
  }

  //---
  function accountSelectHandler(selectedOption: DropdownOptionType | null) {
    const newValue = selectedOption?.value || '';
    setProfileData((prev) => ({
      ...prev,
      account: newValue,
    }));
  }

  //--------------------
  //FORM SUBMISSION ---
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
    //-------------------------------------------------------

    try {
      const payload: ProfilePayloadType = {
        account_type,
        currency: defaultCurrency,
        amount: profileData.amount ?? 0.0,
        //---
        lastname: profileData.lastname,
        name: profileData.name,
        transaction_type: profileData.type,
        selected_account_name: profileData.account,
        selected_account_type,
        user,
      };

      const data = await requestFn(payload);

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from New Debtor request:', data);
      }

      //---------------------------------------------
      //POST the new profile data into database
      // console.log('data to POST:', { profileData });

      //resetting form values
      setIsReset(true);
      setValidationMessages({});
      setProfileData(initialNewProfileData);
      setFormData(initialFormData);
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
        data.message || 'Pocket saving account successfully created!'
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

  // //-----------------------

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

              <label
                htmlFor={formDataNumber.keyName}
                className='label form__title'
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
                    ''
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
