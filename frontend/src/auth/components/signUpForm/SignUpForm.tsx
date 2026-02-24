// 📁 frontend/src/pages/auth/components/SignUpForm.tsx

/* ===============================
📝 SIGN UP FORM
Responsible for registration UI and validation
Uses useFormLogic with signUpSchema
=============================== */
import React, { useState } from 'react';
import { signUpSchema, SignUpFormDataType } from '../../../auth/validation/zod_schemas/authSchemas';
import { useFormLogic } from '../../hooks/useFormLogic';
import InputField from '../formUIComponents/InputField';

import styles from "../authPage/styles/authUI.module.css"

type SignUpFormProps = {
  onSignUp: (userData: SignUpFormDataType) => Promise<void>;
  externalLoading: boolean;
  error: string | null;
  clearError: () => void;
};

const SignUpForm: React.FC<SignUpFormProps> = ({
  onSignUp,
  externalLoading,
  error,
  clearError,
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const initialValues: SignUpFormDataType = {
    username: '',
    email: '',
    password: '',
    user_firstname: '',
    user_lastname: '',
    confirmPassword: '',
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
    schema: signUpSchema,
    initialValues,
    onSubmit: async (data) => {
      await onSignUp(data);
    },
  });

  const isLoading = externalLoading || isSubmitting;

  const handleInputChange = (field: keyof SignUpFormDataType) => (input: string | React.ChangeEvent<HTMLInputElement>) => {
    const value = typeof input === 'string' ? input : input.target.value;
    if (error) clearError();
    handleChange(field)(value);
  };

  const togglePasswordVisibility = () => setIsPasswordVisible(prev => !prev);
  const toggleConfirmVisibility = () => setIsConfirmVisible(prev => !prev);

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
      />

      {/* Password */}
      <div className={styles.extraFieldsGroup}>
       <InputField
         label="Password"
         type={isPasswordVisible ? 'text' : 'password'}
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
       />
       {/* Confirm Password */}
       <InputField
         label="Confirm Password"
         type={isConfirmVisible ? 'text' : 'password'}
         placeholder="confirm password"
         value={formData.confirmPassword || ''}
         onChange={handleInputChange('confirmPassword')}
         error={validationErrors.confirmPassword}
         touched={touchedFields.has('confirmPassword')}
         required
         disabled={isLoading}
         showContentToggle={true}
         isContentVisible={isConfirmVisible}
         onToggleContent={toggleConfirmVisibility}
       />
      </div>

      {/* First Name */}
      <div className={styles.extraFieldsGroup}>
       <InputField
         label="First Name"
         value={formData.user_firstname}
         onChange={handleInputChange('user_firstname')}
         error={validationErrors.user_firstname}
         touched={touchedFields.has('user_firstname')}
         required
         disabled={isLoading}
       />
       {/* Last Name */}
       <InputField
         label="Last Name"
         value={formData.user_lastname}
         onChange={handleInputChange('user_lastname')}
         error={validationErrors.user_lastname}
         touched={touchedFields.has('user_lastname')}
         required
         disabled={isLoading}
       />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        onClick={handleSubmit}
        className={styles['auth-form__button']}
        disabled={!isSubmittingAllowed || isLoading}
      >
        {isLoading ? 'Loading...' : 'Sign Up'}
      </button>
    </>
  );
};

export default SignUpForm;