// 📁 frontend/src/lib/validation/useUpdateProfileValidation.ts

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import { useCallback } from "react";
import { z } from 'zod';
import { extractErrorMessage } from "../../auth_utils/extractErrorMessge.ts";

/* 🌟 ===============================
🏷️ IMPORT TYPE DEFINITIONS
=============================== 🌟 */
// import { UpdateProfileFormDataType } from "../../types/authTypes.ts";
// import { updateProfileSchema } from "../zod_schemas/userSchemas.ts";
import useFieldValidation from "./useFieldValidation.ts";

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS
=============================== 🌟 */
/**
 * 📝 Generic form errors type
 * Field-specific errors plus optional global form error
 */
type FormErrorsType<TFieldName extends string> = Partial<
  Record<TFieldName, string>
> & { form?: string };

// type ProfileFieldName = keyof UpdateProfileFormDataType;

/**
 * 📝 API error structure for profile updates
 */
type ProfileApiErrorType = {
  success: false;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
 // retryAfter?: number;
};

/**
 * 📝 Transformed errors for profile form
 */
// type ProfileFormErrorsType<TProfileFieldName extends string> = Partial<
//   Record<TProfileFieldName, string>
// > & { form?: string };

/**
 * 📝 Hook parameters (generic over schema)
 * Follows same pattern as useChangePasswordValidation
 */
type UseFormValidationParams<TSchema extends z.ZodType<Record<string, unknown>>>  = {
/** Maps backend field names (e.g., 'user_firstname') to frontend field names (e.g., 'firstname') */
  fieldMapping: Record<string, string>;
/** Zod schema defining validation rules for the form */
  schema: TSchema;
};

/* 🌟 ===============================
🔄 HOOK: useUpdateProfileValidation
=============================== 🌟 */
/**
 * 🎯 Custom hook for profile-specific validation
 * Wraps the generic useFieldValidation with profile-specific logic
 * 🔧 PATTERN: Generic over TSchema (same as useChangePasswordValidation)
 * 🔧 ADVANTAGE: Form shape is inferred from schema, no manual type maintenance
 * @returns Validation utilities specialized for profile form
 */
export const useUpdateProfileValidation = <
  TSchema extends z.ZodType<Record<string, unknown>>
