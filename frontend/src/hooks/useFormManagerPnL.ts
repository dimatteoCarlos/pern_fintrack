// src/hooks/useFormManagerPnL.ts
// =====================
// IMPORT DEPENDENCIES
// =====================
import { useState, useCallback } from 'react';

// =======================
// IMPORT DEBOUNCED CALLBACK
// =======================
import { useDebouncedCallback } from './useDebouncedCallback';
// ======================
// IMPORT AND TYPE DEFINITIONS
// ======================
import type {  DropdownOptionType } from '../types/types';
import { ValidationMessagesType } from '../validations/types';
import { PnLValidationSchema, validateAllFn } from '../validations/validationPnL/validationPnL';

// ======================================
// MAIN HOOK IMPLEMENTATION
// ======================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useFormManagerPnL = <FormInputType extends Record<string, unknown>, FormValidatedType extends Record<string, any>>(initialData: FormInputType,initialValidatedData:FormValidatedType) => {
// ====================
// TYPE DEFINITIONS
// ====================
type  FormFieldKeyType = keyof FormInputType & string;

type ShowValidationType=Record<FormFieldKeyType & string, boolean> 

// =====================
// STATE DEFINITIONS
// =====================
const [formInputData, setFormInputData] = useState<FormInputType>(initialData);

const [formValidatedData, setFormValidatedData] = useState<FormValidatedType>(initialValidatedData as FormValidatedType)

const [validationMessages, setValidationMessages] = useState<ValidationMessagesType<FormInputType>>({});

const [showValidation, setShowValidation] = useState<ShowValidationType>(
  Object.fromEntries((Object.keys(initialData) as Array<FormFieldKeyType>).map((key)=>[key, false])) as Record<FormFieldKeyType, boolean>
);

//--------------------------------------
// --- Functions (Factory Pattern) --- / Funciones (Patrón Fábrica) ---
const activateAllValidations = useCallback((isActive:boolean) => {
    setShowValidation(
      Object.fromEntries(Object.keys(initialData).map(key => [key, isActive])) as Record<FormFieldKeyType, boolean>
    );
  }, [initialData]);
//----------------------------------------
// Handler for input numeric data (amount)
  const createInputNumberHandler = (fieldName: keyof FormInputType) => {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
     // update amount
    setFormInputData(prev => ({ ...prev, [fieldName]: value }));

    //custom validation schema
    const { isValid, message, parsedValue } = PnLValidationSchema[fieldName as keyof typeof PnLValidationSchema].validate(value);

    // update validation messages state
    setValidationMessages(prev => ({ ...prev, [fieldName]: message }));

    // update validated state
    if (isValid) {
      setFormValidatedData(prev => ({ ...prev, [fieldName as keyof FormValidatedType]: parsedValue }));
    }else{
      setFormValidatedData(prev=>{const update = {...prev}; delete update[fieldName as keyof FormValidatedType];return update})
    }
  };
};

//-----------------------------------------
//Handler for dropdown selection (account)
 const createDropdownHandler = useCallback((fieldName: FormFieldKeyType) => {
    return (selectedOption: DropdownOptionType | null) => {
      const value = selectedOption?.value || '';
      setFormInputData(prev => ({ ...prev, [fieldName]: value }));
      
    // Immediate validation
    const { isValid, message, parsedValue } = PnLValidationSchema[fieldName as keyof typeof PnLValidationSchema].validate(value);

     setValidationMessages(prev => ({ ...prev, [fieldName]: message || '' }));
      
    // Update validated data
      if (isValid) {
      setFormValidatedData(prev => ({ ...prev, [fieldName as keyof FormValidatedType]: parsedValue }));
      //   setShowValidation(prev=>({...prev,
      // [fieldName]:false}))
    } else {
        // setValidationMessages(prev => ({ ...prev, [fieldName]: '' }));

         setFormValidatedData(prev => {
        const update = {...prev}; 
        delete update[fieldName as keyof FormValidatedType];
        return update;
      });
      }
    };
  }, []);

