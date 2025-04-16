import { Link } from 'react-router-dom';
import { useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';

import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import FormDatepicker from '../../../general_components/datepicker/Datepicker.tsx';

import SummaryDetailBox from '../../../general_components/summaryDetailBox/SummaryDetailBox.tsx';
import PlusSignSvg from '../../../assets/PlusSignSvg.svg';
import '../styles/forms-styles.css';
import {
  ACCOUNT_TYPE_DEFAULT,
  VARIANT_FORM,
} from '../../../helpers/constants.ts';
// import { StatusSquare } from '../../../general_components/boxComponents.tsx';

function PocketDetail() {
  //temporary data
  const pocketInfo = {
    name: 'pocket name',
    note: 'Description',
    date: new Date(),
    account: '',
    amount: '0',
  };
  //summary data
  const summaryData = {
    title: 'target amount',
    amount: 1112.11,
    subtitle1: '$built',
    subtitle2: 'status',
  };

  const accountOptions = ACCOUNT_TYPE_DEFAULT; //define the logic to get the options from backend
  //Account Options
  const accountSelectionProp = {
    title: 'account',
    options: accountOptions,
    variant: VARIANT_FORM, //stablishes the custom styles to use in selection dropdown component
  };

  const initialPocketDetail = {
    pocketInfo,
  };

  const [pocketDetail, setPocketDetail] = useState(initialPocketDetail);
  const [isReset, setIsReset] = useState<boolean>(false);

  //--functions---
  function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    setPocketDetail((prevState) => ({
      ...prevState,
      pocketInfo: { ...pocketInfo, [e.target.name]: e.target.value },
    }));
  }

  function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setPocketDetail(initialPocketDetail);
  }

  function accountSelectHandler(
    selectedOption: {
      value: string; //check any
      label: string;
    } | null
  ) {
    setPocketDetail((prev) => ({
      ...prev,
      pocketInfo: { ...pocketInfo,
         account: selectedOption!.value },
    }));
    console.log('selectedOption', selectedOption);
  }

  function changeDesiredDate(selectedDate: Date) {
    setPocketDetail((prevState) => ({
      ...prevState,
      pocketInfo: { ...pocketInfo, date: selectedDate },
    }));
  }

  return (
    <>
      <section className='page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div className='main__title--container'>
            <Link to='/budget' relative='path' className='iconLeftArrow'>
              <LeftArrowLightSvg />
            </Link>
            <div className='form__title'>{pocketInfo.name}</div>
            <Link to='edit' className='flx-col-center icon3dots'>
              <Dots3LightSvg />
            </Link>
          </div>
        </div>

        <SummaryDetailBox summaryData={summaryData}></SummaryDetailBox>

        <form className='form__box'>
          <div className='form__container'>
            <div className='input__box'>
              <label className='label form__title'>{'note'}</label>
              <input
                type='text'
                className={`input__container`}
                placeholder={`${'description'}`}
                onChange={inputHandler}
                name={'note'}
                value={pocketDetail.pocketInfo['note']}
              />
            </div>

            {/* datepicker */}

            <label className='label '>{'Desired Date'}</label>

            <div className='form__datepicker__container'>
              <FormDatepicker
                changeDate={changeDesiredDate}
                date={pocketDetail.pocketInfo.date}
                variant={'form'}
              ></FormDatepicker>
            </div>
          </div>

          <div className='input__box'>
            <label className='label form__title'>{'Add Money'}</label>

            <DropDownSelection
              dropDownOptions={accountSelectionProp}
              updateOptionHandler={accountSelectHandler}
              isReset={isReset}
              setIsReset={setIsReset}
            />

            <div className='inputAmountAndPlusSign'>
              <input
                type='text'
                className={`input__container input__container--amount`}
                placeholder={`0,00`}
                name={'amount'}
                onChange={inputHandler}
                value={pocketDetail.pocketInfo.amount}
                style={{ fontSize: '1.25rem', padding: '0 0.75rem' }}
              />

              <Link to='' className='flx-col-center iconPlusSign'>
                <PlusSignSvg />
              </Link>
            </div>
          </div>

          <div className='submit__btn__container'>
            <FormSubmitBtn onClickHandler={onSubmitForm}>save</FormSubmitBtn>
          </div>
        </form>
      </section>
    </>
  );
}

export default PocketDetail;
