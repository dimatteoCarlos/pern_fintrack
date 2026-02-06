// 📁 frontend/src/components/common/InputField/InputField.tsx

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import React from "react";
import styles from "./styles/InputField.module.css";
import { LuEyeClosed , LuEyeOff } from "react-icons/lu";

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS
=============================== 🌟 */
export type InputFieldProps = {
  /** 🏷️ Label for the input field */
  label: string;

  /** 📝 Current value */
  value: string;

  /** 🎮 Change handler */
  onChange: (value: string) => void;

  /** ❌ Error message */
  error?: string;

  /** 🔧 Input type (default: text) */
  type?: "text" | "email" | "tel" | "password" | "number";

  /** 🎯 Is field required? */
  required?: boolean;

  /** 📝 Placeholder text */
  placeholder?: string;

  /** 🔧 Is field disabled? */
  disabled?: boolean;

  /** ℹ️ Help text below the input */
  helpText?: string;

  /** 🆔 HTML id */
  id?: string;

  /** 🔧 Extra CSS class names */
  className?: string;

  /** 🎨 Inline styles */
  style?: React.CSSProperties;

  // 🔑 Optional generic toggle for content visibility
  showContentToggle?: boolean;
  isContentVisible?: boolean;
  onToggleContent?: () => void;

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
    type = "text",
    required = false,
    placeholder = "",
    disabled = false,
    helpText,
    id,
    className = "",
    style,
    showContentToggle = false,
    isContentVisible = false,
    onToggleContent,
    toggleIcon,
  }) => {
    /* 🌟 ===============================
    🎮 EVENT HANDLERS
    ================================ 🌟 */
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      },
      [onChange]
    );

    /* 🌟 ===============================
    🎨 COMPUTED VALUES
    ================================ 🌟 */
    const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, "-")}`;
    const hasError = !!error;

    /* 🌟 ===============================
    ♿ ACCESSIBILITY ATTRIBUTES
    ================================ 🌟 */
    const ariaAttributes = hasError
      ? { "aria-invalid": true, "aria-describedby": `${inputId}-error` }
      : {};

    /* 🌟 ===============================
    🎨 RENDER
    ================================ 🌟 */
    return (
      <div
        className={`${styles.inputContainer} ${className} ${
          hasError ? styles.hasError : ""
        }`}
        style={style}
      >
        {/* 🏷️ LABEL */}
        <label htmlFor={inputId} className={styles.inputLabel}>
          {label}
          {required && (
            <span className={styles.requiredIndicator} aria-hidden="true">
              *
            </span>
          )}
        </label>

        {/* 📝 INPUT + OPTIONAL TOGGLE */}
        <div className={styles.inputWrapper}>
          <input
            id={inputId}
            type={showContentToggle ? (isContentVisible ? "text" : "password") : type}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={styles.inputField}
            {...ariaAttributes}
          />

          {showContentToggle && onToggleContent && (
            <button
              type="button"
              className={styles.toggleButton}
              onClick={onToggleContent}
              aria-label={isContentVisible ? "Hide content" : "Show content"}
            >
              {toggleIcon || (isContentVisible ? <LuEyeClosed /> :<LuEyeOff />)}
              {/* {toggleIcon || (isContentVisible ? "🙈" : "👁️")} */}
            </button>
          )}
        </div>

        {/* ❌ ERROR MESSAGE */}
        {hasError && (
          <div
            id={`${inputId}-error`}
            className={styles.errorMessage}
            role="alert"
            aria-live="polite"
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
  }
);

// Display name for React DevTools
InputField.displayName = "InputField";

export default InputField;
