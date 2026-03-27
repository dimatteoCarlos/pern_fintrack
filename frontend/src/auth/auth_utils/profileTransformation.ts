// 📁 frontend/src/auth/utils/profileTransformation.ts

/* 🌟 ===============================
🏷️ IMPORT TYPE DEFINITIONS
=============================== 🌟 */
import { DEFAULT_CURRENCY } from "../../helpers/constants";
import { CurrencyType } from "../../types/types";
import {  UpdateProfileFormDataType, UpdateProfileResponseUserType, UserDataType } from "../types/authTypes";

/**
 * 📝 Form data structure for the profile form
 */
/* 🌟 ===============================
🏷️ TYPE DEFINITIONS (LOCALS)
=============================== 🌟 */
/**
 * 📝 API payload for profile update
 */
export type ProfileApiPayloadType ={
  firstname?: string;
  lastname?: string;
  currency?: CurrencyType;
  contact?: string | null;
}

/* 🌟 ===============================
 🛠️ DATA TRANSFORMATION UTILITIES
=============================== 🌟 */
/**
 * 🔄 Transforms store data to form data
 * Converts: user_firstname → firstname, user_lastname → lastname
 * 
 * @param userData - User data from Zustand store
 * @returns Formatted data for the form
 * 
 * @example
 * const formData = storeToForm(userData);
 * // { firstname: 'John', lastname: 'Doe', ... }
 */
export const storeToForm =(userData:UserDataType | null):UpdateProfileFormDataType=>({
 firstname:userData?.user_firstname || '',
 lastname:userData?.user_lastname || '',
 currency:(userData?.currency?.toLowerCase()  as CurrencyType) || DEFAULT_CURRENCY,
 contact:userData?.contact ?? null,
});

/**
 * 🔄 Transforms form data to API payload
 * Removes empty strings and converts to undefined for API
 * 
 * @param formData - Current form data
 * @returns Clean payload for API (undefined for empty/falsy values)
 * 
 * @example
 * const apiPayload = formToApi(formData);
 * // { firstname: 'John', lastname: 'Doe' } (empty fields omitted)
 */
export const formToApi = (formData: Partial<UpdateProfileFormDataType>): ProfileApiPayloadType => {
  const payload: ProfileApiPayloadType = {};
 // Only include non-empty values
  if (formData.firstname?.trim()) {
    payload.firstname = formData.firstname;
  }

  if (formData.lastname?.trim()) {
    payload.lastname = formData.lastname;
  }

  if (formData.currency) {
    payload.currency = formData.currency;
  }

  if (formData.contact !== undefined) {
  payload.contact =
    formData.contact === '' ? null : formData.contact;
}

  return payload;
};
//---------------------------------------
/**
 * 🔄 Transforms API response to store format
 * Converts API field names to store field names
 * 
 * @param apiData - Response from profile update API
 * @returns Data formatted for Zustand store
 * 
 * @example
 * const storeData = apiToStore(apiResponse.user);
 * // { user_firstname: 'John', user_lastname: 'Doe', ... }
 */
export const apiToStore = (apiData:UpdateProfileResponseUserType):Partial<UserDataType>=> {
  if (!apiData) {
    return {};
  }
  const storeData: Partial<UserDataType> = {};
  // Map API fields to store fields
  if (apiData.user_firstname !== undefined) {
    storeData.user_firstname = apiData.user_firstname;
  }
  if (apiData.user_lastname !== undefined) {
    storeData.user_lastname = apiData.user_lastname;
  }
  if (apiData.currency !== undefined) {
    storeData.currency = apiData.currency;
  }
  if (apiData.user_contact !== undefined) {
    storeData.contact = apiData.user_contact;
  }

  return storeData;
};
//-----------------------------------------
/**
 * 🔄 Creates a clean payload by removing undefined values
 * Useful for API calls that shouldn't send undefined fields
 * 
 * @param payload - Raw payload with potential undefined values
 * @returns Clean object with only defined values
 * 
 * @example
 * const clean = createCleanPayload({ name: 'John', age: undefined });
 * // { name: 'John' }
 */
