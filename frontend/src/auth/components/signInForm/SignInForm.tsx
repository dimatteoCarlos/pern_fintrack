// 📁frontend/src/auth/components/signInForm/SignInForm.tsx

/* ===============================
 🔐 SIGN IN FORM
 Responsible for login UI and validation
 Uses useFormLogic with signInSchema
 =============================== */
import React, { useState } from 'react';
import { signInSchema, SignInFormDataType } from '../../../auth/validation/zod_schemas/authSchemas';
import { getIdentity } from '../../../auth/auth_utils/localStorageHandle/authStorage';
import { FormErrorsType, useFormLogic } from '../../hooks/useFormLogic';
import type { SignInResultType } from '../../hooks/useAuth';
import InputField from '../formUIComponents/InputField';

import styles from "../authPage/styles/authUI.module.css"

type SignInFieldNameType = keyof SignInFormDataType;

/**
 * The server answers a 400 with one list of messages per field, keyed by the
 * form's own field names. Only the first message of each is shown.
 */
const mapApiFieldErrors = (
 fieldErrors: Record<string, string[]>,
): FormErrorsType<SignInFieldNameType> => {
 const mapped: FormErrorsType<SignInFieldNameType> = {};

 (['identity', 'password'] as const).forEach((field) => {
  const messages = fieldErrors[field];

  if (Array.isArray(messages) && messages.length > 0) {
   mapped[field] = messages[0];
  }
 });

 return mapped;
};

type SignInFormProps = {
  onSignIn: (credentials: SignInFormDataType, rememberMe: boolean) => Promise<SignInResultType>;
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

  // Per-field messages the server sent back, kept apart from the client's own.
  const [apiErrors, setApiErrors] = useState<FormErrorsType<SignInFieldNameType>>({});

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
      setApiErrors({});

      const result = await onSignIn(data, rememberMe);

      // A 401 carries no field map: it stays the banner's form-level message so
      // it never names which half of the credentials was wrong.
      if (!result.success && result.fieldErrors) {
        setApiErrors(mapApiFieldErrors(result.fieldErrors));
      }
    },
  });

  // The client's own message wins; the server's is the fallback.
  const getFieldError = (field: SignInFieldNameType): string | undefined =>
    validationErrors[field] || apiErrors[field];

    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const togglePasswordVisibility = () => setIsPasswordVisible(prev => !prev);

    const isLoading = externalLoading || isSubmitting;

    const handleInputChange = (field: keyof SignInFormDataType) => (input: string | React.ChangeEvent<HTMLInputElement>) => {
    const value = typeof input === 'string' ? input : input.target.value;
    if (error) clearError();
    // The server's verdict is about the value that was sent, so editing retires it.
    if (apiErrors[field]) {
      setApiErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
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
        error={getFieldError('identity')}
        touched={touchedFields.has('identity')}
        required
        disabled={isLoading}
      />

      {/* Password */}
      <InputField variant='filled'
        label="Password"
        type="password"
        placeholder="password"
        value={formData.password}
        onChange={handleInputChange('password')}
        error={getFieldError('password')}
        touched={touchedFields.has('password')}
        required
        disabled={isLoading}
       showContentToggle={true}
       isContentVisible={isPasswordVisible}
       onToggleContent={togglePasswordVisibility}
      />

      {/* Remember Me Checkbox

          The ROW is the label, and that is the whole fix. It used to be a div
          carrying onClick, wrapped around a checkbox that already handles its
          own click and a label that already forwards clicks to it — so every
          real way of using the control fired the toggle TWICE and landed back
          on the value it started from: clicking the box, clicking the words,
          and pressing Space on it, because a keyboard activation dispatches a
          click that bubbles just the same. The only gesture that worked was a
          click on the row's empty padding, where nothing but the div answered.

          A label needs no handler: the browser routes the activation to the
          control it names, exactly once, from anywhere inside it. The styles
          were already written for this — the row declares display:flex,
          cursor:pointer and user-select:none — and a flex label is not the
          inline box its default would give.

          The text drops to a span: a label inside a label is not valid, and
          the outer one now covers what the inner one covered. */}
      <label className={styles['auth-form__remember-me']} htmlFor="rememberMe">
        <input
          className={styles['auth-form__checkbox']}
          type="checkbox"
          id="rememberMe"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        <span className={styles['auth-form__label-checkbox']}>
          Remember me
        </span>
      </label>

      {/* Submit Button */}
      <button
        type="submit"
        onClick={handleSubmit}
        className={styles['auth-form__button']}
        disabled={!isSubmittingAllowed || isLoading}
      >
        {isLoading ? 'Loading...' : 'Sign In'}
      </button>
    </>
  );
};

export default SignInForm;