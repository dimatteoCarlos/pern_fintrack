// frontend\src\auth\hooks\useUpdateProfileForm.ts
/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// 🏪 STORE & HOOKS
import { useAuthStore } from "../stores/useAuthStore";
import useAuth from "../hooks/useAuth";

// 🏷️ IMPORT TYPE DEFINITIONS
import { 
 // ProfileUpdateResponseType, 
 UserDataType 
} from "../types/authTypes";
import { CurrencyType } from "../../types/types";

// 🎨 UI CONSTANTS
 import { CURRENCY_OPTIONS } from "../../helpers/constants";
 import { generateCurrencyOptions } from "../../helpers/functions";

// ⚙️ VALIDATION & UTILITIES
import {
  updateProfileSchema,
 } from "../validation/zod_schemas/userSchemas"; 
 import useFieldValidation from "../validation/hook/useFieldValidation";
 
// 🎯 REUSABLE HOOKS
import { useClickOutside } from "../../editionAndDeletion/hooks/useClickOutside";
import { useEscapeKey } from "../../editionAndDeletion/hooks/useEscapeKey";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback.ts";

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS (LOCALS)
=============================== 🌟 */
/**
 * 📝 Form data structure matching the frontend schema
 * Note: Different field names from UserDataType (firstname vs user_firstname)
 */
export type FormDataType = {
  firstname: string;
  lastname: string;
  currency: CurrencyType;
  contact: string | null;} 

/**
* 📝 Field-specific error messages
*/
export type FormErrorsType =  Partial<Record<keyof FormDataType, string>> & {
  [key: string]: string | undefined; // ✅ Dynamic keys for backend fieldErrors
  form?: string;
};

/* 🌟 ===============================
 🛠️ DATA TRANSFORMATION UTILITIES
 =============================== 🌟 */
 /**
 * 🔄 Transforms store data to form data
 * Converts: user_firstname → firstname, user_lastname → lastname
 * @param userData - User data from Zustand store
 * @returns Formatted data for the form
 */
const storeToForm =(userData:UserDataType):FormDataType=>({
 firstname:userData?.user_firstname || '',
 lastname:userData?.user_lastname || '',
 currency:(userData?.currency?.toLowerCase() as CurrencyType) || 'usd',
 contact:userData?.contact || null,
});

/**
 * 🔄 Transforms form data to API payload
 * Prepares data for handleUpdateUserProfile API call
 * @param formData - Current form data
 * @returns Clean payload for API (undefined for empty values)
 */
const formToAPI = (formData:FormDataType)=>({
firstname:formData?.firstname || undefined,
lastname:formData?.lastname || undefined,
currency:formData?.currency || undefined,
contact:formData?.contact || undefined,
})
//------------------

/**
* 🔄 Transforms API response to store format
* Converts: firstname → user_firstname, lastname → user_lastname
* @param apiData - Response from profile update API
* @returns Data formatted for Zustand store
*/
// const apiToStore = (apiData:ProfileUpdateResponseType['user']):Partial<UserDataType>=>({
//   user_firstname: apiData?.user_firstname,
//   user_lastname: apiData?.user_lastname,
//   currency: apiData?.currency,
//   contact: apiData?.contact
// });

/**
 * Transforms form data to store format
 */
// const formToStore = (formData:FormDataType):Partial<UserDataType>=>({
//   user_firstname: formData?.firstname,
//   user_lastname: formData?.lastname,
//   currency: formData?.currency,
//   contact: formData?.contact
// });

//------------------------------------
// MAIN CUSTOM HOOK: useUpdateProfileForm
/**
 * Custom hook containing ALL business logic for UpdateProfileForm
 * Separated from UI for better testability and maintainability
 * 
 * @param onClose - Callback to close the modal
 * @returns Object containing all states, handlers, and refs needed by UI
*/

