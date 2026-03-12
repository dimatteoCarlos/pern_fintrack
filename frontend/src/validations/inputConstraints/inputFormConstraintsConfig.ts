//📦 frontend/src/validations/inputConstraints/inputFormonstraintsConfig.ts
// =================================
// 📝 CONSTRAINTS CONFIGURATION - Form-specific rules
// =================================

import { ConstraintConfigType } from './inputConstraintsTypes';
import { NAME_MAX_LENGTHS } from './nameMaxLengths';

// =================================
// 📋 DEFAULT CONSTRAINTS - Base rules for common fields
// =================================

/**
 * Default constraints that can be reused across forms
 */
export const formDefaultConstraints: ConstraintConfigType = {
  /** Account name field (used in NewAccount, EditAccount) */
  account_name: {
    maxLength: NAME_MAX_LENGTHS.account_name,
    allowedRegex: /^[a-zA-Z0-9/s.-]$/,
    messages: {
      invalidChars: 'Only letters, numbers, spaces, dots and hyphens allowed',
      tooLong: `Maximum ${NAME_MAX_LENGTHS.account_name} characters allowed`,
    },
  },
  
  /** Note/description field */
  note: {
    maxLength: NAME_MAX_LENGTHS.note,
    allowedRegex: /^[/w/s.,-]$/,
    messages: {
      invalidChars: 'Only letters, numbers, spaces and . , - allowed',
      tooLong: `Maximum ${NAME_MAX_LENGTHS.note} characters`,
    },
  },
  
  /** Generic name field (fallback) */
  name: {
    maxLength: NAME_MAX_LENGTHS.default,
    allowedRegex: /^[a-zA-Z0-9/s.-]$/,
    messages: {
      invalidChars: 'Only letters, numbers, spaces, dots and hyphens allowed',
      tooLong: `Maximum ${NAME_MAX_LENGTHS.default} characters`,
    },
  },
};

// =================================
// 📋 ACCOUNT CONSTRAINTS - Forms: NewAccount, EditAccount
// =================================

/**
 * Constraints for account-related forms
 */
export const accountConstraints: ConstraintConfigType = {
  /** Account name field */
  account_name: { ...formDefaultConstraints.account_name },
  
  /** Note/description field */
  note: { ...formDefaultConstraints.note },
};

// =================================
// 📋 CATEGORY CONSTRAINTS - Form: NewCategory
// =================================

/**
 * Constraints for category forms
 */
export const categoryConstraints: ConstraintConfigType = {
  /** Category name field */
  category_name: {
    maxLength: NAME_MAX_LENGTHS.category_name,
    allowedRegex: /^[a-zA-Z0-9/s-]$/,
    messages: {
      invalidChars: 'Only letters, numbers, spaces and hyphens allowed',
      tooLong: `Maximum ${NAME_MAX_LENGTHS.category_name} characters`,
    },
  },
  
  /** Note/description field */
  note: { ...formDefaultConstraints.note },
};

// =================================
// 📋 POCKET CONSTRAINTS - Form: NewPocket
// =================================

/**
 * Constraints for pocket forms
 */
export const pocketConstraints: ConstraintConfigType = {
  /** Pocket name field */
  pocket_name: {
    maxLength: NAME_MAX_LENGTHS.pocket_name,
    allowedRegex: /^[a-zA-Z0-9/s.-]$/,
    messages: {
      invalidChars: 'Only letters, numbers, spaces, dots and hyphens allowed',
      tooLong: `Maximum ${NAME_MAX_LENGTHS.pocket_name} characters`,
    },
  },
  
  /** Note/description field */
  note: { ...formDefaultConstraints.note },
};

// =================================
// 📋 PROFILE CONSTRAINTS - Form: NewProfile
// =================================

/**
 * Constraints for debtor/profile forms
 */
export const profileConstraints: ConstraintConfigType = {
  /** Debtor first name */
  debtor_name: {
    maxLength: NAME_MAX_LENGTHS.debtor_name,
    allowedRegex: /^[a-zA-Z/s]$/,
    messages: {
      invalidChars: 'Only letters and spaces allowed',
      tooLong: `Maximum ${NAME_MAX_LENGTHS.debtor_name} characters`,
    },
  },
  
  /** Debtor last name */
  debtor_lastname: {
    maxLength: NAME_MAX_LENGTHS.debtor_lastname,
    allowedRegex: /^[a-zA-Z/s]$/,
    messages: {
      invalidChars: 'Only letters and spaces allowed',
      tooLong: `Maximum ${NAME_MAX_LENGTHS.debtor_lastname} characters`,
    },
  },
  
  /** Note/description field */
  note: { ...formDefaultConstraints.note },
};