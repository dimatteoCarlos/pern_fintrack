//📁 src/forms/inputConstraints/defaultConstraints.ts

import { FieldConstraintRulesType } from "./inputConstraintsTypes";
import { NAME_MAX_LENGTHS } from "./nameMaxLengths";

// 🎯 Función helper para obtener maxLength dinámico
const getMaxLength = (fieldName: string): number => {
  // Si el campo existe en NAME_MAX_LENGTHS, usa ese valor
  if (fieldName in NAME_MAX_LENGTHS) {
    return NAME_MAX_LENGTHS[fieldName as keyof typeof NAME_MAX_LENGTHS];
  }
  // Si no, usa el default
  return NAME_MAX_LENGTHS.default;
};

// 🌍 Reglas globales de constraints
export const DEFAULT_CONSTRAINTS: Record<string, FieldConstraintRulesType> = {
 // 📝 Campos de texto (usando NAME_MAX_LENGTHS dinámicamente)
  category_name: {
    maxLength: getMaxLength("category_name"),
    allowedRegex: /^[a-zA-Z0-9\s.,-]+$/,
    showCharCounter: true,
    maxLengthMessage: `Maximum ${getMaxLength("category_name")} characters`,
    invalidCharMessage: "Only letters, numbers, spaces and . , - allowed"
  },
  
  subcategory: {
    maxLength: getMaxLength("subcategory"),
    allowedRegex: /^[a-zA-Z0-9\s.,-]+$/,
    showCharCounter: true,
    maxLengthMessage: `Maximum ${getMaxLength("subcategory")} characters`,
    invalidCharMessage: "Only letters, numbers, spaces and . , - allowed"
  },
  
  note: {
    maxLength: getMaxLength("note"),
    allowedRegex: /^[a-zA-Z0-9\s.,-]+$/,
    showCharCounter: true,
    maxLengthMessage: `Maximum ${getMaxLength("note")} characters`,
    invalidCharMessage: "Only letters, numbers, spaces and . , - allowed"
  },
  
  account_name: {
    maxLength: getMaxLength("account_name"),
    allowedRegex: /^[a-zA-Z0-9\s.,-]+$/,
    showCharCounter: true,
    maxLengthMessage: `Maximum ${getMaxLength("account_name")} characters`,
    invalidCharMessage: "Only letters, numbers, spaces and . , - allowed"
  },
  
  debtor_name: {
    maxLength: getMaxLength("debtor_name"),
    allowedRegex: /^[a-zA-Z\s]+$/, // Solo letras para nombres
    showCharCounter: true,
    maxLengthMessage: `Maximum ${getMaxLength("debtor_name")} characters`,
    invalidCharMessage: "Only letters and spaces allowed"
  },
  
  debtor_lastname: {
    maxLength: getMaxLength("debtor_lastname"),
    allowedRegex: /^[a-zA-Z\s]+$/, // Solo letras para apellidos
    showCharCounter: true,
    maxLengthMessage: `Maximum ${getMaxLength("debtor_lastname")} characters`,
    invalidCharMessage: "Only letters and spaces allowed"
  },
  
  nature_type_name: {
    maxLength: getMaxLength("nature_type_name"),
    allowedRegex: /^[a-zA-Z0-9\s-]+$/, // Permitir guiones para tipos
    showCharCounter: true,
    maxLengthMessage: `Maximum ${getMaxLength("nature_type_name")} characters`,
    invalidCharMessage: "Only letters, numbers, spaces and - allowed"
  },
  
  // 📝 Campos genéricos
  name: {
    maxLength: NAME_MAX_LENGTHS.default,
    allowedRegex: /^[a-zA-Z0-9\s.,-]+$/,
    showCharCounter: true,
    maxLengthMessage: `Maximum ${NAME_MAX_LENGTHS.default} characters`,
    invalidCharMessage: "Invalid characters removed"
  },

  description: {
    maxLength: 200,
    allowedRegex: /^[a-zA-Z0-9\s.,-]+$/,
    showCharCounter: true,
    maxLengthMessage: "Maximum 200 characters",
    invalidCharMessage: "Invalid characters removed"
  },

  // 🔢 Campos numéricos
  amount: {
    allowedRegex: /^[0-9.,]+$/,
    invalidCharMessage: "Only numbers, . and , allowed"
  },

  // 🧾 Otros campos
  username: {
    maxLength: 30,
    allowedRegex: /^[a-zA-Z0-9_]+$/, // Solo letras, números, guión bajo
    showCharCounter: true,
    maxLengthMessage: "Maximum 30 characters",
    invalidCharMessage: "Only letters, numbers and _ allowed"
  },

  bio: {
    maxLength: 500,
    allowedRegex: /^[a-zA-Z0-9\s.,!?-]+$/,
    showCharCounter: true,
    maxLengthMessage: "Maximum 500 characters",
    invalidCharMessage: "Invalid characters removed"
  }
};

// 📤 Helper para obtener constraints de un campo específico
export function getConstraintsForField(fieldName: string): FieldConstraintRulesType | undefined {
  return DEFAULT_CONSTRAINTS[fieldName];
}

// 📤 Helper para verificar si un campo tiene constraints
export function hasConstraints(fieldName: string): boolean {
  return fieldName in DEFAULT_CONSTRAINTS;
}

