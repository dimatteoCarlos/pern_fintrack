//NewPocket.tsx
import { useEffect, useState } from 'react';
import LeftArrowSvg from '../../../assets/LeftArrowSvg.svg';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { Link, useLocation } from 'react-router-dom';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import { validationData } from '../../../helpers/functions.ts';
import { CurrencyType, FormNumberInputType } from '../../../types/types.ts';
import FormDatepicker from '../../../general_components/datepicker/Datepicker.tsx';
import '../styles/forms-styles.css';
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.tsx';
import { CreatePocketSavingAccountApiResponseType } from '../../../types/responseApiTypes.ts';
import { url_create_pocket_saving_account } from '../../../endpoints.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';
import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
//----Type definitions and constants ----------
type PocketDataType = {
  name: string;
  note: string;
  currency?: CurrencyType;
  desiredDate: Date;
  target: number | '';
  // amount?: number | '';
};

type PocketSavingPayloadType = {
  name: string;
  note: string;
  type: 'pocket_saving';
  target: number | '';
  desired_date: Date;
  currency?: CurrencyType;
  user: string;
  // saved?: number;
};
const defaultCurrency = DEFAULT_CURRENCY;

const initialNewPocketData: PocketDataType = {
  name: '',
  note: '',
  // amount: 0,
  target: 0,
  desiredDate: new Date(),
  currency: defaultCurrency,
};

const formDataNumber = { keyName: 'target', title: 'target' };

const initialFormData: FormNumberInputType = {
  [formDataNumber.keyName]: '',
};

//-------------------------
function NewPocket() {
  const location = useLocation();
  
  //get userId from stores
  const user: string = import.meta.env.VITE_USER_ID;
  //---states------
  const [pocketData, setPocketData] =
    useState<PocketDataType>(initialNewPocketData);

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

  //------------------------------------------------
  //DATA FETCHING POST
  //POST: NEW ACCOUNT DATA
  //endpoint: http://localhost:5000/api/fintrack/account/new_account/pocket_saving
  const { data, isLoading, error, requestFn } = useFetchLoad<
    CreatePocketSavingAccountApiResponseType,
    PocketSavingPayloadType
  >({ url: url_create_pocket_saving_account, method: 'POST' });

  //--------------------------------------
  //event handler hook for number input handling
  const { inputNumberHandlerFn } = useInputNumberHandler(
    setFormData,
    setValidationMessages,
    setPocketData
  );

  //functions---
  // input handling
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;
    if (name === formDataNumber.keyName) {
      inputNumberHandlerFn(name, value);
    } else {
      setPocketData((prev) => ({ ...prev, [name]: value }));
    }
  }

  //---
  function changeDesiredDate(selectedDate: Date): void {
    setPocketData((data) => ({
      ...data,
      desiredDate: selectedDate,
      // desiredDate: selectedDate.toDateString(),
    }));
  }

  //--------------------
  //FORM SUBMISSION ---
  async function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    console.log('onSubmitForm');

    // Form validation
    const newValidationMessages = { ...validationData(pocketData) };
    // console.log('mensajes de validacion:', { newValidationMessages });

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //----------------------------------------------------
    //POST the new pocket data into database
    //  Prepare and send payload

    try {
      const payload: PocketSavingPayloadType = {
        name: pocketData.name.toLowerCase().trim(),
        note: pocketData.note,
        type: 'pocket_saving',
        currency: pocketData.currency ?? defaultCurrency, //by default
        target: pocketData.target ?? initialNewPocketData.target,
        desired_date: pocketData.desiredDate ?? new Date(), // ISO format
        user,
      };

      const data = await requestFn(payload);

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from New Pocket request:', data);
      }

      // console.log('New pocket data to POST:', { payload });
      // console.log('check this:', formData, formDataNumber);

      //---------------------------------------------------
      //resetting form values
      setIsReset(true);
      setValidationMessages({});
      setFormData(initialFormData);

      setPocketData(initialNewPocketData);
      // setPocketData((prev) => ({ ...prev, desiredDate: new Date() }));
      setTimeout(() => setIsReset(false), 500);
    } catch (error) {
      console.error('Error when posting data:', error);
    }
  }

  //-----------------------
  useEffect(() => {
    if (data && !isLoading && !error) {
      //success response
      setMessageToUser(
        data.message || 'Pocket saving account successfully created!'
      );
      console.log('Received data:', data);
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
    <section className='newPocket__page page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='page__content'>
        <div className='main__title--container'>
          <Link
            to={location.state.previousRoute}
            relative='path'
            className='iconLeftArrow'
          >
            <LeftArrowSvg />
          </Link>
          <div className='form__title'>{'New Pocket'}</div>
        </div>
        {/*  */}
        <form className='form__box'>
          <div className='container--pocketName form__container'>
            <div className='input__box'>
              <label htmlFor='name' className='label form__title'>
                {'Name'}&nbsp;
                <span className='validation__errMsg'>
                  {validationMessages['name']}
                </span>
              </label>

              <input
                type='text'
                className={`input__container`}
                placeholder={`${'purpose/name'}`}
                onChange={inputHandler}
                name={'name'}
                value={pocketData['name']}
              />
            </div>

            <div className='input__box'>
              <label htmlFor='note' className='label form__title'>
                {'Note'}&nbsp;
                <span className='validation__errMsg'>
                  {validationMessages['note']}
                </span>
              </label>
              <input
                type='text'
                className={`input__container`}
                placeholder={`${'description'}`}
                onChange={inputHandler}
                name={'note'}
                value={pocketData['note']}
              />
            </div>{' '}
            {/* Target Amount */}
            <label htmlFor={formDataNumber.keyName} className='form__title1'>
              {'Target Amount'}
              <div
                className='validation__errMsg'
                style={{
                  color: validationMessages[formDataNumber.keyName]
                    ?.toLocaleLowerCase()
                    .includes('format:')
                    ? 'var(--lightSuccess'
                    : 'var(--error',
                }}
              >
                {validationMessages[formDataNumber.keyName]}
              </div>
            </label>
            
            <input
              type='text'
              className={`input__container`}
              onChange={inputHandler}
              name={formDataNumber.keyName}
              placeholder={formDataNumber.keyName}
              value={formData[formDataNumber.keyName]}
            />
            {/* datepicker */}
            <label className='label '>
              {'Desired Date'}&nbsp;
              <span className='validation__errMsg'>
                {validationMessages['date']}
              </span>
            </label>
            <div className='form__datepicker__container'>
              <FormDatepicker
                changeDate={changeDesiredDate}
                date={pocketData.desiredDate}
                variant={'form'}
                isReset={isReset}
              />
            </div>
          </div>

          {/* save button */}
          <FormSubmitBtn onClickHandler={onSubmitForm}  disabled={isLoading}>save</FormSubmitBtn>

        </form>

        <MessageToUser
          isLoading={isLoading}
          error={error}
          messageToUser={messageToUser}
        />
      </div>
    </section>
  );
}

export default NewPocket;
