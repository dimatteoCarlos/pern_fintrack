//frontend/src/pages/forms/newCategory/NewCategory.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import LeftArrowSvg from '../../../../assets/LeftArrowSvg.svg';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import LabelNumberValidation from '../../../general_components/labelNumberValidation/LabelNumberValidation.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';

import { validationData } from '../../../validations/utils/custom_validation.ts';

import '../styles/forms-styles.css';

import useAuth from '../../../../auth/hooks/useAuth.ts';
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';

import { url_create_category_budget_account } from '../../../../urlConfig.ts';

import { CurrencyType, FormNumberInputType } from '../../../types/types.ts';

import {
  DEFAULT_CURRENCY,
  TILE_LABELS,
  VARIANT_FORM,
} from '../../../helpers/constants.ts';

import { CreateCategoryBudgetAccountApiResponseType } from '../../../types/responseApiTypes.ts';
import { normalizeError } from '../../../helpers/normalizeError.ts';
import { AUTH_ROUTE } from '../../../../auth/auth_constants/constants.ts';
import { NAME_MAX_LENGTHS } from '../../../validations/utils/inputConstraints/nameMaxLengths.ts';
import CharacterCounter from '../../../general_components/characterCounter/CharacterCounter.tsx';

// Import hooks and helpers for autocomplete and duplicate checking
import { useAccountExistence } from '../../../hooks/useAccountExistence.ts';
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback.ts';
import {
  buildCategoryAccountName,
  extractCategories,
  extractSubcategories,
} from '../../../helpers/newCategoryHelper.ts';

//-------data config---------------------
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
  const navigateTo = useNavigate();
  //const user: string = import.meta.env.VITE_USER_ID;
  const { isAuthenticated } = useAuth();

// === STATE INITIALIZATION ===
  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);

  const [categoryData, setCategoryData] = useState<CategoryDataType>(
    initialNewCategoryData,
  );
  const [activeNature, setActiveNature] = useState(
    initialNewCategoryData.nature,
  );
  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [messageToUser, setMessageToUser] = useState<
    { message: string; status?: number } | string | null | undefined
  >(null);
 //-------------------------------------
 //AUTOCOMPLETE LOGIC
 //Derived state for account name preview
const previewAccountName = useMemo(() => {
  const fullName = buildCategoryAccountName(
  categoryData.category,
  categoryData.subcategory,
  categoryData.nature,
);

  console.log('🔍 fullName:', fullName);
  return fullName;

}, [categoryData.category, categoryData.subcategory, categoryData.nature]);

  // Helper message for duplicate account name 
  const [duplicateHelperMessage, setDuplicateHelperMessage] = useState<string>('');

  // 📝 Hook for account existence and duplicate checking
  const { getSuggestions, checkDuplicate } = useAccountExistence();

  // 📝 Get full account names for category_budget
  const categoryBudgetNames = useMemo(() => {
    return getSuggestions('category_budget');
  }, [getSuggestions]);

  // 📝 Extract unique categories for autocomplete
  const uniqueCategories = useMemo(() => {
    return extractCategories(categoryBudgetNames);
  }, [categoryBudgetNames]);

  // 📝 Extract unique subcategories for autocomplete
  const uniqueSubcategories = useMemo(() => {
    return extractSubcategories(categoryBudgetNames);
  }, [categoryBudgetNames]);

  // 📝 Debounced duplicate check (300ms)
  const debouncedCheckDuplicate = useDebouncedCallback(() => {
   console.log('🔍 duplicate check running');

   const fullName = buildCategoryAccountName(
     categoryData.category,
     categoryData.subcategory,
     categoryData.nature
   );

    //DEBUG
    console.log('🔍 fullName:', fullName);
    const exists = checkDuplicate(fullName, 'category_budget');
    console.log('🔍 duplicate found:', exists);
    //---

   // If fullName is empty (missing required fields), clear the message
   if (!fullName) {
     setDuplicateHelperMessage('');
     return;
   }

   // Check if the full name already exists
   if (checkDuplicate(fullName, 'category_budget')) {
    
     setDuplicateHelperMessage('ℹ️ This account name already exists');

   } else {
     setDuplicateHelperMessage('');
   }
    }, 300);
 
//-------------------------------------
//✅ CHECK IF USER IS AUTHENTICATED
  useEffect(() => {
    if (!isAuthenticated) {
      setMessageToUser('Please log in to create an account');
      setTimeout(() => navigateTo(AUTH_ROUTE), 5000);
    }
  }, [isAuthenticated, navigateTo]);

