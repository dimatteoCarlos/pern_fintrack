// 📁 frontend/src/components/common/LoadingSpinner/LoadingSpinner.tsx

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import React from 'react';
import styles from './styles/loadingSpinner.module.css';

/* 🌟 ============================
🏷️ TYPE DEFINITIONS
============================= 🌟 */
/**
 * 📝 Loading spinner props
 */
type LoadingSpinnerProps = {
  /** 🎨 Size of the spinner in pixels */
  size?: number;
  
  /** 🎨 Color of the spinner */
  color?: string;
  
  /** 🎨 Additional CSS class names */
  className?: string;
  
  /** 🎯 Accessible label for screen readers */
  label?: string;
};

/* 🌟 ===============================
🎭 COMPONENT: LoadingSpinner
=============================== 🌟 */

/**
 * 🎯 REUSABLE LOADING SPINNER COMPONENT
 * 
 * 📌 DESIGN PRINCIPLES:
 * 1. 🎨 PURE CSS: No external dependencies, lightweight
 * 2. ♿ ACCESSIBLE: Proper ARIA attributes for screen readers
 * 3. 🔧 CUSTOMIZABLE: Size, color, and styling options
 * 4. ⚡ PERFORMANT: Minimal DOM elements and animations
 * 5. 🎯 RESPONSIVE: Scales appropriately with parent container
 * 
 * 🎯 USE CASES:
 * - API loading states
 * - Form submission loading
 * - Content loading placeholders
 * - Button loading states
 * 
 * @param props - Component configuration options
 * @returns An animated loading spinner with accessibility support
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  color = '#3498db',
  className = '',
  label = 'Loading...'
}) => {
  /* 🌟 ===============================
  🎨 COMPUTED STYLES
  =============================== 🌟 */
  
  /**
   * 🎨 Spinner container styles
   */
  const containerStyle: React.CSSProperties = {
    width: size,
    height: size
  };
  
  /**
   * 🎨 Spinner element styles
   */
  const spinnerStyle: React.CSSProperties = {
    borderColor: color,
    borderTopColor: 'transparent',
    width: size,
    height: size,
    borderWidth: Math.max(2, Math.floor(size / 10))
  };
  
  /* 🌟 ===============================
  🎨 RENDER - THE SPINNER UI
  =============================== 🌟 */
  
  return (
    <div 
      className={`${styles.spinnerContainer} ${className}`}
      style={containerStyle}
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
    >
      {/* 🌀 ANIMATED SPINNER */}
      <div 
        className={styles.spinner}
        style={spinnerStyle}
        aria-hidden="true"
      />
      
      {/* 📝 SCREEN READER ONLY TEXT */}
      <span className={styles.srOnly}>
        {label}
      </span>
    </div>
  );
};

export default LoadingSpinner;