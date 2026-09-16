//📦 frontend/src/validations/inputConstraints/nameMaxLengths.ts

// ==================================
// 📏 NAME MAX LENGTHS - Centralized length configurations
// ==================================

/**
 * Maximum lengths for different field types
 */
export const NAME_MAX_LENGTHS = {
  /** Category name (30 chars - the input's own visible width at the
   * narrowest supported breakpoint, NewCategory.tsx's `.input__container`;
   * the category_budget_accounts column allows up to 50, but capping to a
   * number nobody can see defeats the point of a max length. Raised
   * 2026-09-16: 11 silently truncated 'Transportation' to 'transportat',
   * confirmed live via docs/VIDEO/promo-30s/data/seed-demo-account.js. */
  category_name: 30,
  /** Subcategory name (25 chars - the category_budget_accounts column's own
   * VARCHAR(25) ceiling, itself well under what the input can display, so
   * the DB is the binding limit here rather than visible width). Raised
   * 2026-09-16, same incident as category_name above. */
  subcategory: 25,
  /** Note/description field (155 chars, matching the server) */
  note: 155,
  /** Account name (28 chars) */
  account_name: 28,
  /** Pocket name (50 chars, matching the server) */
  pocket_name: 50,
  /** Debtor first name ( chars) */
  debtor_name: 13,
  /** Debtor last name ( chars) */
  debtor_lastname: 14,
  /** Nature type name (5 chars) */
  nature_type_name: 5,
  /** Default fallback (28 chars) */
  default: 30,
} as const;

/**
 * Type derived from NAME_MAX_LENGTHS
 */
export type NameFieldType = keyof typeof NAME_MAX_LENGTHS;