// ------------------------------------
// === DATA FETCHING HOOK (POST) ===
  //endpoint: http://localhost:5000/api/fintrack/account/new_account/category_budget
  // === HANDLERS & UTILITIES ===
  //DATA FETCHING POST
  //POST: NEW ACCOUNT DATA
  const {
    isLoading,
    error,
    requestFn,
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
    setCategoryData,
  );
  //--FUNCTIONS---------
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;

    if (name === formDataNumber.keyName) {
      console.log('formDataNumber.keyName', formDataNumber.keyName);
      inputNumberHandlerFn(name, value);
    } else {
      setCategoryData((prev) => ({ ...prev, [name]: value }));
    }
   
    // Trigger duplicate check after updating category or subcategory
    if (name === 'category' || name === 'subcategory') {
      debouncedCheckDuplicate();
  }
  }

  // Category Nature tile selector handler
  function natureHandler(e: React.MouseEvent<HTMLButtonElement>) {
  // console.log('natureHandler', e.currentTarget.id);
    e.preventDefault();
    const activeNature = e.currentTarget.id ? e.currentTarget.id : '';
    setActiveNature(activeNature);
    setCategoryData((prev) => ({ ...prev, nature: activeNature }));

    //Trigger duplicate check immediately after nature changes
    debouncedCheckDuplicate();
  }

  // FORM SUBMISSION LOGIC (onSubmitForm) 
  async function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
  // console.log('🟢 onSubmitForm called');
   e.preventDefault();
   console.log('🧹 Clearing duplicate helper before submit');

    setMessageToUser(null);

   // Clear helper before submission
   // setDuplicateHelperMessage('');

    // 🆕 CHECK USER AUTHENTICATION BEFORE SUBMIT
    if (!isAuthenticated) {
      setMessageToUser('Please log in to create an account');
      return;
    }
    // ✅ DATA FORM VALIDATION
    const newValidationMessages = {
      ...validationData(categoryData, {
        nonZeroFields: ['amount'],
      }),
    };
    // console.log('mensajes de validacion:', { newValidationMessages });

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }

    //----------------------------------
    //POST TO THE ENDPOINT FOR ACCOUNT DATA HERE
    // new category data into database
    //-----------------------------------
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
      const { data: responseData, error: requestError } =
        await requestFn(payload);
      console.log('📦 Response received:', { responseData, requestError });
      //Los errores del servidor (4xx, 5xx) vienen en data.status
      if (requestError) {
        console.log('🔴 Network error:', requestError);
        // Error del request (network, etc.).Error de red/axios
        setMessageToUser({
          message: requestError,
          status: 500,
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
            status: responseData.status,
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
            status: responseData.status,
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
        {/* FORM START */}
        <form className='form__box'>
          <div className='container--categoryName form__container'>
            <div className='input__box'>
              <label htmlFor='category' className='label forms__label'>
                {'Category Name'}&nbsp;
                <CharacterCounter
                  value={categoryData.category}
                  maxLength={NAME_MAX_LENGTHS.category_name}
                />{' '}
                &nbsp;
                <span className='validation__errMsg'>
                  {validationMessages['category']}
                </span>
              </label>

              <input
                type='text'
                className={`input__container`}
                placeholder={`Category Name`}
                name={'category'}
                onChange={inputHandler}
                value={categoryData.category}
                maxLength={NAME_MAX_LENGTHS.category_name}
                list='category-suggestions' 

              />
     {/* 📝 datalist for category suggestions */}            
             <datalist id='category-suggestions'>
             {uniqueCategories
             .map((name)=>(
              <option key={name} value={name}/>)
             )}
              </datalist> 
            </div>

            {/* SUBCATEGORY */}
            <div className='input__box'>
              <label htmlFor='subcategory' className='label forms__label'>
                {'Subcategory'}&nbsp;
                <CharacterCounter
                  value={categoryData.subcategory!}
                  maxLength={NAME_MAX_LENGTHS.subcategory}
                />{' '}
                &nbsp;
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
                maxLength={NAME_MAX_LENGTHS.subcategory}
                list='subcategory-suggestions'
              />

      {/* datalist for subcategory suggestions */}
            <datalist id='subcategory-suggestions'>
              {uniqueSubcategories.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>      
           </div>

           {/* BUDGET AMOUNT INPUT */}
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
                autoComplete='off'
              />
            </div>
          </div>

          {/* NATURE SELECTOR TILES */}
          <div className='container--nature input__box'>
            <div className='form__title form__title--tiles label forms__label'>
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

        {/* ACCOUNT NAME PREVIEW */}
         <div className='input__box'>
           <label className='label forms__label' style={{ color: 'var(--creme)',fontSize:'1rem',fontWeight:'300', opacity: 0.6}}>
           Account name to be created:
           </label>
           <input
             type='text'
             className='input__container readonly'
             readOnly
             value={previewAccountName || ' category/subcategory/nature'}
             style={{
             color: previewAccountName ? 'cyan' : 'var(--secondary)',
             fontStyle: previewAccountName ? 'normal' : 'italic',
             backgroundColor: 'rgba(255,255,255,0.03)', opacity:'0.8',fontWeight:'300'
             }}
           />
         </div>

          {/* 📝ACCOUNT DUPLICATE HELPER MESSAGE */}
          {duplicateHelperMessage && (
            <div className="duplicate-helper" style={{ margin: '0.5rem 0' }}>
              <span className="validation__msg--info">
                {duplicateHelperMessage}
              </span>
            </div>
          )}
         {/* SUBMIT BUTTON */}
          <div className='submit__btn__container'>
            <FormSubmitBtn onClickHandler={onSubmitForm} disabled={isLoading}>
              save
            </FormSubmitBtn>
          </div>
        </form>

        {/* Message/Error Display Component */}
        <MessageToUser
          isLoading={isLoading}
          error={error}
          messageToUser={messageToUser}
          variant='form'
        />
      </div>
    </section>
  );
}
export default NewCategory;