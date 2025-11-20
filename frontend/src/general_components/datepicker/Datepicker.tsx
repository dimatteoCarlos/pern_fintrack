//TrackerDatePicker.tsxDatepicker
// import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './styles/datepicker-styles.css';
//-------
// import { showDate } from '../../helpers/functions';
import { VariantType } from '../../types/types';

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

function Datepicker({
  date ,
  changeDate,
  variant,
}: DatePickerProps) {
//---
 return (
  <DatePicker
   selected={date}
   onChange={(date) => changeDate(date??new Date())}
   showYearDropdown
   scrollableMonthYearDropdown
   placeholderText='DD/MM/YYYY'
   dateFormat='dd/MMM/yyyy'
   customInput={<input inputMode='none' />} //not showing mobile keyboard
   className={
     variant == 'tracker' || variant == 'light'
       ? 'tracker__inside__datepicker'
       : 'form__inside__datepicker'
   }
    />
  );
}

export default Datepicker;
