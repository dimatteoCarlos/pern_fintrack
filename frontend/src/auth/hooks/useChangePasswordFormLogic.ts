// 📁 frontend/src/auth/hooks/useChangePasswordFormLogic.ts

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import { useCallback, useState } from 'react';

/* 🌟 ===============================
🏷️ IMPORT TYPE DEFINITIONS
=============================== 🌟 */
import { ChangePasswordFormDataType, ChangePasswordResultType } from '../types/authTypes';

import { FormErrorsType } from '../validation/hook/useChangePasswordValidation';



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
  validateField: (
    fieldName: keyof ChangePasswordFormDataType,
    value: string,
    formData?: Partial<ChangePasswordFormDataType>
  ) => {
    isValid: boolean;
    validatedData: string;  // ✅ PRESERVED - valor original
    error?: string;
  };

  /** 📦 Full form validation - adapter contract with FULL response */
  validateAll: (
    formData: Partial<ChangePasswordFormDataType>,
    touchedFields?: Set<keyof ChangePasswordFormDataType>
  ) => {
    isValid: boolean;
    validatedData?: ChangePasswordFormDataType;
    errors: FormErrorsType<keyof ChangePasswordFormDataType>;
  };

  /** 🔄 Transform backend field errors to frontend format */
  transformFromApiToFormErrors: (
    apiError: unknown
  ) => FormErrorsType<keyof ChangePasswordFormDataType>;

  /** 🎯 Domain function - calls the actual API */
  handleDomainChangePassword: (
    payload: ChangePasswordFormDataType
  ) => Promise<ChangePasswordResultType>;
};

/* 🌟 ==============================
   🎣 MAIN HOOK: useChangePasswordFormLogic
   =============================== 🌟 */

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
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<keyof ChangePasswordFormDataType, boolean>>
  >({});

  /** 🎯 Fields that have been modified from initial value - reserved for future UX */
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
   * ✅ CORREGIDO:
   * - Usa delete para campos válidos (NO strings vacíos)
   * - Preserva validatedData del adapter
   * - Semántica correcta: error existe SOLO cuando hay error
   */
  const handleChange = useCallback(
    (fieldName: keyof ChangePasswordFormDataType, value: string | null) => {
      setFormData((currentFormData: ChangePasswordFormDataType) => {
        const updatedForm = {
          ...currentFormData,
          [fieldName]: value ?? ''
        };

        // 🎯 Mark field as touched
        setTouchedFields((prev) => ({
          ...prev,
          [fieldName]: true
        }));

        // 🎯 Mark field as dirty if value changed
        if (currentFormData[fieldName] !== value) {
          setDirtyFields((prev) => ({
            ...prev,
            [fieldName]: true
          }));
        }

        // 🧪 Real-time validation for this field only
        const validationResult = validateField(
          fieldName,
          value ?? '',
          updatedForm
        );

        // 📝 Update validation errors - ✅ CORREGIDO: delete vs string vacío
        setValidationErrors((prevErrors) => {
          const next = { ...prevErrors };

          if (validationResult.isValid) {
            // ✅ Campo válido - eliminar cualquier error existente
            delete next[fieldName];
          } else {
            // ❌ Campo inválido - agregar mensaje de error
            next[fieldName] = validationResult.error ?? 'Invalid value';
          }

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
   * ✅ CORREGIDO:
   * - Retorna ChangePasswordResultType | void (no throw)
   * - Pasa touchedFields a validateAll (soporta validateOnlyTouched)
   * - Objetos vacíos para errores (no strings vacíos)
   */
  const handleSubmit = async (): Promise<ChangePasswordResultType | void> => {
    // 🎯 Mark ALL fields as touched for submit-time validation
    setTouchedFields({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true
    });

    // 🧹 Clear previous errors - ✅ CORRECTO: objetos vacíos
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
        // ✅ CORRECTO: Pasar SOLO fieldErrors, no todo el result
        const mappedErrors = transformFromApiToFormErrors(result.fieldErrors);
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
    /** 🎯 Fields that have been modified (reserved for future UX) */
    dirtyFields,
    /**
     * ✅ Whether form can be submitted
     * 🔑 ROBUST: Uses Object.keys().length, not string comparison
     * 🔑 SEMANTIC: Empty object = no errors = can submit
     */
    isSubmittingAllowed:
      Object.keys(validationErrors).length === 0 &&
      Object.keys(apiErrors).length === 0
  };
};

export default useChangePasswordFormLogic;