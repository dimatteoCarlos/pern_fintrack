// frontend/src/edition/pages/forms/editAccount/EditAccount.tsx

// 🎯 IMPORTS - REACT, ROUTING, EXTERNAL DEPENDENCIES AND TYPES
import { ZodType } from "zod"
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';

// 📚 HOOKS AND STORES - CUSTOM REACT HOOKS AND STATE MANAGEMENT
import { useAccountStore } from '../../../stores/useAccountStore.ts';
import { useFetch } from '../../../hooks/useFetch.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
// import { useEditAccountForm, GenericEditFormData } from '../../../hooks/useEditAccountForm.ts';

// 📦 TYPES AND LOGIC- TYPE SAFETY DEFINITIONS
import { AccountByTypeResponseType, AccountListType } from '../../../types/responseApiTypes.ts';
import { ValidationMessagesType } from '../../../validations/types.ts';
import { DropdownOptionType } from '../../../types/types.ts';

// ⚙️ VALIDATION CONFIG - FORM SCHEMAS AND FIELD DEFINITIONS
import { ACCOUNT_EDIT_SCHEMA_CONFIG, FieldConfigType } from '../../validations/accountEditSchema.ts';
import { accountTypeEditSchemas
} from '../../validations/editSchemas.ts';
import { validateForm } from '../../../validations/utils/zod_validation.ts';

// 🌐 API ENDPOINTS - BACKEND URL CONFIGURATION
import { url_get_account_details_by_id_for_edition, url_patch_account_edit } from '../../../endpoints.ts';

// 🧱 UI COMPONENTS - REUSABLE PRESENTATION COMPONENTS
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import FormSubmitBtn from "../../../general_components/formSubmitBtn/FormSubmitBtn.tsx";
import UniversalDynamicInput from "./UniversalDynamicInput.tsx";

// 🎨 ASSETS AND STYLES - VISUAL RESOURCES AND CSS
import LeftArrowSvg from '../../../assets/LeftArrowSvg.svg';
import '../../../pages/forms/styles/forms-styles.css';

// 🔧 UTILITIES - DATE PARSING AND DATA TRANSFORMATION
import { GenericEditFormData, useEditAccountForm } from "../../../hooks/useEditAccountForm.ts";
import { parsePostgresDate } from "../../utils/dateUtils.ts";
// import { debounce } from '../../utils/debounce.ts';

// 🛠️ INTERNAL UTILITY - VALUE COMPARISON (KISS)
const areValuesEqual = (a: unknown, b: unknown): boolean => {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
};

// 📋 Local State generic type data of edition Form /Tipo de datos genérico para el formulario de edición (para estados locales)
// type GenericEditFormData = {
//  [key: string]: string | number | boolean | Date | null | undefined;
// };

