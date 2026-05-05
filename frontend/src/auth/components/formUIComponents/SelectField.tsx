// 📁 frontend/src/components/common/SelectField/SelectField.tsx

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import React from 'react';
import styles from './styles/selectField.module.css';

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS
=============================== 🌟 */

/**
 * 📝 Select option type
 */
type SelectOption<T> = {
  value: T;
  label: string;
};

/**
 * 📝 Select field props
 */
type SelectFieldProps <T extends string> = {
  /** 🏷️ Label for the select field */
  label: string;
  
  /** 📝 Current value */
  value: T;
  
  /** 📋 Available options */
  options: SelectOption<T>[];
  
  /** 🎮 Change handler */
  onChange: (value: T) => void;
  
  /** ❌ Error message to display */
  error?: string;
  
  /** 🎯 Is field required? */
  required?: boolean;
  
  /** 📝 Placeholder text */
  placeholder?: string;
  
  /** 🔧 Is field disabled? */
  disabled?: boolean;
  
  /** ℹ️ Help text below the select */
  helpText?: string;
  
  /** 🆔 HTML id for the select */
  id?: string;
  
  /** 🔧 Additional CSS class names */
  className?: string;
  
  /** 🎨 Inline styles */
  style?: React.CSSProperties;
};

/* 🌟 ===============================
🎭 COMPONENT: SelectField
=============================== 🌟 */

/**
 * 🎯 REUSABLE SELECT FIELD COMPONENT
 * 
 * 📌 DESIGN PRINCIPLES:
 * 1. ♿ ACCESSIBLE: Proper labels, ARIA attributes, keyboard navigation
 * 2. 🎨 CONSISTENT: Uniform styling with InputField component
 * 3. 🔧 FLEXIBLE: Supports various option formats
 * 4. 🎯 USER-FRIENDLY: Clear error display, helpful text
 * 5. ⚡ PERFORMANT: Optimized re-renders with React.memo
 * 
 * 🎯 USE CASES:
 * - Currency selection
 * - Country selection
 * - Category selection
 * - Status selection
 * - Any dropdown selection
 * 
 * @param props - Component configuration options
 * @returns A fully accessible and styled select field
 */
const SelectFieldInner=<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
  required = false,
  placeholder = 'Select an option',
  disabled = false,
  helpText,
  id,
  className = '',
  style
}:SelectFieldProps<T>) => {

  /* 🌟 ===============================
  🎮 EVENT HANDLERS
  =============================== 🌟 */
  /**
   * ✏️ Handle select changes
   */
  const handleChange = React.useCallback(
(e: React.ChangeEvent<HTMLSelectElement>) =>{onChange(e.target.value as T);},
   [onChange]
  );
  
  /* 🌟 ===============================
  🎨 COMPUTED VALUES
  =============================== 🌟 */
  /**
   * 🆔 Generate unique ID if not provided
   */
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  
  /**
   * 🎨 Determine if field has error
   */
  const hasError = !!error;
  
  /**
   * 🎨 Check if placeholder should be shown
   */
  const showPlaceholder = !value && placeholder;
  
  /* 🌟 ===============================
  ♿ ACCESSIBILITY ATTRIBUTES
  =============================== 🌟 */
  /**
   * 🎯 ARIA attributes for error state
   */
  const ariaAttributes = hasError ? {
    'aria-invalid': true,
    'aria-describedby': `${selectId}-error`
  } : {};
  
  /* 🌟 ===============================
  🎨 RENDER - THE SELECT FIELD UI
  =============================== 🌟 */
  return (
    <div 
      className={`${styles.selectContainer} ${className} ${hasError ? styles.hasError : ''}`}
      style={style}
    >
      {/* 🏷️ LABEL */}
      <label 
        htmlFor={selectId}
        className={styles.selectLabel}
      >
        {label}
        {required && (
          <span className={styles.requiredIndicator} aria-hidden="true">
            *
          </span>
        )}
      </label>
      
      {/* 📋 SELECT FIELD */}
      <div className={styles.selectWrapper}>
        <select
          id={selectId}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          className={styles.selectField}
          {...ariaAttributes}
        >
          {/* 📝 PLACEHOLDER OPTION */}
          {showPlaceholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          
          {/* 📋 AVAILABLE OPTIONS */}
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value}
              className={styles.selectOption}
            >
              {option.label ?? "No Option"}
            </option>
          ))}
        </select>
        
        {/* 🔽 CUSTOM DROPDOWN ARROW */}
        <span className={styles.selectArrow} aria-hidden="true">
          ▼
        </span>
      </div>
      
      {/* ❌ ERROR MESSAGE */}
      {hasError && (
        <div 
          id={`${selectId}-error`}
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
};

/**
 * ⚡ EXPLICACIÓN DEL WRAPPER:
 * React.memo por defecto devuelve un objeto que pierde los genéricos de TS.
 * Al redeclarar el tipo como una función genérica, recuperamos el tipado en el uso del componente.
 */

export const SelectField =React.memo(SelectFieldInner) as (<T extends string>(
 props:SelectFieldProps<T>)
 => JSX.Element) & {displayName?:string} ;

// Display name for React DevTools
(SelectField).displayName = 'SelectField';

export default SelectField;