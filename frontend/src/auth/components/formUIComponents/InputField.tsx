// 📁 frontend/src/components/common/InputField/InputField.tsx
/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import React from "react";
import styles from "./styles/inputField.module.css";
import { LuEyeClosed , LuEye } from "react-icons/lu";

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS
=============================== 🌟 */
export type InputFieldProps = {
  /** 🏷️ Label for the input field */
  label: string;

  /** 📝 Current value */
  value: string;

  /** 🎮 Change handler */
  onChange: (value: string | React.ChangeEvent<HTMLInputElement>) => void;

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

   /** 📝 Is field read-only? (success state) */
  isReadOnly?: boolean;

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

  onToggleVisibility?:() => void;

  isContentVisible?: boolean;

  onToggleContent?: () => void;

  touched?: boolean;
  
  /** 👀 Optional icon/svg for the toggle button */
  toggleIcon?: React.ReactNode;

  //tab control
  tabindex?:number;
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
    isReadOnly=false,

  }) => {
    /* 🌟 ===============================
    🎮 EVENT HANDLERS
    ================================ 🌟 */
   const handleChange = React.useCallback(
     (valueOrEvent: string | React.ChangeEvent<HTMLInputElement>) => {
       const value = typeof valueOrEvent === 'string' ? valueOrEvent : valueOrEvent.target.value;
       onChange(value);
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
            <button
              type="button"
              className={styles.toggleButton}
              onClick={onToggleContent}
              aria-label={isContentVisible ? "Hide content" : "Show content"}
              tabIndex={-1} //Remove from the tab order
            >
              {toggleIcon || (isContentVisible ? <LuEyeClosed /> :<LuEye />)}
              {/* {toggleIcon || (isContentVisible ? "🙈" : "👁️")} */}
            </button>
          )}
        </div>

        {/* ❌ ERROR MESSAGE */}
        {hasError && (// hasError = touched && error
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
          <div className={styles.helpText}>
           {helpText}
            </div>
        )}
      </div>
    );
  }
);

// Display name for React DevTools
InputField.displayName = "InputField";

export default InputField;