// ===========================
// 🏦 MAIN COMPONENT
// 🏗️ ACCOUNT EDITING FORM PAGE
// ===========================
export function EditAccount(): JSX.Element {
 
// 🧭 ROUTING AND NAVIGATION - URL PARAMETERS AND NAVIGATION
  const { accountId } = useParams<{ accountId: string }>(); 
  const navigateTo = useNavigate();
  const location = useLocation();
  const previousRoute = location.state?.previousRoute || '/fintrack/tracker/accounting'; // fallback
  
// 🗄️ GLOBAL STATE - ACCOUNT STORE FOR DATA PERSISTENCE
  const { updateAccount } = useAccountStore();

//2. 📥 DATA FETCHING OF ACCOUNT BY ACCOUNTID FROM API
 const fetchUrl = accountId ? `${url_get_account_details_by_id_for_edition}${accountId}` : null;

 const { apiData, isLoading: isFetching, error: fetchError } = 
  useFetch<AccountByTypeResponseType>(fetchUrl);

 const accountData = apiData?.data?.accountList[0]
 
 //3.📤 API MUTATION - SAVE UPDATED ACCOUNT DATA
 const mutationUrl = accountId ?`${url_patch_account_edit}/${accountId}` : '';
 const {  isLoading: isSaving, error: saveError, requestFn } = 
 useFetchLoad<AccountListType, GenericEditFormData>({
  url: mutationUrl,
  method: 'PATCH',
 });
 
 //4.⚙️ LOCAL STATES
 // 📢 USER FEEDBACK - SUCCESS/ERROR MESSAGES STATE
 const [userMessage, setUserMessage] = useState<{message: string, status: number} | undefined>(undefined);
 
 // const [formData, setFormData] = useState<GenericEditFormData>({});
 // const [validationMessages, setValidationMessages] = useState<ValidationMessagesType<GenericEditFormData>>({});

 // const [isReset] = useState(false);
 
 // 🔍 ACCOUNT TYPE IDENTIFICATION - DETERMINE FORM CONFIGURATION
 const accountType = accountData? accountData.account_type_name:null;
 // console.log('apiData', {accountData})
 // console.log("🚀 ~ EditAccount ~ accountType:", accountType)
 // console.log("🚀 ~ EditAccount ~ requestFn data:", data)
 
 //5.⚙️ ZOD SCHEMA CONFIGURATION
 // ⚙️ DYNAMIC CONFIGURATION - FORM FIELDS BASED ON ACCOUNT TYPE 
 const accountFields = useMemo(() => {
  if (!accountType) return [];//que pasa si esto occure?
  const fields = ACCOUNT_EDIT_SCHEMA_CONFIG[accountType as AccountListType['account_type_name']]  || [];
  // console.log("🚀 ~ EditAccount ~ fields:", fields)
  if (!fields) {
  console.error(`Error: Account type '${accountType}' not found in ACCOUNT_EDIT_SCHEMA_CONFIG.`);
  return [];
 }
  return fields
  }, [accountType]);

 // 📜 VALIDATION SCHEMA - ZOD SCHEMA FOR CURRENT ACCOUNT TYPE
 const schema: ZodType<GenericEditFormData> | null = useMemo(() => 
  accountType ? accountTypeEditSchemas[accountType as AccountListType['account_type_name']] as ZodType<GenericEditFormData> : null
  , [accountType]);
  // console.log("🚀 ~ EditAccount ~ schema:", schema)

// 🧠 FORM STATE MANAGEMENT - HOOK FOR FORM DATA AND VALIDATION
  const { formData, setFormData, validationMessages, setValidationMessages, runFieldValidation } = useEditAccountForm(schema);

  // 🔄 SYNCHRONOUS UPDATE ENGINE - UNIFIED FIELD UPDATE WITH DERIVED CALCULATION
  const updateFormAndDerivatives = useCallback((name:string, value:string | number | boolean | Date | null | undefined)=>{
  
   // 1. INCREMENTAL UPDATE - APPLY USER CHANGE TO FORM DATA
   const newData = {...formData, [name]:value};
   const derivedUpdates:Partial<GenericEditFormData>={};

   // 2. DERIVED FIELD COMPUTATION - CALCULATE DERIVED VALUES
   accountFields.forEach((field)=>{
    if(field.isDerived && typeof field.compute === 'function'){
     const calculatedValue = field.compute(newData as Record<string, unknown>);
     if(!areValuesEqual(calculatedValue, formData[field.fieldName])){
      derivedUpdates[field.fieldName] = calculatedValue as GenericEditFormData[keyof GenericEditFormData]
     }
    }
   })
  // });//updateFormAndDerivatives

  // 3. FINAL STATE MERGING - COMBINE USER AND DERIVED DATA
  const finalData = {...newData, ...derivedUpdates} as GenericEditFormData;
  setFormData(finalData);
  // console.log({finalData}, {name, value,})

 // 4. REAL-TIME VALIDATION - VALIDATE CHANGED AND DERIVED FIELDS
 runFieldValidation(name, value, finalData); 

 Object.entries(derivedUpdates).forEach(([fName,fVal])=>{
  runFieldValidation(fName, fVal,finalData);
 });

  // 5. USER FEEDBACK RESET - CLEAR PREVIOUS MESSAGES ON INTERACTION
  setUserMessage(undefined);
}, [formData, accountFields, runFieldValidation, setFormData]);

// 🚀 INITIAL DATA LOADING - SYNC API RESPONSE TO FORM STATE
useEffect(()=>{
 if(accountData && accountFields.length >0){
  const initialData:GenericEditFormData={} as GenericEditFormData;
  accountFields.forEach((field:FieldConfigType)=>{
   const key = field.fieldName as keyof typeof accountData;
   const val = accountData[key];
   
   if(val !== undefined){
    // 🗓️ DATE FIELD HANDLING - SPECIAL PARSING FOR DATE FIELDS
    initialData[field.fieldName]=(field.fieldName === 'desired_date' && typeof val === 'string')
    ?parsePostgresDate(val)
    :(val as GenericEditFormData[keyof GenericEditFormData]);
   }
  });
  setFormData(initialData);
 }
}, [accountData, accountFields, setFormData]);

 // 🎮 INPUT HANDLER FACTORIES - HIGHER-ORDER FUNCTIONS FOR FIELD TYPES
const handleTextChange = useCallback((fieldName: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
 updateFormAndDerivatives(fieldName, e.target.value);},
  [updateFormAndDerivatives]
);

const handleDropdownChange = useCallback((fieldName: string) => 
  (option: DropdownOptionType | null) => {
    updateFormAndDerivatives(fieldName, option ? option.value : '');
  }, [updateFormAndDerivatives]);

const handleDateChange = useCallback((fieldName: string) => 
  (date: Date) => {
    updateFormAndDerivatives(fieldName, date);
  }, [updateFormAndDerivatives]);

// 📤 FORM SUBMISSION HANDLER - VALIDATION AND API CALL
const onSubmitForm = async (e: React.MouseEvent) => {
 e.preventDefault();
 if (!accountType){ console.error('Submission failed: account type is not defined.'); return}//deberia dar un mensaje
// console.log('formData', formData)
//handling null schema
 if (!schema) {
 console.error('Submission failed: Zod schema is not defined.');
 return;//que se debe hace?
  }

// ✅ FINAL VALIDATION - COMPREHENSIVE FORM VALIDATION BEFORE SUBMIT
 const { errors, data: validatedData } = validateForm(schema, formData);//recordar que devuelve
    
if (Object.keys(errors).length > 0) {
 // ❌ VALIDATION FAILURE - DISPLAY ERRORS AND BLOCK SUBMISSION 
  setValidationMessages(errors as ValidationMessagesType<GenericEditFormData>);
  console.log({errors});
  
  setUserMessage({ message: 'Please fix validation errors', status: 400 });
  return;//deberia mostrar los mensajes de error al usuario
}
// console.log("🚀 ~ onSubmitForm ~ validatedData:", validatedData)

if (!validatedData) return;//what message to show?.

// 📦 PAYLOAD PREPARATION - ADD ACCOUNT TYPE FOR BACKEND PROCESSING

const payloadToSend = {
  ...validatedData,
  type: accountType, //edtion controller need this
};
// console.log("🚀 ~ onSubmitForm ~ payloadToSend:", payloadToSend)

 const result = await requestFn(payloadToSend as GenericEditFormData, {});
 // console.log("🚀 ~ onSubmitForm ~ result after edition:", result)

    
if (result.data) {
 // ✅ SUCCESS FLOW - UPDATE GLOBAL STATE AND NAVIGATE
 updateAccount(result.data);// update and syncronize with accounting dashboard
 setUserMessage({ message: 'Account updated successfully!', status: 200 });
 setTimeout(() => {
 navigateTo(previousRoute); //should be previous route
   }, 500); 
  }
 };
//-------------------------------------------
const isFormDisabled = isFetching || isSaving || !accountData || !schema;
const finalError = fetchError || saveError;

//-------------------------------------------  
// 🎨 PAGE RENDERING - MAIN COMPONENT UI STRUCTURE
return (
 <>
 <section className='page__container'>
 {/* 🔝 PAGE HEADER - NAVIGATION AND VISUAL SPACING */}
 <TopWhiteSpace variant={'dark'} />

 <div className='page__content'>
 {/* 🔙 NAVIGATION HEADER - BACK LINK WITH ICON AND TITLE */}
  <Link to={previousRoute}className='form__header main__title--container '>
   <div className='form__header--icon iconLeftArrow'>
    { <LeftArrowSvg /> }
   </div>
   <div className='form__title'>{'Edit Account'}</div>
  </Link>

{/* 📋 FORM CONTENT - CONDITIONAL RENDERING BASED ON LOADING STATE */}
 {isFetching && <p className="loading__text" style={{color:'yellow', opacity:'0.5'}}>Loading account data...</p>}

  {fetchError && <p style={{color:'red'}} className='error-message'>Error loading data: {fetchError}</p>}

  {accountType && accountFields.length === 0 && !isFetching && (
   <p className='error-message'>Configuration not found for account type: {accountType}</p>
   )}

  {!!accountType && accountFields.length > 0 && (
  <form className='form__box'>
  <div className='form__input__group'>
  {/* 🎨 DYNAMIC RENDERING OF FORM */}
   <div className='form__container'>
    {accountFields.map((fieldConfig) => (
     <UniversalDynamicInput
      key={fieldConfig.fieldName}
      fieldConfig={fieldConfig as FieldConfigType}
      formData={formData}
      setFormData={setFormData}
      validationMessages={validationMessages}
      handleDropdownChange={handleDropdownChange}
      handleDateChange={handleDateChange}
      handleInputNumberChange={handleTextChange} 
      isReset={false}
     />
    ))
   }
    </div>
   </div>
    <div className='submit__btn__container'>
      <FormSubmitBtn onClickHandler={onSubmitForm} disabled={isFormDisabled || !accountId}>
        Save Changes
      </FormSubmitBtn>
    </div>
   </form>
   )}
  </div>
</section>
<section className="Toastify">
  <MessageToUser
    isLoading={isSaving}
    error={finalError}
    messageToUser={userMessage}
    variant="form"
  />
</section>
 </>

  );
}

export default EditAccount;