// 📁 frontend/src/utils/validation/types/validationTypes.ts

/* 🌟 ===============================
   🏷️ GENERIC VALIDATION TYPES
   Single source of truth for validation contracts
   Used by useFieldValidation and all domain-specific adapters
   =============================== 🌟 */

/**
 * 🎯 Result of validating a SINGLE field
 * Generic, reusable across any form
 * @template TValue - Type of the field value being validated
 */
export type FieldValidationResultType<TValue = unknown> = {
  /** ✅ Whether the field passes validation */
  isValid: boolean;
  /** 📦 Original value that was validated - ALWAYS present */
  validatedData: TValue;
  /** ❌ Error message if validation fails - only present when isValid === false */
  error?: string;
};

/**
 * 🎯 Result of validating an ENTIRE form
 * Generic, reusable across any form
 * @template TFormShape - Shape of the form data object
 */
export type FormValidationResultType<TFormShape extends Record<string, unknown>> = {
  /** ✅ Whether the entire form passes validation */
  isValid: boolean;
  /** 📦 Validated and type-safe form data - ONLY present on success */
  validatedData?: TFormShape;
  /** ❌ Field-level errors keyed by field name */
  errors: Partial<Record<keyof TFormShape, string>>;
  /** ❌ Global form-level error message */
  formError?: string;
};

/**
 * 🎯 Configuration options for validation hooks
 * Controls validation behavior
 */
export type ValidationOptionsType = {
  /** 🔍 Only validate fields that have been touched */
  validateOnlyTouched?: boolean;
  /** ⏹️ Stop validation on first error (useful for performance) */
  stopOnFirstError?: boolean;
};