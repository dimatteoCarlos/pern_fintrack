import { capitalize } from "../../helpers/functions";

//src/helpers/functions.ts
export function validationData<T extends Record<string, unknown>>(
  stateToValidate: T,
  options?: {
    nonZeroFields?: string[]; // Campos que NO deben ser 0
    optionalFields?: string[]; // Campos opcionales
  }
): Record<keyof T, string> {
  const errorValidationMessages: Partial<Record<keyof T, string>> = {};

  // Campos que NO deben aceptar 0
  const nonZeroFields = options?.nonZeroFields || [];

  for (const key in stateToValidate) {
    const value = stateToValidate[key];
    
    // Validación para valores vacíos/nulos
    if (value === null || value === undefined || value === '') {
      errorValidationMessages[key] = `* Please provide the ${capitalize(key)}`;
      continue;
    }
// console.log('key', key)

// Validación adicional para números/additional validation for numbers
//this accept zero as number input, used by new account creation
   if (typeof value === 'number') {
    if (nonZeroFields.includes(key) && value === 0) {
      errorValidationMessages[key] = `* ${capitalize(key)} must be greater than zero`;
    }else if (value < 0) {
        errorValidationMessages[key] = `* ${capitalize(key)} must be positive`;
      }
    continue;
  }
}
  return errorValidationMessages as Record<keyof T, string>;
}
//---------------------------------
// ✅ función helper reutilizable para validar el campo 'amount' /validat speceifically amount field
//used by custom validation of amount. ex.Debts.tsx. It does not accept zero 
export function validateAmount(value: string): string | null {
  if (value === '' || value === undefined) return 'Amount is required';

  const result = checkNumberFormatValue(value);
  
  if (result.isError) {
    return `* ${result.formatMessage}`;
  }

  const numValue = result.valueToSave;

  if (numValue === undefined || isNaN(numValue)) {
    return '* Please enter a valid number';
  }

  if (numValue <= 0) {
    return '* Amount must be greater than zero';
  }
  return null; // ✅ No error
}

//---------------------------------
export function validateField_v0(name: string, value: string 
  //| number | null | undefined): string | null
 ) {
if (name === 'amount') {
    return validateAmount(value);
  }

  if (value === '' || value == null) {
    return `* Please provide the ${capitalize(name)}`;
  }
  if (typeof value === 'number' && value <= 0) {
    return `* ${capitalize(name)} negative values are not allowed`;
  }
  return null;
}
//---------------------------------
function validateNumber(value: number, fieldName: string): string | null {
  if (value <= 0) return `* ${capitalize(fieldName)} must be greater than zero`;
  return null;
}
//---
//refactorizar para hacer un validateField generico / working on a dynamic or generic validateField 
export function validateField(name: string, value: string | number | null | undefined) {
  if (value === '' || value == null) {
    return `* Please provide the ${capitalize(name)}`;
  }
    if (name === 'amount') return validateAmount(String(value));
    if (typeof value === 'number') {
    return validateNumber(value, name);
  }
return null;
}
//-----------------------------
//-----check number format ----
//used in input number format validation
export function checkNumberFormatValue(value: string): {
  formatMessage: string;
  valueNumber: string | undefined;
  valueToSave: number  | undefined ;
  isError: boolean;
} {
  const notMatching = /([^0-9.,])/g; // Pattern for invalid characters
  const onlyDotDecimalSep = /^\d*(\.\d*)?$/; //Normal US numeric Format
  const onlyCommaDecimalSep = /^\d*(,\d*)$/; // Only comma as decimal separator. ES numeric format
  const commaSepFormat = /^(\d{1,3})(,\d{3})*(\.\d*)?$/; //Comma as thousand separator, point as decimal separator. US format
  const dotSepFormat = /^(\d{1,3})(\.\d{3})*(,\d*)?$/; //Dots as thousands separator, comma as decimal separator. UK format

  //valueToSave is the number used to update the number type state value
  //no matching character
  if (notMatching.test(value)) {
   const matches = value.match(notMatching)// || [];
    const invalidCharacters = [...new Set(matches)].slice(0,4).join(',').replace(' ','blank')

    //  const  isError= true
    // const valueToSave = undefined
    
    return {
      formatMessage: `not valid number: ${invalidCharacters}`,
      isError:true,
      valueNumber: value.toString(),
      valueToSave:  undefined
    };
  }
  //normal number: point as decimal
  if (onlyDotDecimalSep.test(value)) {
    const valueNumber = !isNaN(parseFloat(value)) ? parseFloat(value) : undefined;

    return {
      formatMessage: 'decimal point format', //'point as decimal, no th separators with optional point as decimal sep '
       
      valueNumber: valueNumber?.toString(),
      valueToSave: valueNumber,
      isError: false,
    };
  }

  //only comma as decimal
  if (onlyCommaDecimalSep.test(value)) {
    const valueNumber = !isNaN(parseFloat(value.replace(',', '.')))
      ? parseFloat(value.replace(',', '.'))
      : 0;

    return {
      formatMessage: 'comma as decimal-sep.',
      valueNumber: valueNumber.toString(),
      valueToSave: valueNumber,
      isError: false,
    };
  }

  //comma separator, decimal dot
  if (commaSepFormat.test(value)) {
    const valueNumber = !isNaN(parseFloat(value.replace(/,/g, '')))
      ? parseFloat(value.replace(/,/g, ''))
      : 0;

    return {
      formatMessage: 'comma as th-sep, point decimal',
      valueToSave: valueNumber,
      valueNumber: value.toString(),
      isError: false,
    };
  }

  //dot as thousand separator, comma as decimal separator
  if (dotSepFormat.test(value)) {
    const valueNumber = !isNaN(
      parseFloat(value.replace(/\./g, '').replace(',', '.'))
    )
      ? parseFloat(
          parseFloat(value.replace(/\./g, '').replace(',', '.')).toFixed(2)
        ) //seems that toFixed method does not work here - check
      : 0
      ;

    return {
      formatMessage: 'dot as th-sep, comma as decimal',
      valueToSave: valueNumber,
      valueNumber: value.toString(),
      isError: false,
    };
  }
  //----
  return {
    formatMessage: `format number not valid`,
    isError: true,
    valueNumber: '',
    valueToSave: undefined 
  };
}
//General reg exp to validate number format--
// ^(0([.,]\d+)?|[1-9]\d{0,2}(,\d{3})_(\.\d_)?|[1-9]\d{0,2}(\.\d{3})_(,\d_)?|[1-9]\d*([.,]\d*)?|[.,]\d+|\d+[.,])$
//------------------------------------




