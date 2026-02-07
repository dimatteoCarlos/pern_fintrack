// 📁 frontend/src/auth/hooks/useChangePasswordFormLogic.ts
//Parent: ChangePasswordContainer.tsx
//Business Logic: error handlers, handle change and submit

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import { useCallback,  useState } from "react";

/* 🌟 ===============================
🏷️ IMPORT TYPE DEFINITIONS
=============================== 🌟 */
import {ChangePasswordFormDataType} from "../types/authTypes.ts";
import { PasswordFormErrorsType } from "../validation/hook/useChangePasswordValidation.ts";

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS (LOCALS)
=============================== 🌟 */
//📝 Validation hook interface
 type ChangePasswordFormLogicParamsType = {
  formData:ChangePasswordFormDataType;
  setFormData:React.Dispatch<React.SetStateAction<ChangePasswordFormDataType>>;

  validateField: (
   fieldName: keyof ChangePasswordFormDataType,
   value: unknown,
   formData?: Partial<ChangePasswordFormDataType>
  ) => { isValid: boolean; error?: string };

  validateAll: (
   formData: Partial<ChangePasswordFormDataType>) => {
   isValid: boolean;
   errors: Partial<Record<keyof ChangePasswordFormDataType, string>>;
   };

  transformFromApiToFormErrors: (apiError: unknown)=> PasswordFormErrorsType<keyof ChangePasswordFormDataType>;

  handleDomainChangePassword: (
    payload: ChangePasswordFormDataType
  ) => Promise<unknown>;
}


/* 🌟 ==============================
🎣 MAIN HOOK: useChangePasswordFormLogic
=============================== 🌟 */

 export const useChangePasswordFormLogic = (
{  formData,
  setFormData,
  validateField,
  validateAll,
  transformFromApiToFormErrors,
  handleDomainChangePassword,}
 :ChangePasswordFormLogicParamsType )=> {
/* 🌟 ==============================
🗃️ INTERNAL STATE (Logic Only)
=============================== 🌟 */
const [touchedFields, setTouchedFields] =
  useState<Partial<Record<keyof ChangePasswordFormDataType, boolean>>>({});

const [dirtyFields, setDirtyFields] =
  useState<Partial<Record<keyof ChangePasswordFormDataType, boolean>>>({});

 const [validationErrors, setValidationErrors] = useState<PasswordFormErrorsType<keyof ChangePasswordFormDataType>>({});

 const [apiErrors, setApiErrors] = useState<PasswordFormErrorsType<keyof ChangePasswordFormDataType>>({});

  /* ===============================
  ✏️ FIELD CHANGE HANDLER
  =============================== */
  const handleChange = useCallback(
  (fieldName: keyof ChangePasswordFormDataType, value: string | null) => {
  //New state first / Calculamos el nuevo estado primero
   setFormData((currentFormData:ChangePasswordFormDataType) => {
    const updatedForm = { ...currentFormData, [fieldName]: value };

  // Mark touched
    setTouchedFields((prev)=>({
     ...prev,[fieldName]:true,
    }))
  
  // Mark dirty
  if(currentFormData[fieldName] !== value){
   setDirtyFields((prev)=>({...prev, [fieldName]:true,}))
  }

  // Validate field (real-time) / Validamos con la instantanea exacta del nuevo formulario
    const validationResult = validateField(fieldName, value, updatedForm);

  // Update errors / actualizar errores
    setValidationErrors((prevErrors) => ({
      ...prevErrors,
      [fieldName]: validationResult.isValid? "":validationResult.error??"",
    }));

    return updatedForm;
   });
  },
  [validateField, setFormData] 
);

/* ===============================
🚀 SUBMIT HANDLER
=============================== */
const handleSubmit = useCallback(async ()=>{
 setApiErrors({});
 const {isValid, errors}=validateAll(formData);
 setValidationErrors(errors);
 if(!isValid){
  return {success:false, message:"validation_failed"}
 }

 try {
// Execute domain action
// If this fails → it WILL throw
  await handleDomainChangePassword(formData);
 
  return {success:true};
 } catch (error) {
// Error path (FULLY CONTROLLED)
  const transformedErrors = transformFromApiToFormErrors(error);
  setApiErrors(transformedErrors);

  return {
   success: false,
  };
 }
},[formData,
  validateAll,
  handleDomainChangePassword,
  transformFromApiToFormErrors,]);

/* ===============================
  ♻️ RESET (OPTIONAL)
=============================== */
  const resetForm = useCallback(() => {
   setValidationErrors({});
   setApiErrors({});
  }, []);

 /* ===============================
  📤 RETURN
 =============================== */
  return {
   handleChange,
   handleSubmit,
   resetForm,
   validationErrors,
   apiErrors,
   touchedFields,
   dirtyFields,
   isSubmittingAllowed:
    Object.values(validationErrors).every(error => error === ""),
   
 };
};

/* 🌟 ===============================
📝 DEFAULT EXPORT
=============================== 🌟 */
export default useChangePasswordFormLogic;

