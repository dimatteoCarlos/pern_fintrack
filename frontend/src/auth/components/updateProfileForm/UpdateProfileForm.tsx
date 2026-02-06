//c:\AA1-WEB_DEVELOPER\REACT\apps\FINTRACK\pern_fintrack\frontend\src\auth\components\updateProfileForm\UpdateProfileForm.tsx
//Ref: UpdateProfileContainer.tsx

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import React from 'react';

// 🎨 COMMON UI COMPONENTS
// 🆕 CHANGE: Usando el componente genérico Message para todo tipo de avisos
import Message from '../formUIComponents/Message'; 
import SelectField from '../formUIComponents/SelectField';
import InputField from '../formUIComponents/InputField';
import SubmitButton from '../formUIComponents/SubmitButton';

// 🎨 STYLES
import styles from './styles/updateProfileForm.module.css';

// 🏷️ TYPE DEFINITIONS
import { UpdateProfileFormDataType } from '../../types/authTypes';
import { CurrencyType } from '../../../types/types';
import { ProfileFormErrorsType } from '../../hooks/useUpdateProfileFormLogic';
import { CurrencyOptionType } from './UpdateProfileContainer';

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS (LOCALS)
=============================== 🌟 */
type UpdateProfileFormPropsType = {
  formData: UpdateProfileFormDataType;
  errors: ProfileFormErrorsType;
  touchedFields: Record<string, boolean>;
  isDirty: boolean;
  isLoading: boolean;

  onChange: (fieldName: keyof UpdateProfileFormDataType, value: string | null | CurrencyType) => void;

  onSubmit: (e: React.FormEvent) => Promise<void>;
  onReset: () => void;
  onClearErrors: () => void;
  onMarkAllTouched: () => void;
  onClose?: () => void;
  apiErrorMessage?: string | null;
  successMessage?: string | null;
  currencyOptions?: CurrencyOptionType[];
  className?: string;
  
  retryAfter?: number | null;

};

/* 🌟 ===============================
📦 MAIN COMPONENT: UpdateProfileForm
=============================== 🌟 */
const UpdateProfileForm = ({
  formData,
  errors,
  touchedFields,
  isDirty,
  isLoading,
  onChange,
  onSubmit,
  onReset,
  onClearErrors,
  onMarkAllTouched,
  onClose,
  apiErrorMessage,
  successMessage,
  currencyOptions,
  className = '',
  retryAfter, 
  
}: UpdateProfileFormPropsType) => {

  const isSuccess = !!successMessage;

  const isRateLimited = typeof retryAfter === 'number' && retryAfter > 0;

/* 🌟 ===============================
 🎮 FORM FIELD HANDLERS
=============================== 🌟 */
  const handleTextChange = React.useCallback(
    (fieldName: keyof UpdateProfileFormDataType) => (value: string) => {
      onChange(fieldName, value);
    }, [onChange]
  );

  const handleCurrencyChange = React.useCallback(
    (value: CurrencyType) => {
      onChange('currency', value);
    }, [onChange]
  );

  const handleContactChange = React.useCallback(
    (value: string) => {
      onChange('contact', value || null);
    }, [onChange]
  );

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSubmit(e);
    }, [onSubmit]
  );

  const handleReset = React.useCallback(() => {
    if (window.confirm('Are you sure you want to reset all changes?')) {
      onReset();
    }
  }, [onReset]);

  /* 🌟 ===============================
  🎨 HELPER FUNCTIONS
  =============================== 🌟 */
  const shouldShowError = React.useCallback(
    (fieldName: string): boolean => {
      return !!touchedFields[fieldName] && !!errors[fieldName];
    }, [touchedFields, errors]
  );
