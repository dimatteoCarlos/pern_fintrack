//NewPocket.tsx
import { useState } from 'react';
import LeftArrowSvg from '../../../assets/LeftArrowSvg.svg';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { Link, useLocation } from 'react-router-dom';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import { validationData } from '../../../helpers/functions.ts';
import { CurrencyType, FormNumberInputType } from '../../../types/types.ts';
import FormDatepicker from '../../../general_components/datepicker/Datepicker.tsx';
import '../styles/forms-styles.css';
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.tsx';
//----Temporary initial values----------
type PocketDataType = {
  name: string;
  note: string;
  target: number | '';
  saved?: number;
  date: Date;
  currency?: CurrencyType;
};
const initialNewPocketData: PocketDataType = {
  name: '',
  note: '',
  target: '',
  date: new Date(),
};
const formDataNumber = { keyName: 'target', title: 'target' };
const initialFormData: FormNumberInputType = {
  target: '',
};
//-------------------------
function NewPocket() {
  const location = useLocation();
  //where to get saved
  const saved = 'alguito'; //Need to define what this is.
  //---states------
  const [pocketData, setPocketData] =
    useState<PocketDataType>(initialNewPocketData);
  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});
  const [isReset, setIsReset] = useState<boolean>(false);
  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);
  //functions---
  const { inputNumberHandlerFn } = useInputNumberHandler(
    setFormData,
    setValidationMessages,
    setPocketData
  );
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    const { name, value } = e.target;
    if (name === formDataNumber.keyName) {
      inputNumberHandlerFn(name, value);
    } else {
      setPocketData((prev) => ({ ...prev, [name]: value }));
    }
  }
  //--
  function changeDesiredDate(selectedDate: Date): void {
    setPocketData((data) => ({
      ...data,
      // desiredDate: selectedDate.toDateString(),
      date: selectedDate,
    }));
  }
  //---
  function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    console.log('onSubmitForm');
    const newValidationMessages = { ...validationData(pocketData) };
    // console.log('mensajes de validacion:', { newValidationMessages });
    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //-------------------------------------------------------
    //POST the new pocket data into database

    console.log('New pocket data to POST:', { pocketData });
    console.log('check this:', formData, formDataNumber);

    const pocketAccountData = {
      type: 'pocket_saving',
      name: pocketData.name,
      currency: 'usd',
      amount: formDataNumber.keyName || pocketData.target,
      date: new Date(),
      //---
      target: formDataNumber.keyName || pocketData.target,
      desired_date: pocketData.date, //desired date
      note: pocketData.note,
    };
    console.log(pocketAccountData);

    //-------------------------------------------------------
    //resetting form values
    setIsReset(true);
    setValidationMessages({});
    setFormData(initialFormData);

    setPocketData(initialNewPocketData);
    setPocketData((prev) => ({ ...prev, date: new Date() }));
    setTimeout(() => setIsReset(false), 500);
  }
  return (
    <section className='newPocket__page page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='page__content'>
        <div className='main__title--container'>
          <Link
            to={location.state.previousRoute}
            relative='path'
            className='iconLeftArrow'
          >
            <LeftArrowSvg />
          </Link>
          <div className='form__title'>{'New Pocket'}</div>
        </div>
        {/*  */}
        <form className='form__box'>
          <div className='container--pocketName form__container'>
            <div className='input__box'>
              <label htmlFor='name' className='label form__title'>
                {'Name'}&nbsp;
                <span className='validation__errMsg'>
                  {validationMessages['name']}
                </span>
              </label>
              <input
                type='text'
                className={`input__container`}
                placeholder={`${'purpose/name'}`}
                onChange={inputHandler}
                name={'name'}
                value={pocketData['name']}
              />
            </div>
            <div className='input__box'>
              <label htmlFor='note' className='label form__title'>
                {'Note'}&nbsp;
                <span className='validation__errMsg'>
                  {validationMessages['note']}
                </span>
              </label>
              <input
                type='text'
                className={`input__container`}
                placeholder={`${'description'}`}
                onChange={inputHandler}
                name={'note'}
                value={pocketData['note']}
              />
            </div>{' '}
            {/* Target Amount */}
            <label htmlFor={formDataNumber.keyName} className='form__title1'>
              {'Target Amount'}
              <div
                className='validation__errMsg'
                style={{
                  color: validationMessages[formDataNumber.keyName]
                    ?.toLocaleLowerCase()
                    .includes('format:')
                    ? 'var(--lightSuccess'
                    : 'var(--error',
                }}
              >
                {validationMessages[formDataNumber.keyName]}
              </div>
            </label>
            <div className='targetAmount input__container '>
              <div className='target__label__amount'>
                <label
                  htmlFor={formDataNumber.keyName}
                  className='label label__target'
                >
                  {formDataNumber.title}&nbsp;
                </label>
                <input
                  className={'input__targetAmount'}
                  type='text'
                  name={formDataNumber.keyName}
                  placeholder={formDataNumber.keyName}
                  onChange={inputHandler}
                  value={formData[formDataNumber.keyName]}
                />
              </div>
              <div className='target__label__saved'>
                saved: {pocketData['saved'] ?? saved}
              </div>
            </div>
            {/* datepicker */}
            <label className='label '>
              {'Desired Date'}&nbsp;
              <span className='validation__errMsg'>
                {validationMessages['date']}
              </span>
            </label>
            <div className='form__datepicker__container'>
              <FormDatepicker
                changeDate={changeDesiredDate}
                date={pocketData.date}
                variant={'form'}
                isReset={isReset}
              />
            </div>
          </div>
          {/* save button */}
          <FormSubmitBtn onClickHandler={onSubmitForm}>save</FormSubmitBtn>
        </form>
      </div>
    </section>
  );
}

export default NewPocket;
