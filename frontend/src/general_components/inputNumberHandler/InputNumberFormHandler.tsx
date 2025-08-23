
import useInputNumberHandler from '../../hooks/useInputNumberHandler.ts';
import { FormNumberInputType } from '../../types/types';

type InputNumberFormHandlerPropType<T> = {
  validationMessages: {
    [key: string]: string;
  };
  setValidationMessages: React.Dispatch<
    React.SetStateAction<{
      [key: string]: string;
    }>
  >;
  keyName: string;
  placeholderText: string;
  formData: FormNumberInputType;
  setFormData: React.Dispatch<React.SetStateAction<FormNumberInputType>>;
  setStateData: React.Dispatch<React.SetStateAction<T>>;
};

//------
function InputNumberFormHandler<T>({
  setValidationMessages,
  keyName,
  placeholderText,
  formData,
  setFormData,
  setStateData,
}: InputNumberFormHandlerPropType<T>) {

  const { inputNumberHandlerFn } = useInputNumberHandler(
    setFormData,
    setValidationMessages,
    setStateData
  );

  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;
    inputNumberHandlerFn(name, value);
  }
  
  return (
    <>
      <input
        className={'input__container'}
        type='text'
        name={keyName}
        placeholder={placeholderText}
        value={formData[keyName]??""}
        onChange={inputHandler}
      />
    </>
  );
}

export default InputNumberFormHandler;
