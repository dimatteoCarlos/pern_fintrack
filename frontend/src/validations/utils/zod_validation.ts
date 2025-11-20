// src/validations/utils/functions.ts
// validateForm
import { ZodType  } from 'zod';
import { ValidationMessagesType } from '../types';

//ValidationMessagesType:structure data type that validateForm will return when validation errors are found. T is form fields names.

// export type ValidationMessagesType<T extends Record<string, unknown>> = {
//   [K in keyof T]?: string;
// };

export type ValidationResultType<T extends Record<string, unknown>> = {
  errors:ValidationMessagesType<T>;
  data:T | null;
};

//-------------------------------------
//Validate a data object against zod schema
//Transform zod errors to render
export function validateForm<T extends Record<string, unknown>>(
  schema: ZodType<T>, // Recibe un esquema Zod (como expenseSchema)
  data: unknown // Recibe los datos del formulario (ej. expenseData)
): ValidationResultType<T> {
 //Validacion del esquema de forma 'segura', `safeParse` no lanza un error si la validación falla, sino que devuelve un objeto.
 const result = schema.safeParse(data);
//verifica el resultado de la validacion
  // console.log('result', result)
  
if (result.success) {
 // Si la validación es exitosa, no hay errores, así que devuelve un objeto vacío.
 // console.log('result desde validatefn')
  return {
    errors: {},
    data: result.data,
  };
  } else {
    // Si la validación falla, procesa los errores.
    const errors: ValidationMessagesType<T> = {}; // Objeto para almacenar los errores formateados

    // Itera sobre cada "issue" (problema/error) que Zod encontró.
    result.error.issues.forEach((issue) => {
      // `issue.path` es un array que indica dónde ocurrió el error en el objeto de datos.
      // Para formularios planos, `issue.path[0]` es el nombre del campo.
      const fieldName = issue.path[0];

      // Asegura que `fieldName` sea un string válido.
      if (fieldName && typeof fieldName === 'string') {
      // Asigna el mensaje de error de Zod (issue.message) al campo correspondiente.
        errors[fieldName as keyof T] = issue.message;
        // console.log('ValidateForm Errors', errors[fieldName as keyof T])
      }
    });
    // console.log('formatted Errors', errors)
    // Devuelve el objeto con los errores formateados.
    return {errors, data:null };
  }
}
