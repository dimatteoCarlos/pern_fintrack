// 📁 frontend/src/auth/containers/ChangePasswordContainer.tsx
// Coordinator: wires UI ↔ form logic ↔ validation ↔ domain actions
/* =============
📦 IMPORTS DEPENDENCIES
============= */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";


/* =============
🏷️ IMPORT STYLES CSS MODULE
============= */
import styles from './styles/passwordChangeForm.module.css'

/* =============
🏷️ IMPORT TYPES
============= */
import { ChangePasswordFormDataType,ChangePasswordResultType  } from "../../types/authTypes";

/* =============
🧠 DOMAIN / AUTH
============= */
import useAuth from '../../hooks/useAuth';

/* =============
🧪 VALIDATION
============= */
import useChangePasswordValidation from "../../validation/hook/useChangePasswordValidation";

import { changePasswordSchema } from "../../validation/zod_schemas/userSchemas";

/* =============
🧩 FORM LOGIC
============= */
import useChangePasswordFormLogic from "../../hooks/useChangePasswordFormLogic";

/* =============
🎨 UI COMPONENTS
============= */
import ChangePasswordForm from './ChangePasswordForm';
import useFieldVisibility from "../../hooks/useFieldVisibility";
import { useAuthUIStore } from "../../stores/useAuthUIStore";
import { AUTH_ROUTE, AUTH_UI_STATES } from "../../auth_constants/constants";

/* ================
⏱️ TYPE DEFINITIONS
================ */
export type FormStatusType = "idle" | "editing" | "submitting" | "success"| "error" | "rate_limited";
type ChangePasswordContainerProps = {
  onClose?: () => void;
};

