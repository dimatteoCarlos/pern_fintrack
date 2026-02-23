// 📁 frontend/src/auth/hooks/useUpdateProfileFormLogic.ts
//Parent: UpdateProfileContainer.tsx
//Business Logic: error handlers, handle change and submit

/* 🌟 =============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import { useCallback,  useEffect,  useMemo, useState } from "react";

// 🏷️ IMPORT TYPE DEFINITIONS
import { 
 NormalizedProfileUpdateResultType,
 UpdateProfileFormDataType,
} from "../types/authTypes.ts";
import { CurrencyType } from "../../types/types.ts";
// import { FormDataType } from "./useUpdateProfileFormTodoEnUno_OLD.ts";

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS (LOCALS)
=============================== 🌟 */
/**
* 📝  Form errors type for profile form
* Combines field-specific errors with optional global form error
*/
 type ProfileFormErrorsType = {
  [key: string]: string |  undefined;
  form?: string;
};

/**
 * 📝 Validation hook interface
 * Defines the contract for validation functions used by this hook
 * This allows dependency injection for better testability
 */
 type ProfileValidationHookType = {
/**
 * ✅ Validates a single form field with context awareness
 * @param fieldName - Name of the field to validate (e.g., 'firstname')
 * @param value - Current value of the field
 * @param formData - Complete form data for cross-field validation
 * @returns Object with validation status and optional error message
*/
 validateField: (
  fieldName: keyof UpdateProfileFormDataType,
  value: unknown,
  formData?: Partial<UpdateProfileFormDataType>
 ) => { isValid: boolean; error?: string };

/**
 * 📋 Validates all form fields at once
 * Typically used on form submission
 * @param formData - Complete form data to validate
 * @returns Object with overall validity and field-specific errors
 */
validateAll: (
  formData: Partial<UpdateProfileFormDataType>
) => {
  isValid: boolean;
  errors: Partial<Record<keyof UpdateProfileFormDataType, string>>;
  };

/**
* 🔄 Transforms API error responses to form field errors
* Handles backend field name mapping (e.g., 'user_firstname' → 'firstname')
* @param apiError - Error response object from the backend API
* @returns Formatted errors ready for display in the UI
*/
 transformApiErrors: (apiError: unknown) => ProfileFormErrorsType;
}

/**
* 📝 API function type
* Defines the exact signature expected for the profile update API call
* This enables mock injection for testing
*/
 type UpdateProfileApiFunctionType = (
  payload: Record<string, unknown>
) => Promise<NormalizedProfileUpdateResultType>;
/**
 * 📝 Transformation utilities interface
 * Contains pure functions for data format conversion
 */
 type TransformationUtilitiesType = {
/**
* 📌 Converts form data format to API payload format
* Handles null/undefined cleanup and field name mapping
* @param formData - Data in frontend form format
* @returns Clean payload ready for API consumption
* @param storeToForm -
* @returns 
*/
 formToApi: (formData: Partial<UpdateProfileFormDataType>) => Record<string, unknown>;
 // storeToForm: (userData: UserDataType) => FormDataType

/**
 * 🔍 Compares current and original data to detect changes
 * Optimizes API calls by sending only modified fields
 * @param currentData - Current form state
 * @param originalData - Original data loaded from backend
 * @returns Object containing only fields that have changed
 */
getChangedFields: (
 currentData: UpdateProfileFormDataType,
 originalData: UpdateProfileFormDataType
) => Partial<UpdateProfileFormDataType>;
}
/**
 * 📝 Hook parameters interface
 * All dependencies are injected for purity and testability
 */
 type UseUpdateProfileFormLogicParamsType ={
/**
 * 🏁 Initial form data loaded from user profile
 * When this changes, the form automatically resets to reflect new data
 */
 initialData: UpdateProfileFormDataType;

/**
* 📤 API function injected by parent component
* Hook remains pure while parent handles API integration
*/
updateProfileApi: UpdateProfileApiFunctionType;

/**
 * ✅ Validation logic injected as dependency
 * Separation allows swapping validation strategies
 */
 validation: ProfileValidationHookType;

/**
 * 🔄 Data transformation utilities
 * Keeps data format logic separate from business logic
 */
 transformations: TransformationUtilitiesType;
}

