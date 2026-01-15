// src/utils/validation/hooks/useFieldValidation.ts (VERSIÓN SIMPLIFICADA)
import { z } from 'zod';

/* 🌟 ===============================
   🏷️ TYPE DEFINITIONS
   =============================== 🌟 */
//Tipo para CUALQUIER esquema Zod (muy genérico)
export type AnyZodSchemaType = z.ZodTypeAny;

//Extrae el tipo TypeScript INFERIDO desde un esquema Zod
//Ej: si Zod dice {name: string}, infer devuelve {name: string}
export type SchemaInferType<T extends AnyZodSchemaType> = z.infer<T>;

//Interfaz para el resultado de validar UN SOLO campo
export type FieldValidationResultType<TFieldValue = unknown> = {
 isValid: boolean;
 error?: string;
 data?: TFieldValue;
}

//Interfaz para el resultado de validar TODO el formulario
export type FormValidationResultType<TFormShape extends Record<string, unknown>> ={
  isValid: boolean;
  errors: Partial<Record<keyof TFormShape, string>>;
  validatedData?: TFormShape;
  generalError?: string;
}

//Opciones configurables del hook
export type ValidationOptionsType= {
  validateOnlyTouched?: boolean;
}

/* 🌟 ===============================
🎯 MAIN VALIDATION HOOK (SIMPLE VERSION)
=============================== 🌟 */
export const useFieldValidation = <TFormShape extends Record<string, unknown>>(
  schema: AnyZodSchemaType,
  options: ValidationOptionsType = {}
) => {
  const { validateOnlyTouched = false } = options;

/* 🔹 VALIDATE SINGLE FIELD (SIN PICK) */
  const validateField = <TFieldValue = unknown>(
    fieldName: keyof TFormShape,
    fieldValue: TFieldValue,
    context: Partial<TFormShape> = {}// Datos adicionales (otros campos)
  ): FieldValidationResultType<TFieldValue> => {
//TRY: Intentamos validar (por si hay errores inesperados) 
    try {
//Preparamos datos para validar: contexto + valor del campo   
// ✅ SIMPLIFICADO: Validar datos parciales con el schema completo
   const dataToValidate = { ...context, [fieldName]: fieldValue };

//Ejecutamos validación Zod (safeParse NO lanza excepciones)
 const result = schema.safeParse(dataToValidate);

//SI FALLA: Procesamos errores 
 if (!result.success) {
// Filtrar solo errores de este campo
 const fieldIssue = result.error.issues.find(issue => issue.path[0] === fieldName);

// Devolvemos resultado de error
 return {
   isValid: false,
   error: fieldIssue?.message || `Invalid fieldValue for ${String(fieldName)}`,
   data: fieldValue //returns original fieldValue
 };
 }

 //SI PASA: Devolvemos éxito
  return { isValid: true, data: fieldValue };
 } catch (error) {
  console.warn(`[useFieldValidation] Error validating field "${String(fieldName)}":`, error);

  return { 
    isValid: false, 
    error: `Validation failed for ${String(fieldName)}`, 
    data: fieldValue 
  };
    }
  };
//------------------------
/* 🔹 VALIDATE ENTIRE FORM (FOR SUBMIT) */
 const validateAll = (
  formData: Partial<TFormShape>,
  touchedFields?: Set<keyof TFormShape>
  ): FormValidationResultType<TFormShape> => {
  try {
   let dataToValidate: Partial<TFormShape> = formData;
   
   if (validateOnlyTouched && touchedFields?.size) {
    const filteredData: Partial<TFormShape> = {};
    for (const fieldName of touchedFields) {
     if (fieldName in formData) {
      filteredData[fieldName] = formData[fieldName];
     }
    }
    dataToValidate = filteredData;
   }

// Validamos TODO el formulario con Zod
  const result = schema.safeParse(dataToValidate);

  if (!result.success) {
   const errors: Partial<Record<keyof TFormShape, string>> = {};

   result.error.issues.forEach(issue => {
    const fieldName = issue.path[0];

    if (typeof fieldName === 'string' && fieldName in formData && !errors[fieldName as keyof TFormShape]) {
     errors[fieldName as keyof TFormShape] = issue.message || 'Invalid value';
    }
   });

   return {
    isValid: false, errors, validatedData: undefined 
    };
  }

// SI PASA: Devolvemos datos validados
  return { isValid: true, errors: {}, validatedData: result.data as TFormShape };
  } catch (error) {
   console.error('[useFieldValidation] Unexpected error:', error);
   return {
    isValid: false,
    errors: {},
    validatedData: undefined,
    generalError: 'Form validation failed unexpectedly'
   };
  }
 };
//-------------------
/* 🔹 UTILITIES */
const isFieldValid = <TFieldValue = unknown>(
 fieldName: keyof TFormShape,
 value: TFieldValue,
 context: Partial<TFormShape> = {}
 ): boolean => validateField(fieldName, value, context).isValid;

 const createEmptyErrors = (): Partial<Record<keyof TFormShape, string>> => ({});
//--------
//returns of hook
return {
//main functions
 validateField,
 validateAll,

//utils
 isFieldValid, //quick check
 createEmptyErrors, //state initialization

//references (debug/testing)
 options,
 schema,
 };
};
// Exportamos el tipo del retorno (para TypeScript)
export default useFieldValidation;