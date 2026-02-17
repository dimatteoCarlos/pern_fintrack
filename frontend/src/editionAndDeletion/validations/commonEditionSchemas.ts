// frontend/src/editionAndDeletion/validations/commonEditionSchemas.ts
import {z} from "zod";
import { ERROR_MESSAGES } from "../../validations/utils/constants";
// import { checkNumberFormatValueForSchema } from "../../validations/zod_schemas/commonSchemas";

//repeated here
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

  if (notMatching.test(value)) {
    const matches = value.match(notMatching);
    const invalidChars = [...new Set(matches)].join(',').replace(' ', 'blank') || '';
    return {
      formatMessage: `${ERROR_MESSAGES.INVALID_NUMBER}:${invalidChars}`,
      isError: true,
      valueNumber: value,
      valueToSave: 0,
    };
  }
  const isNegative = value.startsWith('-');
  const absValue = isNegative ? value.substring(1) : value;

  if (onlyDotDecimalSep.test(absValue)) {
    const num = parseFloat(absValue) * (isNegative ? -1 : 1);
    return { formatMessage: 'decimal point format', valueNumber: value, valueToSave: num, isError: false };
  }

  if (onlyCommaDecimalSep.test(absValue)) {
    const num = parseFloat(absValue.replace(',', '.')) * (isNegative ? -1 : 1);
    return { formatMessage: 'comma as decimal-sep.', valueNumber: value, valueToSave: num, isError: false };
  }

  if (commaSepFormat.test(absValue)) {
    const num = parseFloat(absValue.replace(/,/g, '')) * (isNegative ? -1 : 1);
    return { formatMessage: 'comma as th-sep, point decimal', valueNumber: value, valueToSave: num, isError: false };
  }

  if (dotSepFormat.test(absValue)) {
    const numStr = absValue.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(numStr) * (isNegative ? -1 : 1);
    return { formatMessage: 'dot as th-sep, comma as decimal', valueNumber: value, valueToSave: num, isError: false };
  }

  return { formatMessage: ERROR_MESSAGES.INVALID_FORMAT, isError: true, valueNumber: value, valueToSave: 0 };
}

//compatible
const createDynamicStringSchema = (
 max:number, allowEmpty:boolean = false
)=>{
const base = z.string(
 {
  error:(iss)=>iss.input ===undefined? `Please enter a valid ${iss.path}`:`${iss.input} not allowed`
 });

 if(!allowEmpty){
  return base
  .min(1, {error:(iss)=>iss.input ===''? `* Please select the ${iss.path}`:ERROR_MESSAGES.FIELD_REQUIRED})
  .max(max, {message:`Maximum ${max} characters allowed`});
 }else {
  return base
   .max(max, {message:`Maximum ${max} characters allowed`});
 }
};

//EXPORTS
//1. requiredStringSchema with dynamic max
export const requiredStringSchema =(max:number=50)=>createDynamicStringSchema(max, false);

//2. noteSchema with dynamic max
export const noteSchema = (max:number)=>createDynamicStringSchema(max, true).nullable();

//3. optionalButNotEmptySchema: is optional for edition in payload but never empty
export const optionalButNotEmptySchema =(max:number)=> createDynamicStringSchema(max, false).optional();

//4 numberSchema: complete
export const numberSchema = z.string()
.min(1,ERROR_MESSAGES.FIELD_REQUIRED)
.pipe(z.string().transform((val, ctx)=>{
const result = checkNumberFormatValueForSchema(val);
if(result.isError){
 ctx.issues.push({code:"custom", message:result.formatMessage,input:val});
 return z.NEVER;
}

if(result.valueToSave <=0){
 ctx.issues.push({code:"custom", message:ERROR_MESSAGES.POSITIVE_NUMBER_REQUIRED, input:val})
 return z.NEVER;
}
return result.valueToSave;
}));

//5. currencySchema
export const currencySchema = z.enum(
 ['usd','cop','eur'],{
  error:(issue)=>{
  if(issue.code==='invalid_value'){
   return `Currency ${issue.input} was not found in ${issue.options?.join(',')??'available options'}`;
  }
  return "Invalid currency input";
 }
});

export const currencySchemav2 = z.enum(
 ['usd','cop','eur'],{
  error:(issue)=>{
  if(issue.code==='invalid_value'){
   return {
     message: `Currency "${issue.received}" is not supported. Available options: usd, cop, eur`
   };
  }
  return "Invalid currency input";
 }
});












