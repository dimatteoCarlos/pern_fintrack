// frontend/src/general_components/datepicker/Datepicker.tsx

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './styles/datepicker-styles.css';
//-------
// import { showDate } from '../../helpers/functions';
import { VariantType } from '../../types/types';
import React from 'react';

//to express date in spanish
// import es  from 'date-fns/locale/es';
// import { registerLocale } from 'react-datepicker';
// registerLocale('es', es, );

//-------
type DatePickerProps = {
  date: Date;
  changeDate: (selectedDate: Date) => void;
  variant?: VariantType;
  isReset?: boolean;
};

// ⚙️ Config estándar
const DATE_FORMAT = "dd/MMM/yyyy"

const MIN_DATE = new Date(1900, 0, 1)
const MAX_DATE = new Date(2100, 0, 1)


//-------------------------------------
// 🧩 Custom read-only input
//react-datepicker recommends the usage of forwardRef to avoid focus problems.
const ReadOnlyInput = React.forwardRef<
 HTMLInputElement,
 React.InputHTMLAttributes<HTMLInputElement>
>((props, ref) => {

 return (
  <input
   {...props}
   ref={ref}
   readOnly
   inputMode="none"
   onPaste={(e) => e.preventDefault()}
  />
 )

 })
//--------------------
function Datepicker({
  date ,
  changeDate,
  variant,
}: DatePickerProps) {

const handleChange = React.useCallback(

  (selectedDate: Date | null) => {

   if (!selectedDate) return

   changeDate(selectedDate)

  },

  [changeDate]

 )

//---
 return (
  <DatePicker
   selected={date}
   onChange = {handleChange}

   showYearDropdown
   scrollableMonthYearDropdown
   yearDropdownItemNumber={100}

   placeholderText='DD/MM/YYYY'

   dateFormat={DATE_FORMAT}

   minDate={MIN_DATE}

   maxDate={MAX_DATE}

   shouldCloseOnSelect

   customInput={<ReadOnlyInput />}

   className={
     variant == 'tracker' || variant == 'light'
       ? 'tracker__inside__datepicker'
       : 'form__inside__datepicker'
   }
    />
  );
}

// export default Datepicker;

// Fast refresh: update the code without reloading the pag, and, since it can't handle anonymous components. Add the name to a constant to your export.eslint(react-refresh/only-export-components)

const MemoizedDatepicker = React.memo(Datepicker);

MemoizedDatepicker.displayName = 'Datepicker';

export default MemoizedDatepicker;