/**
* 📝 Hook return type
* Complete API exposed to UI components
*/
 type UseUpdateProfileFormLogicReturnType = {
// 📊 STATES VALUES
/**
* 📝 Current form field values
* Reactive state that updates with user input
*/  
  formData: UpdateProfileFormDataType;

/**
* ❌ Current validation and API errors
* Field-specific errors plus optional global form error
*/  
  errors: ProfileFormErrorsType;

/**
* 👆 Tracks which fields user has interacted with
* Controls when validation errors should be displayed
*/ 
 touchedFields: Record<string, boolean>;

/**
* 🔄 Loading state indicator
* Note: This should come from parent/container, but included for API compatibility
*/
 isLoading: boolean;

/**
* 🔍 Flag indicating unsaved changes exist. Compares current formData with initialData
*/
 isDirty: boolean;

/**
// 📢 MESSAGES: Success message for UI display
* Note: Messages should be handled by parent container
*/
 successMessage: string | null;
  
/**
* ❌ API-level error message
* Note: Errors should be transformed to field errors, but included for compatibility
*/
 apiError: string | null; 

/*Rate Limiter timein secs */ 
 // retryAfter?:number | undefined;

// 🎮 EVENT HANDLERS
/**
* ✏️ Handles changes to any form field
* Updates state, marks field as touched, and triggers validation
* @param fieldName - Which field changed
* @param value - New field value
*/
handleChange: (
 fieldName: keyof UpdateProfileFormDataType,
 value: string | null | CurrencyType) => void;

 /**
 * 📤 Handles form submission with complete validation flow
 * @returns Promise with submission result for parent component to handle
 */
handleSubmit: (e: React.FormEvent) => Promise<{
 success: boolean;
 errors?: ProfileFormErrorsType;
 hasChanges?: boolean;
 // retryAfter?:number;
}>;
  
// 🔧 UTILITY FUNCTIONS
/**
* 🧹 Clears all form errors
* Useful after successful submission or when user starts editing
*/ 
 clearError: () => void;
  //?
// clearSuccessMessage: () => void;

/**
 * 🔄 Resets form to original state
 * Clears changes, errors, and touched status
*/
  resetForm: () => void;
  
/**
 * 👆 Marks all fields as touched
 * Forces display of all validation errors
 * Useful after failed form submission
*/
 markAllFieldsTouched: () => void; 
};

