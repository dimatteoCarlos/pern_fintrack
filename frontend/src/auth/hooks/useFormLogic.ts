// 📁 frontend/src/hooks/useFormLogic.ts

/* ===============================
   🧩 GENERIC FORM LOGIC HOOK
   Reusable across any form in the application
   Uses useFieldValidation for schema validation
   =============================== */

import { useCallback, useState } from 'react';
import { z } from 'zod';
import useFieldValidation from '../validation/hook/useFieldValidation';
// import { useFieldValidation } from '../utils/validation/hooks/useFieldValidation';

// ===============================
// 🏷️ TYPES
// ===============================

export type FormErrorsType<TFieldName extends string> = 
  Partial<Record<TFieldName, string>> ;//& { form?: string };

export type FormLogicResult<TFormShape> = {
  isValid: boolean;
  validatedData?: TFormShape;
  errors: FormErrorsType<keyof TFormShape & string>;
};
//for error forms with 'form' field - optional
export type FormErrorsWithFormType<TFieldName extends string> = 
  FormErrorsType<TFieldName> & { form?: string };

type UseFormLogicParams<TFormShape extends Record<string, unknown>> = {
  /** Zod schema for validation */
  schema: z.ZodType<TFormShape>;
  
  /** Initial form values */
  initialValues: TFormShape;
  
  /** Submit handler */
  onSubmit: (data: TFormShape) => Promise<void>;
  
  /** Validation options */
  validateOnlyTouched?: boolean;
};

// ===============================
// 🎣 HOOK: useFormLogic
// ===============================

export const useFormLogic = <TFormShape extends Record<string, unknown>>({
  schema,
  initialValues,
  onSubmit,
  validateOnlyTouched = true,
}: UseFormLogicParams<TFormShape>) => {
  type FieldNames = keyof TFormShape & string;

  const [formData, setFormData] = useState<TFormShape>(initialValues);
  const [touchedFields, setTouchedFields] = useState<Set<FieldNames>>(new Set());
  const [dirtyFields, setDirtyFields] = useState<Set<FieldNames>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { validateField, validateAll } = useFieldValidation<TFormShape>(schema, {
    validateOnlyTouched,
  });

  const [validationErrors, setValidationErrors] = useState<FormErrorsType<FieldNames>>({});

  /**
   * Handle field change with real-time validation
   */
  const handleChange = useCallback(
    (fieldName: FieldNames) => (value: string) => {
      setFormData((prev) => {
        const updated = { ...prev, [fieldName]: value };

        // Mark as touched
        setTouchedFields((prevTouched) => new Set(prevTouched).add(fieldName));

        // Mark as dirty if value changed
        if (prev[fieldName] !== value) {
          setDirtyFields((prevDirty) => new Set(prevDirty).add(fieldName));
        }

        // Real-time validation
        const result = validateField(fieldName, value, updated);
        setValidationErrors((prevErrors) => {
          const next = { ...prevErrors };
          if (result.isValid) {
            delete next[fieldName];
          } else {
            next[fieldName] = result.error || 'Invalid value';
          }
          return next;
        });

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
      const allFields = Object.keys(formData) as FieldNames[];
      setTouchedFields(new Set(allFields));

      // Full validation
      const result = validateAll(formData, new Set(allFields));

      if (!result.isValid) {
        setValidationErrors(result.errors as FormErrorsType<FieldNames>);
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(formData);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, onSubmit, validateAll]
  );

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setFormData(initialValues);
    setTouchedFields(new Set());
    setDirtyFields(new Set());
    setValidationErrors({});
  }, [initialValues]);

  /**
   * Check if form can be submitted
   */
  const isSubmittingAllowed = useCallback(() => {
    const hasErrors = Object.keys(validationErrors).length > 0;
    return !hasErrors && !isSubmitting;
  }, [validationErrors, isSubmitting]);

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