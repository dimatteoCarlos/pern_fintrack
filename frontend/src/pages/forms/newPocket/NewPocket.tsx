//frontend/src/pages/forms/newPocket/NewPocket.tsx/NewPocket.tsx
// 🎯 IMPORTS
import { useEffect, useState } from 'react';
import { Link, useLocation, } from 'react-router-dom';
import '../styles/forms-styles.css';

// 🛠️ CUSTOM HOOKS & UTILITIES
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
import useAuth from '../../../auth/hooks/useAuth.ts';
import { validationData } from '../../../validations/utils/custom_validation.ts';
import { normalizeError } from '../../../helpers/normalizeError.ts';

// 📦 COMPONENTS
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import FormDatepicker from '../../../general_components/datepicker/Datepicker.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';

// 🖼️ ASSETS
import LeftArrowSvg from '../../../assets/LeftArrowSvg.svg';

// 🏷️ TYPES & CONSTANTS
import { CurrencyType, FormNumberInputType } from '../../../types/types.ts';
import { CreatePocketSavingAccountApiResponseType } from '../../../types/responseApiTypes.ts';
import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';

// 🏷️ ENPOINTS
import { url_create_pocket_saving_account } from '../../../endpoints.ts';

// 📋 TYPE DEFINITIONS
type PocketDataType = {
  name: string;
  note: string;
  currency?: CurrencyType;
  desiredDate: Date | string;
  amount?: number | '';
};

type PocketSavingPayloadType = {
  name: string;
  note: string;
  type: 'pocket_saving';
  target: number | '';
  desired_date: Date | string;
  currency?: CurrencyType;
  user?: string;
  // saved?: number;
};

// ⚙️ CONSTANTS & INITIAL STATES
const defaultCurrency = DEFAULT_CURRENCY;
const initialNewPocketData: PocketDataType = {
  name: '',
  note: '',
  amount: '',  
  desiredDate: new Date().toISOString(),
  currency: defaultCurrency,
};

