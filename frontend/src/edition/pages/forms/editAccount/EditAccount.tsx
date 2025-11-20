// frontend/src/edition/pages/forms/editAccount/EditAccount.tsx
import { ZodType } from "zod"
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';

// 📚 HOOKS 
import { useAccountStore } from '../../../../stores/useAccountStore';
import { useFetch } from '../../../../hooks/useFetch';
import { useFetchLoad } from '../../../../hooks/useFetchLoad';

//📚 ENDPOINTS
import { url_get_account_details_by_id_for_edition, url_patch_account_edit } from '../../../../endpoints';

// 🧱 GENERAL COMPONENTS
import TopWhiteSpace from '../../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { MessageToUser } from '../../../../general_components/messageToUser/MessageToUser.tsx';
import FormSubmitBtn from "../../../../general_components/formSubmitBtn/FormSubmitBtn.tsx";
import UniversalDynamicInput from "./UniversalDynamicInput.tsx";
import LeftArrowSvg from '../../../../assets/LeftArrowSvg.svg';

import '../../../../pages/forms/styles/forms-styles.css'

// ⚙️ TYPES AND LOGIC
import { AccountByTypeResponseType, AccountListType } from '../../../../types/responseApiTypes';
import { ValidationMessagesType } from '../../../../validations/types';
import { DropdownOptionType } from '../../../../types/types';

//  VALIDATION PARAMS
import { ACCOUNT_EDIT_SCHEMA_CONFIG, FieldConfigType } from '../../../validations/accountEditSchema';
import { validateForm } from '../../../../validations/utils/zod_validation';
import { accountTypeEditSchemas
} from '../../../validations/editSchemas';

// UTILS FUNCTION
import { debounce } from "../../../utils/debounce.ts";

// 🎯 Local State generic type data of edition Form /Tipo de datos genérico para el formulario de edición (para estados locales)
type GenericEditFormData = {
  [key: string]: string | number | boolean | Date | null | undefined;
};

