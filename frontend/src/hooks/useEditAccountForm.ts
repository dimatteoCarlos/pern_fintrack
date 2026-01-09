// frontend/src/hooks/useEditAccountForm.ts

// 🎯 IMPORTS - REACT AND VALIDATION DEPENDENCIES
import { useState, useCallback } from 'react';
import { ZodType } from "zod";
import { validateForm } from '../validations/utils/zod_validation';
import { ValidationMessagesType } from '../validations/types';

// 📦 TYPE DEFINITION - GENERIC FORM DATA STRUCTURE
export type GenericEditFormData = {
  [key: string]: string | number | boolean | Date | null | undefined;
};

// 🧠 HOOK DEFINITION - FORM STATE AND VALIDATION MANAGER
export const useEditAccountForm = (
  schema: ZodType<GenericEditFormData> | null
) => {
// 🗄️ STATE DECLARATIONS - FORM DATA AND VALIDATION MESSAGES 
  const [formData, setFormData] = useState<GenericEditFormData>({});
  const [validationMessages, setValidationMessages] = useState<ValidationMessagesType<GenericEditFormData>>({});

  // ✅ VALIDATION ENGINE - FIELD-LEVEL VALIDATION WITH FRESH DATA
  const runFieldValidation = useCallback((fieldName: string, value: unknown, currentData: GenericEditFormData) => {
    if (!schema) return;

  // 🎯 PERFORM VALIDATION WITH LATEST DATA (SYNCHRONOUS)
  const { errors } = validateForm(schema, { ...currentData, [fieldName]: value });

  setValidationMessages(prev => {
    const key = fieldName as keyof GenericEditFormData;
    if (errors[fieldName]) {
      return { ...prev, [fieldName]: errors[fieldName] };
    } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars 
     const { [key]: _, ...rest } = prev;
     return rest as ValidationMessagesType<GenericEditFormData>;
    }
  });
  }, [schema]);
  // 📤 HOOK RETURN - PUBLIC INTERFACE FOR FORM MANAGEMENT
  return { 
    formData, 
    setFormData, 
    validationMessages, 
    setValidationMessages,
    runFieldValidation 
  };
};