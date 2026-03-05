// 📁 frontend/src/auth/hooks/useChangePasswordFormLogic.ts

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import { useCallback, useState } from 'react';

/* 🌟 ===============================
🏷️ IMPORT TYPE DEFINITIONS
=============================== 🌟 */
import { ChangePasswordFormDataType, ChangePasswordResultType } from '../types/authTypes';

import { FormErrorsType, TransformApiErrorsFnType, ValidateAllFnType, ValidateFieldFnType } from '../validation/hook/useChangePasswordValidation';

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS (LOCALS)
=============================== 🌟 */
/**
 * 📝 Parameters for the change password form logic hook
 */
type ChangePasswordFormLogicParamsType = {
/** 📋 Current form data state */
 formData: ChangePasswordFormDataType;

/** 📝 Form data setter from parent */
 setFormData: React.Dispatch<React.SetStateAction<ChangePasswordFormDataType>>;

/** 🧪 Single field validation - adapter contract with FULL response */
 validateField: ValidateFieldFnType<ChangePasswordFormDataType>;

/** 📦 Full form validation - adapter contract with FULL response */
 validateAll: ValidateAllFnType<ChangePasswordFormDataType>;

/** 🔄 Transform backend field errors to frontend format */
 transformFromApiToFormErrors: TransformApiErrorsFnType<keyof ChangePasswordFormDataType>;

/** 🎯 Domain function - calls the actual API */
 handleDomainChangePassword: (
   payload: ChangePasswordFormDataType
 ) => Promise<ChangePasswordResultType>;
};

