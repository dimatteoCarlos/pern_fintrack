// src/validations/utils/constants.ts

export const ERROR_MESSAGES = {
// Common field errors
  FIELD_REQUIRED: 'This field is required.',
  INVALID_FORMAT: 'Format number not valid.',
  POSITIVE_NUMBER_REQUIRED: 'Value must be greater than zero.',
  INVALID_NUMBER: "Please enter a valid number.",
  NOTE_MAX_LENGTH: "Note cannot exceed 150 characters.",
   
  INVALID_CHARS: (chars: string) => `Invalid chars: ${chars}.`,
// Add other common messages as needed
  INVALID_DATE: 'Invalid date format.',
  INVALID_SELECTION: 'Please select an option.',

};

// define common patterns reused in other schemas
export const VALID_NUMBER_FORMATS_PATTERNS = [
{pattern:/^\d*\.\d*$/g , message:'US format (decimal point)'},//onlyDotDecimalSep,
{pattern:/^\d*,\d*$/g , message:'EU/LA format (decimal comma)'},//onlyCommaDecimalSep,
{pattern:/^(\d{1,3})*(,\d{1,3})*\.\d*$/g , message:'US format (comma sep for th)'},//commaSepFormat,
{pattern:/^(\d{1,3})*(.\d{1,3})*,\d*$/g , message:'EU format (point sep for th)'},//dotSepFormat,
];

export const INVALID_CHARS_REGEX = /[^0-9.,]/g;