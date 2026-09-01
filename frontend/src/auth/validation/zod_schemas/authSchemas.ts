// 📁 frontend/src/auth/validation/zod_schemas/authSchemas.ts

/* ===============================
   🔐 AUTH SCHEMAS - Zod validation for SignIn/SignUp
   Reuses FIELD_LIMITS from constants for consistency with backend
   =============================== */

import { z } from 'zod';
import { FIELD_LIMITS } from './constants';

/**
 * Password composition rules. They belong to the forms that write the value,
 * sign-up here and the password change form on its own schema, never to signing
 * in, where the value is only compared.
 */
const passwordField = z.string()
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
  );

/**
 * Base schema for the SignUp form
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

  password: passwordField,
});

/**
 * Sign In schema - one identity and a password.
 *
 * The identity is not validated as an email: it is whichever of the two the
 * user remembers, and the backend picks the column from the string. Validating
 * the format here would reject a perfectly good username.
 */
export const signInSchema = z.object({
  identity: z.string()
    .min(1, { message: `${FIELD_LIMITS.IDENTITY.name} is required` })
    .max(FIELD_LIMITS.IDENTITY.MAX, {
      message: `${FIELD_LIMITS.IDENTITY.name} cannot exceed ${FIELD_LIMITS.IDENTITY.MAX} characters`
    })
    .refine(
      (val) => val.trim().length > 0,
      { message: `${FIELD_LIMITS.IDENTITY.name} cannot be empty or just whitespace` }
    )
    .refine(
      (val) => !val.includes('<') && !val.includes('>'),
      { message: `${FIELD_LIMITS.IDENTITY.name} cannot contain < or > characters` }
    ),

  // Presence and the bcrypt ceiling only, mirroring the backend sign-in schema:
  // a stored hash cannot be measured, so a minimum here would lock out the owner
  // of an older password on the one screen where it can be changed.
  password: z.string()
    .min(1, { message: `${FIELD_LIMITS.PASSWORD.name} is required` })
    .max(FIELD_LIMITS.PASSWORD.MAX, {
      message: `${FIELD_LIMITS.PASSWORD.name} cannot exceed ${FIELD_LIMITS.PASSWORD.MAX} characters`
    }),
});
//---------------------------------
/**
 * Sign Up schema - extends base with:
 * - firstname (required)
 * - lastname (required)
 * - confirmPassword (must match password)
 */
export const signUpSchema = (
baseAuthSchema.extend({
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
)
.superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: "custom",
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });
  }

});

// Type inference for TypeScript
export type SignInFormDataType = z.infer<typeof signInSchema>;

export type SignUpFormDataType = z.infer<typeof signUpSchema>;

// Default export with both schemas
export default {
 signInSchema,
 signUpSchema,
};

