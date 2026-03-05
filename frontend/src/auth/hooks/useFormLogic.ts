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
  Partial<Record<TFieldName, string>>

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

// STATES
  const [formData, setFormData] = useState<TFormShape>(initialValues);

  const [touchedFields, setTouchedFields] = useState<Set<FieldNames>>(new Set());
  const [dirtyFields, setDirtyFields] = useState<Set<FieldNames>>(new Set());

  const [isSubmitting, setIsSubmitting] = useState(false);

 // VALDATION HOOK
  const { validateField, validateAll } = useFieldValidation<TFormShape>(schema, {
    validateOnlyTouched,
  });

  const [validationErrors, setValidationErrors] = useState<FormErrorsType<FieldNames>>({});

 /**
 * HANDLE FIELD CHANGE WITH REAL-TIME VALIDATION
 */
  const handleChange = useCallback(
 (fieldName: FieldNames) => (value: string) => {

   setFormData((prev) => {
     const updated = { ...prev, [fieldName]: value };

 // Mark as touched
      const nextTouched = new Set(touchedFields);

      nextTouched.add(fieldName);
      setTouchedFields(nextTouched);

 // Mark as dirty if value changed
    if (prev[fieldName] !== value) {
      setDirtyFields((prevDirty) => new Set(prevDirty).add(fieldName));
     }

   // Real-time validation
     console.log("touched BEFORE validation", touchedFields);

    const result = validateField(fieldName, value, updated);

    setValidationErrors((prevErrors)=>  {
       const next = { ...prevErrors };

       if (result.isValid) {
         delete next[fieldName];
       } else {
         next[fieldName] = result.error ?? 'Invalid value';
       }

  // 🔹 CROSS VALIDATION. REVALIDATE CONFIRM PASSWORD IF PASSWORD CHANGES
    if (fieldName === 'password' && 'confirmPassword' in updated) {

      const confirmValue = updated['confirmPassword'];

      if (typeof confirmValue === 'string') {

        const confirmResult = validateField(
          'confirmPassword' as FieldNames,
          confirmValue,
          updated
        );

        if (confirmResult.isValid) {
          delete next['confirmPassword' as FieldNames];
        } else {
          next['confirmPassword' as FieldNames] =
            confirmResult.error ?? 'Invalid value';
        }

      }

    }
  //----------------------
       return next 
      });
   return updated;
  });
 },
 [validateField]
  );

/**
* HANDLE FORM SUBMISSION WITH FULL VALIDATION
*/
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Mark all fields as touched
      const allFields = Object.keys(formData) as FieldNames[];

      const touchedSet = new Set(allFields)

      setTouchedFields(touchedSet);

      // Full validation
      const result = validateAll(formData, touchedSet);

      if (!result.isValid) {
        setValidationErrors(result.errors as FormErrorsType<FieldNames>);
        return;
      }

      setIsSubmitting(true);

      try {
        await onSubmit(result.validatedData!);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, onSubmit, validateAll]
  );

  /**
   * RESET FORM TO INITIAL STATE
   */
  const resetForm = useCallback(() => {
    setFormData(initialValues);
    setTouchedFields(new Set());
    setDirtyFields(new Set());
    setValidationErrors({});
  }, [initialValues]);

// SUBMIT ENABLED
  const isSubmittingAllowed = useCallback(() => {
    const hasErrors = Object.keys(validationErrors).length > 0;

    return !hasErrors && !isSubmitting;
  }, [validationErrors, isSubmitting]);

 // OTHER OPTION
 // const isSubmittingAllowed =
 //   !isSubmitting &&
 //   Object.keys(validationErrors).length === 0

//RETURN
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