// 📁frontend/src/auth/components/signInForm/SignInForm.tsx

/* ===============================
 🔐 SIGN IN FORM
 Responsible for login UI and validation
 Uses useFormLogic with signInSchema
 =============================== */
import React, { useState } from 'react';
import { signInSchema, SignInFormDataType } from '../../../auth/validation/zod_schemas/authSchemas';
import { getIdentity } from '../../../auth/auth_utils/localStorageHandle/authStorage';
import { useFormLogic } from '../../hooks/useFormLogic';
import InputField from '../formUIComponents/InputField';

import styles from "../authPage/styles/authUI.module.css"

type SignInFormProps = {
  onSignIn: (credentials: SignInFormDataType, rememberMe: boolean) => Promise<void>;
  externalLoading: boolean;
  error: string | null;
  clearError: () => void;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
};

const SignInForm: React.FC<SignInFormProps> = ({
  onSignIn,
  externalLoading,
  error,
  clearError,
  rememberMe,
  setRememberMe,
}) => {
  // Initialize from localStorage if remembered
  const rememberedIdentity = getIdentity();
  const initialValues: SignInFormDataType = {
    identity: rememberedIdentity?.identity || '',
    password: '',
  };

  const {
    formData,
    handleChange,
    handleSubmit,
    validationErrors,
    touchedFields,
    isSubmitting,
    isSubmittingAllowed,
  } = useFormLogic({
    schema: signInSchema,
    initialValues,
    onSubmit: async (data) => {
      await onSignIn(data, rememberMe);
    },
  });

    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const togglePasswordVisibility = () => setIsPasswordVisible(prev => !prev);

    const isLoading = externalLoading || isSubmitting;

    const handleInputChange = (field: keyof SignInFormDataType) => (input: string | React.ChangeEvent<HTMLInputElement>) => {
    const value = typeof input === 'string' ? input : input.target.value;
    if (error) clearError();
    handleChange(field)(value);
    };

  return (
    <>
      {/* Username or email. One field: the password is the only secret, so a
        second identity could not authenticate anything, only disagree. */}
      <InputField variant='filled'
        label="Username or email"
        type="text"
        placeholder="your_username or email"
        value={formData.identity}
        onChange={handleInputChange('identity')}
        error={validationErrors.identity}
        touched={touchedFields.has('identity')}
        required
        disabled={isLoading}
        tabindex={1}
      />

      {/* Password */}
      <InputField variant='filled'
        label="Password"
        type="password"
        placeholder="password"
        value={formData.password}
        onChange={handleInputChange('password')}
        error={validationErrors.password}
        touched={touchedFields.has('password')}
        required
        disabled={isLoading}
       showContentToggle={true}
       isContentVisible={isPasswordVisible}
       onToggleContent={togglePasswordVisibility}
        tabindex={2}
      />

      {/* Remember Me Checkbox */}
      <div className={styles['auth-form__remember-me']} onClick={() => setRememberMe(!rememberMe)}>
        <input
          className={styles['auth-form__checkbox']}
          type="checkbox"
          id="rememberMe"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          tabIndex={3}
        />
        <label htmlFor="rememberMe" className={styles['auth-form__label-checkbox']}>
          Remember me
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        onClick={handleSubmit}
        className={styles['auth-form__button']}
        disabled={!isSubmittingAllowed || isLoading}
        tabIndex={4}
      >
        {isLoading ? 'Loading...' : 'Sign In'}
      </button>
    </>
  );
};

export default SignInForm;