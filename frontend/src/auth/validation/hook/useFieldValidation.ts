// 📁 frontend/src/utils/validation/hooks/useFieldValidation.ts
// NOTE:
// This hook performs ONLY schema-level validation.
// Authentication / authorization errors MUST be handled separately from backend responses (e.g. incorrect password).

/* 🌟 ===============================
   🧪 GENERIC ZOD FIELD VALIDATION HOOK
   Zod v4 compliant - Validates FULL schema, filters errors by path
   Single source of truth - NO schema fragmentation
   FE/BE safe - Same schema works on both sides
   =============================== 🌟 */

import { z } from 'zod';
import { useCallback } from 'react';
import {
  FieldValidationResultType,
  FormValidationResultType,
  ValidationOptionsType
} from '../types/validationTypes';

/* 🌟 ====================================
 🎯 MAIN VALIDATION HOOK: useFieldValidation
 ======================================= 🌟 */

 /**
 * Generic validation hook based on a full Zod schema.
 *
 * 🔑 DESIGN PRINCIPLES:
 * 1. Schema is NEVER fragmented or sliced
 * 2. Partial data is ALWAYS allowed during editing
 * 3. Field validation = FULL schema validation + ERROR FILTERING by path
 * 4. Same schema works on FE + BE - zero divergence
 *
 * @param schema - Zod schema (same as backend)
 * @param options - Validation behavior configuration
 * @returns Validation functions for field and form level
 */
export const useFieldValidation = <TFormShape extends Record<string, unknown>>(
  schema: z.ZodType<TFormShape> ,
  options: ValidationOptionsType = {}
) => {

/* 🔹 ===============================
 🔍 VALIDATE SINGLE FIELD
 =============================== 🔹 */
/**
* Validates a single field using the FULL schema.
* ✅ Validates complete schema with partial data
* ✅ Filters errors by field path
* ✅ Never fragments or modifies the schema
* ✅ Always returns the original field value as validatedData
*
* @param fieldName - Field to validate
* @param fieldValue - Current value of the field
* @param formData - Current partial form state
* @returns Validation result for this field only
*/
  const validateField = useCallback(<TFieldName extends keyof TFormShape, TFieldValue>(
    fieldName: TFieldName,
    fieldValue: TFieldValue,
    formData: Partial<TFormShape> = {}
  ): FieldValidationResultType<TFieldValue> => {

 // 🔁 Merge current field value into partial form state
    const dataToValidate: Partial<TFormShape> = {
      ...formData,
      [fieldName]: fieldValue
    };

 // 🛡️ Validate using FULL schema
    const result = schema.safeParse(dataToValidate);
 //------------------------------------
    // console.log('field validation result:', result, fieldName, fieldValue);

 // ✅ SUCCESS PATH - Field is valid
    if (result.success) {
      return {
        isValid: true,
        validatedData: fieldValue  // ✅ Always the original field value
      };
    }

 // 🔍 ERROR PATH - Find issues for this specific field
   const fieldIssues = result.error.issues.filter(issue =>
    issue.path.length > 0 && issue.path[0] === fieldName
   );

// ✅ Field is valid (other fields may be invalid, but this one is fine)
   if (fieldIssues.length === 0) {
      return {
        isValid: true,
        validatedData: fieldValue
      };
    }

 // ❌ Field has validation errors
   return {
    isValid: false,
    validatedData: fieldValue,
    error: fieldIssues[0].message  // First error message only (better UX)
    };

  }, [schema]);

/* 🔹 ===============================
 📦 VALIDATE ENTIRE FORM
 =============================== 🔹 */
/**
 * Validates the entire form using the FULL schema.
 * Used primarily for form submission.
 *
 * @param formData - Complete or partial form data
 * @param touchedFields - Optional set of touched fields (for validateOnlyTouched mode)
 * @returns Complete validation result with errors and validated data
 */
 const validateAll = useCallback(
  (
   formData: Partial<TFormShape>,
   touchedFields?: Set<keyof TFormShape>
   ): FormValidationResultType<TFormShape> => {
//----------------------------------------
  // console.log('received:', formData, touchedFields, options);

// 🔍 Filter data if validateOnlyTouched is enabled
  let dataToValidate: Partial<TFormShape> = formData;

  if (options.validateOnlyTouched && touchedFields?.size) {
   dataToValidate = {} as Partial<TFormShape>;
   touchedFields.forEach(field => {
    if (field in formData) {
      dataToValidate[field] = formData[field];
     }
    });
   }

// 🛡️ Validate using FULL schema
 const result = schema.safeParse(dataToValidate);
//--------------------------------------------
// console.log('form validation result:', result)

// ✅ SUCCESS PATH
 if (result.success) {
  return {
   isValid: true,
   errors: {},
   validatedData: result.data,
   formError: undefined
  };
 }

// ❌ ERROR PATH
 const errors: Partial<Record<keyof TFormShape, string>> = {};

 let formError: string | undefined;

// Process all validation issues
 result.error.issues.forEach(issue => {
  const field = issue.path[0] as keyof TFormShape | undefined;
//-----------------------------------------
 // console.log('error path:', errors, issue, field,'options:', options, options.validateOnlyTouched,touchedFields, )

// 📝 Global form error (no field associated)
 if (!field) {
  formError = issue.message;
  return;
 }

// 🔍 Respect touched-only validation if enabled
 if (options.validateOnlyTouched && touchedFields && !touchedFields.has(field)) {
  return;
 }

// ✅ Store first error only (better UX)
 if (!errors[field]) {
   errors[field] = issue.message;
  }
 });

//---------------------------------
 // console.log('useFieldValidation return object:', {
 //  isValid: false,
 //  errors,
 //  validatedData: undefined,
 //  formError
 //   })
//----------------------------------

 return {
  isValid: false,
  errors,
  validatedData: undefined,
  formError
    };
  },[schema, options ]
 );

/* ===============================
📤 HOOK RETURN
=============================== */
 return {
 /** 📋 The original schema (reference, for debugging) */
  schema,
 /** 🔍 Validate a single field - filtered by path */
 validateField,
 /** 📦 Validate entire form - all errors */
 validateAll
 };
};

export default useFieldValidation;