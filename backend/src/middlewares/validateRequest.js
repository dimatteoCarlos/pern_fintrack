// backend/src/middleware/validateRequest.js
// 🛡️ ZOD VALIDATION MIDDLEWARE (ZOD v4 COMPATIBLE)
// Universal middleware to validate request bodies against Zod schemas
import { createError } from '../utils/errorHandling.js';

/**
 * Creates a middleware function that validates request body against a Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
*/

//SYNC alternative: this is the one that will be used.
// ============================================
// 🎯 ALTERNATIVE: SYNCHRONOUS VERSION 
// ============================================
/**
 * Synchronous version of the validation middleware
 * Use for simple schemas that don't need async operations
 */
export const validateRequestSync = (schema) =>{
return (req, res, next)=>{
 try {
  const validationResult = schema.safeParse(req.body);
  if (!validationResult.success) {
    const flattenedErrors = validationResult.error.flatten();

    // 🎯 FORMATO COMPATIBLE CON TU FRONTEND
      const errorResponse = {
        success: false,
        error: 'ValidationError',
        message: 'Request validation failed',
        details: {
         fieldErrors: flattenedErrors.fieldErrors || {},
         formErrors: flattenedErrors.formErrors || []
         }
        };
   return res.status(400).json(errorResponse);
    }

 // ✅ DATOS VALIDADOS Y SANITIZADOS
  req.validatedData = validationResult.data;
  next();

 } catch (error) {
    console.error('Validation middleware error:', error);
    next(createError(500, 'Internal validation error'));
  }
 };
};

export default {
 validateRequestSync,
  // validateRequestAsync,
  // formatZodErrorsForFrontend
};





// export const validateRequestAsync = (schema) => {
//   return async (req, res, next) => {
//     try {
//       // 🎯 VALIDATE REQUEST BODY AGAINST SCHEMA (Zod v4)
//       const validationResult = await schema.safeParseAsync(req.body);
      
//       if (!validationResult.success) {
//       // 🚨 FORMAT ZOD v4 ERRORS FOR CLIENT RESPONSE USING flatten()
//         const flattenedErrors  = validationResult.error.flatten();

//       // 📋 EXTRACT FIELD ERRORS AND GENERAL ERRORS
//         const fieldErrors = flattenedErrors.fieldErrors || {};
//         const formErrors = flattenedErrors.formErrors || [];

//       // 🎨 PREPARE RESPONSE IN CONSISTENT FORMAT  
//      const errorResponse = {
//       success: false,
//       error: 'ValidationError',
//       message: 'Request validation failed',
//       details: {
//         // Field-specific errors (mapped by field name)
//         fieldErrors: fieldErrors,
//         // General form-level errors
//         formErrors: formErrors,
//         // Combined messages for backward compatibility
//         messages: [
//           ...formErrors,
//           ...Object.values(fieldErrors).flat()
//            ]
//          }//details
//        };//errorResponse
//        return res.status(400).json(errorResponse);
//       }//!validation result
      
//       // ✅ VALIDATION SUCCESSFUL - ATTACH CLEAN DATA TO REQUEST
//       req.validatedData = validationResult.data;
//       next();
      
//     } catch (error) {
//       // 🚨 UNEXPECTED ERROR IN VALIDATION MIDDLEWARE
//       console.error('Validation middleware error:', error);
//       next(createError(500, 'Internal validation error'));
//      }
//    };
//  };

// ============================================
// 🎨 ERROR FORMATTING UTILITY
// ============================================
/**
 * Alternative error formatter for custom structure
 * Returns errors in format similar to the frontend validateForm
 */
// export const formatZodErrorsForFrontend = (zodError) => {
//   const flattened = zodError.flatten();
//   const errors = {};
  
//   // Map field errors to simple key-value pairs
//   Object.entries(flattened.fieldErrors || {}).forEach(([field, messages]) => {
//     if (messages && messages.length > 0) {
//       errors[field] = messages[0]; // Take first error only (like used in frontend)
//     }
//   });
  
//   return {
//     errors,
//     formErrors: flattened.formErrors || []
//   };
// };
//--------------------------------------------

// 🎯 CÓMO FUNCIONA flatten():
// javascript
// // Ejemplo de error en Zod v4:
// const error = validationResult.error.flatten();
// // Devuelve:
// {
//   formErrors: ["At least one field must be provided"], // Errores generales
//   fieldErrors: {
//     firstname: ["First name is required"],
//     currency: ["Currency 'gbp' is not supported"]
//   }
// }

/*
📊 ESTRUCTURA DE RESPUESTA DE ERROR:
json
{
  "success": false,
  "error": "ValidationError",
  "message": "Request validation failed",
  "details": {
    "fieldErrors": {
      "firstname": ["First name is required"],
      "currency": ["Currency 'gbp' is not supported"]
    },
    "formErrors": ["At least one field must be provided"],
    "messages": [
      "At least one field must be provided",
      "First name is required", 
      "Currency 'gbp' is not supported"
    ]
  }
}
*/
/*
VERSION SIMPLIFICADA DE VALIDATE REQUEST
// backend/src/middleware/validateRequest.js
import { ZodError } from 'zod';

/**
 * Middleware para validar el cuerpo de la petición usando esquemas de Zod.
 * Adaptado para manejar ZodIssue y validación de instancia.
 */
/*
export const validateRequest = (schema) => (req, res, next) => {
  try {
    // parse() devuelve los datos limpios y transformados
    // Se asigna a req.body para que el controlador use datos validados
    req.body = schema.parse(req.body);
    
    next();
  } catch (error) {
    // 1. Detección recomendada: Usar instanceof ZodError
    if (error instanceof ZodError) {
      
      // 2. Uso de .issues (array de objetos ZodIssue)
      const errorMessages = error.issues.map((issue) => ({
        // 3. Acceso a path (array) y message
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code // Útil para debugging o traducciones en el front
      }));

      return res.status(400).json({
        status: 400,
        message: "Validation Error",
        errors: errorMessages
      });
    }

    // Si no es un error de validación, sigue al manejador global
    next(error);
  }
};

*/