// 📁 frontend/src/auth/utils/transformFromApiToFormErrors.ts

import { ChangePasswordFormDataType } from "../types/authTypes.ts";
import { ChangePasswordResultType } from "../types/authTypes.ts";
import { PasswordFormErrorsType } from "../validation/hook/useChangePasswordValidation.ts";

/**
 * Transforms a standardized ChangePasswordResultType response
 * into a form-friendly field error map.
 *
 * - Only maps fieldErrors
 * - Global / API messages are handled elsewhere (container)
 * - Validation errors always belong to fields
 */
export const transformFromApiToFormErrors = (
 result: ChangePasswordResultType
): PasswordFormErrorsType<keyof ChangePasswordFormDataType> => {

 const errors: PasswordFormErrorsType<keyof ChangePasswordFormDataType> = {};

 if (!result.fieldErrors) {
  return errors;
 }

 Object.entries(result.fieldErrors).forEach(([field, values]) => {
  if (!values || values.length === 0) {
   return;
  }

  errors[field as keyof ChangePasswordFormDataType] = values[0];
 });

 return errors;
};

export default transformFromApiToFormErrors;