/* 🌟 ==============================
🛡️ MAIN CUSTOM HOOK: useUpdateProfileForm
=============================== 🌟 */
export const useUpdateProfileForm = (onClose:()=>void) => {
/* 🌟 ===============================
    🏪 STORE & HOOKS INITIALIZATION
=============================== 🌟 */
 const userData = useAuthStore((state) => state.userData); 
 const {
  handleUpdateUserProfile,
  isLoading,
  error:apiError, 
  successMessage,
  clearError,
  clearSuccessMessage

  } = useAuth();

/* 🌟 ===============================
🎯 REUSABLE HOOKS INTEGRATION
=============================== 🌟 */
// 🔐 Escape key handling (only when not loading)
 useEscapeKey(onClose, !isLoading);

// 🧹 Validation hook
 const { validateField, validateAll } = useFieldValidation(updateProfileSchema);

// 💰 Currency options (memoized)
const currencyOptions = useMemo(
() => generateCurrencyOptions(CURRENCY_OPTIONS),
[]
);

/* 🌟 ==============================
   🗃️ STATE MANAGEMENT
=============================== 🌟 */ 
 const [formData, setFormData]=useState<FormDataType>({
  firstname: '',
  lastname: '',
  currency: 'usd',
  contact: null
 });
 
 const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

 const [errors, setErrors] = useState<FormErrorsType>({});
 
 const [originalData, setOriginalData] = useState<FormDataType | null>(null);
 
 const modalRef = useRef<HTMLDivElement>(null);
 
 // const [isDirty, setIsDirty] = useState(false);

 // const [validationErrors, setValidationErrors] = useState<Record<string,string>>({});

/* 🌟 ===============================
   🔄 INITIALIZATION LOGIC
=============================== 🌟 */
// 🎯 Load user data into form on mount

useEffect(()=>{if(userData){
 const initialFormData = storeToForm(userData);
 setFormData(initialFormData);
 setOriginalData(initialFormData);
}},[userData])

// 🧹 Clear any existing messages on mount
useMemo(()=>{
 clearError();
 clearSuccessMessage();
},[clearError,
clearSuccessMessage])

/* 🌟 ===================
🔍 DIRTY CHECKING 
==================== 🌟 */
const isDirty =useMemo(()=>{
 if(!originalData) return false;
 return (Object.keys(formData) as  Array<keyof FormDataType>).some(key =>formData[key] !== originalData[key])

},[formData, originalData]);

//lear another way of doing it with ts:
// const isDirty= Object.keys(formData).some((key) => {
//   const k = key as keyof FormDataType; // "Confía en mí, es una llave válida"
//   return formData[k] !== originalData?.[k]
// });

/* 🌟 ===============================
   ⏰ AUTO-CLOSE ON SUCCESS
=============================== 🌟 */
 useEffect(() => {
  if (successMessage) {
   const timer = setTimeout(() => {
     onClose();
   }, 2000);
   return () => clearTimeout(timer);
   }
  }, [successMessage, onClose]);

/* 🌟 ===============================
     🖱️ CLICK OUTSIDE HANDLING
=============================== 🌟 */
  useClickOutside(modalRef, onClose, !isLoading);

/* 🌟 ===============================
🎯 FIELD CHANGE HANDLER (WITH DEBOUNCED VALIDATION)
=============================== 🌟 */
// ⏳ Debounced validation function definition(300ms delay)
const debouncedValidate = useDebouncedCallback(
 (fieldName: keyof FormDataType, value: string | null | CurrencyType) => {
 const result = validateField(fieldName, value);

setErrors((prev) => {
 const newErrors: FormErrorsType = { ...prev };
 if (result.error) {
  newErrors[fieldName as string] = result.error;
 } else {
   delete newErrors[fieldName as string];
    }
  return newErrors;
 });
},300);

//====================================
/* 🌟 FIELD CHANGE HANDLER 🌟 */
//====================================
 const handleChange = useCallback((
  field: keyof FormDataType,
  value: string | null | CurrencyType
  ) => {
// 📝 Update form data
 setFormData(prev => ({
   ...prev,
   [field]: value
 }));

// ✋ Mark field as touched
setTouchedFields(prev => ({ ...prev, [field]: true }));

// 🧹 Clear any existing error for this field
// if (errors[field]) {
//   setErrors(prev => ({ ...prev, [field]: undefined }));
// }

// 🧹 Clear global error if user starts typing
if (apiError) {
 clearError();
}

// ✅ Trigger debounced validation
 debouncedValidate(field, value);
 }, [apiError, clearError, debouncedValidate]);

/* 🌟 ===============================
🚀 FORM SUBMISSION HANDLER
=============================== 🌟 */
const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

// 🧹 Clear previous messages
clearError();
clearSuccessMessage();

// Full validation
// ✅ Step 1: Full validation before submit
const validation = validateAll(formData);
if (!validation.isValid) {
 setErrors(validation.errors as FormErrorsType);

// ✋ Mark all fields as touched to show errors
 // const allTouched = ['firstname', 'lastname', 'currency', 'contact'].reduce(
 //   (acc, field) => ({ ...acc, [field]: true }),
 //   {} as Record<string, boolean>
 // );

 const allTouched = Object.keys(formData).reduce((acc,field)=>({...acc, [field]:true}), {})
 ;
 setTouchedFields(allTouched);
 return;
}

// 🔍 Step 2: Check if form has changes
if (!isDirty) {
 setErrors({ form: 'No changes detected. Please modify at least one field.' });
 return;
}

//Data transformation
 try {
 // 🔄 Step 3: Transform data for API
 const apiPayload = formToAPI(formData);

// 🧹 Step 4: Remove undefined values
 const cleanPayload = Object.fromEntries(
  Object.entries(apiPayload).filter(([, value]) => value !== undefined)// eslint-disable-line @typescript-eslint/no-unused-vars
 );

 // 📤 Step 5: Send to API
 const result = await handleUpdateUserProfile(cleanPayload);

 // ⚠️ Step 6: Handle API errors
 if (!result.success) {
  const apiErrors: FormErrorsType = {};
// ✅ Type guard: ensure fieldErrors exists and is an object
if ('fieldErrors' in result &&  result.fieldErrors&& typeof result.fieldErrors === 'object') {
  for (const [field, messages] of Object.entries(result.fieldErrors)) {
// ✅ Guard to ensure messages is array of strings   
   if (Array.isArray(messages) && messages.length > 0) {
    apiErrors[field] = messages[0]; // pick the first error message
     }
    }
  }
  setErrors(Object.keys(apiErrors).length > 0 ? apiErrors : { form: result.error || "Update failed" });
 }
} catch (err) {
setErrors({ form: "An unexpected error occurred" });
}
  };
/* 🌟 ===============================
📤 HOOK RETURN VALUE
=============================== 🌟 */
return {
 // 📊 States
 formData,
 errors,
 touchedFields,
 isLoading,
 isDirty,
 currencyOptions,
 
 // 🎮 Handlers
 handleChange,
 handleSubmit,
 
 // 🎯 Refs
 modalRef,
 
 // 📢 Messages
 successMessage,
 error: apiError,
 
 // 🔧 Utilities (for UI if needed)
 clearError,
 clearSuccessMessage
  };
};

export default useUpdateProfileForm;
