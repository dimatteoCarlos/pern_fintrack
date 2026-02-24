// 📁 frontend/src/auth/components/UpdateProfileContainer.tsx
// 🎯 CONTAINER COMPONENT: Profile Update Form Orchestrator
// 🔧 Responsibility: Coordinates data flow, API calls, state management
// 🏷️ Pattern: Container Component (Smart Component)
// 📌 Design: Mediates between UI, business logic, and external services
/* 🌟 ==============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import React, { useEffect, useMemo, useState } from "react";

// 🏪 STORE & AUTH HOOKS - External state and API connections
import { useAuthStore } from "../../stores/useAuthStore";
import useAuth from "../../hooks/useAuth";

// 🧠 BUSINESS LOGIC HOOK (PURE) - Pure form logic (injectable)
import useUpdateProfileFormLogic from "../../hooks/useUpdateProfileFormLogic";

// ✅ VALIDATION HOOK - Specialized validation for profile data
import useProfileValidation from "../../validation/hook/useUpdateProfileValidation";

// 🔄 TRANSFORMATION UTILITIES - Data format converters
import { storeToForm, formToApi, getChangedFields } from "../../auth_utils/profileTransformation";

// 🎨 UI COMPONENTS
import UpdateProfileForm from "./UpdateProfileForm";
import LoadingSpinner from "../formUIComponents/LoadingSpinner";

// 🎨 STYLES - Component-specific CSS modules
import styles from "./styles/updateProfileContainer.module.css";

// 🏷️ TYPE DEFINITIONS- TypeScript interfaces for type safety
import { NormalizedProfileUpdateResultType, UpdateProfileFormDataType } from "../../types/authTypes";
import { DEFAULT_CURRENCY } from "../../../helpers/constants";
import { CurrencyType } from "../../../types/types";
import { updateProfileSchema } from "../../validation/zod_schemas/userSchemas";

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS (LOCALS)
=============================== 🌟 */
/**
* 📝 Container Component Props Interface
* 🎯 Purpose: Defines the public API of this component
* 🔧 Contract: What parent components can pass to this container
* 🏷️ Pattern: Component Interface Pattern
*/
type UpdateProfileContainerPropsType = {
  onSuccess?: () => void;
  onClose?: () => void;
  LoadingComponent?: React.ComponentType;
};

export type CurrencyOptionType = {
 label: string;
 value: CurrencyType;
};

/* 🌟 ===============================
🏷️ CONSTANT (LOCAL)
=============================== 🌟 */
const DEFAULT_USER_FORM_DATA: UpdateProfileFormDataType = {
  firstname: '',
  lastname: '',
  currency: DEFAULT_CURRENCY,
  contact: null
};

// 🎨 UI CONSTANT       
const currencyOptions: CurrencyOptionType[]=[
  { value: 'usd', label: 'USD - US Dollar' },
  { value: 'eur', label: 'EUR - Euro' },
  { value: 'cop', label: 'COP - Colombian Peso' }
 ]

 const PROFILE_FIELD_MAPPING = {
  user_firstname: "firstname",
  user_lastname: "lastname",
  currency: "currency",
  contact: "contact"
} as const;

/* 🌟 ===============================
🎭 COMPONENT: UpdateProfileContainer
=============================== 🌟 */
/**
* 🎯 CONTAINER COMPONENT: UpdateProfileContainer
* 
* 📌 ARCHITECTURAL ROLE: Orchestrator/Mediator
* 🔧 Responsibilities:
* 1. Connects global store to form logic
* 2. Injects dependencies into business logic hook
* 3. Handles API communication
* 4. Manages loading and error states
* 5. Coordinates between UI and business logic
* 
* 🏷️ PATTERNS APPLIED:
* - Container/Presenter Pattern
* - Dependency Injection Pattern
* - Mediator Pattern
* - Adapter Pattern
* 
* @param props - Component configuration via props
* @returns The complete profile update orchestration system
*/

