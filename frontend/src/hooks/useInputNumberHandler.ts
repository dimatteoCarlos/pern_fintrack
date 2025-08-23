//useInputNumberHandler.ts
import React, { useCallback  } from 'react';
import { checkNumberFormatValue } from '../validations/utils/custom_validation';

//update numeric state and validation messages
function useInputNumberHandler<T>(
  setFormData: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>,
  setValidationMessages: React.Dispatch<
    React.SetStateAction<{
      [key: string]: string;
    }>
  >,
  setStateData: React.Dispatch<React.SetStateAction<T>> ,
  //---
    setIsAmountError?:React.Dispatch<React.SetStateAction<boolean>>,
    setMessageToUser?:React.Dispatch<React.SetStateAction<string | null | undefined>>
  //setFormData for numeric state
) {
  const inputNumberHandlerFn = useCallback(
    (name: string, value: string) => {
      const { formatMessage, isError, valueToSave,valueNumber } =
        checkNumberFormatValue(value);

      setFormData((formData) => ({
        ...formData,
        [name]: value,
      }));

      setValidationMessages((prev) => ({
        ...prev,
        [name]: !isError
          ? ` Format: ${formatMessage}`//""
          : ` * Error: ${formatMessage}`,
      }));

      // console.log('from: useInputNumberHandler', {
      //   formatMessage,
      //   valueNumber,
      //   isError,
      //   valueToSave,
      // });

      if((isError|| valueToSave===0) && setIsAmountError&&setMessageToUser
       ){
        setIsAmountError(true)
        setMessageToUser('Please enter a valid Amount');
        return
      }

    if(setIsAmountError&&setMessageToUser
       ){
      setIsAmountError(false)
      setMessageToUser('');
       }

      setStateData((prev) => ({ ...prev, [name]: valueToSave }));

    return { formatMessage, isError, valueToSave,valueNumber };
    },
    [setFormData, setValidationMessages, setStateData,setIsAmountError,setMessageToUser]
  );

  return { inputNumberHandlerFn  };
}

export default useInputNumberHandler;
