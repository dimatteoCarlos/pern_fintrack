//📦 frontend/src/validations/inputConstraints/inputConstraintsTypes.ts
// ===================================
// 🎯 TYPES - Input Constraints System
// ===================================
/**
 * Supported input types for constraints
 */
export type FieldInputTypeType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'date'
  | 'select';

/**
 * Constraint rules for a single field
 */
export type FieldConstraintRulesType = {
  /** Maximum allowed characters */
  maxLength?: number;
  /** Regular expression for allowed characters */
  allowedRegex?: RegExp;
  /** Custom sanitization function */
  sanitize?: (value: string) => string;
  /** Error messages for different constraint violations */
  messages?: {
    /** Message shown when invalid characters are removed */
    invalidChars?: string;
    /** Message shown when maxLength is exceeded */
    tooLong?: string;
  };
};

/**
 * Configuration map for all fields in a form
 */
export type ConstraintConfigType = Record<string, FieldConstraintRulesType>;

/**
 * Field error with type information
 */
export type FieldErrorType = {
  /** Error message to display */
  message: string;
  /** Error type: constraint (from sanitization) or validation (from business rules) */
  type: 'constraint' | 'validation';
};

/**
 * Form errors map
 */
export type FormErrorsType = Record<string, FieldErrorType | undefined>;
