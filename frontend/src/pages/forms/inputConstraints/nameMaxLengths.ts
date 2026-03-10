//📁frontend/src/pages/forms/inputConstraints/nameMaxLengths.ts

// 📏 Longitudes máximas por tipo de campo (centralizado)
export const NAME_MAX_LENGTHS = {
  category_name: 10,
  subcategory: 10,
  note: 90,
  account_name: 28,
  debtor_name: 10,
  debtor_lastname: 10,
  nature_type_name: 5,
  default: 28,
} as const;

// Tipo derivado para usar en otras partes
export type NameFieldType = keyof typeof NAME_MAX_LENGTHS;