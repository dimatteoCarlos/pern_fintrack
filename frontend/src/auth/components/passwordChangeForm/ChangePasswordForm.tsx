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
import { FormStatusType, TOTAL_COUNTDOWN_SECONDS } from './ChangePasswordContainer';

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
 status: FormStatusType;

 // 💬 Messages & Status
 globalMessage: string | null;
 onClearGlobalMessage: () => void;
 countdown: number | null;
 totalCountdown: number | null;
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
 onClearGlobalMessage,
 countdown,
 totalCountdown,
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

 /*==================
  🔧 HANDLERS
  ==================*/
 const handleInputChange = (fieldName: keyof ChangePasswordFormDataType) => (input: string | React.ChangeEvent<HTMLInputElement>) => {
  const value = typeof input === 'string' ? input : input.target.value;
  if (globalMessage) {
   onClearGlobalMessage?.();
  }
  onChange(fieldName)(value);
 }

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

   {/* 💬 Global Message Container (Anti-Glitch) */}
   <div className={`
    ${styles.passwordMessagesContainer} 
    ${globalMessage || status === 'rate_limited' ? styles.isVisible : styles.isHidden}
   `}>
    <div className={styles.messagesWrapper}>
     {globalMessage ? (
      <Message message={globalMessage} type={isSuccess ? 'success' : 'error'} />
     ) : (status === 'rate_limited' && countdown !== null) ? (
      <Message message={`Please wait ${countdown} seconds before trying again`} type="warning" />
     ) : (
      <div className={styles.placeholderSpace} />
     )}
    </div>
   </div>

   <form onSubmit={onSubmit} className={styles.passwordForm}>
    <div className={styles.passwordFieldsContainer}>
     {/* 🔐 Current Password */}
     <InputField
      label="Current Password"
      type={visibility.currentPassword ? 'text' : 'password'}
      value={formData.currentPassword}
      onChange={handleInputChange('currentPassword')}
      error={getFieldError('currentPassword')}
      touched={!!touchedFields.currentPassword}
      showContentToggle={true}
      isContentVisible={visibility.currentPassword}
      onToggleContent={() => onToggleVisibility('currentPassword')}
      isReadOnly={isSuccess}
      disabled={isSubmitting && isSuccess}
     />

     {/* 🔑 New Password */}
     <InputField
      label="New Password"
      type={visibility.newPassword ? 'text' : 'password'}
      value={formData.newPassword}
      onChange={handleInputChange('newPassword')}
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
      onChange={handleInputChange('confirmPassword')}
      error={getFieldError('confirmPassword')}
      touched={!!touchedFields.confirmPassword}
      showContentToggle={true}
      isContentVisible={visibility.confirmPassword}
      onToggleContent={() => onToggleVisibility('confirmPassword')}
      isReadOnly={isSuccess}
      disabled={isSubmitting || isSuccess}
     />
    </div>

    {/* 🔘 Action Buttons */}
    <div className={styles.actionButtons}>
     {isSuccess ? (
      <div className={styles.successActionsWrapper}>
       {showDone && (
        <button type="button" onClick={onDone} className={styles.doneButton} disabled={isSubmitting}>
         Done
        </button>
       )}

       {/* 📊 Progress Bar */}
       {countdown !== null && countdown > 0 && (
        <div className={styles.countdownContainer}>
         <div className={styles.countdownBar}>
          <div
           className={styles.countdownProgress}
           style={{
            width: `${(countdown / (totalCountdown ?? (TOTAL_COUNTDOWN_SECONDS + 0.01))) * 100}%`,
            backgroundColor: status === 'rate_limited' ? '#f59e0b' : '#28a745'
           }}
          />
         </div>
         <p className={styles.countdownText}> Redirecting in <span className={styles.countdownNumber}>{countdown}</span>s...</p>
        </div>
       )}
      </div>
     ) : (
      /* 🔄 Edit Mode - Action Bar Layout */
      <div className={styles.buttonMainLayout}>
       {/* Primary Submit */}
       <SubmitButton
        disabled={isDisabled || isSubmitting || status === 'rate_limited'}
        isLoading={isSubmitting}
        type="submit"
       >
        {status === 'rate_limited' ? 'System Locked' : 'Change Password'}
       </SubmitButton>

       {/* Secondary Group */}
       <div className={styles.secondaryActions}>
        {showReset && (
         <div className={canReset ? styles.resetVisible : styles.resetHidden}>
          <ResetButton onClick={onReset} disabled={!canReset || isSubmitting}>
           Reset
          </ResetButton>
         </div>
        )}

        {showCancel && (
         <button type="button" onClick={onClose} className={styles.cancelButtonText} disabled={isSubmitting}>
          Cancel
         </button>
        )}
       </div>
      </div>
     )}
    </div>
   </form>
  </div>
 );
}