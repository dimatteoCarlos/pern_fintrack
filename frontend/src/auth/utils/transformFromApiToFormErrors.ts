// 📁 frontend/src/auth/utils/transformFromApiToFormErrors.ts
import { ChangePasswordResultType } from "../types/authTypes.ts";
import { PasswordFormErrorsType } from "../validation/hook/useChangePasswordValidation.ts";

/**
 * Transforma la respuesta del backend al formato de errores que entiende el form
 * @param apiError - Objeto devuelto por handleDomainChangePassword (ChangePasswordResult)
 * @returns PasswordFormErrorsType
 */
export const transformFromApiToFormErrors = (
 apiError: ChangePasswordResultType
): PasswordFormErrorsType<keyof typeof apiError.fieldErrors> => {

 const fieldErrors: PasswordFormErrorsType<string> = {};

 // Manejo de errores específicos por campo
 //What it does: It checks if the key actually belongs to the apiError.fieldErrors object itself, rather than being inherited from its prototype chain.

// Why use .call()? It is a "bulletproof" way to check properties. If the object was created with Object.create(null), it wouldn't have the .hasOwnProperty() method available directly. This ensures the code doesn't crash regardless of how the object was constructed.

// "Check if this specific field exists in the API error response. If it does, take the first error message found for that field and assign it to our local error state. If for some reason there is no message, just leave it as an empty string."

 // if (apiError.fieldErrors) {
 //  for (const key in apiError.fieldErrors) {
 //   if (Object.prototype.hasOwnProperty.call(apiError.fieldErrors, key)) {
 //    fieldErrors[key as keyof typeof apiError.fieldErrors] =
 //      apiError.fieldErrors[key]?.[0] ?? "";
 //   }
 //  }
 // }

 if (apiError.fieldErrors) {
  Object.entries(apiError.fieldErrors).forEach(([key, messages]) => {
  fieldErrors[key] = messages?.[0] ?? "";
});
 }

 return fieldErrors;
};

export default transformFromApiToFormErrors;
