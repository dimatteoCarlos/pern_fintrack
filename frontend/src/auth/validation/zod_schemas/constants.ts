//frontend/src/auth/validation/zod/constants.ts
// ============================
// 🔤 CONSTANTS BASED ON DATABASE SCHEMA
//replicated from backend
// ============================
export type FieldLimitType={
 MAX: number;
 MIN: number;
 name: string;
};

export type UserFieldsType = 'FIRSTNAME' | 'LASTNAME' | 'CONTACT' | 'PASSWORD';

export const FIELD_LIMITS:
// Partial<
Record<UserFieldsType,FieldLimitType>
// >
 = {
  FIRSTNAME:{MAX:25,MIN:1, name:'First name'},  // user_firstname VARCHAR(25)
  LASTNAME:{MAX: 25,MIN:1, name:'Last name'},   // user_lastname VARCHAR(25)
  CONTACT:{MAX: 25,MIN:1, name:'Contact'},    // user_contact VARCHAR(25)
  PASSWORD:{ MAX:72,MIN:4, name:'Password'},//8 is the Minimum securityRequirement and Maximum by Bcrypt practical limit
};

//REUSABLE VALIDATION MESSAGES
export const VALIDATION_MESSAGES = {
  REQUIRED: (field: string) => `${field} is required`,
  
  MIN_LENGTH: (field: string, min: number) => 
    `${field} must be at least ${min} character${min === 1 ? '' : 's'}`,
  
  MAX_LENGTH: (field: string, max: number) => 
    `${field} cannot exceed ${max} characters`,
  
  NO_HTML: (field: string) => `${field} cannot contain < or > characters`,
  
  NO_WHITESPACE: (field: string) => `${field} cannot be empty or just whitespace`,
  
  NO_LEADING_TRAILING: (field: string) => `${field} cannot start or end with spaces`,
  
  INVALID_EMAIL: "Invalid email address",
  
  PASSWORDS_MATCH: "Passwords do not match",
  
} as const;



