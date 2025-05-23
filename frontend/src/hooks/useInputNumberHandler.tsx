import React, { useCallback } from 'react';
import { checkNumberFormatValue } from '../helpers/functions';

//update numeric state and validation messages
function useInputNumberHandler<T>(
  setFormData: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>,
  setValidationMessages: React.Dispatch<
    React.SetStateAction<{
      [key: string]: string;
    }>
  >,
  setStateData: React.Dispatch<React.SetStateAction<T>>
) {
  const inputNumberHandlerFn = useCallback(
    (name: string, value: string) => {
      const { formatMessage, isError, valueToSave } =
        checkNumberFormatValue(value);
      // const { formatMessage, valueNumber, isError, valueToSave } =
      //   checkNumberFormatValue(value);
      // Actualizar el estado numerico en el formulario

      setFormData((formData) => ({
        ...formData,
        [name]: value,
      }));

      setValidationMessages((prev) => ({
        ...prev,
        [name]: !isError
          ? ` Format: ${formatMessage}`
          : ` * Error: ${formatMessage}`,
      }));

      setStateData((prev) => ({ ...prev, [name]: valueToSave }));

      // console.log('from: useInputNumberHandler', {
      //   formatMessage,
      //   // valueNumber,
      //   isError,
      //   valueToSave,
      // });
    },
    [setFormData, setValidationMessages, setStateData]
  );

  return { inputNumberHandlerFn };
}

export default useInputNumberHandler;
