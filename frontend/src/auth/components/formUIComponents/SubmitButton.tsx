// 📁 frontend/src/components/common/SubmitButton/SubmitButton.tsx

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import React from 'react';
import styles from './styles/SubmitButton.module.css';

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS
=============================== 🌟 */

/**
 * 📝 Submit button props
 */
type SubmitButtonProps = {
  /** 📝 Button text/content */
  children: React.ReactNode;
  
  /** 🎯 Is button in loading state? */
  isLoading?: boolean;
  
  /** 🔧 Is button disabled? */
  disabled?: boolean;
  
  /** 🎯 Button type (default: submit) */
  type?: 'submit' | 'button' | 'reset';
  
  /** 🎮 Click handler */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  
  /** 🆔 HTML id for the button */
  id?: string;
  
  /** 🔧 Additional CSS class names */
  className?: string;
  
  /** 🎨 Inline styles */
  style?: React.CSSProperties;
  
  /** 🎯 Loading text (default: 'Loading...') */
  loadingText?: string;
};

/* 🌟 ===============================
🎭 COMPONENT: SubmitButton
=============================== 🌟 */

/**
 * 🎯 REUSABLE SUBMIT BUTTON COMPONENT
 * 
 * 📌 DESIGN PRINCIPLES:
 * 1. 🎨 CONSISTENT: Uniform styling with loading states
 * 2. ♿ ACCESSIBLE: Proper ARIA attributes for loading states
 * 3. ⚡ PERFORMANT: Optimized re-renders with React.memo
 * 4. 🎮 FLEXIBLE: Supports various button types and states
 * 5. 🎯 USER-FRIENDLY: Clear loading feedback
 * 
 * 🎯 USE CASES:
 * - Form submission buttons
 * - API action buttons
 * - Loading state buttons
 * - Primary action buttons
 * 
 * @param props - Component configuration options
 * @returns A styled submit button with loading state support
 */
const SubmitButton: React.FC<SubmitButtonProps> = React.memo(({
  children,
  isLoading = false,
  disabled = false,
  type = 'submit',
  onClick,
  id,
  className = '',
  style,
  loadingText = 'Loading...'
}) => {
  /* 🌟 ===============================
  🎨 COMPUTED VALUES
  =============================== 🌟 */
  
  /**
   * 🎯 Is button actually disabled
   */
  const isButtonDisabled = disabled || isLoading;
  
  /**
   * 🎯 ARIA label for loading state
   */
  const ariaLabel = isLoading ? `${children} - ${loadingText}` : undefined;
  
  /* 🌟 ===============================
  🎨 RENDER - THE SUBMIT BUTTON UI
  =============================== 🌟 */
  
  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={isButtonDisabled}
      className={`${styles.submitButton} ${className} ${isLoading ? styles.loading : ''}`}
      style={style}
      aria-label={ariaLabel}
      aria-busy={isLoading}
    >
      {/* 📝 BUTTON CONTENT */}
      <span className={styles.buttonContent}>
        {children}
      </span>
      
      {/* 🌀 LOADING SPINNER */}
      {isLoading && (
        <span className={styles.loadingSpinner} aria-hidden="true">
          <span className={styles.spinnerDot}></span>
          <span className={styles.spinnerDot}></span>
          <span className={styles.spinnerDot}></span>
        </span>
      )}
      
      {/* 👁️ SCREEN READER LOADING TEXT */}
      {isLoading && (
        <span className={styles.srOnly}>
          {loadingText}
        </span>
      )}
    </button>
  );
});

// Display name for React DevTools
SubmitButton.displayName = 'SubmitButton';

export default SubmitButton;