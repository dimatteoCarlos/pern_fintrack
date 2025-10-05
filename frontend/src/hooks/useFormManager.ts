//src/hooks/useFormManger.ts
import { useState, useCallback } from 'react';
import { useDebouncedCallback } from './useDebouncedCallback';
import type { ZodType } from 'zod';
import { validateForm } from '../validations/utils/zod_validation';
// ===========================
// TYPE DEFINITIONS
// ===========================
import type {  DropdownOptionType, CurrencyType } from '../types/types';
import { ValidationMessagesType } from '../validations/types';
// ===========================
// MAIN HOOK IMPLEMENTATION
// ===========================
const useFormManager = <TInput extends Record<string, unknown>, TValidated extends Record<string, unknown>>(
  schema: ZodType<TValidated>,
  initialData: TInput
) => {
  // ===================
  // STATE MANAGEMENT
  // ===================
  const [formData, setFormData] = useState<TInput>(initialData);

  const [validationMessages, setValidationMessages] = useState<ValidationMessagesType<TInput>>({});

  const [showValidation, setShowValidation] = useState<Record<keyof TInput, boolean>>(
    Object.fromEntries(Object.keys(initialData).map((key) => [key, false])) as Record<keyof TInput, boolean>
  );
// --- Functions (Factory Pattern) --- / Funciones (Patrón Fábrica) ---
    const activateAllValidations = useCallback(() => {
    setShowValidation(
      Object.fromEntries(Object.keys(initialData).map(key => [key, true])) as Record<keyof TInput, boolean>
    );
  }, [initialData]);
//---
// Se usa un genérico TKey para inferir el tipo correcto del campo. / A generic TKey is used to infer the correct field type.
  const updateField = useCallback(<TKey extends keyof TInput>(fieldName: TKey, value: TInput[TKey]) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  }, []);

  // DEBOUNCED VALIDATION
  // =======================
  const validateField = useCallback(<TKey extends keyof TInput>(fieldName: TKey, value: TInput[TKey]) => {
    const currentDataForValidation = {
      ...formData,
      [fieldName]: value
    };
    const { errors: fieldErrors } = validateForm(schema, currentDataForValidation);
    setValidationMessages(prev => ({ ...prev, [fieldName]: fieldErrors[fieldName as string] || '' }));
  }, [formData, schema]);
  //---
  const debouncedUpdateField = useDebouncedCallback(updateField, 500);

  const debouncedValidateField = useDebouncedCallback(validateField, 800);
  //---
  //Handler of field 'amount', 'value', etc. Activates all field validation when entering the value.
    // FIELD HANDLERS (REUSABLE)
  // ==========================
  const createNumberHandler = useCallback(
   ( fieldName:keyof TInput)=>{
    return (evt:React.ChangeEvent<HTMLInputElement  | HTMLTextAreaElement>)=>{
    const {name, value } = evt.target
    console.log('compare', fieldName, name)
    updateField(fieldName as keyof TInput, value as TInput[keyof TInput] )
    debouncedValidateField(fieldName, value)

    if(value){
      // setShowValidation(
      //   Object.fromEntries(Object.keys(initialData).map(key => [key, true])) as Record<keyof TInput, boolean>
      // )
      setShowValidation(prev => ({
      ...prev,
      ...Object.fromEntries(Object.keys(prev).map(key => [key, true]))
    }));
    }
  }
},[updateField,debouncedValidateField, setShowValidation ])
//------------------------
//---
 const updateCurrency = useCallback((currency: CurrencyType) => {
    updateField('currency' as keyof TInput, currency as TInput['currency']);
  validateField('currency' as keyof TInput, currency as TInput['currency']);
  }, [updateField, validateField]);

  // ===================
  // FORM RESET LOGIC
  // ===================
  const resetForm = useCallback(() => {
    setFormData(initialData);
    setValidationMessages({});
    setShowValidation(
      Object.fromEntries(Object.keys(initialData).map(key => [key, false])) as Record<keyof TInput, boolean>
    );
  }, [initialData]);

//--- Handlers (Factory Pattern) --- / Manejadores (Patrón Fábrica) --- /
  const createDropdownHandler = useCallback((
    fieldName: keyof TInput
  ) => {
    return (selectedOption: DropdownOptionType | null) => {
      const value = selectedOption?.value ?? '';
      updateField(fieldName, value as TInput[typeof fieldName]);

      // 💡 Solo valida si el valor no está vacío. / Only validates if the value is not empty.
      // Esto evita que los mensajes de error aparezcan justo después del reseteo. / This prevents error messages from appearing right after reset.
      if (value) {
        validateField(fieldName, value as TInput[typeof fieldName]);
      } else {
        // Si el valor es vacío, limpia el mensaje de error para este campo / If the value is empty, clears the error message for this field
        setValidationMessages(prev => ({ ...prev, [fieldName]: '' }));
      }
    };
  }, [updateField, validateField]);
//-----
  const createInputHandler = useCallback((fieldName: keyof TInput) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      updateField(fieldName, value as TInput[typeof fieldName]);
      // 💡 Solo valida si el valor no está vacío. / Only validates if the value is not empty.
      if (value) {
        validateField(fieldName, value as TInput[typeof fieldName]);
      } else {
        // Si el valor es vacío, limpia el mensaje de error para este campo / If the value is empty, clears the error message for this field
        setValidationMessages(prev => ({ ...prev, [fieldName]: '' }));
      }
    };
  }, [updateField, validateField]);

//---
  const createTextareaHandler = useCallback((fieldName: keyof TInput) => {
    return (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      updateField(fieldName, value as TInput[typeof fieldName]);
      debouncedValidateField(fieldName, value as TInput[typeof fieldName]);
    };
  }, [updateField, debouncedValidateField]);
  
 // FORM-WIDE VALIDATION (for submit)
 // ==============================
  const validateAll = useCallback(() => {
    const { errors: fieldErrors, data: dataValidated } = validateForm(schema, formData);
    return { fieldErrors, dataValidated };
  }, [formData, schema]);
//---
  const handleApiError = useCallback((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during submission.';
    return errorMessage;
  }, []);
//---
  // EXPOSED HOOK VALUES
  // =====================
  return {
    formData,
    showValidation,
    validationMessages,
    resetForm,
    activateAllValidations,
    handlers: {
      updateField,
      debouncedUpdateField,
      validateField,
      debouncedValidateField,
      createNumberHandler,
      createDropdownHandler,
      createInputHandler,
      createTextareaHandler,
      updateCurrency,
      handleApiError,
    },
    validateAll,
    setters: {
      setValidationMessages,
      setShowValidation,
      setFormData,
    }
  };
};

export default useFormManager;