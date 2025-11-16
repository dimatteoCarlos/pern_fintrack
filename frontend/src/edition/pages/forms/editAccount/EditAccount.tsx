// frontend/src/edition/pages/forms/editAccount/EditAccount.tsx
import { ZodType } from "zod"
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

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

// ⚙️ TYPES AND LOGIC
import { AccountByTypeResponseType, AccountListType } from '../../../../types/responseApiTypes';
import { ValidationMessagesType } from '../../../../validations/types';
import { DropdownOptionType } from '../../../../types/types';

//  VALIDATION PARAMS
import { ACCOUNT_EDIT_SCHEMA_CONFIG, FieldConfigType } from '../../../validations/accountEditSchema';
import { validateForm } from '../../../../validations/utils/zod_validation';
import { accountTypeEditSchemas, //BaseAccountEditFormData, CategoryBudgetEditFormData, DebtorAccountEditFormData, PocketSavingEditFormData 

} from '../../../validations/editSchemas';

import { debounce } from "../../../utils/debounce.ts";

// 🎯 Tipo de datos genérico para el formulario de edición (para estados locales)
// type GenericEditFormData = BaseAccountEditFormData & PocketSavingEditFormData & CategoryBudgetEditFormData & DebtorAccountEditFormData & Record<string, unknown>;

// type GenericEditFormData = BaseAccountEditFormData 
//   | PocketSavingEditFormData
//   | CategoryBudgetEditFormData 
//   | DebtorAccountEditFormData
  // | Record<string, unknown>;

type GenericEditFormData = {
  [key: string]: string | number | boolean | Date | null | undefined;
};

// ===================================
// 🏦 ACCOUNT EDITION PAGE 
// ===================================
export function EditAccount(): JSX.Element {
  const { accountId } = useParams<{ accountId: string }>(); 
  const navigate = useNavigate();
  
//1. 🎯 MANAGE STORE SYNC FOR GLOBAL STATES
  const { updateAccount } = useAccountStore(); 

//2. 📥 FETCHING OF ACCOUNT BY ACCOUNTID 
 const fetchUrl = accountId ? `${url_get_account_details_by_id_for_edition}${accountId}` : null;

 const { apiData, isLoading: isFetching, error: fetchError } = 
  useFetch<AccountByTypeResponseType>(fetchUrl);

  const accountData = apiData?.data?.accountList[0]
 console.log('apiData', {accountData})
  
//3.📤 HOOK FOR EDIT MUTATION (PATCH)
 const mutationUrl = accountId ?`${url_patch_account_edit}${accountId}` : '';

 const {  isLoading: isSaving, error: saveError, requestFn } = 
  useFetchLoad<AccountListType, GenericEditFormData>({
    url: mutationUrl,
    method: 'PATCH',
  });

//***/

//4.⚙️ LOCAL STATES
 const [formData, setFormData] = useState<GenericEditFormData>({});

 // const [originalData, setOriginalData] = useState<GenericEditFormData>({});

 const [validationMessages, setValidationMessages] = useState<ValidationMessagesType<GenericEditFormData>>({});
 const [isReset] = useState(false);
 // const [isReset, setIsReset] = useState(false);
  
//5.⚙️ ZOD SCHEMA CONFIGURATION
 const accountType = accountData? accountData.account_type_name:null;
 
 console.log("🚀 ~ EditAccount ~ accountType:", accountType)
//get access of type to the config map using union key 
 const accountFields = useMemo(() => {
  if (!accountType) return [];//que pasa si esto occure?

  const fields = ACCOUNT_EDIT_SCHEMA_CONFIG[accountType as AccountListType['account_type_name']];

  console.log("🚀 ~ EditAccount ~ fields:", fields)
    if (!fields) {
   console.error(`Error: Account type '${accountType}' not found in ACCOUNT_EDIT_SCHEMA_CONFIG.`);
   return [];
  }
  
  return fields
    }, [accountType]);

 console.log("🚀 ~ EditAccount ~ accountFields:", accountFields)//que pasa si n[]
//----
 const schema: ZodType<GenericEditFormData> | null = useMemo(() => 
  accountType ? accountTypeEditSchemas[accountType as AccountListType['account_type_name']] as ZodType<GenericEditFormData> : null
  , [accountType]);
  
  console.log("🚀 ~ EditAccount ~ schema:", schema)
  
//6.🏗️ FORM INITIALIZATION WITH ACCOUNT INFO 
 useEffect(() => {
  if (accountData && accountFields.length > 0) {
   const initialData: GenericEditFormData = {} as GenericEditFormData;
   const data = accountData; //data type is AccountDetailDataUnion
   
   console.log("🚀 ~ useEffect ~ data:", data)
   
   accountFields.forEach((field: FieldConfigType) => {
   // La clave para acceder a data (del API)
   const key = field.fieldName as keyof typeof data; 
   // La clave para asignar a initialData (GenericEditFormData)
   const formKey = field.fieldName as keyof GenericEditFormData
   
   if (data && data[key as keyof typeof data] !== undefined) {
    initialData[formKey] = data[key];
     // initialData[key] = data[key as keyof typeof data] as string | number | Date;//m
   }
  });
  setFormData(initialData);
  // setOriginalData(initialData)
 }
 }, [accountData, accountFields]);

//7.✅ REAL TIME VALIDATION
const runFieldValidation = useCallback((fieldName: string, value: unknown) => {
 if (!schema) return;

 // Validate just the changed field (using .pick)
 // 🟢 FIX: Asegurar que es un ZodObject
  // const zodObjectSchema = schema as z.ZodObject<Record<string,  z.ZodTypeAny>>;
  // const partialSchema = zodObjectSchema.pick({[fieldName]: true } );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partialSchema = (schema as any).pick({ [fieldName]: true });

  const { errors } = validateForm(partialSchema, { [fieldName]: value });

// 🟢 FIX: Aserta la clave para el acceso dinámico
 setValidationMessages(prev => {
  const key = fieldName as keyof GenericEditFormData;
  if (errors[fieldName]) {
   return { ...prev, [fieldName]: errors[fieldName] };
  } else {
  // Elimina el mensaje de error si la validación pasa
  // Patrón idiomático de destructuring para eliminar una propiedad de un objeto de forma inmutable.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
   const { [key]: _, ...rest } = prev;
   return rest;
   }
  });
  }, [schema]);

  // 🟢 MEJORA 3: Debounce para la validación de texto/textarea
  const debouncedValidation = useMemo(() => debounce(runFieldValidation, 300), [runFieldValidation]);
//-----------------------------
//8.🎮DYNAMIC CHANGE HANDLERS
 const handleTextChange = useCallback((fieldName: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
 const value = e.target.value;
 setFormData(prev => ({ ...prev, [fieldName]: value }));
 if (fieldName === 'note' || e.target.type === 'text') {
  debouncedValidation(fieldName, value);
   } else {
// Validación inmediata para otros tipos de input (si es necesario)
   runFieldValidation(fieldName, value);
   }
 }, [debouncedValidation, runFieldValidation]);
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
 const value = date.toISOString().split('T')[0];
 setFormData(prev => ({ ...prev, [fieldName]: value}));
 setValidationMessages(prev => ({ ...prev, [fieldName]: undefined }));
 // 🟢inmediate validation
 runFieldValidation(fieldName, value);
}, [runFieldValidation]);