/* =============
⏱️ CONSTANTS
============= */
const INITIAL_FORM_DATA: ChangePasswordFormDataType ={
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const FIELD_MAPPING: Record<string, keyof ChangePasswordFormDataType> = {
  currentPassword: "currentPassword",
  newPassword: "newPassword",
  confirmPassword: "confirmPassword",
};

export const TOTAL_COUNTDOWN_SECONDS = 5;

/* ==========================
🧱 MAIN CONTAINER COMPONENTE
========================== */
/**
* 🎯 ChangePasswordContainer
* Orchestrates the password update flow, managing API and UI states.

✔️ This container:
Manages the entire UI state.
Coordinates validation, logic, and domain layers.
Handles rate limiting with a countdown timer.
Determines what to render and when.
Enforces dirty, touched, real-time, and submit-time validation. 
*/
const ChangePasswordContainer:React.FC<ChangePasswordContainerProps> = ({ onClose }) => {

/* ==============
🔐 NAVIGACTION HOOK
=============== */
const navigateTo=useNavigate()
/* ==============
🔐 AUTH DOMAIN
=============== */
 const { handleDomainChangePassword} = useAuth();

/* ==================
  🧪 VALIDATION SETUP
 ============= */
 const {validateField, validateAll, transformApiErrors} = useChangePasswordValidation({fieldMapping:FIELD_MAPPING, schema: changePasswordSchema,});

/* ==============================
🗃️ UI STATE (OWNED BY CONTAINER)
============================== */
 const [formData, setFormData] = useState<ChangePasswordFormDataType>(
  INITIAL_FORM_DATA
 );
const [status, setStatus] = useState<FormStatusType>("idle");

 const [globalMessage, setGlobalMessage] = useState<string | null>(null);

 const [isSubmitting, setIsSubmitting] = useState(false);

 const [countdown, setCountdown] = useState<number | null>(null);

 const [totalCountdown, setTotalCountdown] = useState<number | null>(TOTAL_COUNTDOWN_SECONDS);

 const { setUIState, setMessage } = useAuthUIStore();

 // const [totalRetryCounter, setTotalRetryCounter] = useState<number | null>(totalCountdown);
 
/* ===========================
// 👁️ CONTENT VISIBILITY HOOK
=========================== */  
 const { visibility, toggleVisibility, resetVisibility } = useFieldVisibility<keyof ChangePasswordFormDataType>(
   Object.keys(formData) as (keyof ChangePasswordFormDataType)[]
);

/* =====================
🔁 DOMAIN WRAPPER
==================== */
// Wrapper for domain function to match hook signature
 const domainChangePasswordWrapper = useCallback(
  async (payload: ChangePasswordFormDataType): Promise<ChangePasswordResultType> =>{
  return await handleDomainChangePassword(payload.currentPassword, payload.newPassword, payload.confirmPassword)},
  [handleDomainChangePassword]
 );

/* ============================
//  🎣 FORM LOGIC HOOK
============================= */
 const {
  handleChange,
  handleSubmit:formLogicHandleSubmit,
  validationErrors,
  apiErrors,
  touchedFields,
  dirtyFields,
  isSubmittingAllowed,
  resetForm,
} = useChangePasswordFormLogic({
  formData,
  setFormData,
  validateField,
  validateAll,
  transformFromApiToFormErrors:transformApiErrors,
  handleDomainChangePassword:domainChangePasswordWrapper, 
 });

/* ================
🔒 UI STATE DERIVED
================== */
// ✅ COMPUTED
 const isDirty = Object.values(dirtyFields).some(Boolean);
 const hasErrors = Object.values({...validationErrors, ...apiErrors}).some(error => error && error !== "");
 const isDisabled = !isSubmittingAllowed || 
 isSubmitting ||  !!countdown || 
 !isDirty ||  hasErrors;

// Reset disabled conditions
const canReset = isDirty && !isSubmitting; 
// Show Done button only on success
const showDone = status === "success";
// Show Cancel button when not submitting and not in success state
const showCancel = !isSubmitting && status !== "success";

/* =====================
🎯 HANDLERS
==================== */
// Form Handlers
// Currying for form props
 const onChangeField = useCallback(
  (field: keyof ChangePasswordFormDataType) => (value: string | null) => handleChange(field, value),
  [handleChange]
 );
//=====================
 const handleReset = useCallback(() => {
  // setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  setFormData(INITIAL_FORM_DATA);
  resetForm();
  resetVisibility();
  setGlobalMessage(null);
  setCountdown(null);
  setTotalCountdown(null);
  setStatus("idle");
 }, [resetForm,resetVisibility]);

 //======
 const handleClose = useCallback(() => {
  if (isDirty) {
    const confirmClose = window.confirm(
      'You have unsaved changes. Are you sure you want to close?'
    );
    if (!confirmClose) return;
  }
  
  handleReset();
  if (onClose) onClose();
}, [handleReset, onClose, isDirty]);

/* ============================
🚀 ON SUCCESS
============================ */

// ✅ DONE HANDLER - IMMEDIATE LOGOUT (CANCELS AUTO-LOGOUT)
 const handleDone = useCallback(() => {
// ✅ Cancel countdown and logout immediately
  setCountdown(null);
  handleReset();

// ✅ Set UI state for password changed
  setUIState(AUTH_UI_STATES.PASSWORD_CHANGED);
  setMessage('Password changed successfully. Please sign in with your new password.');
  
// Navigate to auth page
  navigateTo(AUTH_ROUTE, { replace: true,
   state: {
    intent: 'password_changed'
  }
  });

},[handleReset, setUIState, setMessage, navigateTo]);

//==========================
// Enhanced submit handler with UX states
 const handleSubmitForm = useCallback(async (e:React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();

 // Reset states
 setGlobalMessage(null);
 setIsSubmitting(true);
 setStatus("submitting");
 setCountdown(null);
 
 const result = await formLogicHandleSubmit();
 // console.log('result from container.nahdleSubmitForm.formLogicHandleSubmit:', result)

  if (!result) {
// ❌If validation client failed-apiErrors is updated
  setStatus("error");
  setGlobalMessage("Please fix validation errors");
  setIsSubmitting(false);
  return;
  }

 if (result.success) {
// ✅ SUCCESS PATH - Start 8 second countdown for auto-logout
  setStatus("success");
  setGlobalMessage(result.message || "Password changed successfully!");
// Security: Suggest re-authentication
// ⏱️ Start 8 second countdown for auto-logout
  console.log("Security: User should re-authenticate with new password");
  setCountdown(TOTAL_COUNTDOWN_SECONDS);
  setTotalCountdown(TOTAL_COUNTDOWN_SECONDS)

 } else {
// ❌ DOMAIN ERROR
  setStatus("error");
  setGlobalMessage(result.message || "Failed to change password");
  
// RATE LIMITING
 if (result.retryAfter) {
  setCountdown(result.retryAfter);
  setTotalCountdown(result.retryAfter)
  setStatus("rate_limited");
  }
 }
  setIsSubmitting(false);
 } ,[formLogicHandleSubmit]
  );

 // =================================
 //  ⏳  COUNTDOWN TICK EFFECT
 // =================================
 useEffect(() => {
  if (countdown === null) return;
    if (countdown <= 0) {
      if (status === 'success') {
        handleDone();
      } else if (status === 'rate_limited') {
        setCountdown(null);
        setStatus('idle');
      }
      return;
    }

 //⏱️ NEXT COUNTDOWN TICK
  const timer = setTimeout(()=>setCountdown(countdown =>(countdown !== null ? countdown-1:null)),1000);

  return ()=>clearTimeout(timer)
 }, [countdown, status, handleDone]);

//---------Debugging logs --------
// console.log("🔄 Dirty fields:", dirtyFields);
// console.log("📊 isDirty:", Object.values(dirtyFields).some(Boolean));
// console.log("🔘 canReset:", isDirty && !isSubmitting);

//----------------------------------
// DEBUG COMPONENT (temporal)
const DebugPanel = () => (
  <div style={{ position: 'fixed', bottom: 0, right: 0, background: '#333', color: 'white', padding: '10px' }}>
    <div>isDirty: {JSON.stringify(isDirty)}</div>
    <div>dirtyFields: {JSON.stringify(dirtyFields)}</div>
    <div>validationErrors: {JSON.stringify(validationErrors)}</div>
    <div>apiErrors: {JSON.stringify(apiErrors)}</div>
    <div>status: {status}</div>
  </div>
);

/* =============
🎨 RENDER
============= */
 return (
  <>
  <div className={styles.container}>

  <ChangePasswordForm
// 📋 Form Data
   formData={formData}

// 🎮 Event Handlers
   onChange={onChangeField}
   onSubmit={handleSubmitForm}
   onReset={handleReset}
   onClose={handleClose}
   onDone={handleDone}
   onToggleVisibility={toggleVisibility}

// ❌ Validation Errors
   validationErrors={validationErrors}
   apiErrors={apiErrors}
   
// 🎯 Field States 
   touchedFields={touchedFields}
   visibility={visibility}

// ⚡ UI States
   isSubmitting={isSubmitting}
   isDisabled={isDisabled}
   // readOnly={status === 'success'} // ✅ Read-only in success state (eyes still work)
   status={status}
   // isDirty={isDirty}

// Messages & Status
   globalMessage={globalMessage}
   onClearGlobalMessage={()=> setGlobalMessage(null)}
   
   countdown={countdown}
   totalCountdown={totalCountdown}
   isSuccess={status === "success"}

// Button Controls
   // showReset={canReset}
   showReset={canReset}
   showDone={showDone}
   showCancel={showCancel}
   canReset={canReset}
    />
 </div>

 {import.meta.env.NODE_ENV === 'development' && <DebugPanel />}
  
</>
  );
};

export default ChangePasswordContainer;
