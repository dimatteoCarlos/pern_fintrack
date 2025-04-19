//createError.js
import pc from 'picocolors'
export function createError(statusCode, message) {
  const err = new Error();
  err.status = statusCode;
  err.message = message;
  console.log('Running create error fn:', 'status:',err.status, err.message);
  return { status: err.status, message: err.message };
}

export const handlePostgresErrorEs = (error) => {
  let code = 500; // Código de estado HTTP por defecto
  let message = error.message || 'Error interno del servidor'; // Mensaje por defecto

  switch (error.code) {
    case '23514': // Violación de CHECK constraint
      code = 400;
      message =
        'Violación de restricción: La fecha de inicio no puede ser futura.';
      break;

    case '23505': // Violación de UNIQUE constraint
      code = 409;
      message = 'Violación de restricción: El registro ya existe.';
      break;

    case '23503': // Violación de FOREIGN KEY constraint
      code = 400;
      message = 'Violación de restricción: Clave foránea no válida.';
      break;

    case '22P02': // Error de tipo de dato inválido
      code = 400;
      message = 'Error de tipo de dato: El valor proporcionado no es válido.';
      break;

    default:
      // Mantén el código y mensaje por defecto para otros errores
      break;
  }

  return { code, message };
};

export const handlePostgresError = (error) => {
  let code = 500; // Default HTTP status code
  let message = error.message || 'Internal server error'; // Default message

  switch (error.code) {
    case '23514': // CHECK constraint violation
      code = 400;
      message = 'Constraint violation: The start date cannot be in the future.';
      break;

    case '23505': // UNIQUE constraint violation
      code = 409;
      message = 'Constraint violation: The record already exists.';
      break;

    case '23503': // FOREIGN KEY constraint violation
      code = 400;
      message = 'Constraint violation: Invalid foreign key.';
      break;

    case '22P02': // Invalid data type error
      code = 400;
      message = 'Data type error: The provided value is not valid.';
      break;

    default:
      // Keep the default code and message for other errors
      break;
  }

  return { code, message };
};
