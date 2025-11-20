// frontend/src/edition/pages/components/UniversalDynamicInput/UniversalDynamicInput.tsx
// 💡Imports
import { useMemo } from 'react';
import { FieldConfigType } from '../../../validations/accountEditSchema.ts';
import { ValidationMessagesType } from '../../../../validations/types.ts';
// 🧱 Place holder for external components
import { DropdownOptionType } from '../../../../types/types.ts';
import DropDownSelection from '../../../../general_components/dropdownSelection/DropDownSelection.tsx';
import FormDatepicker from '../../../../general_components/datepicker/Datepicker.tsx'; 
// =====================================
// 🎯 GENERIC TYPE PROPERTIES DEFINITION/INTERFAZ DE PROPIEDADES (USANDO GENÉRICOS)
// ====================================
/**
 * Define las props del componente UniversalDynamicInput.
 * @template T El tipo genérico del objeto de datos del formulario (GenericEditFormData).
 */
export interface UniversalDynamicInputProps<T extends Record<string, unknown>> {
 fieldConfig: FieldConfigType;
 formData: T;
 setFormData: React.Dispatch<React.SetStateAction<T>>;
 validationMessages: ValidationMessagesType<T>;
 isReset: boolean;
 
 // Handlers para los diferentes tipos de input, definidos como HOF (High Order Functions)
 handleDropdownChange: (fieldName: string) => (option: DropdownOptionType | null) => void;

 handleDateChange: (fieldName: string) => (date: Date) => void;
 
 // Se usa el mismo handler para texto y números (como lo define EditAccount.tsx)
 handleInputNumberChange: (fieldName: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}
// =======================================
// 🧱 DYNAMICALLY RENDERING COMPONENT
// =======================================
/**
 * Componente que renderiza un campo de formulario dinámicamente según la configuración.
 * @template T - Tipado seguro para los datos del formulario.
 */
export function UniversalDynamicInput<T extends Record<string, unknown>>({
 fieldConfig,
 formData,
 validationMessages,
 handleDropdownChange,
 handleDateChange,
 handleInputNumberChange,
 // setFormData, // No se usa directamente aquí, solo en los handlers del padre
 isReset,
}: UniversalDynamicInputProps<T>): JSX.Element {
 const fieldNameKey = fieldConfig.fieldName as keyof T;
 
 // 💡 Acceso tipado al valor y mensaje de error
 const value = formData[fieldNameKey];
 const errorMessage = validationMessages[fieldNameKey];

 // ReadOnly fields
 const isReadOnly = !fieldConfig.isEditable;
 const readOnlyStyle = useMemo(() => isReadOnly
  ? ({ opacity: 0.6, pointerEvents: 'none', backgroundColor: '#333333' } as React.CSSProperties)
  : undefined,
  [isReadOnly]
 );
//-----
// Get the generic handler for text/number
 const textOrNumberHandler = handleInputNumberChange(fieldConfig.fieldName);
 
// -----------------------------------
// 🔧 LOGIC: Manejo del valor del input
// -----------------------------------
// En la edición, el valor puede ser un string (texto/fecha) o number (Zod loS transforma)
// Se convierte a string para el atributo `value` del <input>
 let inputValue = '';
 if (value !== null && value !== undefined) {
 inputValue = String(value);
 }
// -----------------------------------
// 🎨 DYNAMIC RENDERING INPUT TYPE SELECTION
// -----------------------------------
 const renderInput = () => {
  switch (fieldConfig.inputType) {
   case 'text':
   case 'number':
   case 'textarea':
// 📝 TEXTAREA O INPUTS DE TEXTO/NÚMERO
// Si es un textarea, renderiza un <textarea>
  if (fieldConfig.inputType === 'textarea') {
   return (
    <textarea
      className={`input__container ${isReadOnly ? 'read-only' : ''}`}
      name={fieldConfig.fieldName}
      placeholder={fieldConfig.placeholder}
      value={inputValue}
      onChange={textOrNumberHandler}
      readOnly={isReadOnly}
      style={readOnlyStyle}
     />
     );
  }

// For text/number input
  return (
   <input
    className={`input__container ${isReadOnly ? 'read-only' : ''}`}
    type={'text'} // Usar 'text' para el manejo de formatos de número por el handler del padre
    name={fieldConfig.fieldName}
    placeholder={fieldConfig.placeholder}
    value={inputValue}
    onChange={textOrNumberHandler}
    readOnly={isReadOnly}
    style={readOnlyStyle}
   />
  );

 case 'select':
 // 🔽 DROPDOWN/SELECT
  if (!fieldConfig.options) {
   return <p className='error-message'>Error: 'select' type, requires 'options'.</p>;
  }
   
 return (
  <DropDownSelection
   dropDownOptions={{
    title:inputValue ||  fieldConfig.placeholder || `Select ${fieldConfig.label}`,
    options: fieldConfig.options,
    variant: 'form', // dark form style
  }}

  updateOptionHandler={handleDropdownChange(fieldConfig.fieldName)}
  isReset={isReset}
  setIsReset={() => { /* no-op o manejar en el padre si es necesario */ }}
 />
 );

case 'date': {
 let dateValue: Date;

// 🟢 PARSING MEJORADO para diferentes formatos
 if (value instanceof Date) {
   dateValue = value;
 } else if (typeof value === 'string') {
 // Intentar diferentes estrategias de parsing
 let parsedDate = new Date(value);
 
 if (isNaN(parsedDate.getTime())) {
 // Estrategia 1: Timestamp PostgreSQL "YYYY-MM-DD HH:MM:SS-TZ"
 if (value.includes(' ')) {
   const [datePart] = value.split(' ');
   const [year, month, day] = datePart.split('-').map(Number);
   parsedDate = new Date(year, month - 1, day);
 }
 // Estrategia 2: Formato YYYY-MM-DD
 else if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
   const [year, month, day] = value.split('-').map(Number);
   parsedDate = new Date(year, month - 1, day);
  }
 }
 dateValue = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
} else {
 dateValue = new Date();
}

// console.log('🎯 UniversalDynamicInput recibiendo:', {
// fieldName: fieldConfig.fieldName,
// valorRecibido: value,
// tipoValor: typeof value,
// esDateInstance: value instanceof Date,
// esString: typeof value === 'string',
// // valorComoDate: value instanceof Date ? value : new Date(value as string),
// dateValue:dateValue,
// });

return (
  <div className='form__datepicker__container input__box--datepicker'>
   <FormDatepicker
    changeDate={handleDateChange(fieldConfig.fieldName)}
    date={dateValue}
    variant={'form'}
    />
  </div>
  );
}
 default:
 // 🚨 TYPE NOT SUPPORTED
 return( <p className='error-message'>Input type not supported: {fieldConfig.inputType}</p>);
  } };

 // -----------------------------------
 // 📦 GENERAL STRUCTURE
 // -----------------------------------
 return (
  <div className='input__box'>
  <label className='label form__title'>
   {fieldConfig.label}
   {fieldConfig.isRequired && <span className='required-star'>*</span>}
   &nbsp;
   <span className='validation__errMsg'>
       {errorMessage}
   </span>
  </label>
     
  {/* 📝 Help Text */}
  {fieldConfig.helpText && !errorMessage && (
   <p className='help-text'
   style={{color:'cyan', opacity:'0.8', fontWeight:'100', fontSize:'0.8rem', }}
   >{fieldConfig.helpText}</p>
  )}

 {/* 🖼️ Rendering of input/select/date according to input type */}
  {renderInput()}
  </div> 
 );
}

export default UniversalDynamicInput;