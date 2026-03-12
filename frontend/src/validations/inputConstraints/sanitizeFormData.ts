//📦frontend/src/validations/inputConstraints/sanitizeFormData.ts

import { getConstraintsForField } from "./defaultInputConstraints";
import { FieldConstraintRulesType } from "./inputConstraintsTypes";
import { sanitizeValue} from "./sanitizedValue";

/**
 * Sanitizes an entire form data object based on constraint rules.
 * Used as final security layer before form submission.
 */

// =======
// TYPES
// =======
//Options for form data sanitization
export type SanitizeFormDataOptionsType = {
 /** 
   * When true: fields without constraints are passed through unchanged.
   * When false: fields without constraints are omitted from result.
   */
  readonly allowUnvalidatedFields?: boolean;

  /** Custom constraints to override defaults */
  readonly customConstraints?: Record<string, Partial<FieldConstraintRulesType>>;

/** When true: returns detailed metadata about which fields were modified */
  readonly isTrackingChanges?: boolean;
};

// Result of form data sanitization
export type SanitizeFormDataResultType<TFormData> = {
/** Sanitized form data with all string fields cleaned */
  readonly sanitizedData: TFormData;

/** Fields that were modified during sanitization (only if trackChanges=true) */
  readonly sanitizedFieldKeys?: Array<keyof TFormData>;

/** Count of fields sanitized (only if trackingChanges=true) */
  totalSanitizedFieldsCount?: number;

/** Whether any field was modified during sanitization */
  readonly hasBeenModified: boolean;
};
//================
// MAIN FUNCTION
//================
/**
 * Sanitizes all string fields in a form data object
 * 
 * @param formData - Original form data object
 * @param options - Sanitization options
 * @returns Sanitized form data with metadata
 * 
 * @example
 * const data = { name: "John@@123", description: "Hello!!!" };
 * const result = sanitizeFormData(data);
 * // result.sanitizedData = { name: "John123", description: "Hello" }
 * // result.wasModified = true
 * // result.modifiedFields = ["name", "description"]
 */

/**
 * Sanitizes all string fields in a form data object
 * 
 * @param formData - Original form data object
 * @param options - Sanitization options
 * @returns Sanitized form data with metadata
 * 
 * @example
 * const data = { name: "John@@123", description: "Hello!!!" };
 * const result = sanitizeFormData(data);
 * // result.sanitizedData = { name: "John123", description: "Hello" }
 * // result.wasModified = true
 * // result.modifiedFields = ["name", "description"]
 */
 
function sanitizeFormData<TFormData extends Record<string,unknown>>(
 formData:TFormData,
 options:SanitizeFormDataOptionsType={}
):SanitizeFormDataResultType<TFormData>  {
// Destructure options with defaults 
 const {
   allowUnvalidatedFields=true,
   customConstraints={},
   isTrackingChanges=true,
  }=options;

// Create a shallow copy to avoid mutating the original
  const sanitizedData = {...formData} as TFormData;//raw form data

// Tracking variables
  const sanitizedFieldKeys:Array<keyof TFormData> = [];
  let totalSanitizedFieldsCount = 0;
  let hasBeenModified=false;
 
//Iterate through all fields in the form data
  for (const fieldName  in sanitizedData){
// Type assertion: typedFieldName is a valid key of TFormData
   const typedFieldName =fieldName as keyof TFormData;   

   const fieldValue= sanitizedData[typedFieldName];

// Skip non-string values (numbers, booleans, dates, null, undefined)
   if(typeof fieldValue!=='string'){continue;}   
   
// Get default constraints for this field
   const defaultFieldRules = getConstraintsForField(fieldName);

// Apply custom constraints if provided
 const mergedFieldRules: FieldConstraintRulesType | undefined = 
  customConstraints[fieldName]
    ? { ...defaultFieldRules, ...customConstraints[fieldName] } as FieldConstraintRulesType
    : defaultFieldRules;

// Case 1: Field has no validation rules
    const hasNoValidationRules = !mergedFieldRules;
   
// Skip if there is no rules for this field and not including unconstrained
  if (hasNoValidationRules) {
   if (allowUnvalidatedFields) {
// Pass through original value unchanged
     sanitizedData[typedFieldName] = fieldValue as TFormData[keyof TFormData];
   }
// If not allowing unvalidated fields, skip this field entirely
    continue;
   }

// Case 2: Field has validation rules - sanitize it
   const fieldSanitizationReport = sanitizeValue(fieldValue, mergedFieldRules);
   
 // Check if the value was modified
    const wasFieldModified = fieldSanitizationReport.sanitized !== fieldValue;
    
    if (wasFieldModified) {
      // Update with sanitized value
      sanitizedData[typedFieldName] = fieldSanitizationReport.sanitized as TFormData[keyof TFormData];
      hasBeenModified = true;

 // Track details if requested
    if (isTrackingChanges) {
     sanitizedFieldKeys.push(typedFieldName);
     totalSanitizedFieldsCount++;
    }
   }
  }
//Return result with or without tracking metadata
  if(isTrackingChanges){
   return{
    sanitizedData,
    hasBeenModified,
    sanitizedFieldKeys,
    totalSanitizedFieldsCount
   };
  }

  return {
   sanitizedData,hasBeenModified
  }
}

export default sanitizeFormData