// 📁 frontend/src/auth/hooks/useAuthFormLogic.ts

/* ===============================
   📝 AUTH FORM LOGIC HOOK
   Manages form state, validation, and submission for auth forms
   =============================== */

import { useCallback, useState } from 'react';
import { SignInCredentialsType, SignUpCredentialsType } from '../types/authTypes';
import { useAuthValidation } from '../validation/hook/useAuthValidation';

import z from 'zod'

// ===============================
// 🏷️ TYPES
// ===============================

export type AuthMode = 'signin' | 'signup';

type UseAuthFormLogicParams= {
  mode: AuthMode;
  onSubmit: (data: SignInCredentialsType | SignUpCredentialsType) => Promise<void>;
};

// ===============================
// 🎣 HOOK: useAuthFormLogic
// ===============================

export const useAuthFormLogic =({ mode, onSubmit }: UseAuthFormLogicParams) => {

 const {schema, validateField, validateAll } = useAuthValidation({ mode });

 type FormShape = z.infer<typeof schema>;

const INITIAL_FORM_DATA = Object.fromEntries(
  Object.keys(schema.shape).map(key => [key, ''])
) as FormShape;


 //LOCAL STATES
 const [formData, setFormData] = useState(INITIAL_FORM_DATA);
 
 const [touchedFields, setTouchedFields] = useState<Set<keyof FormData>>(new Set());

 const [dirtyFields, setDirtyFields] = useState<Set<keyof FormData>>(new Set());
 
 const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
 

  const [isSubmitting, setIsSubmitting] = useState(false);


  /**
   * Handle field changes with real-time validation
   */
  const handleChange = useCallback(
    (fieldName: keyof FormData) => (value: string |null) => {
      setFormData((prev) => {
        const updated = { ...prev, [fieldName]: value ??""};

        // Mark as touched
        setTouchedFields((prevTouched) => new Set(prevTouched).add(fieldName));

        // Mark as dirty if value changed
        if (prev[fieldName] !== value) {
          setDirtyFields((prevDirty) => new Set(prevDirty).add(fieldName));
        }

      // 🧪 Real-time validation for this field only
        const validationResult = validateField(fieldName, value??"", updated);


// 📝 Update validation errors
        setValidationErrors((prevErrors) => ({
          ...prevErrors,
          [fieldName]: validationResult.isValid ? '' : validationResult.error || '',
        }));

        return updated;
      });
    },
    [validateField]
  );

  /**
   * Handle form submission with full validation
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Mark all fields as touched
      const allFields = Object.keys(formData) as (keyof FormData)[];
      setTouchedFields(new Set(allFields));

      // Full validation
      const validationResult = validateAll(formData, new Set(allFields));

      if (!validationResult.isValid) {
        setValidationErrors(
          Object.fromEntries(
            Object.entries(validationResult.errors).map(([key, value]) => [key, value || ''])
          )
        );
        return;
      }

      setIsSubmitting(true);
      try {
        if (mode === 'signin') {
          await onSubmit({
            username: formData.username,
            email: formData.email,
            password: formData.password,
          } as SignInCredentialsType);
        } else {
          await onSubmit({
            username: formData.username,
            email: formData.email,
            user_firstname: formData.user_firstname,
            user_lastname: formData.user_lastname,
            password: formData.password,
          } as SignUpCredentialsType);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, mode, onSubmit, validateAll]
  );

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM_DATA);
    setTouchedFields(new Set());
    setDirtyFields(new Set());
    setValidationErrors({});
  }, []);

  /**
   * Check if form can be submitted
   */
  const isSubmittingAllowed = useCallback(() => {
    const allTouched = mode === 'signin'
      ? ['username', 'email', 'password'].every((field) => touchedFields.has(field as keyof FormData))
      : ['username', 'email', 'password', 'user_firstname', 'user_lastname', 'confirmPassword']
          .every((field) => touchedFields.has(field as keyof FormData));

    const hasErrors = Object.values(validationErrors).some((error) => error && error.length > 0);

    return allTouched && !hasErrors && !isSubmitting;
  }, [mode, touchedFields, validationErrors, isSubmitting]);

  return {
    formData,
    handleChange,
    handleSubmit,
    resetForm,
    validationErrors,
    touchedFields,
    dirtyFields,
    isSubmitting,
    isSubmittingAllowed: isSubmittingAllowed(),
  };
};