const UpdateProfileContainer=  ({
  onClose, onSuccess,
  LoadingComponent = LoadingSpinner
}:UpdateProfileContainerPropsType) => {
 /* 🌟 ==========================
 🏪 STORE & EXTERNAL DATA CONNECTION
 =========================== 🌟 */
  const userData = useAuthStore((state) => state.userData);
  
  const {
    handleUpdateUserProfile,// 🚀 Main API function
    isLoading: isApiLoading,// ⏳ API loading state
    clearError: clearApiError,// 🧹 Clear API errors
    clearSuccessMessage: clearApiSuccessMessage // 🧹 Clear API success messages
  } = useAuth();
  
 /* 🌟 ==========================
  📊 LOCAL STATE MANAGEMENT
  =========================== 🌟 */
 const [retryAfter, setRetryAfter] = useState<number | null>(null);
 
 /**
 * 🔄 Data Transformation Utilities
 * 
 * 🎯 Purpose: Pure functions for data format conversion
 * 📦 Includes: formToApi(), getChangedFields()
 * 💾 Memoization: Empty dependency array = create once
 * 🏷️ Pattern: Utility Function Pattern
 */
 const transformations = useMemo(() => ({
  formToApi, // 🔄 Form format → API payload format
  storeToForm, // store format to Form format
  getChangedFields // 🔍 Compare current vs original, return only changed fields
 }), []);// ⚡ Empty array = create once, never recalculate
//---------------
/**
* 📝 Initial Form Data Transformation
* 
* 🎯 Purpose: Convert store data → form data format
* 🔧 Function: storeToForm() transforms field names and structure
* 💾 Memoization: useMemo prevents recalculation on every render
* ⚡ Optimization: Only recalculates when userData changes
*/
  const initialFormData = useMemo(() => {
   return userData 
 // 🔄 Transform: Store format → Form format
  ? transformations.storeToForm(userData) 
 // 🛡️ Guard: Return default form if no user data
  : DEFAULT_USER_FORM_DATA;
  }, [userData, transformations]); //⚡ Dependency: Only recalc when userData or/and transformations changes 
  // console.log("🚀 ~ UpdateProfileContainer ~ initialFormData:", initialFormData)

 /* 🌟 ==========================
 🔄 DEPENDENCIES SETUP & INJECTION
 =========================== 🌟 */
 /**
 * ✅ Initialize Profile Validation System
 * 
 * 🎯 Purpose: Get validation functions and error transformers
 * 📋 Includes: Field validation, form validation, API error mapping
 * 🏷️ Pattern: Strategy Pattern (validation strategy)
 */
  const profileValidation = useProfileValidation({fieldMapping:PROFILE_FIELD_MAPPING, schema:updateProfileSchema});
 
 /**
 * 🚀 API Wrapper Function (Adapter Pattern)
 * 🎯 Purpose: Adapt the raw API response to standardized format
 * Normalize BE response (Record<string, string[]>) to UI format (Record<string, string>)
 * 🔧 Responsibility: Error handling, response normalization
 * 🏷️ Pattern: Adapter Pattern (API response → Standardized format)
 * 💾 Memoization: useCallback prevents recreation on every render
 * 
 * @param payload - Form data transformed to API format
 * @returns Standardized result with success/error information
 */  
  const updateProfileApiWrapper = React.useCallback(
   async (payload: Record<string, unknown>): Promise<NormalizedProfileUpdateResultType> => {
  try {
// 🚀 Call the actual API function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiResult = await handleUpdateUserProfile(payload);

  // 1️⃣ Handle Success Case
  // Reset retryAftr state on success and return consistent message 
  if (apiResult.success) {
   if (onSuccess) onSuccess();
    return {
     success: true,
     fieldErrors: {} ,
     message: apiResult.message || 'Profile updated successfully',
    };
   }

  // 2️⃣ Handle Rate Limit 🚦
  if (!apiResult.success && apiResult.retryAfter) {
      setRetryAfter(apiResult.retryAfter);
  }

  // 3️⃣ 🧠 NORMALIZATION LOGIC (The Core Fix)
   // Convert Record<string, string[]> (BE) -> Record<string, string> (UI)
   // ❌ Business Logic Error (server returned success: false)
   const normalizedFieldErrors: Record<string, string> = {};
   if (apiResult.fieldErrors) {
    Object.entries(apiResult.fieldErrors).forEach(([key, value]) => {
     // If it's an array (BE style), take the first error message
     // If it's already a string, use it directly
     normalizedFieldErrors[key] = Array.isArray(value) ? value[0] : String(value);
    });
   }

   // 4️⃣ Return standardized object to the logic hook
    return {
     success: false,
     error: apiResult.error ?? apiResult.message,
     message: apiResult.message,
     fieldErrors: normalizedFieldErrors, // Now it strictly matches Record<string, string>
   };

    } catch (error) {
     // 🌐 Network/Server Error
      console.error("API call failed:", error);
      return {
       success: false,
       error: "Network error",
       fieldErrors: {},
       };
     }
    },
    [handleUpdateUserProfile, onSuccess]
  );
  
  /* 🌟 ==========================
  🧠 BUSINESS LOGIC HOOK INITIALIZATION
  =========================== 🌟 */
  /**
  * 🧠 Initialize Form Business Logic Engine
  * 
  * 🎯 Purpose: Inject all dependencies into the pure logic hook
  * 🔧 Pattern: Dependency Injection Pattern
  * 📦 What's injected:
  *   - initialFormData: Starting data from store
  *   - updateProfileApiWrapper: API adapter function
  *   - profileValidation: Validation strategies
  *   - transformations: Data format converters
  * 
  * 🏷️ The hook returns: Form state, handlers, and computed values
*/
  const formLogic = useUpdateProfileFormLogic({
  initialData: initialFormData,  // 📝 Starting form values
  updateProfileApi: updateProfileApiWrapper, // 🚀 API adapter
  validation: profileValidation, // ✅ Validation strategies
  // 🔄 Data transformers
  transformations
  });
  
/* 🌟 =============================
🧹 EFFECTS & SIDE EFFECTS MANAGEMENT
=========================== 🌟 */
/**
* 🧹 Cleanup Effect: Reset API States (Component Unmount)
* 🎯 Purpose: Clear API states when component is destroyed
* 🔧 Pattern: Cleanup Pattern (prevent memory leaks)
* ⚡ Timing: Runs when component unmounts
*/
 useEffect(() => {
   return () => {
     clearApiError();           // 🧹 Clear any API errors
     clearApiSuccessMessage();  // 🧹 Clear any API success messages
   };
  }, [clearApiError, clearApiSuccessMessage]); // ⚡ Dependencies
  
/* 🌟 ==========================
🎮 EVENT HANDLERS & COORDINATION
=========================== 🌟 */
/* 📤 Form Submission Handler (Orchestrator)
* 
* 🎯 Purpose: Coordinate the entire form submission flow
* 🔧 Responsibilities:
*   1. Prevent default form behavior
*   2. Clear previous messages
*   3. Delegate to business logic hook
*   4. Handle global form errors
* 🏷️ Pattern: Mediator Pattern (coordinates multiple systems)
*/
 const handleFormSubmit = React.useCallback(
  async (e: React.FormEvent) => {
   e.preventDefault();
   clearApiError();
   clearApiSuccessMessage();
 
// 🧠 Delegate submission to business logic hook   
  const result = await formLogic.handleSubmit(e);
  console.log("🚀 ~ UpdateProfileContainer ~ result:", result);

 },
 [formLogic, clearApiError, clearApiSuccessMessage]
);
  
/* 🚪 Modal Close Handler (With Unsaved Changes Check)
* 
* 🎯 Purpose: Handle modal closure with user confirmation
* 🔧 Features:
*   - Checks for unsaved changes (isDirty)
*   - Shows confirmation dialog if changes exist
*   - Calls parent's onClose callback
* 🏷️ Pattern: Guard Pattern (protects against data loss)
*/
const handleClose = React.useCallback(() => {
// ⚠️ Check for unsaved changes
 if (formLogic.isDirty && !formLogic.successMessage) {
  const confirmClose = window.confirm(
  'You have unsaved changes. Are you sure you want to close?');
  if (!confirmClose) return;// ❌ User cancelled
 }

 // ✅ All good, notify parent to close modal
 if (onClose) {
   onClose();
 }
}, [formLogic.isDirty,formLogic.successMessage, onClose]);

/* 🌟 ==========================
📊 LOADING & ERROR STATE MANAGEMENT
=========================== 🌟 */
/* ⏳ Combined Loading State
* 🎯 Purpose: Aggregate all loading states into one boolean
* 🔧 Logic: API loading OR form logic loading
* 📊 Usage: Controls loading overlay and button disabled states
*/
const isLoading = isApiLoading || formLogic.isLoading;

/**
* 🛡️ Guard Clause: No User Data
* 🎯 Purpose: Show loading state if user data isn't available
* 🔧 Pattern: Guard Pattern (early return)
* 🎨 UI: Shows loading spinner with message
*/
if (!userData) {
 return (
 <div className={styles.loadingContainer}>
  <LoadingComponent />{/* 🔄 Customizable loading spinner */}
  <p className={styles.loadingText}>
    Loading user profile...
  </p>
 </div>
  );
}

/* 🌟 ==========================
🎨 RENDER - THE PRESENTATION LAYER
=========================== 🌟 */
return (
 <div className={styles.container}>
 {/* 🔄 LOADING OVERLAY (Blocks UI during operations)*/}
  {isLoading && (
   <div className={styles.loadingOverlay}>
    <LoadingComponent />
    <p className={styles.loadingOverlayText}>
     Saving your changes...
    </p>
   </div>
  )}
      
 {/* 🎨 MAIN FORM CONTENT - Presentational Component */}
<UpdateProfileForm
// 📊 FORM STATE (from business logic hook)
 formData={formLogic.formData} // 📝 Current form values
 errors={formLogic.errors}  // ❌ Validation errors
 touchedFields={formLogic.touchedFields} // 👆 Fields user has interacted with
 isDirty={formLogic.isDirty} // ⚡ Unsaved changes flag
 isLoading={isLoading}      // ⏳ Combined loading state

// 🎮 EVENT HANDLERS (delegated to business logic)
 onChange={formLogic.handleChange}  // ✏️ Field change handler
 onSubmit={handleFormSubmit}   // 📤 Form submission handler
 onReset={formLogic.resetForm} // 🔄 Form reset handler
 onClearErrors={formLogic.clearError} // 🧹 Clear errors handler
 onMarkAllTouched={formLogic.markAllFieldsTouched} // 👆 Mark all fields touched
// 🚪 MODAL CONTROLS
 onClose={onClose ? handleClose : undefined} // 🚪 Close handler (if provided)
// 📢 MESSAGES FROM BUSINESS LOGIC
// 🌐 API-level errors
 apiErrorMessage={formLogic.apiError}
// ✅ Success messages
 successMessage={formLogic.successMessage}
// 🎨 UI CONFIGURATION       
 currencyOptions={currencyOptions}
// ⏰ RATE LIMIT INFO (🆕)
retryAfter={retryAfter}

/>

{/* migrate this to a component */}
{/* 🐛 DEBUG INFORMATION */}
{import.meta.env.VITE_ENVIRONMENT === 'developmentx' && (
  <div className={styles.debugInfo}>
    <h4 className={styles.debugInfoHeader}>
      🐛 Development Debug Info
    </h4>
    <div className={styles.debugGrid}>
      <div className={styles.debugItem}>
        <span className={styles.debugLabel}>isDirty:</span>
        <span className={styles.debugValue}>
          {formLogic.isDirty ? '🟢 YES' : '⚪ NO'}
        </span>
      </div>
      <div className={styles.debugItem}>
        <span className={styles.debugLabel}>isLoading:</span>
        <span className={styles.debugValue}>
          {isLoading ? '🔄 YES' : '⚪ NO'}
        </span>
      </div>
      <div className={styles.debugItem}>
        <span className={styles.debugLabel}>Error Count:</span>
        <span className={styles.debugValue}>
          {Object.keys(formLogic.errors).length}
        </span>
      </div>
      <div className={styles.debugItem}>
        <span className={styles.debugLabel}>Touched Fields:</span>
        <span className={styles.debugValue}>
          {Object.keys(formLogic.touchedFields).length}
        </span>
      </div>
      <div className={styles.debugItem}>
        <span className={styles.debugLabel}>User ID:</span>
        <span className={styles.debugValue}>
          {userData?.user_id || 'N/A'}
        </span>
      </div>
      <div className={styles.debugItem}>
        <span className={styles.debugLabel}>Initial Loaded:</span>
        <span className={styles.debugValue}>
          {initialFormData ? '✅' : '❌'}
        </span>
      </div>
    </div>
  </div>
)}
</div>
  );
};

export default UpdateProfileContainer;