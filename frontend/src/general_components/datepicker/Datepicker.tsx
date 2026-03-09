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
//---
 return (
  <DatePicker
   selected={date}
   // onChange={(date) => changeDate(date??new Date())}

   onChange = {(date)=>{if(!date) return
   changeDate(date)}}

   showYearDropdown
   scrollableMonthYearDropdown
   placeholderText='DD/MM/YYYY'
   dateFormat='dd/MMM/yyyy'

  customInput={<ReadOnlyInput />}

  // customInput={<input readOnly inputMode='none' />} //not showing mobile keyboard

   className={
     variant == 'tracker' || variant == 'light'
       ? 'tracker__inside__datepicker'
       : 'form__inside__datepicker'
   }
    />
  );
}

export default Datepicker;
