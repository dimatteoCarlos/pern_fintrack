//📦 frontend/src/validations/inputConstraints/useFormConstraints.ts
// 🎣 useFormConstraints.ts
// 
// Form-level hook that intercepts input changes, applies sanitization rules,
// preserves cursor position, and updates feedback context.
// Listens to both input and change events for maximum coverage.

import { useCallback } from 'react';
import { getConstraintsForField } from './defaultInputConstraints';
import { SanitizeResultType, sanitizeValue } from './sanitizedValue';
// import { FieldConstraintRulesType } from './inputConstraintsTypes';
// import { useConstraintContext } from './ConstraintProvider'; // Will be used in Commit 5

// ================================
// 🛡️ TYPE GUARDS
// ================================
//Type guard to check if an element is an input or textarea
function isInputOrTextareaElement(element:EventTarget | null):element is HTMLInputElement | HTMLTextAreaElement{
if(!element) return false;
const htmlElement = element as HTMLElement;
return htmlElement.tagName === 'INPUT' || htmlElement.tagName === 'TEXTAREA';
}

/**
 * Type guard to check if an event has IME composition support
 */
function hasIMECompositionSupport(event: Event): event is Event & { isComposing: boolean } {
  return 'isComposing' in event;
}

//Type guard to check if an element is a select element
// function isSelectElement(element:EventTarget | null){
//  if (element instanceof HTMLSelectElement) {
//     return element.tagName === 'SELECT'; 
//   }
//   return false;
// }

//============================
// 🎣 HOOK: useFormConstraints
//============================

/**
 * Hook that intercepts form changes, applies input constraints in real-time,
 * preserves cursor position, and updates feedback context.
 * 
 * Attach the returned handler to the form's onInput and onChange events.
 * 
 * @returns Object containing the form input/change handlers
 * 
 * @example
 * const { handleFormInput, handleFormChange } = useFormConstraints();
 * 
 * return (
 *   <form  onInput={handleFormInput}
 *     onChange={handleFormChange}
 *     onSubmit={handleSubmit}
 *     <input name="name" />
 *     <textarea name="description" />
 *   </form>
 * );
 */
