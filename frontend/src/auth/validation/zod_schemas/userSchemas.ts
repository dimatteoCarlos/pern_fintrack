// frontend/src/auth/validation/zod/userSchemas.ts

import {z} from 'zod';
import { FIELD_LIMITS, FieldLimitType } from './constants';

//Backend zod validation schema replicated
// ===========================
// 🧼 UTILITY FUNCTIONS FOR SANITIZATION
// ===========================
export const sanitizeText = (text:string) => {
 return text.replace(/[<>]/g, '').trim();
};
// =======================
// 📝 INDIVIDUAL FIELD SCHEMAS (REUSABLE)
// =======================
const individualFieldSchema = (field:FieldLimitType)=>
 z.string()
 .min(1,{message:`${field.name} is required`})
 .min(field.MIN,{
  message:`${field.name} must be at least ${field.MIN} character${field.MIN === 1 ? '' : 's'}`
 })
 .max(field['MAX'],{
  message:`${field.name} cannot exceed ${field.MAX} characters`})
 .refine(val=>!val.includes('<') && !val.includes('>'), {message: `${field.name} cannot contain < or > characters`})
//-----------------------
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

   // =========================
   // 📝 CURRENCY FIELD SCHEMA
   // =========================
   /**
    * Normalizes currency code to lowercase
    */
   
   export const currencySchema= z.enum(['usd', 'cop', 'eur'], {
     error: (issue) => {
       if (issue.code === 'invalid_value') {
        return {
         message: `Currency "${issue.received}" is not supported. Available options: usd, cop, eur`
        };
       } 
       return {message:"Invalid currency input"};
     }
   })
   .optional();

// ==========================
// 🎯 UPDATE PROFILE SCHEMA
// ==========================
export const updateProfileSchema = z.object(
{
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
)

// =======================
// 📦 EXPORT ALL SCHEMAS
// =======================
export default {
//Main schemas
 updateProfileSchema,
// changePasswordSchema,

// Individual schemas for potential reuse
 firstNameSchema,
 lastNameSchema,
 contactSchema,
 currencySchema,
}

// =====================
// 🏷️ TYPE INFERENCE
// =====================
export type UpdateProfileSchemaFormDataType =z.infer<typeof updateProfileSchema>;








