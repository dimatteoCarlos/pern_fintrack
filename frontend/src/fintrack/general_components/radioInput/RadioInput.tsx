// 📍 frontend/src/general_components/radioInput/RadioInput.tsx
//victorPace= value id className type
import './styles/radioInput-styles.css';

//==================================
// 🎯 RADIO INPUT TYPES
// =================================
/**
 * Mode for account type selection
 * - 'inputRadioMode': Traditional radio buttons
 * - 'inputChipMode': Compact chip-style buttons (for mobile)
 */
export type AccountTypeSelectionModeType = 'inputRadioMode' | 'inputChipMode';

/**
 * Props for RadioInput component
 * @template T - Type of the option value (usually string)
 */
export type RadioInputPropsType<T = string> = {
  /** Currently selected option value */
  radioOptionSelected: T;
  /** Array of options to display */
  inputRadioOptions: { value: T; label: string }[];
  /** Callback when selection changes */
  setRadioOptionSelected: (radioOptionSelected: T) => void;
  /** Optional title for the radio group */
  title?: string;
  /** Unique identifier for the group (used in id attributes) */
  labelId: string;
  /** Whether the input is disabled */
  disabled: boolean;
  /** Selection mode: radio buttons or chips */
  accountTypeSelectionMode?: AccountTypeSelectionModeType;
};

// ============================
// 🎯 COMPONENT: RadioInput
// ============================
/**
 * RadioInput component that can display as traditional radio buttons
 * or as horizontal chips (compact mode for mobile)
 */
const RadioInput =  <T extends string>({
  radioOptionSelected,
  inputRadioOptions,
  setRadioOptionSelected,
  title = '',
  labelId,
  disabled=false,
  accountTypeSelectionMode = 'inputRadioMode',
}: RadioInputPropsType<T>) => {
  //victorpacient

  const onChangeHandleRadio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelectedOption = e.target.value as T;
    setRadioOptionSelected(newSelectedOption);
  };

 //---
  const isChipMode = accountTypeSelectionMode === 'inputChipMode';

  const InputOptionsClassName = `radio-input__options ${
   isChipMode ? 'radio-input__options--chip' : ''
  }`;

  //--------------------------
  return (
    <>
      <div className='radio-input__container '>
 {title && <div className='radio-input__title'>{title}</div>}
        <div className={InputOptionsClassName}>
          {inputRadioOptions?.map((option, index) => (
            <div
              className='radio-input__option'
              key={`radio-input__option-${index}`}
            >
              <input
                type='radio'
                id={`option-${labelId}-${index}`}
                value={option.value}
                disabled={disabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onChangeHandleRadio(e)
                }
                checked={option.value === radioOptionSelected}
                className={ 'radio-input__radio'}
              />
              <label
                htmlFor={`option-${labelId}-${index}`}
                className={'radio-input__label'}
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
