// 📁 frontend/src/lib/validation/useChangePasswordValidation.ts

/* ===============================
📦 DEPENDENCIAS
=============================== */
import { useCallback } from "react";
import { ChangePasswordFormDataType } from "../../types/authTypes.ts";
import { changePasswordSchema } from "../zod_schemas/userSchemas.ts";
import { extractErrorMessage } from "../../utils/extractErrorMessge.ts";
import useFieldValidation from "./useFieldValidation.ts";

/* ===============================
🏷️ TIPOS
=============================== */
type PasswordFieldName = keyof ChangePasswordFormDataType;

/**
 * 📝 Tipo de errores transformados para el formulario de cambio de contraseña
 * Separando el `form` para evitar conflictos de TS con los campos de tipo TFieldName
 */
type PasswordFormErrorsType<TFieldName extends string> = Partial<Record<TFieldName, string>> & {
  form?: string;
};

/**
 * Parametros para el hook de validación
 * - `fieldMapping`: mapea nombres de campo backend → frontend
 * - `schema`: esquema Zod para validación
 */
type UseFormValidationParams<TFieldName extends string> = {
  fieldMapping: Record<string, TFieldName>;
  schema: typeof changePasswordSchema;
};

/* ===============================
🔄 HOOK useChangePasswordValidation
=============================== */
export const useChangePasswordValidation = <TFieldName extends string>(
  params: UseFormValidationParams<TFieldName>
) => {
  const { fieldMapping, schema } = params;

  // Hook genérico para validación de campos
  const genericValidation = useFieldValidation<Record<TFieldName, unknown>>(schema, {
    validateOnlyTouched: true,
  });

  /* ===============================
  🔧 TRANSFORMAR ERRORES DE API
  ================================ */
  const transformApiErrors = useCallback(
    (apiError: unknown): PasswordFormErrorsType<TFieldName> => {
      const transformedErrors: PasswordFormErrorsType<TFieldName> = {};

      try {
        if (!apiError) {
          transformedErrors.form = "No error response from server";
          return transformedErrors;
        }

        const errorObj = apiError as Record<string, unknown>;

        // 🔁 CAMBIO: Manejar `fieldErrors` tanto en la raíz como dentro de `details`
        let fieldErrors: Record<string, string[]> | undefined;

        if (
          errorObj.details &&
          typeof errorObj.details === "object" &&
          "fieldErrors" in errorObj.details &&
          typeof (errorObj.details as Record<string, unknown>).fieldErrors === "object"
        ) {
          // ⚠️ Cast seguro, no any
          fieldErrors = (errorObj.details as Record<string, unknown>)
            .fieldErrors as Record<string, string[]>;
        } else if (
          errorObj.fieldErrors &&
          typeof errorObj.fieldErrors === "object"
        ) {
          fieldErrors = errorObj.fieldErrors as Record<string, string[]>;
        }

        // 🔁 CAMBIO: Mapear errores backend → frontend usando fieldMapping
        if (fieldErrors) {
          Object.entries(fieldErrors).forEach(([backendField, messages]) => {
            const frontendField = fieldMapping[backendField];

            if (frontendField && Array.isArray(messages) && messages.length > 0) {
              (transformedErrors as Record<TFieldName, string>)[frontendField as TFieldName] = messages[0]; // Solo primer mensaje
            }
          });
        }

        // 🔁 CAMBIO: fallback global de error
        if (!transformedErrors.form && typeof errorObj.message === "string") {
          transformedErrors.form =
            (errorObj.error as string) || errorObj.message || extractErrorMessage(apiError);
        }
      } catch (error) {
        console.error("❌ Error transforming password API errors:", error);
        transformedErrors.form = "Failed to process server response";
      }

      return transformedErrors;
    },
    [fieldMapping]
  );

  /* ===============================
  🔧 FUNCIONES DE VALIDACIÓN
  ================================ */
  const validateField = useCallback(
    (fieldName: TFieldName, value: unknown, formData?: Partial<Record<TFieldName, unknown>>) => {
      return genericValidation.validateField(fieldName, value, formData);
    },
    [genericValidation]
  );

  const validateAll = useCallback(
    (formData: Partial<Record<TFieldName, unknown>>, touchedFields?: Set<TFieldName>) => {
      return genericValidation.validateAll(formData, touchedFields);
    },
    [genericValidation]
  );

  const createEmptyErrors = useCallback((): PasswordFormErrorsType<TFieldName> => {
    return genericValidation.createEmptyErrors() as PasswordFormErrorsType<TFieldName>;
  }, [genericValidation]);

  /* ===============================
  📤 RETORNO DEL HOOK
  ================================ */
  return {
    validateField,
    validateAll,
    createEmptyErrors,
    transformApiErrors,
    schema: genericValidation.schema,
  };
};

/* ===============================
📝 EXPORTS DE TIPOS
=============================== */
export type { PasswordFieldName, PasswordFormErrorsType };

export default useChangePasswordValidation;
