// 📁frontend/src/auth/components/signInForm/SignInForm.tsx

/* ===============================
 🔐 SIGN IN FORM
 Responsible for login UI and validation
 Uses useFormLogic with signInSchema
 =============================== */
import React from 'react';
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
  const identity = getIdentity();
  const initialValues: SignInFormDataType = {
    username: identity?.username || '',
    email: identity?.email || '',
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

  const isLoading = externalLoading || isSubmitting;

  const handleInputChange = (field: keyof SignInFormDataType) => (input: string | React.ChangeEvent<HTMLInputElement>) => {
    const value = typeof input === 'string' ? input : input.target.value;
    if (error) clearError();
    handleChange(field)(value);
  };

  return (
    <>
      {/* Username */}
      <InputField
        label="Username"
        type="text"
        placeholder="your_username"
        value={formData.username}
        onChange={handleInputChange('username')}
        error={validationErrors.username}
        touched={touchedFields.has('username')}
        required
        disabled={isLoading}
        tabindex={1}
      />
 
      {/* Email */}
      <InputField
        label="Email"
        type="email"
        placeholder="email"
        value={formData.email}
        onChange={handleInputChange('email')}
        error={validationErrors.email}
        touched={touchedFields.has('email')}
        required
        disabled={isLoading}
        tabindex={2}
      />

      {/* Password */}
      <InputField
        label="Password"
        type="password"
        placeholder="password"
        value={formData.password}
        onChange={handleInputChange('password')}
        error={validationErrors.password}
        touched={touchedFields.has('password')}
        required
        disabled={isLoading}
        tabindex={3}
      />

      {/* Remember Me Checkbox */}
      <div className={styles['auth-form__remember-me']} onClick={() => setRememberMe(!rememberMe)}>
        <input
          className={styles['auth-form__checkbox']}
          type="checkbox"
          id="rememberMe"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          tabIndex={4}
        />
        <label htmlFor="rememberMe" className={styles['auth-form__label-checkbox']}>
          Keep me signed in
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        onClick={handleSubmit}
        className={styles['auth-form__button']}
        disabled={!isSubmittingAllowed || isLoading}
        tabIndex={5}
      >
        {isLoading ? 'Loading...' : 'Sign In'}
      </button>
    </>
  );
};

export default SignInForm;