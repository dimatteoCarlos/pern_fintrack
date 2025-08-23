// frontend\src\general_components\dropdownSelection\DropDownSelection.tsx
import Select, {
  components,
  DropdownIndicatorProps,
  GroupBase,
  StylesConfig,
  SelectInstance,
  SingleValue,
  MultiValue,
} from 'react-select';
import { useEffect, useRef } from 'react';
import ArrowDownDarkSvg from '../../assets/ArrowDownDarkSvg.svg';
import ArrowDownLightSvg from '../../assets/ArrowDownLightSvg.svg';
import { VariantType, DropdownOptionType } from '../../types/types';

export type DropdownSelectPropType = {
  dropDownOptions: {
    title: string;
    options: DropdownOptionType[];
    variant: VariantType;
  };

  updateOptionHandler: (selectedOption: DropdownOptionType | null) => void;

  setIsReset: (value: boolean) => void;
  isReset: boolean;

  setIsResetDropdown?: (value: boolean) => void;
  isResetDropdown?: boolean;
};

// 1.  `create a DropdownIndicator function that returns DropdownIndicator as component
const createDropdownIndicator =
  (variant: VariantType) =>
  (
    props: DropdownIndicatorProps<
      DropdownOptionType,
      false,
      GroupBase<DropdownOptionType>
    >
  ) =>
    (
      <components.DropdownIndicator {...props}>
        {variant === 'tracker' ? <ArrowDownDarkSvg /> : <ArrowDownLightSvg />}
      </components.DropdownIndicator>
    );

// ✅ Styles function based on `variant`
const createStyles = (
  variant: VariantType
): StylesConfig<DropdownOptionType, false, GroupBase<DropdownOptionType>> => ({
  container: (baseStyles) => ({
    ...baseStyles,
    boxShadow: 'none',
    width: '100%',
    border: 'none',
    borderRadius: '0.75rem',
  }),

  control: (base) => ({
    ...base,
    backgroundColor: variant === 'tracker' ? '#e8e4da' : 'transparent',
    color: variant === 'tracker' ? 'var(--dark)' : 'var(--light)',
    boxShadow: 'none', //this is the contorn line
    border: variant === 'tracker' ? 'none' : '1px solid var(--light)',
    borderRadius: '1rem',
    fontWeight: '500',
    fontSize: '0.875rem',
    cursor: 'pointer',
    textTransform: 'capitalize' as const,
  }),

  placeholder: (baseStyles) => ({
    ...baseStyles,
    color: variant === 'tracker' ? 'var(--dark)' : 'var(--creme)',
  }),

  menu: (base) => ({
    ...base,
    backgroundColor: variant === 'tracker' ? 'white' : 'var(--dark)',
    color: variant === 'tracker' ? 'var(--dark)' : 'var(--light)',
  }),
  
  singleValue: (base) => ({
    ...base,
    color: variant === 'tracker' ? 'var(--dark)' : 'var(--creme)',
  }),

  option: (provided, state) =>
    variant === 'tracker'
      ? {
          ...provided,
          backgroundColor: state.isSelected ? '#e8e4da' : 'white',
          //variant:tracker
          color: 'var(--dark)', //variant:tracker
          ':active': { backgroundColor: 'transparent' },
          ':hover': { backgroundColor: 'rgba(232, 228, 218 , 0.4)' },
        }
      : //variant: form
        {
          ...provided,
          backgroundColor: state.isSelected ? 'var(--dark)' : 'transparent', //not working as expected
          color: 'var(--creme)',
          borderRadius: '1rem',
          padding: '0.5rem',
          ':active': { backgroundColor: '#333030' },
          ':hover': { backgroundColor: 'hsla(0, 3.00%, 19.40%, 0.50)' },
        },
});
//----------------------------------
//--Main component
function DropDownSelection({
  dropDownOptions,
  updateOptionHandler,
  isReset,
  isResetDropdown,
  setIsReset,setIsResetDropdown, 

}: DropdownSelectPropType) {
  const { title, options, variant } = dropDownOptions;
  // console.log('dropSel:', { title, options, variant });
  const selectRef =
    useRef<
      SelectInstance<DropdownOptionType, false, GroupBase<DropdownOptionType>>
    >(null);

  useEffect(() => {
    if ((isReset || isResetDropdown) && selectRef.current) {
      selectRef.current.clearValue();
      setIsReset(false); //Parent does this
     if(setIsResetDropdown){ setIsResetDropdown(false);}
    }
  }, [isReset, isResetDropdown,setIsResetDropdown, setIsReset]);

  const handleChange = (
    newValue: SingleValue<DropdownOptionType> | MultiValue<DropdownOptionType>
  ) => {
    updateOptionHandler(newValue as SingleValue<DropdownOptionType>);
      };

  return (
    <Select
      options={options}
      onChange={handleChange}
      placeholder={title}
      styles={createStyles(variant)}
      closeMenuOnSelect
      isSearchable={false}
      isClearable
      ref={selectRef}
      menuPlacement={variant === 'tracker' ? 'top' : 'bottom'}
      components={{
        DropdownIndicator: createDropdownIndicator(variant), // passing variant without select props`
      }}
    />
  );
}

export default DropDownSelection;
