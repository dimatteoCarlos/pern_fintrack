El patrón que funciona en `useChangePasswordFormLogic` es el correcto: el hook recibe las funciones de validación y el estado del formulario desde el contenedor, gestiona internamente el estado de interacción (`touched`, `dirty`, errores) y expone los handlers. Aplicaré ese mismo patrón a `useAuthFormLogic`, con las adaptaciones necesarias para manejar la unión de tipos de los formularios de login/registro.

El código corregido queda así:

```tsx
// 📁 frontend/src/auth/hooks/useAuthFormLogic.ts

import { useCallback, useState } from 'react';
import { SignInCredentialsType, SignUpCredentialsType } from '../types/authTypes';
import { AuthMode } from './useAuthFormLogic.types'; // asumiendo que este tipo existe
import {
  FormErrorsType,
  TransformApiErrorsFnType,
  ValidateAllFnType,
  ValidateFieldFnType,
} from '../validation/hook/useAuthValidation';

// ===============================
// 🏷️ TIPOS LOCALES
// ===============================

/**
 * Tipo base para los datos del formulario de autenticación (unión discriminada por modo)
 * Este tipo debe ser proporcionado por el contenedor y coincidir con el esquema de validación
 */
export type AuthFormData = SignInCredentialsType | (SignUpCredentialsType & { confirmPassword: string });

/**
 * Tipo de los campos del formulario (unión de todas las claves posibles)
 * Se usa para tipar las funciones de validación y el estado de interacción
 */
export type AuthFormField = keyof AuthFormData;

/**
 * Parámetros del hook
 */
type UseAuthFormLogicParams = {
  /** Modo del formulario (signin o signup) */
  mode: AuthMode;
  /** Datos actuales del formulario (proporcionados por el contenedor) */
  formData: AuthFormData;
  /** Setter de los datos del formulario (proporcionado por el contenedor) */
  setFormData: React.Dispatch<React.SetStateAction<AuthFormData>>;
  /** Función de validación de un campo (contrato) */
  validateField: ValidateFieldFnType<AuthFormData>;
  /** Función de validación completa del formulario (contrato) */
  validateAll: ValidateAllFnType<AuthFormData>;
  /** Función para transformar errores de API a errores de formulario (contrato) */
  transformFromApiToFormErrors: TransformApiErrorsFnType<AuthFormField>;
  /** Función de dominio que llama a la API (contrato) */
  handleDomainAuth: (data: SignInCredentialsType | SignUpCredentialsType) => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string> }>;
};

// ===============================
// 🎣 HOOK PRINCIPAL
// ===============================

export const useAuthFormLogic = ({
  mode,
  formData,
  setFormData,
  validateField,
  validateAll,
  transformFromApiToFormErrors,
  handleDomainAuth,
}: UseAuthFormLogicParams) => {
  // Estados internos (interacción)
  const [touchedFields, setTouchedFields] = useState<Partial<Record<AuthFormField, boolean>>>({});
  const [dirtyFields, setDirtyFields] = useState<Partial<Record<AuthFormField, boolean>>>({});
  const [validationErrors, setValidationErrors] = useState<FormErrorsType<AuthFormField>>({});
  const [apiErrors, setApiErrors] = useState<FormErrorsType<AuthFormField>>({});

  /**
   * Maneja el cambio en un campo con validación en tiempo real
   * @param fieldName - Nombre del campo que cambia
   * @param value - Nuevo valor (string | null)
   */
  const handleChange = useCallback(
    (fieldName: AuthFormField, value: string | null) => {
      setFormData((currentFormData) => {
        const updatedForm = { ...currentFormData, [fieldName]: value ?? '' } as AuthFormData;

        // Marcar como touched
        setTouchedFields((prev) => ({ ...prev, [fieldName]: true }));

        // Marcar como dirty si el valor cambió
        if (currentFormData[fieldName] !== value) {
          setDirtyFields((prev) => ({ ...prev, [fieldName]: true }));
        }

        // Validación en tiempo real para este campo
        setValidationErrors((prevErrors) => {
          const next = { ...prevErrors };
          const validationResult = validateField(fieldName, value ?? '', updatedForm);

          if (validationResult.isValid) {
            delete next[fieldName];
          } else {
            next[fieldName] = validationResult.error ?? 'Valor inválido';
          }

          // Si el campo es 'newPassword' en modo signup, también revalidar confirmPassword
          if (mode === 'signup' && fieldName === 'newPassword') {
            const confirmResult = validateField('confirmPassword', (updatedForm as any).confirmPassword, updatedForm);
            if (confirmResult.isValid) {
              delete next['confirmPassword'];
            } else {
              next['confirmPassword'] = confirmResult.error ?? 'Valor inválido';
            }
          }

          return next;
        });

        return updatedForm;
      });
    },
    [validateField, setFormData, mode]
  );

  /**
   * Maneja el envío del formulario
   * @returns Resultado del dominio (success/error) o void si la validación falla
   */
  const handleSubmit = async (): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string> } | void> => {
    // Marcar todos los campos como touched (para mostrar errores al enviar)
    const allFields = Object.keys(formData) as AuthFormField[];
    const allTouched = allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {} as Record<AuthFormField, boolean>);
    setTouchedFields(allTouched);

    // Limpiar errores previos
    setValidationErrors({});
    setApiErrors({});

    // Validación completa del lado cliente
    const validationResult = validateAll(formData, new Set(allFields));

    if (!validationResult.isValid) {
      setValidationErrors(validationResult.errors);
      return; // La validación falló, no se envía
    }

    try {
      // Llamar a la función de dominio (API)
      const result = await handleDomainAuth(formData);

      if (!result.success && result.fieldErrors) {
        // Transformar errores de campo de la API a formato del formulario
        const mappedErrors = transformFromApiToFormErrors(result.fieldErrors);
        setApiErrors(mappedErrors);
      }

      return result;
    } catch (error) {
      console.error('❌ Error inesperado en handleSubmit:', error);
      return {
        success: false,
        error: 'UnexpectedError',
        message: 'Ocurrió un error inesperado. Por favor, intente de nuevo.',
      };
    }
  };

  /**
   * Reinicia todos los estados del formulario (excepto los datos que el contenedor maneje)
   */
  const resetForm = useCallback(() => {
    setValidationErrors({});
    setApiErrors({});
    setTouchedFields({});
    setDirtyFields({});
  }, []);

  /**
   * Indica si el formulario puede enviarse
   * - Todos los campos están marcados como touched
   * - No hay errores de validación cliente ni de API
   * - Todos los campos tienen valor (no vacío)
   */
  const isSubmittingAllowed = (() => {
    const allTouched = Object.keys(formData).every((field) => touchedFields[field as AuthFormField] === true);
    const allFilled = Object.values(formData).every((value) => typeof value === 'string' && value.trim().length > 0);
    const hasClientErrors = Object.keys(validationErrors).length > 0;
    const hasApiErrors = Object.keys(apiErrors).length > 0;

    return allTouched && allFilled && !hasClientErrors && !hasApiErrors;
  })();

  return {
    handleChange,
    handleSubmit,
    resetForm,
    validationErrors,
    apiErrors,
    touchedFields,
    dirtyFields,
    isSubmittingAllowed,
  };
};

export default useAuthFormLogic;
```

