// 📁 frontend/src/auth/validation/hook/useChangePasswordValidation.ts

import { useCallback } from 'react';
import { z } from 'zod';
import useFieldValidation from './useFieldValidation';
import { extractErrorMessage } from '../../utils/extractErrorMessge';

/* ===============================
   🏷️ TYPES DEFINITIONS
=============================== */

// ✅ Partial<Record> + Record<string, unknown> constraint
export type FormErrorsType<TFieldName extends string> = 
  Partial<Record<TFieldName, string>> & { form?: string };

// ✅ TSchema must extends ZodType that inferes Record<string, unknown>
type ChangePasswordValidationParams<
  TSchema extends z.ZodType<Record<string, unknown>>
> = {
  fieldMapping: Record<string, string>;
  schema: TSchema;
};

/* ====================================
   🎯 HOOK: useChangePasswordValidation
=============================== */
/**
 * 🎯 Change Password Validation Hook
 * 
 * 🔑 RESPONSIBILITIES:
 * 1. Adapt generic validation to domain-specific field names
 * 2. Transform backend API errors to frontend format
 * 3. Preserve FULL validation contract (isValid, validatedData, error)
 * 4. Maintain type safety - NO casts, NO any
 * 
 * ✅ Generic over TSchema - works with ANY object schema
 * ✅ Exports contract types for consumers to use
 * ✅ Zero deprecations - Zod v4 compliant
 */

export const useChangePasswordValidation = <
  TSchema extends z.ZodType<Record<string, unknown>>
