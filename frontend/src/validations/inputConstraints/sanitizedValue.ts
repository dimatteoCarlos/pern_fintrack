//frontend/src/validations/inputConstraints/sanitizedValue.ts

/**
 * 📏 sanitizeValue.ts
 * 
 * Sanitizes input text based on constraint rules.
 * Used for real-time input filtering and final form sanitization.
*/

import { FieldConstraintRulesType } from "./inputConstraintsTypes";

/**
 * Result of sanitization operation
 */
export type SanitizeResultType = {
  /** The sanitized text after applying rules */
  sanitized: string;
  /** Whether any characters were removed during sanitization */
  isCharactersRemoved: boolean;
  /** Original length before sanitization */
  originalLength: number;
 /* Final length after sanitization */
  finalLength: number;
 //Array of removed characters
 removedChars:string[];
 //positions from where removed
 removedPositions: number[]; 
};

/**
 * Sanitizes a string value based on constraint rules
 * 
 * @param value - Original input string
 * @param rules - Constraint rules to apply
 * @returns Sanitization result with metadata
 * 
 * @example
 * const rules = { maxLength: 5, allowedRegex: /[a-z]/ };
 * const result = sanitizeValue("hello123", rules);
 * // result = { sanitized: "hello", isCharactersRemoved: true, originalLength: 8, finalLength: 5 }
 */
export function sanitizeValue(
  value: string,
  rules: FieldConstraintRulesType
): SanitizeResultType {
// Guard against undefined/null values
  if (!value) {
    return {
      sanitized: '',
      isCharactersRemoved: false,
      originalLength: 0,
      finalLength: 0,
      removedChars: [],
      removedPositions: [],
    };
  }

  let sanitized = value;
  let isCharactersRemoved = false;
  const originalLength = value.length;

  const removedChars: string[] = [];
  const removedPositions: number[] = [];

 //tracking by char
 for (let i=0; i<value.length;i++){
  const char = value[i];

  const isCharValid = !rules.allowedRegex || rules.allowedRegex.test(char);
  const withinLength = !rules.maxLength || sanitized.length<rules.maxLength;

  if(isCharValid && withinLength){
   sanitized +=char;
   
  } else {
   isCharactersRemoved=true;
   removedChars.push(char);
   removedPositions.push(i);
  }
 }

/**
  // Step 1: Apply regex filter if defined
  let removedCharsList: string[] = [];

  if (rules.allowedRegex) {
   //get non valid chars by filtering
   const removedByRegex = value
      .split('')
      .filter((char) => !rules.allowedRegex!.test(char)); 

     removedCharsList = [...removedByRegex];

   //filtering valid chars
    const filtered = value
      .split('')
      .filter((char) => rules.allowedRegex!.test(char))
      .join('');

    if (filtered !== value) {
      isCharactersRemoved = true;
      sanitized = filtered;
    }
  }

  // Step 2: Apply maxLength if defined
  if (rules.maxLength && sanitized.length > rules.maxLength) {
    const truncatedPart = sanitized.slice(rules.maxLength);

    removedCharsList = [...removedCharsList, ...truncatedPart.split('')];
    sanitized = sanitized.slice(0, rules.maxLength);
    isCharactersRemoved = true;
  }
 **/

  return {
    sanitized,
    isCharactersRemoved,
    originalLength,
    finalLength: sanitized.length,

    removedChars,
    removedPositions,

  };
}

/**
 * Helper to check if a value needs sanitization
 * 
 * @param value - Value to check
 * @param rules - Rules to apply
 * @returns True if sanitization would change the value
 */
export function needsSanitization(
  value: string,
  rules: FieldConstraintRulesType
): boolean {
  const { sanitized } = sanitizeValue(value, rules);
  return sanitized !== value;
}

/**
 * Quick sanitize without result metadata (for simple cases)
 * 
 * @param value - Value to sanitize
 * @param rules - Rules to apply
 * @returns Sanitized string only
 */
export function quickSanitize(
  value: string,
  rules: FieldConstraintRulesType
): string {
  return sanitizeValue(value, rules).sanitized;
}


/**
// En ConstraintFeedback.tsx
const result = sanitizeValue(value, rules);

if (result.charactersRemoved) {
  return (
    <div className="constraint-feedback">
      <span className="warning">
        ⚠ Removed characters: {result.removedChars.join(', ')}
      </span>
      <span className="positions">
        at positions: {result.removedPositions.join(', ')}
      </span>
    </div>
  );
}
 */
