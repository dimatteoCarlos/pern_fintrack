// 📁 frontend/src/auth/ChangePasswordForm.tsx
/**
 * 🌟 ===============================
 * 📦 IMPORTS
 * =============================== 🌟
 */
import React from 'react';
import { ChangePasswordFormDataType } from '../../types/authTypes';
import { FormErrorsType } from '../../validation/hook/useChangePasswordValidation';

import InputField from '../formUIComponents/InputField';
import Message from '../formUIComponents/Message';
import SubmitButton from '../formUIComponents/SubmitButton';
import ResetButton from '../formUIComponents/Resetbutton';

import styles from './styles/passwordChangeForm.module.css';
import { FormStatus, TOTAL_COUNTDOWN_SECONDS } from './ChangePasswordContainer';



/**
 * 🌟 ===============================
 * 🏷️ PROPS TYPE
 * =============================== 🌟
 */
 type PropsType = {
 // 📋 Form Data
 formData: ChangePasswordFormDataType;
 
 // 🎮 Event Handlers
 onChange: (field: keyof ChangePasswordFormDataType) => (value: string) => void;
 onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
 onReset: () => void;
 onClose: () => void;
 onDone: () => void;
 onToggleVisibility: (field: keyof ChangePasswordFormDataType) => void;
 
 // ❌ Validation Errors
 validationErrors: FormErrorsType<keyof ChangePasswordFormDataType>;
 apiErrors: FormErrorsType<keyof ChangePasswordFormDataType>;
 
 // 🎯 Field States
 touchedFields: Partial<Record<keyof ChangePasswordFormDataType, boolean>>;
 visibility: Record<keyof ChangePasswordFormDataType, boolean>;
 
 // ⚡ UI States
 isSubmitting: boolean;
 isDisabled: boolean;
 isReadOnly?: boolean;
 status:FormStatus;

 // 💬 Messages & Status
 globalMessage: string | null;
 countdown: number | null;
 isSuccess?: boolean;
 
 // 🔘 Button Controls
 showReset?: boolean;
 showDone?: boolean;
 showCancel?: boolean;
 canReset?: boolean;

};