>({
  fieldMapping, schema,}: UseFormValidationParams<TSchema>) => {
// ============================================
// 🔧 INFER TYPES FROM SCHEMA (No manual types!)
// ============================================
/** Form shape inferred directly from Zod schema */
type FormShape = z.infer<TSchema>;
/** Field names derived from the inferred shape */
type FieldNames = keyof FormShape & string;

// ============================================
// 🔧 GENERIC VALIDATION HOOK (type inferred from schema)
// ============================================
  const genericValidation = useFieldValidation(
    schema,
    { validateOnlyTouched: true }
  );

  /* 🌟 ===============================
  🔧 PROFILE-SPECIFIC VALIDATION FUNCTIONS
  =============================== 🌟 */
  /**
   * 🔄 Transforms API errors to profile form errors
   * Maps backend field names (user_firstname) to frontend names (firstname)
    Supports both root-level fieldErrors and Axios-style details.fieldErrors
   * @param apiError - Error response from profile update API
   * @returns Errors formatted for profile form display
   */
    const transformProfileApiErrors = useCallback(
    (apiError: unknown): FormErrorsType<FieldNames> => {
      const errors: FormErrorsType<FieldNames> = {};

     try {
     // 🛡️ 🛡️ Guard clause: no error response
      if (!apiError) {
       errors.form = "No error response from server";
       return errors;
     }

     const errorObj = apiError as Record<string, unknown>;

      // 🚦 HIGHEST PRIORITY: Rate limit handling
       if ("retryAfter" in errorObj && errorObj.retryAfter) {
         const retry = Number(errorObj.retryAfter);
         if (!isNaN(retry) && retry > 0) {
          errors.form =
           typeof errorObj.message === "string"
            ? errorObj.message
            : "Too many updates. Please wait.";
           return errors; // early return
         }
       }

      // 🔄 Extract field errors (supports multiple formats)
      // let fieldErrors: Record<string, string[]> | undefined;

      // Direct fieldErrors at root level
       if (errorObj.fieldErrors && typeof errorObj.fieldErrors === "object") {
          const fieldErrors = errorObj.fieldErrors as Record<string, string[]>;
        
       // 🔄 Transform field errors using fieldMapping
         Object.entries(fieldErrors).forEach(([backendField, messages]) => {
           const frontendField = fieldMapping[backendField] as FieldNames | undefined;

           if (frontendField && Array.isArray(messages) && messages.length > 0) {
          // Take first message only (better UX for field-level errors)
          (errors as Record<FieldNames, string>)[frontendField] = messages[0];
            }
          });
        } 

    // 🌐 Global error fallbacks (when no field-specific errors found)
         if (!errors.form) {
          const globalMessage =
            (errorObj.error as string) ||
            (errorObj.message as string) ||
            extractErrorMessage(apiError);
          if (globalMessage) errors.form = globalMessage;
        }

       // if (errorObj.error && typeof errorObj.error === "string" && !errors.form) {
       //    errors.form = errorObj.error;
       //  }

       //  if (errorObj.message && typeof errorObj.message === "string" && !errors.form) {
       //    errors.form = errorObj.message;
       //  }

       //  if (Object.keys(errors).length === 0) {
       //    errors.form = extractErrorMessage(apiError);
       //  }
      } catch (e) {
        console.error("❌ Error transforming profile API errors:", e);
        errors.form = "Failed to process server response";
      }

      return errors;
    }, [fieldMapping]
  );        
  /* ===============================
  🔹  FIELD VALIDATION FUNCTIONS
  ================================ */
 /**
  * ✅ Validates a single field with context awareness
  * 
  * @param fieldName - Name of the field to validate
  * @param value - Current value of the field
  * @param formData - Complete form data for cross-field validation
  * @returns Validation result with isValid flag and optional error message
  */
  const validateProfileField = useCallback(
    (
      fieldName: FieldNames,
      value: unknown,
      formData?: Partial<FormShape>
    ) => genericValidation.validateField(fieldName, value, formData),
    [genericValidation]
  );

  /**
  * 📋 Validates all form fields at once
  * Typically used on form submission
  * 
  * @param formData - Complete form data to validate
  * @param touchedFields - Set of fields user has interacted with (optional)
  * @returns Validation result with overall validity and field-specific errors
  */

  const validateProfileForm = useCallback(
    (formData: Partial<FormShape>,
      touchedFields?: Set<FieldNames>) =>
      genericValidation.validateAll(formData, touchedFields),
    [genericValidation]
  );

  // const isProfileFieldValid = useCallback(
  //   (
  //     fieldName: TProfileFieldName,
  //     value: unknown,
  //     formData?: Partial<Record<TProfileFieldName, unknown>>
  //   ) => genericValidation.isFieldValid(fieldName, value, formData),
  //   [genericValidation]
  // );

  // const createEmptyProfileErrors = useCallback(
  //   (): ProfileFormErrorsType<TProfileFieldName> =>
  //     genericValidation.createEmptyErrors() as ProfileFormErrorsType<TProfileFieldName>,
  //   [genericValidation]
  // );

  /* 🌟 ===============================
  📤 HOOK RETURN VALUE
  =============================== 🌟 */
  return {
  // 🧠 Core validation functions (from generic hook)
  /** Validates a single field in real-time */
    validateField: validateProfileField,
  /** Validates the entire form (used on submit) */
    validateAll: validateProfileForm,
    // isFieldValid: isProfileFieldValid,
    // createEmptyErrors: createEmptyProfileErrors,

  // 🎯 Profile-specific functions
  /** Transforms raw API errors to form-friendly error format */
    transformApiErrors: transformProfileApiErrors,

  // 📊 References and metadata(useful for debugging)
  /** Original Zod schema for reference */
    schema: genericValidation.schema,
  /** Validation options (e.g., validateOnlyTouched) */
    // options: genericValidation.options,
  };
};

/* 🌟 ===============================
📝 TYPE EXPORTS
=============================== 🌟 */
export type {
  FormErrorsType,
  ProfileApiErrorType,
};

export default useUpdateProfileValidation;