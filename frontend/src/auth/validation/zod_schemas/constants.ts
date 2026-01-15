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


