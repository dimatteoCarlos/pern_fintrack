//frontend/src/auth/auth_utils/safeMergeUser.ts
import { UserDataType } from "../types/authTypes";

// ===============================
// 🛠️ Utils: Safe User Merge
// ===============================
/**
 * Safely merges partial user data from backend with existing user data
 * Prevents loss of fields when backend omits certain properties
 * 
 * @param newUser - Partial user data from backend response
 * @returns Merged user data with all fields preserved
 * @throws Error if newUser is missing
 */
export const safeMergeUser = ( 
 current: UserDataType | null,
 newUser: Partial<UserDataType>): UserDataType => {
  
  if (!newUser) {
    throw new Error("Invalid server response - Missing user data");
  }

  // Filter out undefined values to avoid overwriting with undefined
  const cleaned = Object.fromEntries(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(newUser).filter(([_, value]) => value !== undefined)
  ) as Partial<UserDataType>;

  // Merge with current data, preserving existing values for missing fields
  return {
   user_id: cleaned.user_id ?? current?.user_id ?? '',

   username: cleaned.username ?? current?.username ?? '',

   email: cleaned.email ?? current?.email ?? '',

   role: cleaned.role ?? current?.role ?? 'user',

   currency: cleaned.currency ?? current?.currency ?? 'usd',

   contact: cleaned.contact ?? current?.contact ?? null,

   user_firstname: cleaned.user_firstname ?? current?.user_firstname ?? '',

   user_lastname: cleaned.user_lastname ?? current?.user_lastname ?? '',
  };
};