/* 🌟 ==============================
🎣 MAIN HOOK: useChangePasswordFormLogic
=============================== 🌟 */
/**
* 🎯 Change Password Form Logic Hook
* 
* 🔑 RESPONSIBILITIES:
* - Manage form state (touched, dirty, errors)
* - Handle field changes with real-time validation
* - Coordinate form submission flow
* - Transform API errors to form errors
* - Provide submission eligibility status
* 
* ✅ Pure business logic - NO UI state
* ✅ Uses imported contract types from validation
* ✅ Type-safe - validation functions must match contract
*/
export const useChangePasswordFormLogic = ({
  formData,
  setFormData,
  validateField,
  validateAll,
  transformFromApiToFormErrors,
  handleDomainChangePassword
}: ChangePasswordFormLogicParamsType) => {

/* 🌟 ==============================
🗃️ INTERNAL STATE
=============================== 🌟 */
/** 🎯 Fields that have been blurred/touched - show errors only after interaction */
 const [touchedFields, setTouchedFields] = useState<Partial<Record<keyof ChangePasswordFormDataType, boolean>>>({});

/** 🎯 Fields that have been modified from initial value - reserved for UX */
 const [dirtyFields, setDirtyFields] = useState<
   Partial<Record<keyof ChangePasswordFormDataType, boolean>>
 >({});

/** ❌ Client-side validation errors (Zod) - EMPTY OBJECT = no errors */
 const [validationErrors, setValidationErrors] = useState<
 FormErrorsType<keyof ChangePasswordFormDataType>
 >({});

/** ❌ Server-side API errors (transformed) - EMPTY OBJECT = no errors */
 const [apiErrors, setApiErrors] = useState<
  FormErrorsType<keyof ChangePasswordFormDataType>
 >({});

/* ===============================
✏️ FIELD CHANGE HANDLER
=============================== */
/**
* Delete for valid fields (no empty strings)
*/
// const handleChange = useCallback(
// (fieldName: keyof ChangePasswordFormDataType, value: string | null) => {

//  setFormData((currentFormData: ChangePasswordFormDataType) => {
//  const updatedForm = {
//    ...currentFormData,
//    [fieldName]: value ?? ''
//  };

// // 🎯 Mark field as touched
//  setTouchedFields((prev) => ({
//   ...prev,
//   [fieldName]: true
//  }));

// // 🎯 Mark field as dirty if value changed
//  if (currentFormData[fieldName] !== value) {
//   setDirtyFields((prev) => ({
//    ...prev,
//    [fieldName]: true
//   }));
//  }

// // 🧪 Real-time validation for this field only
//  const validationResult = validateField(
//   fieldName,
//   value ?? '',
//   updatedForm
//  );

// // 📝 Update validation errors
//  setValidationErrors((prevErrors) => {
//   const next = { ...prevErrors };

//  if (validationResult.isValid) {
//    delete next[fieldName];
//   } else {
//     next[fieldName] = validationResult.error ?? 'Invalid value';
//   }

//    return next;
//  });

//  return updatedForm;
//  });
//  },
//  [validateField, setFormData]
// );

const handleChange = useCallback(
(fieldName: keyof ChangePasswordFormDataType, value: string | null) => {

 setFormData((currentFormData: ChangePasswordFormDataType) => {
 const updatedForm={...currentFormData, [fieldName]: value??'' };

// 🎯 Mark field as touched and dirty (unchanged)
 setTouchedFields((prev) => ({
  ...prev, [fieldName]: true
 }));

// 🎯 Mark field as dirty if value changed
 if (currentFormData[fieldName] !== value) {
  setDirtyFields((prev) => ({
   ...prev,  [fieldName]: true }));
 }
// 🧪 Real-time validation for this field only
// 📝 Update validation errors for the changed field
 setValidationErrors((prevErrors) => {
  const next = { ...prevErrors };

 const mainResult = validateField(fieldName, value??'',updatedForm);

  if (mainResult.isValid) {
    delete next[fieldName];
   } else {
     next[fieldName] = mainResult.error ?? 'Invalid value';
  }

 // If newPassword changed, also validate confirmPassword
  if (fieldName === 'newPassword') {
    const confirmResult = validateField('confirmPassword', updatedForm.confirmPassword, updatedForm);
    if (confirmResult.isValid) {
      delete next['confirmPassword'];
    } else {
      next['confirmPassword'] = confirmResult.error ?? 'Invalid value';
    }
 }
//----------------------
  return next;
  });

 return updatedForm;
   });
  },
 [validateField, setFormData]
);

/* ===============================
🚀 SUBMIT HANDLER
=============================== */
/**
* Handles form submission
* 
* 🔄 Flow:
* 1. Mark ALL fields as touched (show all errors on submit)
* 2. Clear previous errors (start fresh)
* 3. Run full client-side validation with touched fields
* 4. If invalid → return void (container knows validation failed)
* 5. If valid → call domain API
* 6. Transform backend field errors if any
* 7. Return domain result to container
* 
* ✅ Returns ChangePasswordResultType | void (never throws)
* ✅ Passes touchedFields to validateAll (supports validateOnlyTouched)
* ✅ Empty objects for errors (no empty strings)
* 
* @returns Domain result on success/error, void if client validation fails
*/
  const handleSubmit = async (): Promise<ChangePasswordResultType | void> => {
// 🎯 Mark ALL fields as touched for submit-time validation
  setTouchedFields({
    currentPassword: true,
    newPassword: true,
    confirmPassword: true
  });

// 🧹 Clear previous errors - ✅ empty objects
  setValidationErrors({});
  setApiErrors({});

// 🧪 Full client-side validation with touched fields
  const validationResult = validateAll(
    formData,
    new Set(Object.keys(touchedFields) as Array<keyof ChangePasswordFormDataType>)
  );

// ❌ Client validation failed
  if (!validationResult.isValid) {
    setValidationErrors(validationResult.errors);
    return; // ✅ void = validation failed, container knows
  }

 try {
// 🎯 Call domain function (API)
  const result = await handleDomainChangePassword(formData);

// ❌ Domain error - transform backend field errors
 if (!result.success && result.fieldErrors) {
  const mappedErrors =  transformFromApiToFormErrors(result.fieldErrors);
   setApiErrors(mappedErrors);
  }

// ✅ Return domain result to container
 return result;

  } catch (error) {
// 🔴 Unexpected error (network, server down, etc.)
  console.error('❌ Unexpected error in handleSubmit:', error);

// ✅ Return valid domain result, NEVER throw
 const errorResult: ChangePasswordResultType = {
  success: false,
  error: 'UnexpectedError',
  message: 'An unexpected error occurred. Please try again.'
 };

 return errorResult;
   }
  };

/* ===============================
♻️ RESET FORM
=============================== */
/** Resets all form state to initial values */
 const resetForm = useCallback(() => {
 setValidationErrors({});
 setApiErrors({});
 setTouchedFields({});
 setDirtyFields({});
}, []);

/* ===============================
📤 HOOK RETURN
=============================== */
 return {
/** ✏️ Field change handler with real-time validation */
  handleChange,
/** 🚀 Form submit handler - returns domain result or void */
  handleSubmit,
/** ♻️ Reset all form state */
  resetForm,
/** ❌ Client-side validation errors - EMPTY = no errors */
  validationErrors,
/** ❌ Server-side API errors - EMPTY = no errors */
  apiErrors,
/** 🎯 Fields that have been touched/blurred */
  touchedFields,
/** 🎯 Fields that h ave been modified (reserved for future UX) */
  dirtyFields,
/**
* ✅ Whether form can be submitted
* 🔑 Uses Object.keys().length, not string comparison
*/
 isSubmittingAllowed:
  Object.keys(validationErrors).length === 0 &&
  Object.keys(apiErrors).length === 0 &&
  Object.values(touchedFields).length === Object.values(formData).length
 };
};

export default useChangePasswordFormLogic;

/*
ALTERNATIVE TO  isSubmittinAllowed:
const allTouched = (Object.keys(formData) as (keyof ChangePasswordFormDataType)[])
  .every((field) => touchedFields[field] === true);

const allFilled = (Object.values(formData) as string[])
  .every((value) => value.trim().length > 0);

const hasClientErrors = Object.keys(validationErrors).length > 0;
const hasApiErrors = Object.keys(apiErrors).length > 0;

isSubmittingAllowed:
  allTouched &&
  allFilled &&
  !hasClientErrors &&
  !hasApiErrors

*/