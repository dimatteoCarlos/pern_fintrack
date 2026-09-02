// frontend/src/general_components/inputNumberHandler/InputNumberFormHandler.tsx

import useInputNumberHandler from '../../hooks/useInputNumberHandler.ts';

// 💡 Explicit type for input states, just strings for inputs.
type StringInputMapType = {
  [key: string]: string;
};

type InputNumberFormHandlerPropType<T> = {
  validationMessages: {
    [key: string]: string;
  };
  setValidationMessages: React.Dispatch<
    React.SetStateAction<{
      [key: string]: string;
    }>
  >;
  keyName: keyof T;
  placeholderText: string;
  formData: StringInputMapType; //Partial<T>;
  setFormData: React.Dispatch<React.SetStateAction<StringInputMapType>>;
  //<Partial<T>>>;
  setStateData: React.Dispatch<React.SetStateAction<T>>;
  onChangeHandler?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

//------
function InputNumberFormHandler<T>({
  setValidationMessages,
  keyName,
  placeholderText,
  formData,
  setFormData,
  setStateData,
  onChangeHandler,
}: InputNumberFormHandlerPropType<T>) {
  const { inputNumberHandlerFn } = useInputNumberHandler(
    setFormData as React.Dispatch<
      React.SetStateAction<{ [key: string]: string }>
    >, // Aserción general
    setValidationMessages,
    setStateData as React.Dispatch<React.SetStateAction<T>>,
  );

  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;
    inputNumberHandlerFn(name, value);
    onChangeHandler?.(e);
  }

  // 👇 Type assertion segura para el valor
  const currentValue = formData[keyName as string];

  const displayValue =
    currentValue !== undefined && currentValue !== null
      ? String(currentValue)
      : '';

  return (
    <>
      <input
        className={'input__container'}
        type='text'
        /* The label beside it points here with the same key it names the field
           by, so an id derived from anything else would break the pair. */
        id={keyName as string}
        name={keyName as string}
        placeholder={placeholderText}
        value={displayValue}
        onChange={inputHandler}
      />
    </>
  );
}

export default InputNumberFormHandler;