export const createCleanPayload = <T extends Record<string, unknown>>(
  payload: T
): Partial<T> => {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
};
//-------------------------------------------
/**
 * 🔍 Compares form data to detect changes
 * Returns only the fields that have been modified
 * 
 * @param currentData - Current form data
 * @param originalData - Original form data
 * @returns Object containing only changed fields
 * 
 * @example
 * const changed = getChangedFields(newData, originalData);
 * // { firstname: 'Jane' } (only changed fields)
 */
export const getChangedFields = (
  currentData: UpdateProfileFormDataType,
  originalData: UpdateProfileFormDataType
): Partial<UpdateProfileFormDataType> => {
 type ChangedType = {
  [K in keyof UpdateProfileFormDataType]?: 
   UpdateProfileFormDataType[K] extends string | null 
     ? string | null 
     : UpdateProfileFormDataType[K]
  };

  //Normalization
  const normalize = (val: unknown) => String(val ?? '');
  
  const changed: ChangedType = {};

  (Object.keys(currentData) as Array<keyof UpdateProfileFormDataType>).forEach(key => {
    if (normalize(currentData[key]) !== normalize(originalData[key])) {
    // Type assertion específica
    (changed)[key] = currentData[key];
    }
  });

  return changed as Partial<UpdateProfileFormDataType>;
};
//--------------------------------
/**
 * 🔄 Normalizes currency value to ensure consistency
 * Converts to lowercase and validates against allowed currencies
 * 
 * @param currency - Raw currency value
 * @param defaultCurrency - Fallback value (default: 'usd')
 * @returns Normalized currency value
 * 
 * @example
 * const normalized = normalizeCurrency('USD'); // 'usd'
 */
export const normalizeCurrency = (
  currency: string | undefined | null,
  defaultCurrency: CurrencyType = DEFAULT_CURRENCY
): CurrencyType => {
  if (!currency) {
    return defaultCurrency;
  }

  const normalized = currency.toLowerCase() as CurrencyType;
  
  // Validate against common currency codes
  const validCurrencies: CurrencyType[] = ['usd', 'eur', 'cop'];
  
  return validCurrencies.includes(normalized) ? normalized : defaultCurrency;
};
//-----------------------------------------
/**
 * 📊 Utility to check if form has any data
 * Useful for conditional rendering or validation
 * 
 * @param formData - Form data to check
 * @returns Boolean indicating if form has any non-empty data
 * 
 * @example
 * const hasData = hasFormData(formData); // true/false
 */
export const hasFormData = (formData: UpdateProfileFormDataType): boolean => {
  return Object.values(formData).some(value => {
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
  });
};

// /* 🌟 ===============================
// 🧪 TRANSFORMATION TESTING UTILITIES
// =============================== 🌟 */

// /**
//  * 🧪 Creates mock user data for testing transformations
//  * 
//  * @param overrides - Partial data to override defaults
//  * @returns Complete UserDataType object
//  * 
//  * @example
//  * const mockUser = createMockUserData({ user_firstname: 'Test' });
//  */
// export const createMockUserData = (
//   overrides: Partial<UserDataType> = {}
// ): UserDataType => ({
//   user_id: 1,
//   user_firstname: 'John',
//   user_lastname: 'Doe',
//   email: 'john@example.com',
//   currency: 'USD',
//   contact: '+1234567890',
//   created_at: new Date().toISOString(),
//   updated_at: new Date().toISOString(),
//   is_verified: true,
//   ...overrides
// });

// /**
//  * 🧪 Creates mock API response for testing
//  * 
//  * @param overrides - Partial data to override defaults
//  * @returns Complete API response object
//  * 
//  * @example
//  * const mockApiResponse = createMockApiResponse({ user_firstname: 'Jane' });
//  */
// export const createMockApiResponse = (
//   overrides: Partial<ProfileUpdateResponseType['user']> = {}
// ): ProfileUpdateResponseType => ({
//   success: true,
//   message: 'Profile updated successfully',
//   user: {
//     user_firstname: 'John',
//     user_lastname: 'Doe',
//     currency: 'USD',
//     contact: '+1234567890',
//     ...overrides
//   }
// });

/* 🌟 ===============================
📝 EXPORT ALL UTILITIES
=============================== 🌟 */
export default {
  storeToForm,
  formToApi,
  apiToStore,
  createCleanPayload,
  getChangedFields,
  normalizeCurrency,
  hasFormData,
  // createMockUserData,
  // createMockApiResponse
};
