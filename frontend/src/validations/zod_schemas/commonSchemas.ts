// src/validations/schemas/commonSchemas.ts
//validation of numeric inputs
import {z} from "zod";
import {ERROR_MESSAGES,
// VALID_NUMBER_FORMATS_PATTERNS,
//  INVALID_CHARS_REGEX,
} from '../utils/constants.ts'

//------------
// Esquema de Zod para validar y transformar entradas numéricas / Zod schema to validate and transform numeric data
export const numberSchema = z.string()
  .min(1, ERROR_MESSAGES.FIELD_REQUIRED)
  .pipe(z.string().transform((val, ctx) => {
    const result = checkNumberFormatValueForSchema(val);
    
    if (result.isError) {
      ctx.issues.push({
        code: "custom",
        message: result.formatMessage,
        input: val,
      });
      return z.NEVER;
    }

    if (result.valueToSave <= 0) {
      ctx.issues.push({
        code: "custom",
        message: ERROR_MESSAGES.POSITIVE_NUMBER_REQUIRED,
        input: val,
      });
      return z.NEVER;
    }

    return result.valueToSave;
  }));

// Función auxiliar para normalización de números
export function checkNumberFormatValueForSchema(rawValue: string): {
  formatMessage: string;
  valueNumber: string;
  valueToSave: number;
  isError: boolean;
} {
  const notMatching = /([^0-9.,])/g;
  const onlyDotDecimalSep = /^\d*(\.\d*)?$/;
  const onlyCommaDecimalSep = /^\d*(,\d*)$/;
  const commaSepFormat = /^(\d{1,3})(,\d{3})*(\.\d*)?$/;
  const dotSepFormat = /^(\d{1,3})(\.\d{3})*(,\d*)?$/;

  const value = rawValue.trim();

  // Validar caracteres no permitidos
  if (notMatching.test(value)) {
    const matches = value.match(notMatching)
     const invalidChars = [...new Set(matches)].join(',').replace(' ','blank') || '';
       return {
      formatMessage: `${ERROR_MESSAGES.INVALID_NUMBER}:${invalidChars}`,
      isError: true,
      valueNumber: value,
      valueToSave: 0,
    };
  }
  // Manejar números negativos
  const isNegative = value.startsWith('-');
  const absValue = isNegative ? value.substring(1) : value;

  // Normal US numeric format (1234.56)
  if (onlyDotDecimalSep.test(absValue)) {
    const num = parseFloat(absValue) * (isNegative ? -1 : 1);
    return {
      formatMessage: 'decimal point format',
      valueNumber: value,
      valueToSave: num,
      isError: false,
    };
  }

  // Only comma as decimal separator (1234,56)
  if (onlyCommaDecimalSep.test(absValue)) {
    const num = parseFloat(absValue.replace(',', '.')) * (isNegative ? -1 : 1);
    return {
      formatMessage: 'comma as decimal-sep.',
      valueNumber: value,
      valueToSave: num,
      isError: false,
    };
  }

  // US format with thousand separators (1,234,567.89)
  if (commaSepFormat.test(absValue)) {
    const num = parseFloat(absValue.replace(/,/g, '')) * (isNegative ? -1 : 1);
    return {
      formatMessage: 'comma as th-sep, point decimal',
      valueNumber: value,
      valueToSave: num,
      isError: false,
    };
  }

  // European format with thousand separators (1.234.567,89)
  if (dotSepFormat.test(absValue)) {
    const numStr = absValue.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(numStr) * (isNegative ? -1 : 1);
    return {
      formatMessage: 'dot as th-sep, comma as decimal',
      valueNumber: value,
      valueToSave: num,
      isError: false,
    };
  }

  // Format not valid /Formato no reconocido
  return {
    formatMessage: ERROR_MESSAGES.INVALID_FORMAT,
    isError: true,
    valueNumber: value,
    valueToSave: 0,
  };
}
//================================
export const requiredStringSchema = z.string({error: (iss) => iss.input === undefined ? `Please enter a valid ${iss.path}` : `${iss.input} not allowed`}) 
.min(1, {error:(iss)=>iss.input === ''?`* Please select the ${(iss.path)}`:ERROR_MESSAGES.FIELD_REQUIRED})

//================================
export const currencySchema = z.enum(['usd', 'cop', 'eur'], {
  error:(issue)=>{
 if(issue.code === 'invalid_value'){
  return `Currency ${issue.input} was not found in ${issue.options?.join(', ') ?? 'available options: usd, cop, eur'}`;
   }
    return "Invalid currency input"
  }
}
) 
//---------------------------------
export const noteSchema = z.string({error: (iss) => iss.input === undefined || '' ? `Please entered the ${iss.path}` : ``})
.min(1,{error:(issue)=>issue.input ===''?`* Please enter the ${issue.path}`:ERROR_MESSAGES.FIELD_REQUIRED})
.max(150, {
  message: ERROR_MESSAGES.NOTE_MAX_LENGTH,
});
//---------------------------------