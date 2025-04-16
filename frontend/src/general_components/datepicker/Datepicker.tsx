//TrackerDatePicker.tsx
import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './styles/datepicker-styles.css';
//-------
import { showDate } from '../../helpers/functions';
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
  date = new Date(),
  changeDate,
  isReset,
  variant,
}: DatePickerProps) {
  // Handle state selected date
  const [selectedDate, setSelectedDate] = useState<Date>(date);

  //Handle date changes
  const dateChangeHandler = (date: Date) => {
    const dateChanged = isReset ? new Date() : date;

    console.log('isReset:', isReset, 'datechanged:', showDate(dateChanged));

    setSelectedDate(dateChanged);
    changeDate(dateChanged);
  };

  useEffect(() => {
    if (isReset) {
      setSelectedDate(new Date());
    }
  }, [isReset]);
  // console.log(document.querySelector('.react-datepicker-popper')?.parentElement)

  return (
    <DatePicker
      selected={isReset ? new Date() : selectedDate}
      onChange={(date) => dateChangeHandler(date!)}
      showYearDropdown
      scrollableMonthYearDropdown
      placeholderText='DD/MM/YYYY'
      dateFormat='dd/MMM/YYY'
      customInput={<input inputMode='none' />} //not showing mobile keyboard
      className={
        variant == 'tracker' || variant == 'light'
          ? 'tracker__inside__datepicker'
          : 'form__inside__datepicker'
      }
      // className='tracker__inside__datepicker'
    />
  );
}

export default Datepicker;
