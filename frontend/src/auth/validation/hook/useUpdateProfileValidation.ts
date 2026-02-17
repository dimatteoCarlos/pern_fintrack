// 📁 frontend/src/lib/validation/useUpdateProfileValidation.ts

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES.
=============================== 🌟 */
import { useCallback } from "react";

/* 🌟 ===============================
🏷️ IMPORT TYPE DEFINITIONS
=============================== 🌟 */
import { UpdateProfileFormDataType } from "../../types/authTypes.ts";
import { updateProfileSchema } from "../zod_schemas/userSchemas.ts";
import useFieldValidation from "./useFieldValidation.ts";

/* 🌟 ===============================
🏷️ IMPORT UTILS
=============================== 🌟 */
import { extractErrorMessage } from "../../auth_utils/extractErrorMessge.ts";
/* 🌟 ===============================
🏷️ TYPE DEFINITIONS
=============================== 🌟 */
/**
 * 📝 Profile form data type is defined by UpdateProfileFormDataType
*/
/**
 * 📝 Profile field names (key)
 */
type ProfileFieldName = keyof UpdateProfileFormDataType;
/**
 * 📝 API error structure for profile updates (generic structure)
 */
type ProfileApiErrorType = {
  success: false;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
  retryAfter?: number;
};

/**
 * 📝 Transformed errors for profile form
 */
type ProfileFormErrorsType<TProfileFieldName extends string> = Partial<Record<TProfileFieldName, string>> & {
  form?: string;
};

/* ==============================
  🔹 Hook parameters type
============================== */
type UseFormValidationParams<TProfileFieldName extends string> = {
  fieldMapping: Record<string, TProfileFieldName>; // backend → frontend field mapping
  schema: typeof updateProfileSchema; // Zod schema or any validation schema
};
//---

/* 🌟 ===============================
🔄 UPDATE PROFILE VALIDATION HOOK
=============================== 🌟 */
/**
 * 🎯 Custom hook for profile-specific validation
 * Wraps the generic useFieldValidation with profile-specific logic
 * 
 * @returns Validation utilities specialized for profile form
 */
