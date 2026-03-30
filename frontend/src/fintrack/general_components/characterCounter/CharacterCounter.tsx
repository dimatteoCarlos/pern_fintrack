//frontend/src/general_components/characterCounter/CharacterCounter.tsx

// =======================================
// 📊 COMPONENT - Character Counter
// =======================================
//
// Displays a character counter next to input labels.
// Shows current/max characters with color coding:
// - Normal: low opacity white
// - Near limit (80%): yellow/orange
// - At limit: red
//
// @example
// <CharacterCounter value={formData.name} maxLength={50} />
//
// @example
// // When no maxLength is provided, component returns null
// <CharacterCounter value={formData.name} />

// import React from 'react';

// ======================================
// 📦 PROPS TYPE
// ======================================

export type CharacterCounterProps = {
  /** Current value of the input field */
  value: string;
  /** Maximum allowed characters (optional - if not provided, component returns null) */
  maxLength?: number;
  /** Optional custom className for styling overrides */
  className?: string;
};

// ======================================
// 🧮 HELPER FUNCTIONS
// ======================================

/**
 * Counts characters properly (handles Unicode/emojis)
 * Array.from() preserves surrogate pairs, unlike .length
 */
const countCharacters = (str: string): number => {
  return Array.from(str).length;
};

// ======================================
// 🎨 STYLES
// ======================================

const getCounterColor = (current: number, max: number): string => {
  const ratio = current / max;
  
  if (current >= max) {
    return '#ff4d4d'; // Red - at limit
  }
  if (ratio >= 0.8) {
    return '#ffaa00'; // Yellow/Orange - near limit
  }
  if (ratio >= 0.6) {
    return '#dbf26a'; // Yellow/Orange - near limit
  }
  return 'rgba(255,255,255,0.4)'; // Low opacity white - normal
};

const getFontWeight = (current: number, max: number): 'bold' | 'normal' => {
  return current >= max ? 'bold' : 'normal';
};

// ======================================
// 🧩 MAIN COMPONENT
// ======================================

/**
 * CharacterCounter component displays a character count indicator
 * next to input labels. Only renders when maxLength is provided.
 */
const CharacterCounter = ({ 
  value, 
  maxLength,
  className = '',
}: CharacterCounterProps): JSX.Element | null => {
  
  // Don't render if no maxLength is provided
  if (maxLength === undefined) {
    return null;
  }

  const currentLength = countCharacters(value);
  const counterColor = getCounterColor(currentLength, maxLength);
  const fontWeight = getFontWeight(currentLength, maxLength);

  return (
    <span
      className={className}
      style={{
        fontSize: '0.75rem',
        marginLeft: '0.5rem',
        color: counterColor,
        fontWeight,
        transition: 'color 0.2s ease',
      }}
      aria-label={`${currentLength} of ${maxLength} characters`}
      title={`${currentLength} of ${maxLength} characters`}
    >
      {currentLength>0 && `${currentLength}/${maxLength}`}
    </span>
  );
};

export default CharacterCounter;