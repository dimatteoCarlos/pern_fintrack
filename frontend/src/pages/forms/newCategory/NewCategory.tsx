//frontend/src/pages/forms/newCategory/NewCategory.tsx
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import LeftArrowSvg from '../../../assets/LeftArrowSvg.svg';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';

import { validationData } from '../../../validations/utils/custom_validation.ts';

import '../styles/forms-styles.css';

import useAuth from '../../../auth/hooks/useAuth.ts';
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';

import { url_create_category_budget_account } from '../../../endpoints.ts';

import { CurrencyType, FormNumberInputType } from '../../../types/types.ts';

import { DEFAULT_CURRENCY, TILE_LABELS, VARIANT_FORM } from '../../../helpers/constants.ts';

import { CreateCategoryBudgetAccountApiResponseType } from '../../../types/responseApiTypes.ts';
import { normalizeError } from '../../../helpers/normalizeError.ts';

// import PlusSignSvg from '../../../assets/PlusSignSvg.svg';
// import { useLocation } from 'react-router-dom';
//-------data config----------------------
// === TYPE DEFINITIONS AND CONSTANTS ===
const defaultCurrency = DEFAULT_CURRENCY;
//----Category Nature Tiles---------------
const tileTitle = 'Category Nature';

type CategoryDataType = {
  category: string;
  subcategory?: string;
  amount: number | '';
  nature: string;
  currency?: CurrencyType;
};

type CategoryBudgetPayloadType = {
  name: string;
  type: 'category_budget';
  currency: CurrencyType;
  budget: number | string;
  date: Date | string;
  nature: string;
  subcategory?: string;
  user?: string;
};

// === INITIAL STATE DATA ===
const initialNewCategoryData: CategoryDataType = {
  category: '',
  subcategory: '',
  amount: '',
  nature: '',
  currency: defaultCurrency,
};
const formDataNumber = { keyName: 'amount', title: 'budget' };
const initialFormData: FormNumberInputType = {
  [formDataNumber.keyName]: '',
};

// === COMPONENT DEFINITION ===
function NewCategory() {
  const location = useLocation();
  const navigateTo=useNavigate()
//const user: string = import.meta.env.VITE_USER_ID;
  const { isAuthenticated } = useAuth()

 // === STATE INITIALIZATION ===
  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);

  const [categoryData, setCategoryData] = useState<CategoryDataType>(
    initialNewCategoryData
  );
  const [activeNature, setActiveNature] = useState(
    initialNewCategoryData.nature
  );
  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [messageToUser, setMessageToUser] = useState<{message:string, status?:number} | string | null | undefined>(
    null
  );

//✅ CHECK IF USER IS AUTHENTICATED
 useEffect(()=>{
  if(!isAuthenticated){
  setMessageToUser('Please log in to create an account')
  setTimeout(()=>navigateTo('/auth'), 5000)
    }
 }, [isAuthenticated, navigateTo]);
//------------------------------------
// === DATA FETCHING HOOK (POST) ===
//endpoint: http://localhost:5000/api/fintrack/account/new_account/category_budget
// === HANDLERS & UTILITIES ===
//DATA FETCHING POST
//POST: NEW ACCOUNT DATA
const { isLoading, error, requestFn,
  //  ...rest 
} = useFetchLoad<
  CreateCategoryBudgetAccountApiResponseType,
  CategoryBudgetPayloadType
  >({ url: url_create_category_budget_account, method: 'POST' });
//  console.log('more data', rest)
/*
Errores HTTP (400, 500) → Vienen en responseData con su status y message
Errores de red → Vienen en requestError
Errores inesperados → Van al catch
*/
// === HANDLERS & UTILITIES ===
//event handler hook for number input handling
  const { inputNumberHandlerFn } = useInputNumberHandler(
    setFormData,
    setValidationMessages,
    setCategoryData
  );
  //FUNCTIONS---------
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;

    if (name === formDataNumber.keyName) {
    console.log('formDataNumber.keyName', formDataNumber.keyName)     
      inputNumberHandlerFn(name, value);
    } else {
      setCategoryData((prev) => ({ ...prev, [name]: value }));
    }
  }
  //--NEED TO RE DEFINE THIS FUNCTION IN THE FUTURE FOR SUBCATEGORY
  // function addHandler(e: React.MouseEvent<HTMLButtonElement>) {
  //   e.preventDefault();
  //   //adding function
  //   console.log('addHandler subcategory method PENDING to define');
  // }
// Category Nature tile selector handler
  function natureHandler(e: React.MouseEvent<HTMLButtonElement>) {
    // console.log('natureHandler', e.currentTarget.id);
    e.preventDefault();
    const activeNature = e.currentTarget.id ? e.currentTarget.id : '';
    setActiveNature(activeNature);
    setCategoryData((prev) => ({ ...prev, nature: activeNature }));
  }

// = FORM SUBMISSION LOGIC (onSubmitForm) ===
 async function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
 // console.log('🟢 onSubmitForm called');
 // 🆕 CHECK USER AUTHENTICATION BEFORE SUBMIT
    if (!isAuthenticated) {
      setMessageToUser('Please log in to create an account');
      return;
    }
 // ✅ DATA FORM VALIDATION
   const newValidationMessages = { ...validationData(categoryData, { 
    nonZeroFields: ['amount']}) };
