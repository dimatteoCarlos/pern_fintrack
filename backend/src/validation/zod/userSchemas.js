// backend/src/utils/validation/zod/userSchemas.js
// 🎯 ZOD SCHEMAS FOR USER OPERATIONS (UPDATE PROFILE & PASSWORD CHANGE)
// All validations based on ACTUAL database schema limits
import { z } from 'zod';
import { isIanaTimeZone } from '../../utils/fintrackUtils/date-utils/ianaTimeZone.js';
// ======================================
// 🔤 CONSTANTS BASED ON DATABASE SCHEMA
// ======================================
const FIELD_LIMITS = {
  USERNAME:{MAX:25,MIN:3, name:'Username'},   // username VARCHAR(50), held at 25 until the migration narrows the column
  // No MIN: a length floor on an address is not a rule anyone enforces, and the
  // format check is what decides. The MAX is the column's.
  EMAIL:{MAX:255, name:'Email'},      // email VARCHAR(255)
  FIRSTNAME:{MAX:25,MIN:1, name:'First name'},  // user_firstname VARCHAR(25)
  LASTNAME:{MAX: 25,MIN:1, name:'Last name'},   // user_lastname VARCHAR(25)
  CONTACT:{MAX: 25,MIN:1, name:'Contact'},    // user_contact VARCHAR(25)
  PASSWORD:{ MAX:72,MIN:4, name:'Password'},//8 is the Minimum securityRequirement and Maximum by Bcrypt practical limit
};

// ==================================
// 🧼 UTILITY FUNCTIONS FOR SANITIZATION
// ==================================
/**
 * Basic sanitization to prevent XSS
 * Removes < and > characters, trims whitespace
 */
export const sanitizeText = (text) => {
  return text.replace(/[<>]/g, '').trim();
};

// =================================
// 📝 INDIVIDUAL FIELD SCHEMAS (REUSABLE)
// =================================
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
export const currencySchema = z.enum(['usd', 'cop', 'eur', 'ves', 'mxn'], {
  error: (issue, ctx) => {
    if (issue.code === 'invalid_enum_value') {
      return {
        message: `Currency "${issue.received}" is not supported. Available options: usd, cop, eur, ves, mxn`
      };
    }
    return { message: ctx.defaultError };
  }
})
.optional();

// ==========================
// 🌍 TIME ZONE FIELD SCHEMA
// ==========================
/**
 * The IANA zone the user's calendar is read on. Checked against the same set the
 * database trigger admits, so a wrong value comes back as a 400 and not as the
 * 500 the trigger would raise.
 */
export const timezoneSchema = z.string()
  .refine(isIanaTimeZone, {
    message: 'Time zone must be a valid IANA identifier, for example America/Bogota'
  })
  .optional();

// ======================================
// 📝 INDIVIDUAL FIELD SCHEMAS (REUSABLE)
// ======================================
const individualFieldSchema = (field)=>
 // An absent field would otherwise come back with zod's own type message. Returning
 // undefined for any other issue keeps the checks below in charge of their wording.
 z.string({error:(issue)=> issue.input === undefined ? `${field.name} is required` : undefined})
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
    if (val === undefined) return undefined;

    // ✅ allow explicit null (erase contact)
    if (val === null) return null;

    const sanitized = sanitizeText(val);
    return sanitized.length > 0 ? sanitized : null;
  });

// ==========================
// 🎯 SIGN-UP SCHEMA
// ==========================
/**
 * The server's own copy of the sign-up rules, mirroring the form schema at
 * frontend/src/auth/validation/zod_schemas/authSchemas.ts so a rejection reads the
 * same on either side. It is what holds when the request does not come from the form.
 */
// individualFieldSchema admits a value of only spaces: it passes min(1), and the
// controller then trims it to an empty string on its way to a NOT NULL column.
const requiredNameSchema = (field) =>
 individualFieldSchema(field).refine((val) => val.trim().length > 0, {
  message: `${field.name} cannot be empty or just whitespace`,
 });

export const signUpSchema = z.object({
 username: requiredNameSchema(FIELD_LIMITS.USERNAME),

 // Trimmed before the format check: an address pasted with a trailing space is a
 // valid address, not a 400.
 email: z.string({error:(issue)=> issue.input === undefined ? `${FIELD_LIMITS.EMAIL.name} is required` : undefined})
  .transform((val) => val.trim())
  .pipe(
   z.email({ message: 'Invalid email address' })
    .max(FIELD_LIMITS.EMAIL.MAX, {
     message: `${FIELD_LIMITS.EMAIL.name} cannot exceed ${FIELD_LIMITS.EMAIL.MAX} characters`
    })
  ),

 // Never sanitized and never trimmed: removing a character from a secret changes
 // the credential its owner chose.
 password: z.string({error:(issue)=> issue.input === undefined ? `${FIELD_LIMITS.PASSWORD.name} is required` : undefined})
  .min(FIELD_LIMITS.PASSWORD.MIN, {
   message: `${FIELD_LIMITS.PASSWORD.name} must be at least ${FIELD_LIMITS.PASSWORD.MIN} characters`
  })
  .max(FIELD_LIMITS.PASSWORD.MAX, {
   message: `${FIELD_LIMITS.PASSWORD.name} cannot exceed ${FIELD_LIMITS.PASSWORD.MAX} characters`
  })
  .refine((val) => val === val.trim(), {
   message: `${FIELD_LIMITS.PASSWORD.name} cannot start or end with spaces`
  })
  // The real ceiling is bcrypt's, and bcrypt counts bytes: an accented password can
  // sit under 72 characters and over 72 bytes, and bcrypt would cut it in silence.
  // The first clause yields to the character rule above, so an over-long password
  // is reported once and not twice for the same cause.
  .refine((val) => val.length > FIELD_LIMITS.PASSWORD.MAX
   || Buffer.byteLength(val, 'utf8') <= FIELD_LIMITS.PASSWORD.MAX, {
   message: `${FIELD_LIMITS.PASSWORD.name} cannot exceed ${FIELD_LIMITS.PASSWORD.MAX} bytes`
  }),

 user_firstname: requiredNameSchema(FIELD_LIMITS.FIRSTNAME),
 user_lastname: requiredNameSchema(FIELD_LIMITS.LASTNAME),

 // Both already optional where they are declared: absent means the column default.
 currency: currencySchema,
 timezone: timezoneSchema
});

// ==========================
// 🎯 UPDATE PROFILE SCHEMA
// ==========================
export const updateProfileSchema = z.object({
  firstname: firstNameSchema.optional(),
  lastname: lastNameSchema.optional(),
  contact: contactSchema,
  currency: currencySchema.optional(),
  timezone: timezoneSchema
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
    )
    .refine(
      (val) => val === val.trim(),
      { message: "New password cannot start or end with spaces" }
    )
    .refine(val=>!val.includes('<') && !val.includes('>'), {message: `Passwords cannot contain < or > characters`}),

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

// Tipos automáticos para frontend y backend
// type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
// type SignUpInput = z.infer<typeof signUpSchema>;

// =======================
// 📦 EXPORT ALL SCHEMAS
// =======================
export default {
// Main schemas for endpoints
  signUpSchema,
  updateProfileSchema,
  changePasswordSchema,

// Individual schemas for potential reuse
  firstNameSchema,
  lastNameSchema,
  contactSchema,
  currencySchema,
  timezoneSchema,
};