export function useFormConstraints() {
// Will be implemented in Commit 5
// const { setFieldFeedback } = useConstraintContext();

//===================
// 🔧 HELPER: sanitizeWithCursorPreservation
//===================
/**
* Applies sanitization result to DOM input while preserving cursor position.
* 
* This function assumes sanitization has already been performed and
* only handles the DOM updates and cursor management.
* 
* @param inputElement - The input element being modified
* @param originalValue - Original value before sanitization
* @param sanitizationResult - Result from sanitizeValue containing cleaned text and metadata
* @param maximumLength - Maximum allowed length (for feedback)
*/
const sanitizeWithCursorPreservation = useCallback((
     inputElement: HTMLInputElement | HTMLTextAreaElement,
     originalValue: string,
     sanitizationResult: SanitizeResultType,
     // maximumLength?: number
  ) => {
// 🚫 Skip cursor operations for number inputs (setSelectionRange crashes in some browsers)
 const isNumberInput = inputElement.type === 'number';
   if (isNumberInput) {
     if (sanitizationResult.sanitized !== originalValue) {
       inputElement.value = sanitizationResult.sanitized;
     }
     return;
   }

 // 1️⃣ Save current cursor position
  const cursorStartPosition = inputElement.selectionStart ?? 0;
  
 // 2️⃣ If no changes, exit early
 if (sanitizationResult.sanitized === originalValue) {
  return;
 }
 // 3️⃣ Update DOM input value
 inputElement.value = sanitizationResult.sanitized;

 // 4️⃣ Calculate cursor offset based on removed characters
 // Count how many removed characters were BEFORE the cursor
 const charactersRemovedBeforeCursor = sanitizationResult.removedPositions.filter(
 removedPosition => removedPosition < cursorStartPosition
 ).length;

 // Calculate new cursor position (cannot be negative)
 const newCursorPosition = Math.max(0, cursorStartPosition - charactersRemovedBeforeCursor);

 // 5️⃣ Restore cursor position
 inputElement.setSelectionRange(newCursorPosition, newCursorPosition);

 // 6️⃣ Update feedback context (will be implemented in Commit 5)
 // setFieldFeedback(inputElement.name, {
 //   characterCount: sanitizationResult.sanitized.length,
 //   maximumLength,
 //   wereCharactersRemoved: sanitizationResult.isCharactersRemoved,
 //   removedCharacters: sanitizationResult.removedChars,
 //   removedPositions: sanitizationResult.removedPositions
 // });
  }, []); // No dependencies as setFieldFeedback would be stable

// =========================================
// 🔧 CORE HANDLER: processInputConstraints
// =========================================
/**
 * Core processing logic shared by both input and change handlers.
 * 
 * @param inputElement - The input element that triggered the event
*/
 const processInputConstraints = useCallback((
    inputElement: HTMLInputElement | HTMLTextAreaElement
  ) => {
    // 1️⃣ Get field name and current value
    const fieldName = inputElement.name;
    const currentFieldValue = inputElement.value;
    
   // 2️⃣ Skip if field has no name (can't apply rules)
    const fieldHasName = Boolean(fieldName);
    if (!fieldHasName) {
      return;
    }
    
    // 3️⃣ Get rules for this field
    const fieldRules = getConstraintsForField(fieldName);
    
    // // 4️⃣ Skip if no rules defined for this field
    // const fieldHasValidationRules = Boolean(fieldRules);
    // if (!fieldHasValidationRules) {
    //   return;
    // }

    // 4️⃣ Skip if no rules defined for this field
    if (!fieldRules) {
    return;
    }
    
    // 5️⃣ Perform sanitization
    const sanitizationResult = sanitizeValue(currentFieldValue, fieldRules);
    
    // 6️⃣ Apply sanitized value to DOM with cursor preservation
    sanitizeWithCursorPreservation(
      inputElement,
      currentFieldValue,
      sanitizationResult,
      // fieldRules.maxLength
    );

// 7️⃣ Event continues - original form handlers receive sanitized value
  }, [sanitizeWithCursorPreservation]);

//====================================
// 🎣 INPUT HANDLER: handleFormInput (captures typing, paste, autofill)
//====================================
/**
* Form-level input handler that captures immediate changes:
 * - Every keystroke
 * - Paste events
 * - Cut events
 * - Drag & drop
 * - Most autofill events
 * - IME composition updates
*/
 const handleFormInput = useCallback((
    event: React.FormEvent<HTMLFormElement>
  ) => {
    // 1️⃣ Skip IME composition events (critical for Asian language support)
    const nativeEvent = event.nativeEvent// as InputEvent;InputEvent does not exist on all browsers and React does not type it right.
    const isImeCompositionInProgress = hasIMECompositionSupport(nativeEvent) 
      ? nativeEvent.isComposing === true 
      : false;
    if (isImeCompositionInProgress) {
      return;
    }
    
    // 2️⃣ Use type guard to check if target is input or textarea
    if (!isInputOrTextareaElement(event.target)) {
      return;
    }
    
    // 3️⃣ Safe to cast now that we've verified the type
    const inputElement = event.target;
    
    // 4️⃣ Process constraints
    processInputConstraints(inputElement);
  }, [processInputConstraints]);

// =======================================
// 🎣 CHANGE HANDLER: handleFormChange (backup for non-input events)
// =======================================
  /**
   * Form-level change handler that captures:
   * - Blur events (when field loses focus)
   * - Enter key submissions
   * - Some browser-specific autofill cases
   * 
   * Acts as a backup for cases not covered by onInput.
   */
  const handleFormChange = useCallback((
    event: React.ChangeEvent<HTMLFormElement>
  ) => {
    // 1️⃣ Skip IME composition events (critical for Asian language support
    const nativeEvent = event.nativeEvent;
    const isImeCompositionInProgress = hasIMECompositionSupport(nativeEvent) 
      ? nativeEvent.isComposing === true 
      : false;
      
    if (isImeCompositionInProgress) {
      return;
    }
    
    // 2️⃣ Use type guard to check if target is input or textarea
    if (!isInputOrTextareaElement(event.target)) {
      return;
    }
    
    // 3️⃣ Safe to cast now that we've verified the type
    const inputElement = event.target;
    
    // 4️⃣ Process constraints
    processInputConstraints(inputElement);
  }, [processInputConstraints]);

//===================
  // 📤 RETURN
//===================
  return {
 /** Attach to form's onInput event for immediate sanitization */
 handleFormInput,
 
 /** Attach to form's onChange event as backup */
 handleFormChange
   };
  }

//==============
// 📦 TYPES
//==============
/**
* Return type of useFormConstraints hook
*/
export type UseFormConstraintsReturn = {
 handleFormInput: (event: React.FormEvent<HTMLFormElement>) => void;

 handleFormChange: (event: React.ChangeEvent<HTMLFormElement>) => void;
};