//---
  const getFieldError = React.useCallback(
    (fieldName: string): string | undefined => {
      return shouldShowError(fieldName) ? errors[fieldName] : undefined;
    }, [shouldShowError, errors]
  );

  return (
    <div className={`${styles.formContainer} ${className}`}>
      <header className={styles.formHeader}>
        <h2 className={styles.formTitle}>Update Your Profile</h2>
        <p className={styles.formSubtitle}>
          Manage your personal information and preferences
        </p>
      </header>

      {/* 📢 GLOBAL MESSAGES CONTAINER */}
      <div className={styles.messagesContainer}>
       {isSuccess && (

        <div className={styles.messagesWrapper}>
         <Message type="success" message={successMessage!} autoDismiss={5000} />
        </div>
        
        )}
        {/* {Show api error only when no field errors exist} */}
        {apiErrorMessage && Object.keys(errors).length === 0 && !isSuccess && (
          <div className={styles.messagesWrapper}>
           <Message type="error" message={apiErrorMessage} onDismiss={onClearErrors} />
          </div>
        )}

        {errors.form && !isSuccess && (
          <div className={styles.messagesWrapper}>
           <Message type="warning" message={errors.form} onDismiss={onClearErrors} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className={styles.form}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.fieldsetLegend}>Personal Information</legend>
          <div className={styles.personalInfoGrid}>
            <InputField
              label="First Name"
              value={formData.firstname}
              onChange={handleTextChange('firstname')}
              error={getFieldError('firstname')}
              required
              placeholder="Enter your first name"
              disabled={isLoading || isSuccess} 
            />
            <InputField
              label="Last Name"
              value={formData.lastname}
              onChange={handleTextChange('lastname')}
              error={getFieldError('lastname')}
              required
              placeholder="Enter your last name"
              disabled={isLoading || isSuccess} 
            />
          </div>
        </fieldset>
         {/* 💰 PREFERENCES SECTION */}
        <fieldset className={styles.fieldset}>
          <legend className={styles.fieldsetLegend}>Preferences</legend>
          <div className={styles.preferencesSection}>
            <SelectField
              label="Preferred Currency"
              value={formData.currency}
              options={currencyOptions || []}
              onChange={handleCurrencyChange}
              error={getFieldError('currency')}
              disabled={isLoading || isSuccess}
              placeholder="Select currency"
            />
            <InputField
              label="Contact Information"
              value={formData.contact || ''}
              onChange={handleContactChange}
              error={getFieldError('contact')}
              placeholder="Phone or email (optional)"
              disabled={isLoading || isSuccess}
              helpText="Optional - for notifications and updates"
            />
          </div>
        </fieldset>

        {/* 🎯 ACTION BUTTONS */}
        <div className={styles.actionButtons}>
          {!isSuccess ? (
          <div className={styles.buttonGroupAnimation}>
             <>
               <SubmitButton
                 type="submit"
                 isLoading={isLoading}
                 disabled={!isDirty || isLoading || isRateLimited
                 }
                 className={styles.saveButton}
               >
                 Save Changes
               </SubmitButton>

              <button
                type="button"
                onClick={handleReset}
                disabled={!isDirty || isLoading}
                className={styles.resetButton}
              >
                Reset
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                
              )}
            </>
          </div>
          ) : (
            // 🆕 CHANGE: Botón único "Done" tras éxito
            <button
              type="button"
              onClick={onClose}
              className={styles.doneButton}
            >
              Done
            </button>
          )}
        </div>

        {/* 🛠️ DEBUG UTILITIES */}
        {/* 🆕 CHANGE: Ocultar debug si hay éxito para limpiar la UI */}
        {import.meta.env.VITE_ENVIRONMENT === 'developmentx' && !isSuccess && (
          <div className={styles.debugUtilities}>
            <div className={styles.debugButtons}>
              <button type="button" onClick={onMarkAllTouched} className={`${styles.debugButton} ${styles.debugButtonMark}`}>
                Mark All Touched
              </button>
              <button type="button" onClick={onClearErrors} className={`${styles.debugButton} ${styles.debugButtonClear}`}>
                Clear All Errors
              </button>
            </div>
          </div>
        )}
      </form>

     {/* ℹ️ FORM STATUS INDICATOR - show when not success */}
      
      {Object.keys(touchedFields).length > 0 && !isSuccess && (
        <div className={`${styles.statusIndicator} ${isDirty ? styles.statusIndicatorDirty : styles.statusIndicatorClean}`}>
          <span className={styles.statusIcon}>{isDirty ? '⚡' : '✅'}</span>
          <span>
            {isDirty ? 'You have unsaved changes' : 'All changes saved (no unsaved changes)'}
          </span>
        </div>
      )}
    </div>
  );
};

export default UpdateProfileForm;