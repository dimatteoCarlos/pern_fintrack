//src/general_components/radioIniput/RadionInput.tsx
//victorPace= value id className type

import './styles/radioInput-styles.css';
type RadioInputPropsType<T = string> = {
  radioOptionSelected: T;
  inputRadioOptions: { [key: string]: T }[];
  setRadioOptionSelected: (radioOptionSelected: T) => void;
  title?: string;
  labelId: string;
};

const RadioInput = ({
  radioOptionSelected,
  inputRadioOptions,
  setRadioOptionSelected,
  title = '',
  labelId,
}: RadioInputPropsType) => {
  //vitorpace
  const onChangeHandleRadio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelectedOption = e.target.value;
    setRadioOptionSelected(newSelectedOption);
  };

  const ratioTitle = title;
  //---

  return (
    <>
      <div className='radio-input__container '>
        <div className='radio-input__title'>{ratioTitle}</div>
        <div className='radio-input__options'>
          {inputRadioOptions?.map((option, index) => (
            <div
              className='radio-input__option'
              key={`radio-input__option-${index}`}
            >
              <input
                type='radio'
                id={`option-${labelId}-${index}`}
                value={option.value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onChangeHandleRadio(e)
                }
                checked={option.value === radioOptionSelected}
                className='radio-input__radio'
              />
              <label
                htmlFor={`option-${labelId}-${index}`}
                className='radio-input__label'
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default RadioInput;