/* 🌟 ==============================
🛡️ MAIN HOOK: useUpdateProfileFormLogic
=============================== 🌟 */
/**
 * 🎯 PURE BUSINESS LOGIC HOOK for Profile Update Form
 * 
 * 📌 DESIGN PRINCIPLES:
 * 1. PURE FUNCTION: Same inputs → same outputs, no side effects
 * 2. DEPENDENCY INJECTION: All external logic provided as parameters
 * 3. SINGLE RESPONSIBILITY: Only handles form business logic
 * 4. TESTABILITY: Easy to unit test with mocked dependencies
 * 
 * 🔗 ARCHITECTURE POSITION:
 * This hook sits between UI components (presentation) and
 * parent container (orchestration). It knows nothing about
 * React context, Zustand stores, or API implementation details.
 * 
 * @param params - All required dependencies injected by parent
 * @returns Complete form logic package ready for UI consumption
 */
 const useUpdateProfileFormLogic = (
 {
  initialData,
  updateProfileApi,
  validation,
  transformations
}: UseUpdateProfileFormLogicParamsType
):UseUpdateProfileFormLogicReturnType => {
/* 🌟 ==============================
🗃️ STATE MANAGEMENT (Local UI State Only)
=============================== 🌟 */
/**
 * 📝 Current form field values
 * Initialized with initialData from parent
 * Updates in real-time as user types
 */
 const [formData, setFormData] = useState<UpdateProfileFormDataType>(initialData);

 /**
* 👆 Tracks user interaction with form fields
* Prevents showing validation errors before user has touched a field
* Improves UX by reducing "error spam"
 */
 const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

/**
* ❌ Stores validation and API errors
* Updated after each field change and form submission. Cleared when user starts editing, after success submit or form resets
*/
 const [errors, setErrors] = useState<ProfileFormErrorsType>({});

/**
* 🔄 Loading state (for API compatibility)
* 🎯 NOTE: Ideally loading state should come from parent container
* This is a compromise for backward compatibility
*/
 const [isLoading, setIsLoading] = useState<boolean>(false);

/**
 * 🏁 Success message state (for API compatibility)
 * 🎯 NOTE: Messages should be handled by parent container
 * This is included to match the return type interface
 */
const [successMessage, setSuccessMessage] = useState<string | null>(null);

/**
* ❌ API-level error message (for API compatibility)
* 🎯 NOTE: API errors should be transformed to field errors
* This is included to match the return type interface
*/
 const [apiError, setApiError] = useState<string | null>(null);

 // const [retryAfter, setRetryAfter] = useState<number | undefined>(undefined);

//================================
//🌟SIDE EFFECT
//================================
// 🔄 1. INTERNAL SYNCHRONIZATION (Reconciliation)
// Cuando el Store Global cambia, initialData cambia. 
// Este efecto actualiza el formulario automáticamente sin intervención del padre.
// 🔄 EFFECT: Sync internal form state with external initial data
// This effectively "clears" isDirty when the store updates after success
 useEffect(() => {
  setFormData(initialData);
  setErrors({});
  setTouchedFields({});
  setApiError(null);
  setSuccessMessage(null);//check
  }, [initialData])


/* 🌟 ===============================
🔍 COMPUTED PROPERTIES (Derived State)
 =============================== 🌟 */
/** 🔍 DIRTY CHECKING 
 * Dirty Checking: Detects unsaved changes
 * 
 * 🎯 HOW IT WORKS:
 * 1. Compares each field in current formData with initialData
 * 2. Returns true if ANY field has a different value
 * 3. Automatically updates when initialData changes (via dependency)
 * 
 * 📌 KEY POINT:
 * - Uses initialData directly (not stored in separate state)
 * - Reacts to initialData changes automatically
 * - No stale closure issues
 */
 const isDirty = useMemo(() => {
// Convert object keys to typed array for safe iteration
 const fieldNames = Object.keys(formData) as Array<keyof UpdateProfileFormDataType>;

// Check if any field has changed from its original value
const changed = fieldNames.some(
(key) => formData[key] !== initialData[key]
);
// LOG FOR DEBUGGIN
if (import.meta.env.VITE_ENVIRONMENT === 'development') {
  // console.log('--- 🔍 Check Dirty fields ---');
  // console.log('Original:', initialData);
  // console.log('Actual:', formData);
  // console.log('¿Is it Dirty?:', changed);
}
  return changed;
}, [formData, initialData]); // ✅ Recalculates when formData OR initialData changes

/**
* 👆 Marks all fields as "touched"
* Forces UI to show ALL validation errors immediately
* Useful after failed form submission to ensure user sees all issues
*/
const markAllFieldsTouched = useCallback(() => {
 const fieldNames = Object.keys(formData) as Array<keyof UpdateProfileFormDataType>;
 
 const allTouched = fieldNames.reduce((accumulator, fieldName) => {
   accumulator[fieldName] = true;
   return accumulator;
 }, {} as Record<string, boolean>);
 setTouchedFields(allTouched);
  }, [formData]); // ✅ Updates if form structure changes 
  
//================================
//🌟SIDE EFFECT
//================================
// 🔄 1. INTERNAL SYNCHRONIZATION (Reconciliation)
// Cuando el Store Global cambia, initialData cambia. 
// Este efecto actualiza el formulario automáticamente sin intervención del padre.
// 🔄 EFFECT: Sync internal form state with external initial data
// This effectively "clears" isDirty when the store updates after success
 useEffect(() => {
  setFormData(initialData);
  setErrors({});
  setTouchedFields({});
  setApiError(null);
  }, [initialData])

//====================================
//🌟FUNCTION DECLARATION🌟
//===================================
// const startCountdown = (initialTime: number | undefined) => {
//  if (!initialTime || initialTime <= 0) return;

//  let remaining = Math.ceil(initialTime / 1000); // Convertir a segundos
 
//  const interval = setInterval(() => {
//    remaining -= 1;
   
//    if (remaining <= 0) {
//      clearInterval(interval);
//    }
//  }, 1000);
 
//  return () => clearInterval(interval);
//  };

//====================================
//🌟FIELD CHANGE HANDLER (Core Logic)🌟
//===================================
/**
* ✏️ Handles field value changes with immediate validation
🎯 WHAT IT DOES (in order):
* 1. Calculates what the form data WILL BE after update
* 2. Updates the form state with new value
* 3. Marks field as "touched" for error display logic
* 4. Validates the field with UPDATED data (not stale)
* 5. Updates error state based on validation result
* 
* 🔧 CRITICAL IMPROVEMENT:
* Uses "nextFormData" (the future state) for validation, not the current state. This prevents stale validation.
* 
* ⚠️ IMPORTANT:
* This maintains purity and prevents side effects in the updater
*/
const handleChange =useCallback((fieldName:keyof UpdateProfileFormDataType, value : string | null | CurrencyType)=>{
// 🔄 1. UPDATE STATE / FUNCIONAL UPDATE (siempre fresco)
setFormData(currentFormData => {
 const nextFormData = {
   ...currentFormData, 
   [fieldName]: value
 };

// ✅ 2. VALIDATE WIHT NEW STATE
 const validationResult = validation.validateField(
   fieldName,
   value,
   nextFormData
 );

// ✅ 3. UPDATE ERRORS
 setErrors(currentErrors => {
  const updatedErrors = { ...currentErrors };

  if (validationResult.error) {
   updatedErrors[fieldName as string] = validationResult.error;
 } else {
   delete updatedErrors[fieldName as string];
   }
  return updatedErrors;
  }); 
  return nextFormData;
 });
//-----
// ✅ 4.MARK AS TOUCHED
 setTouchedFields(currentTouched => (
  { ...currentTouched, [fieldName]: true}) );

// 🧹 5. CLEAR ANY API-LEVEL ERROR WHEN USER STARTS TYPING
 if (apiError) {
  setApiError(null);
}
 
// 🧹 CLEAR SUCCESS MESSAGE WHEN USER MAKES CHANGES
 if (successMessage) {
  setSuccessMessage(null);
 }

}, [validation,apiError, successMessage])

/* 🌟 ===================================
🚀 FORM SUBMISSION HANDLER (Complete Flow)
=================================== 🌟 */
/**
* 📤 Handles form submission with full validation and API integration
* 
* * 🎯 SUBMISSION FLOW (Step by Step):
* 1. 🧹 Clear previous errors
* 2. ✅ Validate entire form
* 3. 🔍 Check for actual changes (dirty check)
* 4. 🔄 Prepare optimized payload (only changed fields)
* 5. 📤 Send to API via injected function
* 6. ⚠️ Handle API response (success or error)
* 7. 🎉 Update state on success
* 
* 🔄 OPTIMIZATION:
* Only sends changed fields to API, reducing payload size
* and preventing unnecessary updates.
*/
const handleSubmit = useCallback(async (
 e: React.FormEvent) => {
 e.preventDefault();

// 🧹 STEP 1: Clear any existing errors
 setErrors({});
 setApiError(null);
 setSuccessMessage(null);
 setIsLoading(true);
 
// ✅ STEP 2: Validate entire form before submission
 const validationResult = validation.validateAll(formData);
 
 if (!validationResult.isValid) {
// ❌ Validation failed - show all field errors
  setErrors(validationResult.errors as ProfileFormErrorsType);
  markAllFieldsTouched();// 💡 Tip: Si falla la validación al enviar, muestra todos los errores
  setIsLoading(false);

 return {
  success: false,
  errors: validationResult.errors as ProfileFormErrorsType
  };
 }

// 🔍 STEP 3: Check if user actually made changes
 if (!isDirty) {
// ⚠️ No changes detected - friendly error message
 const noChangesError = { 
  form: 'No changes detected.' 
 };
 setErrors(noChangesError);
 return {
  success: false,
  errors: noChangesError,
  hasChanges: false
  };
 }
//---
try {
// 🔄 STEP 4: Prepare optimized API payload
// Get ONLY fields that have actually changed (performance optimization)
 const changedFields = transformations.getChangedFields(formData, initialData);
   
// Transform form data to API format (handles null/undefined cleanup)
 const apiPayload = transformations.formToApi(changedFields);

// 📤 STEP 5: Send to API via injected function
// console.log('📦 Payload to send:', apiPayload);//xx

 const result = await updateProfileApi(apiPayload);

// ⚠️ Step 6: Handle API response
 if (!result.success) {
  //Handle field errors
  
 if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
  const apiErrors = validation.transformApiErrors(result);
  setErrors(apiErrors);  // ← Solo field errors
  setApiError(null);     // ← Limpiar apiError
 } 
 // Handle global error
 else if (result.error) {
   setApiError(result.error);  // ← Solo apiError
   setErrors({});       // ← Limpiar field errors
  }
  setIsLoading(false);
  return { success: false };
 }
 //----------------------
 // 🎉 STEP 7: Success - update state and return success
 setSuccessMessage("Profile updated successfully!");

 // 🧹 Clear any remaining field errors on success
 setErrors({});
 setApiError(null);
 setTouchedFields({});
 return { success: true };

 }catch (error) {
 // ❌ STEP 8: Handle unexpected errors (network, server down, etc.)
  console.error('❌ Unexpected error during profile update:', error);
  const unexpectedError = { 
   form: 'An unexpected error occurred. Please try again.' 
  };
  setErrors(unexpectedError);
  setApiError("Network or server error");
  setIsLoading(false);
  return {
   success: false,
   errors: unexpectedError
   };
  } finally {
     setIsLoading(false);
    }
   }, [formData, isDirty, validation, transformations, initialData, updateProfileApi, markAllFieldsTouched]);

