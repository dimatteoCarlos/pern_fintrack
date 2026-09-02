// 📁 frontend/src/components/common/InputField/InputField.tsx
/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import React from 'react';
import { LuEyeClosed, LuEye } from 'react-icons/lu';
import styles from './styles/inputField.module.css';

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS
=============================== 🌟 */
export type InputFieldProps = {
  /** 🏷️ Label for the input field. A node, not only a string, so a caller can
   * put a glyph in front of the words. The id below still needs text, so it
   * falls back when the label is not one. */
  label: React.ReactNode;

  /** 📝 Current value */
  value: string;

  /** 🎮 Change handler */
  onChange: (value: string | React.ChangeEvent<HTMLInputElement>) => void;

  /** ❌ Error message */
  error?: string;

  /** 🔧 Input type (default: text) */
  type?: 'text' | 'email' | 'tel' | 'password' | 'number';

  /** 🎯 Is field required? */
  required?: boolean;

  /** 📝 Placeholder text */
  placeholder?: string;

  /** 🔧 Is field disabled? */
  disabled?: boolean;

  /** 📝 Is field read-only? (success state) */
  isReadOnly?: boolean;

  /** ℹ️ Help text below the input */
  helpText?: string;

  /** 🆔 HTML id */
  id?: string;

  /** 🔧 Extra CSS class names */
  className?: string;

  /** 🎨 How the field is drawn. Not a colour and not a surface: both the auth
   * modal and the profile menu sit on white, what differs is that the auth one
   * is filled. Defaults to default, which is every consumer outside auth. */
  variant?: 'default' | 'filled';

  /** 🎨 Inline styles */
  style?: React.CSSProperties;

  // 🔑 Optional generic toggle for content visibility
  showContentToggle?: boolean;

  onToggleVisibility?: () => void;

  isContentVisible?: boolean;

  onToggleContent?: () => void;

  touched?: boolean;

  /** 👀 Optional icon/svg for the toggle button */
  toggleIcon?: React.ReactNode;
};

/* 🌟 ===============================
🎭 COMPONENT: InputField
=============================== 🌟 */
const InputField: React.FC<InputFieldProps> = React.memo(
  ({
    label,
    value,
    onChange,
    error,
    type = 'text',
    required = false,
    placeholder = '',
    disabled = false,
    helpText,
    id,
    className = '',
    variant = 'default',
    style,
    showContentToggle = false,
    isContentVisible = false,
    onToggleContent,
    toggleIcon,
    isReadOnly = false,
  }) => {
    /* 🌟 ===============================
    🎮 EVENT HANDLERS
    ================================ 🌟 */
    const handleChange = React.useCallback(
      (valueOrEvent: string | React.ChangeEvent<HTMLInputElement>) => {
        const value =
          typeof valueOrEvent === 'string'
            ? valueOrEvent
            : valueOrEvent.target.value;
        onChange(value);
      },
      [onChange],
    );

    /* 🌟 ===============================
    🎨 COMPUTED VALUES
    ================================ 🌟 */
    const inputId =
      id ||
      `input-${
        typeof label === 'string'
          ? label.toLowerCase().replace(/\s+/g, '-')
          : 'field'
      }`;
    const hasError = !!error;

    /* 🌟 ===============================
    ♿ ACCESSIBILITY ATTRIBUTES
    ================================ 🌟 */
    const ariaAttributes = hasError
      ? { 'aria-invalid': true, 'aria-describedby': `${inputId}-error` }
      : {};

    /* 🌟 ===============================
    🎨 RENDER
    ================================ 🌟 */
    return (
      <div
        className={`${styles.inputContainer} ${styles[variant]} ${className} ${
          hasError ? styles.hasError : ''
        }`}
        style={style}
      >
        {/* 🏷️ LABEL */}
        <label htmlFor={inputId} className={styles.inputLabel}>
          {label}
          {required && (
            <span className={styles.requiredIndicator} aria-hidden='true'>
              *
            </span>
          )}
        </label>

        {/* 📝 INPUT + OPTIONAL TOGGLE */}
        <div className={styles.inputWrapper}>
          <input
            id={inputId}
            type={
              showContentToggle
                ? isContentVisible
                  ? 'text'
                  : 'password'
                : type
            }
            value={value}
            onChange={(e) => handleChange(e)}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={isReadOnly}
            required={required}
            className={styles.inputField}
            style={{ paddingRight: showContentToggle ? '40px' : '12px' }} // Evita que el texto toque el icono
            {...ariaAttributes}
          />

          {showContentToggle && onToggleContent && (
            /* No tabIndex. A `tabIndex={-1}` stood here and took the button out
               of the tab order, which left the keyboard with no way at all to
               unmask the field -- this is the only control that does it. The
               natural order already puts the button right after its own input.

               The name says password and not content: the type above resolves to
               'password' whenever showContentToggle is set, so the generic word
               told the listener less than the truth. */
            <button
              type='button'
              className={styles.toggleButton}
              onClick={onToggleContent}
              aria-label={isContentVisible ? 'Hide password' : 'Show password'}
            >
              {toggleIcon || (isContentVisible ? <LuEyeClosed /> : <LuEye />)}
              {/* {toggleIcon || (isContentVisible ? "🙈" : "👁️")} */}
            </button>
          )}
        </div>

        {/* ❌ ERROR MESSAGE */}
        {hasError && ( // hasError = touched && error
          <div
            id={`${inputId}-error`}
            className={styles.errorMessage}
            role='alert'
            aria-live='polite'
          >
            {error}
          </div>
        )}

        {/* ℹ️ HELP TEXT */}
        {helpText && !hasError && (
          <div className={styles.helpText}>{helpText}</div>
        )}
      </div>
    );
  },
);

// Display name for React DevTools
InputField.displayName = 'InputField';

export default InputField;
