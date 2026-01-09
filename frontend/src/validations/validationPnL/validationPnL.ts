//frontend/src/validations/validationPnL.ts
//=====================
import { CurrencyType, TransactionType, TransferAccountType } from "../../types/types";
import { checkNumberFormatValueForSchema } from "../zod_schemas/commonSchemas";
//============================
//type definitions
type ValidParsedValuesType = string | number | Date | CurrencyType | TransactionType | undefined;

type  ValidateReturnType ={
 isValid:boolean;
 message:string;
 parsedValue:ValidParsedValuesType;
}

// Definir una interfaz para la estructura común de todos los schemas
type FieldValidationSchema ={
  type: string;
  required: boolean;
  validate: (value: string) => ValidateReturnType;
}
//===============================
//custom validation schema by field
export const PnLValidationSchema = {
 amount:{
  type:'number',
  required:true,
  validate:(rawValue:string):ValidateReturnType=>{
  const value = rawValue.trim();

//-Pre-validation
  if (!value.trim()) {
   return {
     isValid: false,
     message: '* Amount is required',
     parsedValue: undefined
   };
      }

//-------------
//validate format number
//-------------
  const {isError, formatMessage, valueToSave, }=checkNumberFormatValueForSchema(value);

  if(isError){
    return {
      isValid: false,
      message: `* Error: ${formatMessage}`, // Mensaje de error
      parsedValue: undefined
    };
  }

  if (valueToSave !== undefined && valueToSave <= 0) {
   return {
    isValid: false,
    message: `* Error: Amount must be > 0`,
    parsedValue: undefined
   };
  }

   const isValid = !isError && !!valueToSave && valueToSave>0; //true

   const message= isError?`* Error:${formatMessage}`:`Format:${formatMessage}`
   const parsedValue = valueToSave//number

  return {isValid, message, parsedValue}
  }
},//amount value
//---
account :{
  type:'dropdown',
  required:true,
  validate:(value:string)=>{
   const isValid = !!value;
   const message = !value
   ?`* Please select an Account`
   :``;
   const parsedValue =value;
   return {isValid, message, parsedValue}
  }
},
//---
note:{
 type:'textarea',//text area
 required:true,
 validate:(value:string):ValidateReturnType=>{
   if(!value.trim()){
     return {
      isValid: false,
      message:'* Please describe profit/loss',
      parsedValue: undefined
   }}
  if(value.trim().length<4 || value.trim().length>=150){
   return {isValid:false, message:`* Note must be min:4 and max:150 chars`, parsedValue:undefined}
  }

  //Success
  return {
    isValid:true, message:'', parsedValue:value.trim()
      }
    }
  },

//---
currency:{
 type:'currency',//value fixed by app config
 required:true,
 validate:(value:string):ValidateReturnType =>({
  isValid:true,
  message:'',
  parsedValue:value as CurrencyType
 })
} ,

 type: {
    type: 'select',
    required: true,
    validate: (value: string): ValidateReturnType => ({
      isValid: true,
      message: '',
      parsedValue: value as TransactionType
    })
  }, 
 
  accountType: {
    type: 'custom',
    required: false,
    validate: (value: string): ValidateReturnType => ({
      isValid: true,
      message: '',
      parsedValue: value as TransferAccountType|| undefined
    })
  },

    date: {
    type: 'date',
    required: true,
    validate: (value: string): ValidateReturnType => {
     const parsedDate = value ? new Date(value) : new Date();

     return {
      isValid: true,
      message: '',
      parsedValue: parsedDate
      };
     }
    },

    } as const;

//========================================
// Validate all fields of form: formData
//========================================
export const validateAllFn=<FormDataType extends Record<string, unknown>>(formData:FormDataType,
 validationSchema: Record<string,FieldValidationSchema> 
)=>{
let isValid = true;
const fieldErrorMessages :Record<string, string> = {};

//converted data
const data: Record<string,ValidParsedValuesType> = {};
// const validationFieldSchemas= Object.entries(PnLValidationSchema)
// console.log({validationFieldSchemas})

for (const [fieldName, fieldSchema] of Object.entries(validationSchema)){
const value = formData[fieldName as keyof FormDataType];
// Convertir a string si es necesario (porque validate espera string)
 const stringValue = value !== undefined && value !== null
   ? String(value)
   : '';

 const { isValid: fieldIsValid, message, parsedValue } = fieldSchema.validate(stringValue);

  if(!fieldIsValid){
    isValid = false;
    fieldErrorMessages[fieldName]=message
  }else{
  if (parsedValue !== undefined) {
   data[fieldName] = parsedValue;//clean value
  }
 }
}//end of 
console.log({data})
return {isValid,fieldErrorMessages, data}
}
