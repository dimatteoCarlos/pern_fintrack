//📁frontend/src/types/inputConstraintsTypes.ts

// 🧾 Field Input Types
export type FieldInputType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "date";

// 🧾 Constraint Rules
export type FieldConstraintRulesType = {
  maxLength?: number;
  allowedRegex?: RegExp;
  showCharCounter?: boolean;
  maxLengthMessage?: string;
  invalidCharMessage?: string;
};

// 🧾 Constraint Feedback
export type ConstraintFeedbackType = {
  charCount: number;
  maxLength?: number;
  removedCharacters: boolean;
};  