// =============================
// DEBOUNCED VALIDATION FOR TEXT AREA
// =============================
const debouncedTextAreaValidation = useDebouncedCallback((fieldName:FormFieldKeyType,value:string )=>{
const {isValid, message, parsedValue} = PnLValidationSchema[fieldName as keyof typeof PnLValidationSchema].validate(value);

setValidationMessages(prev => ({ ...prev, [fieldName]: message || '' }));

if (isValid) {
    setFormValidatedData(prev => ({ ...prev, [fieldName]: parsedValue }));
    
    setShowValidation(prev=>({...prev,
    [fieldName]:false}))
  }else {
      setFormValidatedData(prev => {
        const update = { ...prev };
        delete update[fieldName];
        return update;
        });
      }
},500)

//------------------------------------
// Handler for textarea input (Note)
const createTextareaHandler = useCallback((fieldName: FormFieldKeyType) => {
  return   ((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    
    setFormInputData(prev => ({ ...prev, [fieldName]: value }));

    setShowValidation(prev=>({...prev,
      [fieldName]:true}))

    debouncedTextAreaValidation(fieldName, value);
  });
}, [debouncedTextAreaValidation]);

//---------------------------------------------
// Handler for a generic field input w/o validation(Generic)
   const createFieldHandler = useCallback(<V>(fieldName:FormFieldKeyType)=>{return (value:V)=>{
    setFormInputData(prev =>({...prev, [fieldName]:value}))

    setFormValidatedData(prev=>({...prev, [fieldName]:value}))
}
   }, [])
// ============================================
// Handler for a generic field input w validation(Generic)
   const createFieldValidationHandler = useCallback(<V extends string>(fieldName:FormFieldKeyType)=>{
    return (value:V )=>{
    //update state immediately
    setFormInputData(prev =>({...prev, [fieldName]:value}));

    setShowValidation(prev => ({ ...prev, [fieldName]: true }));

    //immediate validation
    const { isValid, message, parsedValue } = PnLValidationSchema[fieldName as keyof typeof PnLValidationSchema].validate(value);

    setValidationMessages(prev => ({ ...prev, [fieldName]: message || '' }));

    //upadate validated fields
    if (isValid) {
        setFormValidatedData(prev => ({ ...prev, [fieldName]: parsedValue }));
        setShowValidation(prev => ({ ...prev, [fieldName]: false }));
      }else{
      setFormValidatedData(prev => {
        const update = { ...prev };
        delete update[fieldName];
        return update;
          }
        );
        }
}
}, [])
// ============================================
// FORM-WIDE VALIDATION (for submit)
// =========================================
//Validate fields before submission
 const validateAllPnL = useCallback(()=>{
const {isValid,fieldErrorMessages}= validateAllFn(formInputData,PnLValidationSchema)

//show all validation messages
// setShowValidation(prev=>
//   Object.fromEntries((Object.keys(prev) as Array<keyof ShowValidationType>).map((key)=>[key, true as boolean])) as Record<FormFieldKeyType, boolean>)
    activateAllValidations(true)
    return {
    isValid,
    messages: fieldErrorMessages,
    validatedData: isValid ? (formValidatedData as FormValidatedType) : null
  };

  },[formInputData, formValidatedData,activateAllValidations])

// =============================
// FORM RESET AFTER SUBMIT
// ==========================
  const resetForm = useCallback(() => {
    setFormInputData(initialData);
    setFormValidatedData(initialValidatedData as FormValidatedType)
    setValidationMessages({});
    activateAllValidations(false)
    // setShowValidation(
    //   Object.fromEntries(Object.keys(initialData).map(key => [key, false])) as Record<keyof FormInputType, boolean>
    // );

  }, [initialData,initialValidatedData,activateAllValidations]);

   // ======================
  // EXPOSED API*
  // ======================
  return {
    // States
    formInputData,
    formValidatedData,
    validationMessages,
    showValidation,
    activateAllValidations,
    resetForm,
    
    // Handlers
    createInputNumberHandler,
    createDropdownHandler,
    createTextareaHandler,
    createFieldHandler,
    createFieldValidationHandler,
    validateAllPnL,

     
    // Setters
    setFormInputData,
    setFormValidatedData,
    setValidationMessages,
    setShowValidation,

  };
};