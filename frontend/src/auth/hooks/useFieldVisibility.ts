// 📁 frontend/src/auth/hooks/useFieldVisibility.ts

/* 🌟 ===============================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import { useState, useCallback } from "react";

/* 🌟 ===============================
🏷️ TYPE DEFINITIONS
=============================== 🌟 */
/**
* 📝 Password visibility state
* Maps each password field name to a boolean indicating if it's visible
*/
type VisibilityState<T extends PropertyKey> = Record<T, boolean>;

/* 🌟 ===============================
🔄 USE PASSWORD VISIBILITY HOOK
=============================== 🌟 */
/**
* 🎯 Custom hook to manage password field visibility (eye toggle)
* Supports multiple password fields independently
*
* @param fields - Array of field names to initialize toggle functionality
*/
export const useFieldVisibility=<T extends PropertyKey> (fields: T[]) => {
// ------------------------------
// 📋 STATE MANAGEMENT
// ------------------------------
// Initialize all specified fields as hidden (false)
  const [visibility, setVisibility] = useState<VisibilityState<T>>(
    () => fields.reduce((acc, field) => ({ ...acc, [field]: false }), {} as VisibilityState<T>)
  );

// ----------------------------
// 🎮 TOGGLE HANDLER
// ----------------------------
/**
   * 🔄 Toggles visibility for a specific field
   * @param fieldName - Field key to toggle visibility
   */
  const toggleVisibility = useCallback((fieldName: T) => {
    setVisibility((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  }, []);

// ------------------------------
// 🧹 RESET UTILITY
// ------------------------------
/**
* 🧼 Resets all password fields to hidden (false)
* Useful on form reset or unmount
*/
  const resetVisibility = useCallback(() => {
    setVisibility(fields.reduce((acc, field) => ({ ...acc, [field]: false }), {} as VisibilityState<T>));
  }, [fields]);

/* 🌟 ===============================
📤 HOOK RETURN VALUE
================================ 🌟 */
  return {
/* Map of fieldName -> boolean (true if visible) */
  visibility,
/* Function to toggle visibility for a specific field */
  toggleVisibility,
/* Function to reset all fields to hidden */
  resetVisibility,
  };
};

export default useFieldVisibility;