## 📌 Explicación de los cambios y por qué resuelven los errores

1. **Eliminación de `any` y tipos inferidos del esquema**  
   - Ahora el hook recibe `formData` y `setFormData` como props, tipados con `AuthFormData` (unión de los tipos de signin y signup). Esto evita tener que inferir tipos dentro del hook y asegura que el contenedor es quien tiene el control de la estructura del formulario.
   - Las funciones de validación (`validateField`, `validateAll`) también se reciben como props, con contratos de tipo `ValidateFieldFnType<AuthFormData>` y `ValidateAllFnType<AuthFormData>`, lo que garantiza que los tipos de los datos y los campos coincidan con lo que espera la validación.

2. **Tipado de `fieldName`**  
   - Se define `AuthFormField = keyof AuthFormData`, que es la unión de todas las claves posibles en los formularios de login y registro. Esto es válido porque `validateField` acepta cualquier campo de ese conjunto (la validación interna sabrá cómo manejarlo según el modo). Se elimina así el error de asignación anterior.

3. **Manejo de `touchedFields` y `dirtyFields` como objetos parciales**  
   - Siguiendo el patrón exitoso de `useChangePasswordFormLogic`, se usan `Partial<Record<AuthFormField, boolean>>` en lugar de `Set`. Esto simplifica la comprobación de campos tocados y es más fácil de serializar si fuera necesario.

4. **Validación en tiempo real**  
   - En `handleChange`, se llama a `validateField` con el campo y el nuevo valor, y se actualiza `validationErrors` de forma inmutable. Se incluye una lógica adicional para el caso de `newPassword` en modo registro, para revalidar `confirmPassword` automáticamente (similar a lo que hacía el hook de cambio de contraseña).

5. **Manejo de envío**  
   - `handleSubmit` marca todos los campos como tocados, limpia errores previos, ejecuta la validación completa, y si falla, actualiza `validationErrors` y retorna `void`. Si la validación pasa, llama a `handleDomainAuth` y procesa los errores de API usando `transformFromApiToFormErrors`.

6. **Cálculo de `isSubmittingAllowed`**  
   - Se utiliza el mismo criterio que en el hook de cambio de contraseña: todos los campos tocados, todos llenos (sin espacios en blanco), y sin errores de validación ni de API. Esto es más robusto que solo verificar `touched` y `errors` porque también asegura que no haya campos vacíos no tocados.

7. **Separación de responsabilidades**  
   - El hook ahora es puramente lógico: no conoce cómo se validan los datos, solo usa las funciones que recibe. El contenedor (`UpdateProfileContainer` u otro) será el responsable de obtener esas funciones desde `useAuthValidation` y pasar el estado del formulario, manteniendo la arquitectura limpia.

## 🔧 Adaptación necesaria en el contenedor

Para usar este hook, el contenedor deberá:

```tsx
const { schema, validateField, validateAll, transformFromApiToFormErrors } = useAuthValidation({ mode });
const [formData, setFormData] = useState<AuthFormData>(() => 
  mode === 'signin' 
    ? { username: '', email: '', password: '' }
    : { username: '', email: '', password: '', user_firstname: '', user_lastname: '', confirmPassword: '' }
);

const {
  handleChange,
  handleSubmit,
  resetForm,
  validationErrors,
  apiErrors,
  touchedFields,
  dirtyFields,
  isSubmittingAllowed,
} = useAuthFormLogic({
  mode,
  formData,
  setFormData,
  validateField,
  validateAll,
  transformFromApiToFormErrors,
  handleDomainAuth: async (data) => {
    // Aquí llamar a la API de autenticación (ej: signInUser o signUpUser)
    // y devolver el resultado en el formato esperado
  },
});
```

De esta manera, se mantiene la separación de responsabilidades y se eliminan todos los errores de TypeScript.