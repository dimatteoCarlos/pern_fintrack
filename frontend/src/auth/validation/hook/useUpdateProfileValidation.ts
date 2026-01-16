// 📁 frontend/src/lib/validation/useUpdateProfileValidation.ts

import { useCallback } from "react";
import { UpdateProfileFormDataType } from "../../types/authTypes";
import { updateProfileSchema } from "../zod_schemas/userSchemas";
import useFieldValidation from "./useFieldValidation";

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
// import { useCallback } from "react";
// import useFieldValidation from "@/utils/validation/hooks/useFieldValidation";
// import { updateProfileSchema } from "@/profile/validation/zod_schemas/userSchemas";
// import { CurrencyType } from "@/types/types";

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
 * 📝 API error structure for profile updates
 */
type ProfileApiErrorType = {
  success: false;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
};

/**
 * 📝 Transformed errors for profile form
 */
type ProfileFormErrorsType = Partial<Record<ProfileFieldName, string>> & {
  form?: string;
  [key: string]: string | undefined;
};

/* 🌟 ===============================
🔄 UPDATE PROFILE VALIDATION HOOK
=============================== 🌟 */
/**
 * 🎯 Custom hook for profile-specific validation
 * Wraps the generic useFieldValidation with profile-specific logic
 * 
 * @returns Validation utilities specialized for profile form
 */
export const useUpdateProfileValidation = () => {
  /* 🌟 ===============================
  📦 USE GENERIC VALIDATION HOOK
  =============================== 🌟 */
 //FUNCTION DECLARATION
// 🧠 Use the existing generic field validation hook
// genericValidation function definition
  const genericValidation = useFieldValidation<UpdateProfileFormDataType>(
    updateProfileSchema,
    { validateOnlyTouched: true }
  );

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
    (apiError: unknown): ProfileFormErrorsType => {
      const transformedErrors: ProfileFormErrorsType = {};

      try {
        // 🛡️ Type guard for API error structure
        if (
          apiError &&
          typeof apiError === 'object' &&
          'fieldErrors' in apiError &&
          apiError.fieldErrors &&
          typeof apiError.fieldErrors === 'object'
        ) {
          const fieldErrors = apiError.fieldErrors as Record<string, string[]>;

          // 🗺️ Field name mapping: backend → frontend
          const fieldMapping: Record<string, ProfileFieldName> = {
            'user_firstname': 'firstname',
            'user_lastname': 'lastname',
            'currency': 'currency',
            'contact': 'contact'
          };

          // 🔄 Transform each backend error
          Object.entries(fieldErrors).forEach(([backendField, messages]) => {
            const profileField = fieldMapping[backendField] || backendField as ProfileFieldName;
            
            if (Array.isArray(messages) && messages.length > 0) {
              transformedErrors[profileField] = messages[0];
            }
          });
        }

        // 🌐 Handle global API errors
        if (
          apiError &&
          typeof apiError === 'object' &&
          'error' in apiError &&
          typeof apiError.error === 'string' &&
          !transformedErrors.form
        ) {
          transformedErrors.form = apiError.error;
        }

        // 💬 Handle message field as fallback
        if (
          apiError &&
          typeof apiError === 'object' &&
          'message' in apiError &&
          typeof apiError.message === 'string' &&
          !transformedErrors.form &&
          Object.keys(transformedErrors).length === 0
        ) {
          transformedErrors.form = apiError.message;
        }

      } catch (error) {
        console.error('❌ Error transforming profile API errors:', error);
        transformedErrors.form = 'Failed to process server response';
      }

      return transformedErrors;
    },
    []
  );

  /**
   * ✅ Validates a profile field with proper typing
   * 
   * @param fieldName - Profile field to validate
   * @param value - Field value
   * @param formData - Complete form data for context
   * @returns Validation result
   */
  //FUNCTION DECLARATION
  //validateProfileField function definitio to validate a field
  const validateProfileField = useCallback(
    (
      fieldName: ProfileFieldName,
      value: unknown,
      formData?: Partial<UpdateProfileFormDataType>
    ) => {
      return genericValidation.validateField(fieldName, value, formData);
    },
    [genericValidation]
  );

  /**FUNCTION DECLARATION
   * 📋 Validates entire profile form
   * 
   * @param formData - Profile form data
   * @param touchedFields - Set of touched fields (optional)
   * @returns Full validation result
   */
  const validateProfileForm = useCallback(
    (
      formData: Partial<UpdateProfileFormDataType>,
      touchedFields?: Set<ProfileFieldName>
    ) => {
      return genericValidation.validateAll(formData, touchedFields);
    },
    [genericValidation]
  );

  /**
   * 🔍 Checks if a profile field is valid
   * 
   * @param fieldName - Field to check
   * @param value - Field value
   * @param formData - Complete form data
   * @returns Boolean indicating validity
   */
  //FUNCTION DECLARATION
  const isProfileFieldValid = useCallback(
    (
      fieldName: ProfileFieldName,
      value: unknown,
      formData?: Partial<UpdateProfileFormDataType>
    ) => {
      return genericValidation.isFieldValid(fieldName, value, formData);
    },
    [genericValidation]
  );

  /**
   * 🧹 Creates empty errors object for profile form
   * 
   * @returns Empty errors object
   */
  //FUNCTION DECLARATION
  const createEmptyProfileErrors = useCallback(
    (): ProfileFormErrorsType => {
      return genericValidation.createEmptyErrors() as ProfileFormErrorsType;
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
};

export default useUpdateProfileValidation;