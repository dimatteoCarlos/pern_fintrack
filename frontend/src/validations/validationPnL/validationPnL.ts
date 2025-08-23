//frontend/src/validations/validationPnL.ts
//=====================
//This is used for an own custom validation form (no libraries)
import { checkNumberFormatValueForSchema } from "../zod_schemas/commonSchemas";

// Definir una interfaz para la estructura común de todos los schemas
type FieldValidationSchema ={
  type: string;
  required: boolean;
  validate: (value: string) => {
    isValid: boolean;
    message: string;
 //eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsedValue: any;
  };
}

//custom validation schema by field
export const PnLValidationSchema = {
amount:{
  type:'number',
  required:true,
  validate:(value:string)=>{
//-Pre-validation
  if (!value.trim()) {
        return {
          isValid: false,
          message: '* Amount is required',
          parsedValue: undefined
        };
      }

    const numValue = typeof value === 'string' ? parseFloat(value): Number(value);
    console.log("🚀 ~ numValue:", numValue)

    if(numValue !== undefined &&  !isNaN(numValue) && numValue<=0){
      return {
        isValid: false,
        message: `* Error: Amount must be > 0`,
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

    const isValid = !isError && !!valueToSave && valueToSave>0; //true
    const message= isError?`* Error:${formatMessage}`:`Format:${formatMessage}`
    const parsedValue = valueToSave//number

  return {isValid, message, parsedValue}
  }
},
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
  type:'text',
  required:true,
  validate:(value:string)=>{
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

} as const;

//========================================
// Validate all fields of formData
//========================================
export const validateAllFn=<FormDataType>(formData:FormDataType
,
  validationSchema: Record<string, FieldValidationSchema> 
)=>{

let isValid = true 
const fieldErrorMessages :Record<string, string> = {}

// const validationFieldSchemas= Object.entries(PnLValidationSchema)
// console.log(validationFieldSchemas)

for (const [fieldName, fieldSchema] of Object.entries(validationSchema)){
const value = formData[fieldName as keyof FormDataType];

  // Convertir a string si es necesario (porque validate espera string)
    const stringValue = value !== undefined && value !== null
     ? String(value)
     : '';

    const { isValid: fieldIsValid, message } = fieldSchema.validate(stringValue);

  if(!fieldIsValid){
    isValid = false;
    fieldErrorMessages[fieldName]=message
  }
}
return {isValid,fieldErrorMessages}
}
