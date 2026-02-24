//frontend\src\auth\auth_utils\safeMergeUser.ts

import { useAuthStore } from "../stores/useAuthStore";
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
export const safeMergeUser = (newUser: Partial<UserDataType>): UserDataType => {
  const current = useAuthStore.getState().userData;
  
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
   user_id: current?.user_id ?? cleaned.user_id ?? '',
   username: current?.username ?? cleaned.username ?? '',
   user_firstname: current?.user_firstname ?? cleaned.user_firstname ?? '',
   user_lastname: current?.user_lastname ?? cleaned.user_lastname ?? '',
   email: current?.email ?? cleaned.email ?? '',
   currency: current?.currency ?? cleaned.currency ?? 'usd',
   role: current?.role ?? cleaned.role ?? 'user',
   contact: current?.contact ?? cleaned.contact ?? null,
  };
};