/* 🌟 ===============================
🔧 UTILITY FUNCTIONS (Helper Methods)
=============================== 🌟 */
/**
* 🧹 Clears all form errors
* Useful when:
* - Form submission succeeds
* - User starts editing a field with an error
* - Manual reset is needed
*/
const clearError= useCallback(() => {
 setErrors({});
 setApiError(null);
}, []);
  
/**
* 🔄 Resets form to original state
* What it resets:
* 1. Form data back to initialData
* 2. All errors cleared
* 3. Touched status cleared
* 
* 📌 NOTE: Uses initialData from parameters, always up-to-date
*/
const resetForm = useCallback(() => {
  setFormData(initialData)
  setErrors({});
  setTouchedFields({});
  setSuccessMessage(null);
  setApiError(null);
  setIsLoading(false);
  }, [initialData]);
  
/* 🌟 ===============================
📤 HOOK RETURN VALUE (Public API)
=============================== 🌟 */
return {
// 📊 STATE VALUES (Read-only for UI)
 formData,
 errors,
 touchedFields,
 isLoading,
 // isDirty: JSON.stringify(formData) !== JSON.stringify(initialData),
 isDirty,
 successMessage,
 apiError,
 // retryAfter,

// 🎮  EVENT HANDLERS (For user interaction)
 handleChange,
 handleSubmit,

// 🔧 UTILITY FUNCTIONS (For programmatic control)
 clearError,
 resetForm,
 markAllFieldsTouched
  };
};

/* 🌟 ===============================
📝 TYPE EXPORTS (For TypeScript Consumers)
=============================== 🌟 */
export type {
  ProfileFormErrorsType,
  UpdateProfileApiFunctionType,
  ProfileValidationHookType,
  TransformationUtilitiesType,
  UseUpdateProfileFormLogicParamsType,
  UseUpdateProfileFormLogicReturnType
};

/* 🌟 ===============================
📝 DEFAULT EXPORT
=============================== 🌟 */
export default useUpdateProfileFormLogic;