const formDataNumber = { keyName: 'amount', title: 'target' };
const initialFormData: FormNumberInputType = {
  [formDataNumber.keyName]: '',
};
// =============================
// 🎯 COMPONENT DEFINITION
// =============================
function NewPocket() {
const location = useLocation();
// const navigateTo=useNavigate()
//-------------------------------------
const { isAuthenticated, isCheckingAuth } = useAuth();
//const user: string = import.meta.env.VITE_USER_ID;

// 🏁 STATE MANAGEMENT
const [formData, setFormData] =
useState<FormNumberInputType>(initialFormData);

const [pocketData, setPocketData] =
useState<PocketDataType>(initialNewPocketData);

const [validationMessages, setValidationMessages] = useState<{
[key: string]: string;
}>({});

const [isReset, setIsReset] = useState<boolean>(false);
const [messageToUser, setMessageToUser] = useState<{message:string, status?:number} |string | null | undefined>(
null );

// 🌐 DATA FETCHING HOOK
//POST: NEW ACCOUNT DATA
//endpoint: http://localhost:5000/api/fintrack/account/new_account/pocket_saving
const { isLoading, error, requestFn,
    //  ...rest
      } = useFetchLoad<
   CreatePocketSavingAccountApiResponseType,
    PocketSavingPayloadType
  >({ url: url_create_pocket_saving_account, method: 'POST' });
//  console.log('more data from new pocket creation', rest)
//-----------------------------------
// 🎮 EVENT HANDLER HOOKS
//event handler hook for number input handling
 const { inputNumberHandlerFn } =      useInputNumberHandler(
      setFormData,
      setValidationMessages,
      setPocketData
  );
//-------------------------
// 🧹 MESSAGE CLEANUP EFFECT
// Clear message after 5 seconds
  useEffect(() => {
    if (messageToUser) {
     const timer = setTimeout(() => {
        setMessageToUser(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [messageToUser]);

//---------------------------------------
// ✨ INPUT HANDLERS
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;

  if (name === formDataNumber.keyName) {
 console.log('formDataNumber.keyName', formDataNumber.keyName,formDataNumber)   
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
  
// 📤 FORM SUBMISSION LOGIC (onSubmitForm)
  async function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
 // console.log('onSubmitForm');

// 🔐 AUTHENTICATION CHECK.BEFORE SUBMISSION
    if (!isAuthenticated) {
      setMessageToUser('Your session has expired. Please log in again.');
      // navigateTo('/auth');
      return;
    }

 // ✅ DATA FORM VALIDATION
   const newValidationMessages = { ...validationData(pocketData, { 
    nonZeroFields: ['amount']}) };
// console.log('mensajes de validacion:', { newValidationMessages });

   if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
  
// 🚀 API REQUEST EXECUTION
//POST the new pocket data into database
//Prepare and send payload
   try {
     const payload: PocketSavingPayloadType = {
        name: pocketData.name.toLowerCase().trim(),
        note: pocketData.note,
        type: 'pocket_saving',
        currency: pocketData.currency ?? defaultCurrency,//default
        target: pocketData.amount !== undefined && pocketData.amount !== '' ? pocketData.amount : '',
        desired_date: pocketData.desiredDate ?? new Date().toISOString(), // ISO format
        // user,
      };

// ✅ requestFn delivers { data: ResponseType | null, error: string | null }
  const {data: responseData, error: requestError }= await requestFn(payload);
// console.log('📦 Response received:', { responseData, requestError }); 

// ✅ VALIDATION BEFORE SUBMITTING
// ❌ REQUEST ERROR HANDLING
   if (requestError) {
    console.log('🔴 Network error:', requestError);  
// Error del request (network, etc.).Error de red/axios
    setMessageToUser({
      message: requestError,
      status: 500
      });
      return;
    }

//✅ HANDLING SERVER RESPONSE (SUCCESS OR ERROR)
  if(responseData){
// console.log('📊 Server response status:', responseData.status, responseData.message, responseData.data);
// ✅ CHECK STATUS CODE
    if(responseData.status >= 200 && responseData.status<300){
    //SUCCESS
    console.log('mensaje', { message:responseData.message || 'New Pocket account successfully created!', status:responseData.status
    })

    setMessageToUser(
      { message:responseData.message || 'New Pocket account successfully created!', status:responseData.status
    })

// 🔄 RESET FORM ON SUCCESS
    setIsReset(true);
    setValidationMessages({});
    setFormData(initialFormData);
    setPocketData(initialNewPocketData);
    setPocketData((prev) => ({ ...prev, desiredDate: new Date() }));
    // setIsDisabledValue(false);
    // setMessageToUser(null)
    // setTimeout(() => setIsReset(false), 500); 
      }else{
console.error('❌ Server error - setting message')
      setMessageToUser({message:responseData.message || "Server error when creating new Pocket account", status:responseData.status
        })
       }
      }

if (import.meta.env.VITE_ENVIRONMENT === 'development') {
    console.log('Data from New Pocket request:', responseData);
  }
 } catch (error) {
    // 🚨 UNEXPECTED ERROR HANDLING
console.error('🔥 Unexpected error when submitting new Pocket accoung', error);
    const { message, status } = normalizeError(error);
    setMessageToUser({ message, status });
    }
  }


// 🚫 FORM DISABLE STATE
  const isFormDisabled = !isAuthenticated;

//================================================
// 🛡️ AUTHENTICATION GUARD - PREVENT RENDERING IF NOT AUTHENTICATED
  if (isCheckingAuth) {
    return (
      <section className='newPocket__page page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div>Checking authentication...</div>
          </div>
        </div>
      </section>
    );
  }

  // 🚫 REDIRECT IF NOT AUTHENTICATED - ADDITIONAL PROTECTION LAYER
  if (!isAuthenticated) {
    return (
      <section className='newPocket__page page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h3>Authentication Required</h3>
            <p>Please log in to create a new Pocket account.</p>
          </div>
        </div>
      </section>
    );
  }  
//-----------------------
// 🎨 RENDER COMPONENT
  return (
    <section className='newPocket__page page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='page__content'>
    {/* 📱 HEADER SECTION */}
    <div className='main__title--container'>
    <Link to={location.state.previousRoute}
      relative='path'
      className='iconLeftArrow'>
    <LeftArrowSvg />
    </Link>

    <div className='form__title'>{'New Pocket'}</div>
    </div>

    {/* 🆕 MENSAJE DE NO AUTENTICADO
    {!isAuthenticated && (
    <div className='error-message' style={{ margin: '1rem 0', padding: '1rem' }}>
      Please log in to create a new account
    </div>
      )}      */}

  {/* 📝 FORM SECTION */}
  <form className='form__box'>
    <div className='container--pocketName form__container'>
  {/* 📛 NAME INPUT */}  
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
        name={'name'}
        onChange={inputHandler}
        value={pocketData['name']}
        disabled={isFormDisabled}
      />
    </div>
  {/* 📝 NOTE INPUT */}
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
    </div>

    {/* 💰 TARGET AMOUNT INPUT */}
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
      className={`input__container`}
      type='text'
      name={formDataNumber.keyName}
      placeholder={formDataNumber.keyName}
      value={formData[formDataNumber.keyName]}
      onChange={inputHandler}
    />

     {/* 📅 DATE PICKER */}
    <label className='label '>
      {'Desired Date'}&nbsp;
      <span className='validation__errMsg'>
        {validationMessages['date']}
      </span>
    </label>

    <div className='form__datepicker__container'>
      <FormDatepicker
        changeDate={changeDesiredDate}
        date={new Date(pocketData.desiredDate) as Date} 
        variant={'form'}
        isReset={isReset}
      />
    </div>

   </div> {/* END. container--pocketName form__container*/}

   {/* 💾 SUBMIT BUTTON */}
    <FormSubmitBtn onClickHandler={onSubmitForm}  disabled={isLoading || isFormDisabled}>save</FormSubmitBtn>
  </form>

  {/* 💬 USER MESSAGES */}
  <MessageToUser
    isLoading={isLoading}
    error={error}
    messageToUser={messageToUser}
    variant="form"
  />
  </div>
</section>
  );
}

export default NewPocket;
