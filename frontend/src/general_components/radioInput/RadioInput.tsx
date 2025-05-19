//src/general_components/radioIniput/RadionInput.tsx
//victorPace= value id className type
// import RadioInput from '../../../general_components/radioInput/RadioInput.tsx';
// import { useState } from 'react';
import './styles/radioInput-styles.css';
type RadioInputPropType = {
  radioOptionSelected: string;
  inputRadioOptions: { [key: string]: string }[];
  setRadioOptionSelected: (radioOptionSelected: string) => void;
  title?: string;
  labelId:string;
};

const RadioInput = ({
  radioOptionSelected,
  inputRadioOptions,
  setRadioOptionSelected,
  title = '',
  labelId
}: RadioInputPropType) => {
  //vitorpace
  const onChangeHandleRadio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelectedOption = e.target.value;
    setRadioOptionSelected(newSelectedOption);
  };

  //---data and state to select type of debit account
  // const inputRadioOptions = [
  //   { label: 'bank', value: 'bank' },
  //   { label: 'investment', value: 'investment' },
  //   { label: 'pocket', value: 'pocket' },
  // ];
  // const initialSelectedOptionState = 'bank';
  const ratioTitle = title;
  // const ratioTitle = 'type';

  // const [radioOptionSelected, setRadioOptionSelected] = useState(
  //   initialSelectedOptionState
  // );
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
              <label htmlFor={`option-${labelId}-${index}`} className='radio-input__label'>
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