// 9.✅ VALIDATION AND SUBMIT
const onSubmitForm = async (e: React.MouseEvent) => {
 e.preventDefault();
 if (!accountType) return;//deberia dar un mensaje

//handling null schema
 if (!schema) {
 console.error('Submission failed: Zod schema is not defined.');
 return;//que se debe hace?
  }
    
// 9.1. Zod Validation
 const { errors, data: validatedData } = validateForm(schema, formData);//recordar que devuelve
    
if (Object.keys(errors).length > 0) {
  setValidationMessages(errors as ValidationMessagesType<GenericEditFormData>);
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

 console.log("🚀 ~ onSubmitForm ~ result despues de editar:", result)
    
if (result.data) {
 updateAccount(result.data);// update and syncronize with accounting dashboard

setTimeout(() => {
 navigate('/fintrack/tracker/accounting'); //should be previous route
}, 500); 
 }
  };

const isFormDisabled = isFetching || isSaving || !accountData || !schema;

const finalError = fetchError || saveError;

const messageToUser = accountData ? { message: 'Account updated successfully!', status: 200 } : undefined;
  
//10. RENDER
return (
 <section className='form__layout'>
 <TopWhiteSpace variant={'dark'} />
 <div className='form__container'>
  <Link to={'/fintrack/tracker/accounting'} className='form__header'>
   <div className='form__header--icon'>
    {/* <LeftArrowSvg /> */}flecha
   </div>
   <div className='form__title'>
    {'Edit Account'}
   </div>
  </Link>

   {isFetching && <p>Loading account data...</p>}

   {fetchError && <p className='error-message'>Error loading data: {fetchError}</p>}

   {accountType && accountFields.length === 0 && !isFetching && (
    <p className='error-message'>Configuration not found for account type: {accountType}</p>
    )}

   {!!accountType && accountFields.length > 0 && (
    <form className='form__body'>
     <div className='form__input__group'>
   {/* 🎨 DYNAMIC RENDERING OF FORM */}
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

    <div className='submit__btn__container'>
      <FormSubmitBtn onClickHandler={onSubmitForm} disabled={isFormDisabled || !accountId}>
        Save Changes
      </FormSubmitBtn>
    </div>
     </form>
   )}

  <MessageToUser
    isLoading={isSaving}
    error={finalError}
    messageToUser={messageToUser}
    variant="form"
  />
 </div>
 </section>
  );
}

export default EditAccount;