/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import React from "react";
import styles from "./styles/passwordChangeForm.module.css";
import { ChangePasswordFormDataType } from "../../types/authTypes";
import Message from "../formUIComponents/Message";
import InputField from "../formUIComponents/InputField";
import SubmitButton from "../formUIComponents/SubmitButton";

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS
=============================== 🌟 */
type ChangePasswordFormPropsType = {
 /** 📄 Form state */
 formData: ChangePasswordFormDataType;

/** ❌ Frontend validation errors (per field) */
 errorsOfValidation: Partial<Record<keyof ChangePasswordFormDataType , string>>;

 /** ❌ Backend field errors (optional, global use only) */
 apiErrors?:Partial<Record<keyof FormData , string>> & {form?:string};

/** ❌ Backend global message */
 apiErrorMessage: string | null;

 /** ⏰ Rate limit retry (seconds) */
 retryAfter?: number | null;

 /** ✅ Success feedback */
  successMessage?: string | null;

  /** ⏳ Loading state */
  isLoading?: boolean;

  /** 🎮 Field handler factory */
  handleChange: (
    field: keyof ChangePasswordFormDataType
  ) => (value: string) => void;

  /** 🚀 Submit handler */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;

  /** ❌ Optional close / dismiss */
  onClose?: () => void;

 // touchedFields: Record<string, boolean>;
 // isDirty: boolean;
 // // Handlers
 
 // onReset: () => void;
 // onClearErrors: () => void;
 // onMarkAllTouched: () => void;


};

/* 🌟 ===============================
🎭 COMPONENT: ChangePasswordForm
=============================== 🌟 */
const ChangePasswordForm = ({
  formData,
  errorsOfValidation,
  apiErrors,
  apiErrorMessage,
  retryAfter,
  successMessage,
  isLoading = false,
  // handleChange,
  onSubmit,
  onClose,

 // touchedFields,
 // isDirty,

}: ChangePasswordFormPropsType):JSX.Element | null => {
 // if (!formData) return null;
 return (
 <form className={styles.form} onSubmit={onSubmit} noValidate>
  <h2 className={styles.title}>Security Settings</h2>
   <p className={styles.subtitle}>Update your account password</p>
{/* 

  {/* 📢 GLOBAL MESSAGES */}
  {successMessage && 
  // <div className={styles.successBanner}>
   <Message message={successMessage} type="success" onDismiss={onClose} autoDismiss={1500}
   />}

   {apiErrorMessage || apiErrors?.form && 
    <Message message={apiErrorMessage || apiErrors?.form} type="error" onDismiss={onClose} 
   />}

   {/* {apiErrorMessage && <div className={styles.errorBanner}>{apiErrorMessage}</div>} */}

  {/* {apiErrorMessage && <div className={styles.errorBanner}>{apiErrorMessage}</div>} */}

   {/* ⏰ RATE LIMIT WARNING */}
   {retryAfter && retryAfter > 0 && (
    // <div className={styles.warningBanner}>
    //  Too many attempts. Please wait <strong>{retryAfter}s</strong> before trying again.
    // </div>
     <Message message={` Too many attempts. Please wait ${Math.ceil(retryAfter/60)}m before trying again.`} type="warning" onDismiss={onClose} autoDismiss={retryAfter*1000}
    />
   )}

   {/* 🔑 CURRENT PASSWORD */}
   <div className={styles.fieldGroup}>
    {/* <label htmlFor="currentPassword">Current Password</label> */}
    <InputField
     id="currentPassword"
     type="password"
     label='Current Password'
     value={formData.currentPassword ?? ''}
     // onChange={handleChange('currentPassword')}
     onChange={()=>console.log('currentPassword')}
     // error={errorsOfValidation['currentPassword']}
     required 
     placeholder='Current Password'
     helpText='4–72 characters. No "<", ">", or empty spaces.'

     showContentToggle
     isContentVisible = {true}
     // onToggleContent={}
     disabled={isLoading || (!!retryAfter && retryAfter > 0)}

     // className={errorsOfValidation.currentPassword
     //   // && touchedFields.currentPassword 
     //  ? styles.inputError : ""}
    />

    {/* {errorsOfValidation.currentPassword
     // && touchedFields.currentPassword 
     && (
     <span className={styles.errorMessage}>{errorsOfValidation.currentPassword}</span>
    )} */}
   </div>

   {/* 🆕 NEW PASSWORD */}
   {/* <div className={styles.fieldGroup}>
    <InputField
     label="New Password"
     value={formData.newPassword ?? ""}
     onChange={handleChange("newPassword")}
     error={errorsOfValidation.newPassword}
     type="password"
     required
     placeholder="New password"
     helpText="Use a strong password you haven't used before."
     showContentToggle
     disabled={isLoading || Boolean(retryAfter)}
   />

   </div> */}

   {/* ✅ CONFIRM PASSWORD */}
   {/* <div className={styles.fieldGroup}>
    <InputField
      label="Confirm New Password"
      value={formData.confirmPassword ?? ""}
      onChange={handleChange("confirmPassword")}
      error={errorsOfValidation.confirmPassword}
      type="password"
      required
      placeholder="Repeat new password"
      showContentToggle
      disabled={isLoading || Boolean(retryAfter)}
        />
   </div> */}


   {/* 🎮 ACTIONS */}
   <div className={styles.actions}>
    {onClose && (
     <button type="button" onClick={onClose} className={styles.cancelButton} disabled={isLoading}>
      Cancel
     </button>
    )}


    {/* <button 
     type="submit" 
     className={styles.submitButton} 
     disabled={isLoading || !isDirty || (!!retryAfter && retryAfter > 0)}
    >
     {isLoading ? "Updating..." : "Update Password"}
    </button> */}

    <SubmitButton
     children={'UpdatePassword'}
     type="submit" 
     isLoading= {isLoading}
     loadingText ={isLoading ? "Updating..." : "Update Password"}
     className={styles.submitButton} 
    />
     
   </div>
  </form>
 );
};

export default ChangePasswordForm;