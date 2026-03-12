//📦 frontend/src/validations/inputConstraints/nameMaxLengths.ts

// ==================================
// 📏 NAME MAX LENGTHS - Centralized length configurations
// ==================================

/**
 * Maximum lengths for different field types
 */
export const NAME_MAX_LENGTHS = {
  /** Category name (10 chars) */
  category_name: 10,
  /** Subcategory name (10 chars) */
  subcategory: 10,
  /** Note/description field (90 chars) */
  note: 90,
  /** Account name (28 chars) */
  account_name: 28,
  /** Pocket name (28 chars) */
  pocket_name: 28,
  /** Debtor first name (10 chars) */
  debtor_name: 10,
  /** Debtor last name (10 chars) */
  debtor_lastname: 10,
  /** Nature type name (5 chars) */
  nature_type_name: 5,
  /** Default fallback (28 chars) */
  default: 28,
} as const;

/**
 * Type derived from NAME_MAX_LENGTHS
 */
export type NameFieldType = keyof typeof NAME_MAX_LENGTHS;