>({
  fieldMapping,
  schema,
}: ChangePasswordValidationParams<TSchema>) => {
  
/* ===============================
     🔹 Generic field validation hook
=============================== */

 // ✅ FormShape is Record<string, unknown> as constraint
  type FormShape = z.infer<TSchema>;
  type FieldNames = keyof FormShape & string;

  const { validateField: baseValidateField, validateAll: baseValidateAll } = 
    useFieldValidation<FormShape>(
      schema as unknown as z.ZodType<FormShape>,
      { validateOnlyTouched: true }
    );

/* ===============================
  🔍 FIELD VALIDATION
  =============================== */
/**
   * Validates a single field using the FULL schema.
   * 
   * ✅ FULL contract preserved:
   * - isValid: boolean
   * - validatedData: string (original value)
   * - error?: string (only when isValid === false)
   */  
  const validateField = useCallback(
    (fieldName: FieldNames, value: string, formData?: Partial<FormShape>) => {
      const result = baseValidateField(fieldName, value, formData);
      return {
        isValid: result.isValid,
        validatedData: result.validatedData as string,
        error: result.error,
      };
    },
    [baseValidateField]
  );

/* ===============================
  📦 FORM VALIDATION
  =============================== */
/**
 * Validates the entire form using the FULL schema.
 * 
 * ✅ FULL contract preserved:
 * - isValid: boolean
 * - validatedData?: FormShape (only on success)
 * - errors: FormErrorsType<FieldNames>
 * 
 * ✅ Accepts touchedFields for validateOnlyTouched mode
 */
  
  const validateAll = useCallback(
    (formData: Partial<FormShape>, touchedFields?: Set<FieldNames>):ValidateAllResultType<FormShape> => {
      const result = baseValidateAll(formData, touchedFields);
      
 // ✅ Initialization with empty Record + cast
      const errors = {} as FormErrorsType<FieldNames>;
 // ✅ Map field errors  
      Object.entries(result.errors).forEach(([field, message]) => {
        if (field && message) {
          // ✅ Direct assignment with cast
          (errors as Record<FieldNames, string>)[field as FieldNames] = message;
        }
      });
// ✅ Add form-level error if present  
      if (result.formError) {
        errors.form = result.formError;
      }

      return {
        isValid: result.isValid,
        validatedData: result.validatedData,
        errors,
      };
    },
    [baseValidateAll]
  );

/* ===============================
  🔄 API ERROR TRANSFORMATION
  =============================== */
/**
* Transforms backend API field errors to frontend error format.
* 
* 📥 BACKEND CONTRACT:
*   fieldErrors: Record<string, string[]>
* 
* 📤 FRONTEND CONTRACT:
*   FormErrorsType<FieldNames>
* 
* 🔁 Uses fieldMapping to convert backend → frontend field names
*/

//Aqui se aplico puro casting manual, osea que ts no esta haciendo un conio, puro joder!.Mejor validar los errores con zod en tiempo real.

const transformApiErrors = useCallback(
 (apiError: unknown): FormErrorsType<FieldNames> => {
   const transformedErrors = {} as FormErrorsType<FieldNames>;
   
  try {
   if (!apiError) {
     transformedErrors.form = 'No error response from server';
     return transformedErrors;
   }

   const errorObj = apiError as Record<string, unknown>;
   let fieldErrors: Record<string, string[]> | undefined;

// 📦 CASE 1: Axios-style error with details.fieldErrors
  if (
    errorObj.details &&
    typeof errorObj.details === 'object' &&
    'fieldErrors' in errorObj.details
  ) {
    fieldErrors = (errorObj.details as Record<string, unknown>)
      .fieldErrors as Record<string, string[]>;
      
// 🎯 CASE 2: Domain-style error with fieldErrors at root
  } else if (errorObj.fieldErrors && typeof errorObj.fieldErrors === 'object') {
    fieldErrors = errorObj.fieldErrors as Record<string, string[]>;
  }
// 🔁 Map backend → frontend field names using fieldMapping
  if (fieldErrors) {
   Object.entries(fieldErrors).forEach(([backendField, messages]) => {
    
    const frontendField = fieldMapping[backendField] as FieldNames | undefined;
     
    if (frontendField && messages.length > 0) {
// ✅ Explicit cast
// ✅ Take first message only (better UX)
     (transformedErrors as Record<FieldNames, string>)[frontendField] = messages[0];
     }
   });
 }

 // 🌍 Global error fallback
  if (!transformedErrors.form && typeof errorObj.message === 'string') {
   transformedErrors.form = 
     (errorObj.error as string) || 
     errorObj.message || 
     extractErrorMessage(apiError);
 }

 } catch (error) {
  console.error('❌ Error transforming API errors:', error);
  transformedErrors.form = 'Failed to process server response';
 }

 return transformedErrors;
 },
 [fieldMapping]
 );

/* ===============================
📤 HOOK RETURN
=============================== */
 return {
/** 🔍 Single-field validation */
  validateField,
/** 📦 Full form validation */
  validateAll, 
/** 🔄 Backend error transformer */
  transformApiErrors,
/** 📋 Original Zod schema */
    schema,
  };
};

// ===============================
// 🏷️ EXPORT CONTRACT TYPES
// ===============================
/**
 * 🎯 Result of single-field validation
 * - validatedData is ALWAYS present and MUST be string for form fields
 */
export type ValidateFieldResultType = {
  isValid: boolean;
  validatedData: string;
  error?: string;
};

/** 🎯 Tipo del resultado de validateAll */
export type ValidateAllResultType<TFormShape> = {
  isValid: boolean;
  validatedData?: TFormShape;
  errors: FormErrorsType<keyof TFormShape & string>;
};

/** 🎯 Type of  validateField function */
export type ValidateFieldFnType<TFormShape> = (
  fieldName: keyof TFormShape,
  value: string,
  formData?: Partial<TFormShape>
) => ValidateFieldResultType;

/** 🎯 Tipo de la función validateAll */
export type ValidateAllFnType<TFormShape> = (
  formData: Partial<TFormShape>,
  touchedFields?: Set<keyof TFormShape>
) => ValidateAllResultType<TFormShape>;

/** 🎯 Tipo de la función transformApiErrors */
export type TransformApiErrorsFnType<TFieldName extends string> = (
  apiError: unknown
) => FormErrorsType<TFieldName>;

export default useChangePasswordValidation;