/**
 * 🌟 ===============================
 * 🎯 FORM COMPONENT
 * =============================== 🌟
 */
 export default function ChangePasswordForm({
  formData,
  onChange,
  onSubmit,
  onReset,
  onClose,
  onDone,
  onToggleVisibility,
  validationErrors,
  apiErrors,
  touchedFields,
  visibility,
  isSubmitting,
  isDisabled,
  status,
  globalMessage,
  countdown,
  isSuccess = false,
  showReset = true,
  showDone = false,
  showCancel = true,
  canReset = true,
 }: PropsType) {

/*==================
 🔧 HELPERS
 ==================*/
 const getFieldError = (field: keyof ChangePasswordFormDataType): string | undefined => {
  return validationErrors[field] || apiErrors[field];
 };
/* ===============================
 🎨 RENDER
=============================== */
 return (
  <div className={styles.passwordFormContainer}>
   {/* 🏷️ Header */}
   <header className={styles.passwordFormHeader}>
    <h2 className={styles.formTitle}>Change Password</h2>
    <p className={styles.passwordFormSubtitle}>
     Ensure your account is using a long, random password to stay secure.
    </p>
   </header>
   
   {/* 💬 Global Message */}
   {globalMessage && (
    <div className={styles.passwordMessagesContainer}>
     <div className={styles.messagesWrapper}>
      <Message 
       message={globalMessage} 
       type={isSuccess ? 'success' : 'error'}
      />
     </div>
    </div>
   )}

{/* {TEMPRORARY INSER HERE THE COUNTDOWNS MSG} */}
 {/* ⏱️ Countdown for rate limiting (Only when status is rate_limited ) */}
     {status === 'rate_limited' && countdown !== null && (
      <Message 
        message={`Please wait ${countdown} seconds before trying again`} 
        type="warning"
      />
    )}

    {/* ⏱️ Countdown for success state - Visual progress bar */}
    {/* {isSuccess && countdown !== null && countdown > 0 && (
      <div className={styles.countdownContainer}>
        <div className={styles.countdownText}>
          Redirecting to login in <span className={styles.countdownNumber}>{countdown}</span> seconds...
        </div>
        <div className={styles.countdownBar}>
          <div 
            className={styles.countdownProgress} 
            style={{ width: `${(countdown / 100) * 100}%` }}
          />
        </div>
      </div>
    )} */}

{/* {TEMPRORARY INSER HERE THE COUNTDOWNS MSG} */}


  <form onSubmit={onSubmit} className={styles.passwordForm}>
    <div className={styles.passwordFieldsContainer}>
     
     {/* 🔐 Current Password */}
     <InputField
      label="Current Password"
      type={visibility.currentPassword ? 'text' : 'password'}
      value={formData.currentPassword}
      onChange={(input: string | React.ChangeEvent<HTMLInputElement>) => {
       const value = typeof input === 'string' ? input : input.target.value;
       onChange('currentPassword')(value);
      }}
      error={getFieldError('currentPassword')}
      touched={!!touchedFields.currentPassword}
      showContentToggle={true}
      isContentVisible={visibility.currentPassword}
      onToggleContent={() => onToggleVisibility('currentPassword')}
      isReadOnly={isSuccess} // ✅ isReadOnly en éxito (ojos funcionan)
      disabled={isSubmitting && isSuccess}  // ❌ disabled 
     />

     {/* 🔑 New Password */}
     <InputField
      label="New Password"
      type={visibility.newPassword ? 'text' : 'password'}
      value={formData.newPassword}
      onChange={(input: string | React.ChangeEvent<HTMLInputElement>) => {
       const value = typeof input === 'string' ? input : input.target.value;
       onChange('newPassword')(value);
      }}
      error={getFieldError('newPassword')}
      touched={!!touchedFields.newPassword}
      showContentToggle={true}
      isContentVisible={visibility.newPassword}
      onToggleContent={() => onToggleVisibility('newPassword')}
      isReadOnly={isSuccess} 
       disabled={isSubmitting || isSuccess}
     />

     {/* 🔒 Confirm Password */}
     <InputField
      label="Confirm Password"
      type={visibility.confirmPassword ? 'text' : 'password'}
      value={formData.confirmPassword}
      onChange={(input: string | React.ChangeEvent<HTMLInputElement>) => {
       const value = typeof input === 'string' ? input : input.target.value;
       onChange('confirmPassword')(value);
      }}
      error={getFieldError('confirmPassword')}
      touched={!!touchedFields.confirmPassword}
      showContentToggle={true}
      isContentVisible={visibility.confirmPassword}
      onToggleContent={() => onToggleVisibility('confirmPassword')}
      isReadOnly={isSuccess} 
       disabled={isSubmitting || isSuccess}
     />
    </div>

    {/* ⏱️ Countdown Message */}
    {/* {countdown !== null && (
     <Message 
      message={`Please wait ${countdown} seconds before trying again`} 
      type="info"
     />
    )} */}
    
    {/* 🔘 Action Buttons */}
    <div className={styles.actionButtons}>
     {isSuccess ? (
     <div className={styles.successActionsWrapper}>
      {showDone && (
       <button
        type="button"
        onClick={onDone}
        className={styles.doneButton}
        disabled={isSubmitting}
       >
        Done
       </button>
      )}

      {/* 📊 Barra de progreso debajo del botón Done */}
       {countdown !== null && countdown > 0 && (
        <div className={styles.countdownContainer}>
         <div className={styles.countdownBar}>
          <div 
           className={styles.countdownProgress} 
           style={{ width: `${(countdown / TOTAL_COUNTDOWN_SECONDS) * 100}%` }} // ✅ Cálculo real
          />
         </div>
         <p className={styles.countdownText}>Please, Sign In with new Password. Redirecting in {countdown}s...</p>
        </div>
       )}
      
     </div>
     ) : (
      // 🔄 Normal State - Action Buttons
      <div className={styles.buttonGroupAnimation}>
       <SubmitButton 
        disabled={isDisabled || isSubmitting}
        isLoading={isSubmitting}
        type="submit"
       >
        {isSubmitting ? 'Changing Password...' : 'Change Password'}
       </SubmitButton>

       {showReset && (
        <ResetButton 
         onClick={onReset} 
         disabled={!canReset || isSubmitting}
        >
         Reset
        </ResetButton>
       )}

       {showCancel && (
        <button
         type="button"
         onClick={onClose}
         className={styles.cancelButton}
         disabled={isSubmitting}
        >
         Cancel
        </button>
       )}
      </div>
     )}
    </div>

   </form>

  </div>
 );
}