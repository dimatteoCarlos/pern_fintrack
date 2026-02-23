// 📁 frontend/src/auth/validation/hook/useAuthValidation.ts

/* ===============================
   🔐 AUTH VALIDATION HOOK
   Generic validation for signin/signup forms
   Reuses useFieldValidation for consistent validation
   =============================== */

import { useCallback } from 'react';
import { z } from 'zod';

// ============================================
// 📝 IMPOR GENERIC VALIDATION HOOK AND SCHEMAS
// ============================================
import useFieldValidation from './useFieldValidation';
import { signInSchema, signUpSchema } from '../zod_schemas/authSchemas';

// ===========================
// 🎯 IMPORT TYPES
// ===========================
export type FormErrorsType<TFieldName extends string> = 
  Partial<Record<TFieldName, string>> & { form?: string };

export type ValidateFieldResultType = {
  isValid: boolean;
  validatedData: string;
  error?: string;
};

export type ValidateAllResultType<TFormShape> = {
  isValid: boolean;
  validatedData?: TFormShape;
  errors: FormErrorsType<keyof TFormShape & string>;
};

export type ValidateFieldFnType<TFormShape> = (
  fieldName: keyof TFormShape,
  value: string,
  formData?: Partial<TFormShape>
) => ValidateFieldResultType;

export type ValidateAllFnType<TFormShape> = (
  formData: Partial<TFormShape>,
  touchedFields?: Set<keyof TFormShape>
) => ValidateAllResultType<TFormShape>;

type UseAuthValidationParams = {
  mode: 'signin' | 'signup';
};

// ===============================
// 🎣 HOOK: useAuthValidation
// ===============================

export const useAuthValidation = ({ mode }: UseAuthValidationParams) => {
 // Select schema based on mode
  const schema = mode === 'signin' ? signInSchema : signUpSchema;
  type FormShape = z.infer<typeof schema>;
  type FieldNames = keyof FormShape & string;

  const { validateField: baseValidateField, validateAll: baseValidateAll } = 
   useFieldValidation<FormShape>(
     schema as unknown as z.ZodType<FormShape>,
     { validateOnlyTouched: true }
    );

  /**
   * Validate a single field in real-time
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

  /**
   * Validate entire form (for submission)
   */
  const validateAll = useCallback(
    (formData: Partial<FormShape>, touchedFields?: Set<FieldNames>) => {
      const result = baseValidateAll(formData, touchedFields);
      
      const errors = {} as FormErrorsType<FieldNames>;
      
      Object.entries(result.errors).forEach(([field, message]) => {
        if (field && message) {
          (errors as Record<FieldNames, string>)[field as FieldNames] = message;
        }
      });

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

  return {
    validateField,
    validateAll,
    schema,
  };
};

// ===============================
// 📤 EXPORT TYPES
// ===============================

export type AuthValidationResultType = {
  isValid: boolean;
  error?: string;
};

export type AuthValidationFieldFnType<T> = (
  fieldName: keyof T,
  value: string,
  formData?: Partial<T>
) => AuthValidationResultType;

export type AuthValidationAllFnType<T> = (
  formData: Partial<T>,
  touchedFields?: Set<keyof T>
) => {
  isValid: boolean;
  errors: FormErrorsType<keyof T & string>;
};