// console.log('mensajes de validacion:', { newValidationMessages });

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
//------------------------------------
//POST TO THE ENDPOINT FOR ACCOUNT DATA HERE
// new category data into database
//------------------------------------
// Payload construction
  try {
    const payload: CategoryBudgetPayloadType = {
      name: categoryData.category.toLowerCase().trim(),
      type: 'category_budget',
      currency: categoryData?.currency ?? defaultCurrency, //default
      budget: formData.amount ?? categoryData.amount,
      date: new Date().toISOString(), // ISO format
      nature: categoryData.nature,
      subcategory: categoryData.subcategory || undefined,
      // user,
    };

// ✅ requestFn devuelve { data: ResponseType | null, error: string | null }
    const {data: responseData, error: requestError }= await requestFn(payload);
    console.log('📦 Response received:', { responseData, requestError }); 
//Los errores del servidor (4xx, 5xx) vienen en data.status
    if (requestError) {
    console.log('🔴 Network error:', requestError);  
    // Error del request (network, etc.).Error de red/axios
    setMessageToUser({
      message: requestError,
      status: 500
      });
      return;
    }
// Manejar Respuesta del Servidor (Éxito o Error HTTP)    
     if (responseData) {
     console.log('📊 Server response status:', responseData.status);  
 // ✅ VERIFICAR STATUS CODE AQUÍ MISMO
      if (responseData.status >= 200 && responseData.status < 300) {
        // SUCCESS
        setMessageToUser({
          message: responseData.message || 'Category created successfully!',
          status: responseData.status
        });
  // RESET WHEN SUCCESS
        setActiveNature(initialNewCategoryData.nature);
        setValidationMessages({});
        setFormData(initialFormData);
        setCategoryData(initialNewCategoryData);
      } else {
        console.log('❌ Server error - setting message');
        // ❌ ERROR DEL SERVIDOR (4xx, 5xx) - Viene en responseData
        setMessageToUser({
          message: responseData.message || 'Server error',
          status: responseData.status
        });
      }
    }

   if (import.meta.env.VITE_ENVIRONMENT === 'developmentX') {
      console.log('Data from New Category request:', responseData);
      }
    
   } catch (error) {
    console.log('🔥 Unexpected error:', error);
     //For unexpected errors only
    const { message, status } = normalizeError(error);
    setMessageToUser({ message, status });
    }
  }
// === EFFECTS (Message Cleanup) ===
// Clear message after 5 seconds
  useEffect(() => {
    if (messageToUser) {
      const timer = setTimeout(() => {
        setMessageToUser(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [messageToUser]);
//-----------------------
// === RENDER (JSX) ===
  return (
    <section className='account__page__container page__container'>
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

          {/* <Link to='..' relative='path' className='iconLeftArrow'>
            <LeftArrowSvg />
          </Link> */}
          <div className='form__title'>{'New Category'}</div>
        </div>
        {/* Form Start */}      
        <form className='form__box'>
          <div className='container--categoryName form__container'>
            <div className='input__box'>
              <label htmlFor='category' className='label form__title'>
                {'Category Name'}&nbsp;
                <div className='validation__errMsg'>
                  {validationMessages['category']}
                </div>
              </label>

              <input
                type='text'
                className={`input__container`}
                placeholder={`Category Name`}
                name={'category'}
                onChange={inputHandler}
                value={categoryData.category}
                // disabled={isFormDisabled}
              />
            </div>

        {/* SUBCATEGORY */}
            <div className='input__box'>
              <label htmlFor='subcategory' className='label form__title'>
                {'Subcategory'}&nbsp;
              </label>
              <div className='validation__errMsg'>
                {validationMessages['subcategory']}
              </div>

              <input
                type='text'
                className={`input__container`}
                placeholder={`subcategory name`}
                name={'subcategory'}
                onChange={inputHandler}
                value={categoryData.subcategory}
              />
            </div>

          {/* Budget Amount Input */}
            <div className='input__box'>
              <LabelNumberValidation
                formDataNumber={formDataNumber}
                validationMessages={validationMessages}
                variant={VARIANT_FORM}
              />
              
              <input
                className={'input__container'}
                type='text'
                name={formDataNumber.keyName}
                placeholder={formDataNumber.title}
                value={formData[formDataNumber.keyName]}
                onChange={inputHandler}
              />
            </div>
          </div>

          {/* Nature Selector Tiles */}
          <div className='container--nature'>
            <div className='form__title form__title--tiles'>
              {tileTitle}
              <div className='validation__errMsg'>
                {validationMessages['nature']}
              </div>
            </div>
            <div className='nature__tiles'>
              {TILE_LABELS.map((label, indx) => {
                return (
                  <button
                    className='nature__btn tile__button'
                    onClick={natureHandler}
                    key={`${indx}-tile`}
                    id={`${label.labelText.toLowerCase()}`}
                    style={
                      activeNature.toLowerCase() ===
                      label.labelText.toLowerCase()
                        ? {
                            backgroundColor: 'var(--creme)',
                            color: 'var(--dark)',
                          }
                        : {}
                    }
                  >
                    {label.labelText}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Submit Button */}
          <div className='submit__btn__container'>
          <FormSubmitBtn onClickHandler={onSubmitForm}disabled={isLoading}>save</FormSubmitBtn>
          </div>
        </form>
        
        {/* Message/Error Display Component */}
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
export default NewCategory;