// ===================================
// 🏦 ACCOUNT EDITION PAGE 
// ===================================
export function EditAccount(): JSX.Element {

//PREVIOUS ROUTE CONFIG
  const { accountId } = useParams<{ accountId: string }>(); 
  const navigateTo = useNavigate();
  const location = useLocation();
  const previousRoute = location.state?.previousRoute || '/fintrack/tracker/accounting'; // fallback
  
//1. 🎯 MANAGE STORE SYNC FOR GLOBAL STATES
  const { updateAccount } = useAccountStore(); 

//2. 📥 FETCHING OF ACCOUNT BY ACCOUNTID 
 const fetchUrl = accountId ? `${url_get_account_details_by_id_for_edition}${accountId}` : null;

 const { apiData, isLoading: isFetching, error: fetchError } = 
  useFetch<AccountByTypeResponseType>(fetchUrl);
//ojo el AccountByTypeResponseType deberia depender del accountTypeId o accountTypeName, 

 const accountData = apiData?.data?.accountList[0]
 // console.log('apiData', {accountData})
  
//3.📤 HOOK FOR EDIT MUTATION (PATCH)
 const mutationUrl = accountId ?`${url_patch_account_edit}/${accountId}` : '';

 const {  isLoading: isSaving, error: saveError, requestFn } = 
  useFetchLoad<AccountListType, GenericEditFormData>({
    url: mutationUrl,
    method: 'PATCH',
  });
// console.log("🚀 ~ EditAccount ~ requestFn data:", data)

//4.⚙️ LOCAL STATES
 const [formData, setFormData] = useState<GenericEditFormData>({});

 const [validationMessages, setValidationMessages] = useState<ValidationMessagesType<GenericEditFormData>>({});

 const [isReset] = useState(false);

const [userMessage, setUserMessage] = useState<{message: string, status: number} | undefined>(undefined);
  
//5.⚙️ ZOD SCHEMA CONFIGURATION
 const accountType = accountData? accountData.account_type_name:null;
// console.log("🚀 ~ EditAccount ~ accountType:", accountType)
//get access of type to the config map using union key
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

//----
 const schema: ZodType<GenericEditFormData> | null = useMemo(() => 
  accountType ? accountTypeEditSchemas[accountType as AccountListType['account_type_name']] as ZodType<GenericEditFormData> : null
  , [accountType]);
  // console.log("🚀 ~ EditAccount ~ schema:", schema)
    
//6.🏗️ FORM INITIALIZATION WITH EXISTENT ACCOUNT INFO 
 useEffect(() => {
  if (accountData && accountFields.length > 0) {
   const initialData: GenericEditFormData = {} as GenericEditFormData;
   const data = accountData; 
   // console.log("🚀 ~ useEffect ~ data:", data, {accountFields})
   
   accountFields.forEach((field: FieldConfigType) => {
   // La clave para acceder a data (del API)
   const key = field.fieldName as keyof typeof data; 
   // La clave para asignar a initialData (GenericEditFormData)
   const formKey = field.fieldName as keyof GenericEditFormData
   if (data && data[key as keyof typeof data] !== undefined) {
    // 🟢 Convertir desired_date de string a Date
if (field.fieldName === 'desired_date' && typeof data[key] === 'string') {
  // 🟢 MEJOR PARSING para timestamp PostgreSQL
  const dateString = data[key] as string;
  let parsedDate: Date;
  
  // Intentar parsing para timestamp PostgreSQL "YYYY-MM-DD HH:MM:SS-TZ"
  if (dateString.includes(' ')) {
    // Formato timestamp: "2024-01-15 15:30:00-05"
    const [datePart] = dateString.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    parsedDate = new Date(year, month - 1, day);
  } else {
    // Formato simple: "YYYY-MM-DD"
    parsedDate = new Date(dateString);
  }
  
  // Validar que el parsing fue exitoso
  if (!isNaN(parsedDate.getTime())) {
    initialData[formKey] = parsedDate;
  } else {
    console.warn(`Failed to parse date: ${dateString}, using current date`);
    initialData[formKey] = new Date('05-02-1966');
  }
  
  // console.log('🔄 Date parsing:', {
  //   original: dateString,
  //   parsed: parsedDate,
  //   successful: !isNaN(parsedDate.getTime())
  // });

} else {
  initialData[formKey] = data[key];
 }
  }
 });
 // console.log('',{initialData})
 
 setFormData(initialData);

// console.log('🔍 DIAGNÓSTICO desired_date:', {
//   valorOriginalAPI: data?.desired_date,
//   tipoOriginal: typeof data?.desired_date,
//   stringParseado: data?.desired_date ? new Date(data.desired_date as string) : null,
//   parsingExitoso: data?.desired_date ? !isNaN(new Date(data.desired_date as string).getTime()) : false,
//   nuestroParsing: initialData.desired_date,
//   nuestroParsingExitoso: initialData.desired_date ? !isNaN((initialData.desired_date as any).getTime()) : false
// });
  }
 }, [accountData, accountFields]);

//7.✅ REAL TIME VALIDATION
const runFieldValidation = useCallback((fieldName: string, value: unknown) => {
 if (!schema) return;

 // Validate just the changed field (using .pick)
// 🟢 FIX: Asegurar que es un ZodObject
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partialSchema = (schema as any).pick({ [fieldName]: true });

  const { errors } = validateForm(partialSchema, { [fieldName]: value });

// 🟢 KEY: Casting key for dynamic access 
 setValidationMessages(prev => {
  const key = fieldName as keyof GenericEditFormData;
  if (errors[fieldName]) {
   return { ...prev, [fieldName]: errors[fieldName] };
  } else {
  // Elimina el mensaje de error si la validación pasa.
  // Patrón idiomático de destructuring para eliminar una propiedad de un objeto de forma inmutable.

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
   const { [key]: _, ...rest } = prev;
   return rest;
   }
  });
  }, [schema]);
//-----
// 🟢 Debounce para la validación de texto/textarea
  const debouncedValidation = useMemo(() => debounce(runFieldValidation, 500), [runFieldValidation]);

//-----------------------------
//8.🎮DYNAMIC CHANGE HANDLERS
 const handleTextChange = useCallback((fieldName: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
 const value = e.target.value;
 setFormData(prev => ({ ...prev, [fieldName]: value }));
 setUserMessage(undefined);
  debouncedValidation(fieldName, value);
}, 
  [debouncedValidation]
);
//---
const handleDropdownChange = useCallback((fieldName: string) => (option: DropdownOptionType | null) => {
 const value = option ? option.value : '';
 setFormData(prev => ({ ...prev, [fieldName]: value }));
 setValidationMessages(prev => ({ ...prev, [fieldName]: undefined }));
 // 🟢inmediate validation 
 runFieldValidation(fieldName, value);
}, [runFieldValidation]);
//---------
const handleDateChange = useCallback((fieldName: string) => (date: Date) => {
 
 setFormData(prev => ({ ...prev, [fieldName]: date}));

 setValidationMessages(prev => ({ ...prev, [fieldName]: undefined }));

 // const value = date.toISOString().split('T')[0]; // "YYYY-MM-DD";

 // 🟢inmediate validation
 runFieldValidation(fieldName, date);

// console.log('handleDateChange', fieldName, value, )

}, [runFieldValidation]);
//----------
// 9.✅ VALIDATION AND SUBMIT
const onSubmitForm = async (e: React.MouseEvent) => {
 e.preventDefault();
 if (!accountType) return;//deberia dar un mensaje
// console.log('formData', formData)
//handling null schema
 if (!schema) {
 console.error('Submission failed: Zod schema is not defined.');
 return;//que se debe hace?
  }
    
// 9.1. Zod Validation
 const { errors, data: validatedData } = validateForm(schema, formData);//recordar que devuelve
    
if (Object.keys(errors).length > 0) {
  setValidationMessages(errors as ValidationMessagesType<GenericEditFormData>);
  setUserMessage({ message: 'Please fix validation errors', status: 400 });
  return;//deberia mostrar los mensajes de error al usuario
}
if (!validatedData) return;//que mensaje se muestra
    
// 9.2. Prepare Payload
// El 'validatedData' es el payload, que Zod ya ha filtrado a los campos del esquema (opcionales)
const payloadToSend = {
  ...validatedData,
  type: accountType, //edtion controller need this
};

// 9.3. SEND API (PATCH)
 const result = await requestFn(payloadToSend as GenericEditFormData, {});
// console.log("🚀 ~ onSubmitForm ~ result despues de editar:", result)
    
if (result.data) {
 updateAccount(result.data);// update and syncronize with accounting dashboard
 setUserMessage({ message: 'Account updated successfully!', status: 200 });

setTimeout(() => {
 navigateTo('/fintrack/tracker/accounting'); //should be previous route
}, 500); 
 }
  };
//-------------------------------------------
const isFormDisabled = isFetching || isSaving || !accountData || !schema;
const finalError = fetchError || saveError;

//-------------------------------------------  
//10. RENDER
return (
 <>
 <section className='page__container'>
 <TopWhiteSpace variant={'dark'} />
 <div className='page__content'>

  <Link to={previousRoute}className='form__header main__title--container '>
   <div className='form__header--icon iconLeftArrow'>
    { <LeftArrowSvg /> }
   </div>
   <div className='form__title'>
    {'Edit Account'}
   </div>
  </Link>

  {isFetching && <p style={{color:'yellow', opacity:'0.5'}}>Loading account data...</p>}

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
      // 🟢 MODIFICACIÓN: Uso de handleTextChange para todos los inputs de texto/número.
      handleInputNumberChange={handleTextChange} 
      isReset={isReset}
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