/* 🌟 ===============================
📦 MAIN HOOK: useUpdateProfileValidation
=============================== 🌟 */
//🔹 Generic reusable form validation hook
export const useUpdateProfileValidation = <TProfileFieldName extends string>(
  params: UseFormValidationParams<TProfileFieldName>
) => {
const { fieldMapping, schema } = params;

//FUNCTION DECLARATION
// 🧠 Use the existing generic field validation hook
  const genericValidation = useFieldValidation<Record<TProfileFieldName, unknown>>(schema, { validateOnlyTouched: true });

/* 🌟 ===============================
🔧 PROFILE-SPECIFIC VALIDATION FUNCTIONS
=============================== 🌟 */
/**
 * 🔄 Transforms API errors to profile form errors
 * Maps backend field names (user_firstname) to frontend names (firstname)
 * 
 * @param apiError - Error response from profile update API
 * @returns Errors formatted for profile form display
 */
const transformProfileApiErrors = useCallback(
 (apiError: unknown): ProfileFormErrorsType<TProfileFieldName> => {
  const transformedErrors: ProfileFormErrorsType<TProfileFieldName> = {};

 try {
// ============================================
// 🚨  NULL/UNDEFINED ERROR SAFETY CHECK
// ============================================
 if (!apiError) {
 transformedErrors.form = 'No error response from server';
 return transformedErrors;
 }
// ============================================
// 📋  GENERIC LOGIC: FIELD ERRORS PROCESSING
// ============================================
// 🛡️ Type guard for API error structure
// Normalize to a safe object for processing
 const errorObj = apiError as Record<string, unknown>;

// ============================================
// 🚨 1. NEW: RATE LIMIT HANDLING (HIGHEST PRIORITY)
// ============================================
if ('retryAfter' in errorObj && errorObj.retryAfter !== undefined 
  && errorObj.retryAfter !== null) {
 const retryValue = Number(errorObj.retryAfter);
 
 if (!isNaN(retryValue) && retryValue > 0) {
  transformedErrors.form = typeof errorObj.message === 'string' 
   ? errorObj.message 
   : 'Too many updates. Please wait.';
  // ⚡ EARLY RETURN: Infrastructure block takes precedence
  return transformedErrors;
 }
}
// ============================================
// 📋 2. FIELD ERRORS PROCESSING
// ============================================
// 🔄 Map backend field errors to frontend fields
 if (
 errorObj.fieldErrors &&
 typeof errorObj.fieldErrors === 'object'
 ) {
 const fieldErrors = errorObj.fieldErrors as Record<string, string[]>;
// 🗺️ Field name mapping: backend → frontend
// 🔄 Transform each backend error
  Object.entries(fieldErrors).forEach(([backendField, messages]) => {
 const frontendField =
  fieldMapping[backendField] as TProfileFieldName | undefined;

if (
  frontendField &&
  Array.isArray(messages) &&
  messages.length > 0
) {
(transformedErrors as Record<TProfileFieldName, string>)[frontendField] = messages[0];
}
   });
  }
// ===============================
// 📝 3. GLOBAL MESSAGES FALLBACK
// ===============================
  if (
   errorObj.error &&
   typeof errorObj.error === 'string' &&
   !transformedErrors.form
  ) {
   transformedErrors.form = errorObj.error;
  }
 // 💬 Handle message field as fallback
  if (
    errorObj.message &&
    typeof errorObj.message === 'string' &&
    !transformedErrors.form &&
    Object.keys(transformedErrors).length === 0
  ) {
    transformedErrors.form = errorObj.message;
  }
  // 🌐 Handle global API errors
  if (Object.keys(transformedErrors).length === 0) {
 transformedErrors.form = extractErrorMessage(apiError);
   }
//------------
} catch (error) {
  console.error('❌ Error transforming profile API errors:', error);
  transformedErrors.form = 'Failed to process server response';
}
  return transformedErrors;
},
[fieldMapping]
  );
//---------
/**
* ✅ Validates a profile field with proper typing
* 
* @param fieldName - Profile field to validate
* @param value - Field value
* @param formData - Complete form data for context
* @returns Validation result
*/
//FUNCTION DECLARATION
//validateProfileField function definition to validate a field
 const validateProfileField = useCallback(
  (
   fieldName: TProfileFieldName,
   value: unknown,
   // formData?: Partial<UpdateProfileFormDataType>
   formData?: Partial<Record<TProfileFieldName,unknown>>
  ) => {
   return genericValidation.validateField(fieldName, value, formData);
  },
  [genericValidation]
 );
 //-----
 /**FUNCTION DECLARATION
* 📋 Validates entire profile form
* @param formData - Profile form data
* @param touchedFields - Set of touched fields (optional)
* @returns Full validation result
*/
 const validateProfileForm = useCallback(
  (
    formData: Partial<Record<TProfileFieldName, unknown>>,
    touchedFields?: Set<TProfileFieldName>
  ) => {
    return genericValidation.validateAll(formData, touchedFields);
  },
  [genericValidation]
);

/**
* 🔍 Checks if a profile field is valid
* @param fieldName - Field to check
* @param value - Field value
* @param formData - Complete form data
* @returns Boolean indicating validity
*/
//FUNCTION DECLARATION
const isProfileFieldValid = useCallback(
(
  fieldName: TProfileFieldName,
  value: unknown,
  formData?: Partial<Record<TProfileFieldName, unknown>>
) => {
 return genericValidation.isFieldValid(fieldName, value, formData);
},
 [genericValidation]
  );
//-----
/**
* 🧹 Creates empty errors object for profile form
* @returns Empty errors object
*/
//FUNCTION DECLARATION
const createEmptyProfileErrors = useCallback(
 (): ProfileFormErrorsType<TProfileFieldName>=> {
  return genericValidation.createEmptyErrors() as ProfileFormErrorsType<TProfileFieldName>;
 },
 [genericValidation]
);

/* 🌟 ===============================
📤 HOOK RETURN VALUE
=============================== 🌟 */
return {
// 🧠 Core validation functions (from generic hook)
 validateField: validateProfileField,
 validateAll: validateProfileForm,
 isFieldValid: isProfileFieldValid,
 createEmptyErrors: createEmptyProfileErrors,
// 🎯 Profile-specific functions
 transformApiErrors: transformProfileApiErrors,
// 📊 References and metadata
 schema: genericValidation.schema,
 options: genericValidation.options
  };
};

/* 🌟 ===============================
📝 TYPE EXPORTS
=============================== 🌟 */
export type {
  ProfileFieldName,
  ProfileApiErrorType,
  ProfileFormErrorsType
}
export default useUpdateProfileValidation;