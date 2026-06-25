// ============================================================
// 📦 newCategoryHelper - Utilities for category_budget accounts
// ============================================================
// Purpose:
//   - Parse full account names into category, subcategory, and nature
//   - Build full account name from individual fields (subcategory is required)
//   - Extract unique categories and subcategories from a list of names
// ============================================================

/**
 * Parses a full category_budget account name into its components.
 *
 * Format: "category/subcategory/nature"
 *
 * @param fullName - The full account name (e.g., "Food/Restaurants/Must")
 * @returns Object with category, subcategory, and nature
 *
 * @example
 * parseCategoryAccountName("Food/Restaurants/Must")
 * // { category: "Food", subcategory: "Restaurants", nature: "Must" }
 *
 * @example
 * parseCategoryAccountName("Food/Must")
 * // { category: "Food", subcategory: undefined, nature: "Must" } // Handles legacy data
 */
export const parseCategoryAccountName = (
  fullName: string,
): { category: string; subcategory: string | undefined; nature: string } => {
  if (!fullName || typeof fullName !== 'string') {
    return { category: '', subcategory: undefined, nature: '' };
  }

  const parts = fullName.split('/').map((part) => part.trim());

  if (parts.length === 2) {
    // Legacy format: "category/nature"
    return {
      category: parts[0],
      subcategory: undefined,
      nature: parts[1] || '',
    };
  }

  if (parts.length >= 3) {
    // Standard format: "category/subcategory/nature"
    return {
      category: parts[0],
      subcategory: parts[1] || undefined,
      nature: parts[2] || '',
    };
  }

  return {
    category: parts[0] || '',
    subcategory: undefined,
    nature: '',
  };
};

/**
 * Builds a full account name from individual fields.
 *
 * ⚠️ **Option B:** subcategory is required.
 * If category, subcategory, or nature is empty/whitespace, returns an empty string.
 *
 * @param category - The category name (required)
 * @param subcategory - The subcategory name (required)
 * @param nature - The nature (required)
 * @returns The full account name, or empty string if any field is invalid
 *
 * @example
 * buildCategoryAccountName("Food", "Restaurants", "Must")
 * // "Food/Restaurants/Must"
 *
 * @example
 * buildCategoryAccountName("Food", "", "Must")
 * // "" (empty, because subcategory is required)
 */
export const buildCategoryAccountName = (
  category: string,
  subcategory: string | undefined,
  nature: string,
): string => {
  const trimmedCategory = category?.trim() || '';
  const trimmedSubcategory = subcategory?.trim() || '';
  const trimmedNature = nature?.trim() || '';

  // Option B: subcategory is mandatory. If any is empty, return empty.
  if (!trimmedCategory || !trimmedSubcategory || !trimmedNature) {
    return '';
  }

  return `${trimmedCategory}/${trimmedSubcategory}/${trimmedNature}`;
};

/**
 * Extracts unique categories from a list of full account names.
 *
 * @param fullNames - Array of full account names
 * @returns Sorted array of unique categories
 *
 * @example
 * extractCategories(["Food/Restaurants/Must", "Food/Groceries/Need", "Transport/Gasoline/Must"])
 * // ["Food", "Transport"]
 */
export const extractCategories = (fullNames: string[]): string[] => {
  if (!fullNames || fullNames.length === 0) {
    return [];
  }

  const uniqueCategories = new Set<string>();
  fullNames.forEach((name) => {
    const { category } = parseCategoryAccountName(name);
    if (category) {
      uniqueCategories.add(category);
    }
  });

  return Array.from(uniqueCategories).sort();
};

/**
 * Extracts unique subcategories from a list of full account names.
 * Filters out undefined and empty subcategories.
 *
 * @param fullNames - Array of full account names
 * @returns Sorted array of unique subcategories
 *
 * @example
 * extractSubcategories(["Food/Restaurants/Must", "Food/Groceries/Need", "Transport/Gasoline/Must"])
 * // ["Gasoline", "Groceries", "Restaurants"]
 */
export const extractSubcategories = (fullNames: string[]): string[] => {
  if (!fullNames || fullNames.length === 0) {
    return [];
  }

  const uniqueSubcategories = new Set<string>();
  fullNames.forEach((name) => {
    const { subcategory } = parseCategoryAccountName(name);
    if (subcategory && subcategory.length > 0) {
      uniqueSubcategories.add(subcategory);
    }
  });

  return Array.from(uniqueSubcategories).sort();
};