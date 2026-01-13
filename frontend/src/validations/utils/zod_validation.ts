// src/validations/utils/functions.ts
// validateForm
import { ZodType  } from 'zod';
import { ValidationMessagesType } from '../types';

//ValidationMessagesType:structure data type that validateForm will return when validation errors are found. TFormData is form fields names.

// export type ValidationMessagesType<TFormData extends Record<string, unknown>> = {
//   [K in keyof TFormData]?: string;
// };

export type ValidationResultType<TFormData extends Record<string, unknown>> = {
  errors:ValidationMessagesType<TFormData>;
  data:TFormData | null;
};

//-------------------------------------
//Validate a data object against zod schema
//Transform zod errors to render
export function validateForm<TFormData extends Record<string, unknown>>(
  schema: ZodType<TFormData>, // Recibe un esquema Zod (como expenseSchema)
  data: unknown // Recibe los datos del formulario (ej. expenseData)
): ValidationResultType<TFormData> {
 //Validacion del esquema de forma 'segura', `safeParse` no lanza un error si la validación falla, sino que devuelve un objeto.
 const result = schema.safeParse(data);
//verifica el resultado de la validacion
// console.log('result', result)
  
if (result.success) {
 // Si la validación es exitosa, no hay errores, así que devuelve un objeto vacío.
 // console.log('result desde validatefn',result)
  return {
    errors: {},
    data: result.data,
  };
  } else {
    // Si la validación falla, procesa los errores.
    const errors: ValidationMessagesType<TFormData> = {}; // Objeto para almacenar los errores formateados

    // Itera sobre cada "issue" (problema/error) que Zod encontró.
    result.error.issues.forEach((issue) => {
      // `issue.path` es un array que indica dónde ocurrió el error en el objeto de datos.
      // Para formularios planos, `issue.path[0]` es el nombre del campo.
      const fieldName = issue.path[0];

      // Asegura que `fieldName` sea un string válido.
      if (fieldName && typeof fieldName === 'string') {
      // Asigna el mensaje de error de Zod (issue.message) al campo correspondiente.
        errors[fieldName as keyof TFormData] = issue.message;
        // console.log('ValidateForm Errors', errors[fieldName as keyof TFormData])
      }
    });
    // console.log('formatted Errors', errors)
    // Devuelve el objeto con los errores formateados.
    return {errors, data:null };
  }
}
