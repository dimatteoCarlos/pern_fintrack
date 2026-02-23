// 📁 frontend/src/auth/validation/zod_schemas/authSchemas.ts

/* ===============================
   🔐 AUTH SCHEMAS - Zod validation for SignIn/SignUp
   Reuses FIELD_LIMITS from constants for consistency with backend
   =============================== */

import { z } from 'zod';
import { FIELD_LIMITS } from './constants';

/**
 * Base schema for common fields shared between SignIn and SignUp
 * Includes:
 * - username (required)
 * - email (valid format)
 * - password (min/max, no whitespace, no HTML)
 */
const baseAuthSchema = z.object({
  username: z.string()
    .min(1, { message: 'Username is required' })
    .max(FIELD_LIMITS.FIRSTNAME.MAX, { 
      message: `Username cannot exceed ${FIELD_LIMITS.FIRSTNAME.MAX} characters` 
    })
    .refine(
      (val) => val.trim().length > 0,
      { message: 'Username cannot be empty or just whitespace' }
    )
    .refine(
      (val) => !val.includes('<') && !val.includes('>'),
      { message: 'Username cannot contain < or > characters' }
    ),

  email: z.email({ message: 'Invalid email address' })
    .min(1, { message: 'Email is required' })
    .refine(
      (val) => !val.includes('<') && !val.includes('>'),
      { message: 'Email cannot contain < or > characters' }
    ),

  password: z.string()
    .min(FIELD_LIMITS.PASSWORD.MIN, { 
      message: `Password must be at least ${FIELD_LIMITS.PASSWORD.MIN} characters` 
    })
    .max(FIELD_LIMITS.PASSWORD.MAX, {
      message: `Password cannot exceed ${FIELD_LIMITS.PASSWORD.MAX} characters`
    })
    .refine(
      (val) => val.trim().length > 0,
      { message: 'Password cannot be empty or just whitespace' }
    )
    .refine(
      (val) => val === val.trim(),
      { message: 'Password cannot start or end with spaces' }
    )
    .refine(
      (val) => !val.includes('<') && !val.includes('>'),
      { message: 'Password cannot contain < or > characters' }
    ),
});

/**
 * Sign In schema - exactly the base schema
 * No additional fields needed
 */
export const signInSchema = baseAuthSchema;

/**
 * Sign Up schema - extends base with:
 * - firstname (required)
 * - lastname (required)
 * - confirmPassword (must match password)
 */
export const signUpSchema = baseAuthSchema.extend({
  user_firstname: z.string()
    .min(1, { message: 'First name is required' })
    .max(FIELD_LIMITS.FIRSTNAME.MAX, { 
      message: `First name cannot exceed ${FIELD_LIMITS.FIRSTNAME.MAX} characters` 
    })
    .refine(
      (val) => val.trim().length > 0,
      { message: 'First name cannot be empty or just whitespace' }
    )
    .refine(
      (val) => !val.includes('<') && !val.includes('>'),
      { message: 'First name cannot contain < or > characters' }
    ),

  user_lastname: z.string()
    .min(1, { message: 'Last name is required' })
    .max(FIELD_LIMITS.LASTNAME.MAX, { 
      message: `Last name cannot exceed ${FIELD_LIMITS.LASTNAME.MAX} characters` 
    })
    .refine(
      (val) => val.trim().length > 0,
      { message: 'Last name cannot be empty or just whitespace' }
    )
    .refine(
      (val) => !val.includes('<') && !val.includes('>'),
      { message: 'Last name cannot contain < or > characters' }
    ),

  confirmPassword: z.string()
    .min(1, { message: 'Please confirm your password' }),
})
.refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

// Type inference for TypeScript
export type SignInFormDataType = z.infer<typeof signInSchema>;
export type SignUpFormDataType = z.infer<typeof signUpSchema>;

// Default export with both schemas
export default {
 signInSchema,
 signUpSchema,
};