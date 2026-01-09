// backend/src/utils/validation/zod/userSchemas.js
// 🎯 ZOD SCHEMAS FOR USER OPERATIONS (UPDATE PROFILE & PASSWORD CHANGE)
// All validations based on ACTUAL database schema limits
import { z } from 'zod';
// ======================================
// 🔤 CONSTANTS BASED ON DATABASE SCHEMA
// ======================================
const FIELD_LIMITS = {
  FIRSTNAME:{MAX:25,MIN:1, name:'First name'},  // user_firstname VARCHAR(25)
  LASTNAME:{MAX: 25,MIN:1, name:'Last name'},   // user_lastname VARCHAR(25)
  CONTACT:{MAX: 25,MIN:1, name:'Contact'},    // user_contact VARCHAR(25)
  PASSWORD:{ MAX:72,MIN:4, name:'Password'},//8 is the Minimum securityRequirement and Maximum by Bcrypt practical limit
};

// ============================================
// 🧼 UTILITY FUNCTIONS FOR SANITIZATION
// ============================================
/**
 * Basic sanitization to prevent XSS
 * Removes < and > characters, trims whitespace
 */
export const sanitizeText = (text) => {
  return text.replace(/[<>]/g, '').trim();
};

// =======================================
// 📝 INDIVIDUAL FIELD SCHEMAS (REUSABLE)
// =======================================
/**
 * Creates a schema for text fields with consistent validation
 * @param {Object} field - Field configuration {MAX, MIN, name}
 * @returns {z.ZodString} Zod schema for the field
 */

// =========================
// 📝 CURRENCY FIELD SCHEMA
// =========================
/**
 * Normalizes currency code to lowercase
 */

export const currencySchema = z.enum(['usd', 'cop', 'eur'], {
  errorMap: (issue, ctx) => {
    if (issue.code === 'invalid_enum_value') {
      return {
        message: `Currency "${issue.received}" is not supported. Available options: usd, cop, eur`
      };
    }
    return { message: ctx.defaultError };
  }
})
.default('usd'); // ✅ required with default value

// =======================================
// 📝 INDIVIDUAL FIELD SCHEMAS (REUSABLE)
// =======================================
const individualFieldSchema = (field)=>
 z.string()
 .min(1,{message:`${field.name} is required`})
 .min(field.MIN,{
  message:`${field.name} must be at least ${field.MIN} character${field.MIN === 1 ? '' : 's'}`
 })
 .max(field['MAX'],{
  message:`${field.name} cannot exceed ${field.MAX} characters`})
 .refine(val=>!val.includes('<') && !val.includes('>'), {message: `${field.name} cannot contain < or > characters`})
 // .refine(val => val.trim() === val, {
 //   message: `${field.name} cannot have spaces at the beginning or end`
 // })
 // .refine(val => val.length > 0, {
 //  message: `${field.name} cannot be empty`
 //  });

// FIRSTNAME SCHEMA
const firstNameSchema=individualFieldSchema(FIELD_LIMITS.FIRSTNAME);

// LASTNAME SCHEMA
const lastNameSchema = individualFieldSchema(FIELD_LIMITS.LASTNAME);

// CONTACT SCHEMA (OPTIONAL)
const contactSchema = z.string()
  .max(FIELD_LIMITS.CONTACT.MAX, { 
    message: `Contact cannot exceed ${FIELD_LIMITS.CONTACT.MAX} characters` 
  })
  .optional()
  .nullable()
  .transform(val => {
    if (!val) return null;
    const sanitized = sanitizeText(val);
    return sanitized.length > 0 ? sanitized : null;
  });

// ==========================
// 🎯 UPDATE PROFILE SCHEMA
// ==========================
export const updateProfileSchema = z.object({
  firstname: firstNameSchema.optional(),
  lastname: lastNameSchema.optional(),
  contact: contactSchema,
  currency: currencySchema.optional()
})
// Validate that at least one field is provided
.refine(
  (data) => {
    return Object.values(data).some(val => 
      val !== undefined && val !== null && val !== ''
    );
  },
  {
    message: "At least one field must be provided for update",
    path: []
  }
);

// ==========================
// 🔐 PASSWORD CHANGE SCHEMA
// ==========================
export const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, { message: "Current password is required" }),
    
  newPassword: z.string()
    .min(FIELD_LIMITS.PASSWORD.MIN, { 
      message: `New password must be at least ${FIELD_LIMITS.PASSWORD.MIN} characters` 
    })
    .max(FIELD_LIMITS.PASSWORD.MAX, {
      message: `Password cannot exceed ${FIELD_LIMITS.PASSWORD.MAX} characters`
    })
    .refine(
      (password) => password.trim().length > 0,
      { message: "New password cannot be empty or just whitespace" }
    ),
    
  confirmPassword: z.string()
    .min(1, { message: "Please confirm your new password" })
})
// Validate that new password and confirmation match
.refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"]
  }
)
// Validate that new password is different from current
//data es el valor que Zod ya parseó/validó hasta ese punto y que le pasa a tu función de refinamiento
.refine(
  (data) => data.currentPassword.trim() !== data.newPassword.trim(),
  {
    message: "New password cannot be the same as current password",
    path: ["newPassword"]
  }
)
// Validate no leading/trailing spaces in new password
.refine(
  (data) => data.newPassword.trim() === data.newPassword,
  {
    message: "New password cannot have spaces at the beginning or end",
    path: ["newPassword"]
  }
);

// ============================================
// 🏷️ TYPE INFERENCE FOR TYPESCRIPT (FRONTEND)
// ============================================
// If using TypeScript, these types are automatically inferred:
// export type UpdateProfileInputType = z.infer<typeof updateProfileSchema>;
// export type ChangePasswordInputType = z.infer<typeof changePasswordSchema>;

// =======================
// 📦 EXPORT ALL SCHEMAS
// =======================
export default {
// Main schemas for endpoints
  updateProfileSchema,
  changePasswordSchema,

// Individual schemas for potential reuse
  firstNameSchema,
  lastNameSchema,
  contactSchema,
  currencySchema,

// TypeScript types (for frontend)
  // UpdateProfileInput,
  // ChangePasswordInput,
  // CurrencyType
};
