//frontend/src/pages/forms/newPocket/NewPocket.tsx/NewPocket.tsx
// 🎯 IMPORTS
import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/forms-styles.css';

// 🛠️ CUSTOM HOOKS & UTILITIES
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.ts';
import { useCurrencyPreview } from '../../../hooks/useCurrencyPreview.ts';
import useAuth from '../../../../auth/hooks/useAuth.ts';
import { validationData } from '../../../validations/utils/custom_validation.ts';
import { normalizeError } from '../../../helpers/normalizeError.ts';
import {
  numberFormatCurrency,
  toCalendarDay,
} from '../../../helpers/functions.ts';
import { createPocket } from '../../../api/pocketApi.ts';
import { usePocketDetailStore } from '../../../stores/usePocketDetailStore.ts';
import { usePocketBoardStore } from '../../../stores/usePocketBoardStore.ts';

// 📦 COMPONENTS
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import FormDatepicker from '../../../general_components/datepicker/Datepicker.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import RateTooltip from '../../../general_components/rateTooltip/RateTooltip.tsx';

// 🖼️ ASSETS
import LeftArrowSvg from '../../../../assets/LeftArrowSvg.svg';

// 🏷️ TYPES & CONSTANTS
import { CurrencyType, FormNumberInputType } from '../../../types/types.ts';
import { CreatePocketBody } from '../../../types/pocketTypes.ts';
import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';

import { NAME_MAX_LENGTHS } from '../../../validations/utils/inputConstraints/nameMaxLengths.ts';
import CharacterCounter from '../../../general_components/characterCounter/CharacterCounter.tsx';

// 📋 TYPE DEFINITIONS
type PocketDataType = {
  name: string;
  note: string;
  currency?: CurrencyType;
  desiredDate: Date;
  amount?: number | '';
};

// ⚙️ CONSTANTS & INITIAL STATES
const defaultCurrency = DEFAULT_CURRENCY;
const initialNewPocketData: PocketDataType = {
  name: '',
  note: '',
  amount: '',
  desiredDate: new Date(),
  currency: defaultCurrency,
};

// The floor the calendar offers, read from the device. It is ergonomics, not
// the rule: the server refuses a past deadline on the OWNER's calendar, which
// is the only calendar that can settle it. Today itself is offered, because a
// goal due this month is a real goal.
const startOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const formDataNumber = { keyName: 'amount', title: 'target' };
const initialFormData: FormNumberInputType = {
  [formDataNumber.keyName]: '',
};
// =============================
// 🎯 COMPONENT DEFINITION
// =============================
function NewPocket() {
  const location = useLocation();
  const navigateTo = useNavigate();
  // console.log("🚀 ~ NewPocket ~ location:", location)
  //-------------------------------------

  // 🏁 STATE MANAGEMENT
  const { isAuthenticated, isCheckingAuth } = useAuth();

  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);

  const [pocketData, setPocketData] =
    useState<PocketDataType>(initialNewPocketData);

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  // const [isReset, setIsReset] = useState<boolean>(false);
  const [messageToUser, setMessageToUser] = useState<
    { message: string; status?: number } | string | null | undefined
  >(null);

  // 🌐 SUBMISSION STATE
  // POST /api/fintrack/pocket, through the module's own client.
  //
  // Local state rather than useFetchLoad, because the answer is not data this
  // screen renders: it is the next screen's payload, handed to the detail store
  // on its way past. A hook that holds the response would keep a copy of a
  // pocket this component no longer shows.
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  //-----------------------------------
  // 🎮 EVENT HANDLER HOOKS
  //event handler hook for number input handling
  const { inputNumberHandlerFn } = useInputNumberHandler(
    setFormData,
    setValidationMessages,
    setPocketData,
  );
  //---------------------------------------
  // ✨ INPUT HANDLERS
  function inputHandler(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    e.preventDefault();
    const { name, value } = e.target;

    if (name === formDataNumber.keyName) {
      // console.log('formDataNumber.keyName', formDataNumber.keyName,formDataNumber)
      inputNumberHandlerFn(name, value);
    } else {
      setPocketData((prev) => ({ ...prev, [name]: value }));
    }
  }
  //---
  const changeDesiredDate = useCallback((selectedDate: Date): void => {
    setPocketData((data) => ({
      ...data,
      desiredDate: selectedDate,
    }));
  }, []);
  //---
  const selectedCurrency = pocketData.currency ?? defaultCurrency;

  function updateDataCurrency(currency: CurrencyType) {
    setPocketData((data) => ({ ...data, currency }));
  }

  // States what the backend will store as the target, which is the figure the
  // pocket detail compares against the balance. Reads the rates already held in
  // the store, so it issues no request.
  const { targetCurrencyPreview, rate, direction } = useCurrencyPreview(
    formData[formDataNumber.keyName],
    selectedCurrency,
  );

  const isAmountError = !!validationMessages[formDataNumber.keyName]
    ?.trim()
    .startsWith('*');

  const showRatePreview = !!targetCurrencyPreview && !isAmountError;

  const rateTooltipText =
    rate && direction
      ? `${direction}\nrate: ${numberFormatCurrency(rate, 2, undefined, 'es-ES')}`
      : '';

  // 📤 FORM SUBMISSION LOGIC (onSubmitForm)
  async function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    // console.log('onSubmitForm');

    // 🔐 AUTHENTICATION CHECK.BEFORE SUBMISSION
    if (!isAuthenticated) {
      setMessageToUser('Your session has expired. Please log in again.');
      // navigateTo(AUTH_ROUTE);
      return;
    }

    // ✅ DATA FORM VALIDATION
    const newValidationMessages = {
      ...validationData(pocketData, {
        nonZeroFields: ['amount'],
      }),
    };
    // console.log('mensajes de validacion:', { newValidationMessages });

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }

    // 🚀 API REQUEST EXECUTION
    setIsSubmitting(true);
    setMessageToUser(null);

    try {
      // The five keys the strict schema accepts. `type` and `user` are gone:
      // the type belonged to the retired account model, and identity comes
      // from the token — sending either is now a 400, not a field ignored.
      const payload: CreatePocketBody = {
        name: pocketData.name.toLowerCase().trim(),
        currency: pocketData.currency ?? defaultCurrency,
        targetAmount: Number(pocketData.amount),
        // The day the user pointed at, on the user's own calendar. Converted
        // exactly once, here, and never sent as an instant.
        desiredDate: toCalendarDay(pocketData.desiredDate),
      };

      // Omitted rather than sent empty: the column is nullable and '' is a note
      // nobody wrote.
      const note = pocketData.note.trim();
      if (note) payload.note = note;

      const detail = await createPocket(payload);

      // 🔄 RESET FORM ON SUCCESS
      setValidationMessages({});
      setFormData(initialFormData);
      setPocketData(initialNewPocketData);

      // The 201 carried the whole detail payload, so the screen it opens is
      // already answered and asks for nothing. The board is only marked stale:
      // it refetches if and when the user goes back to it.
      usePocketDetailStore.getState().setDetail(detail);
      usePocketBoardStore.getState().invalidate();

      navigateTo(`/fintrack/pocket/pockets/${detail.pocket.pocketId}`, {
        state: { previousRoute: '/fintrack/pocket' },
      });
    } catch (error) {
      // 🚨 ERROR HANDLING
      // One path for every failure. The client throws on a refused request as
      // well as on a network fault, so a 400 from the strict schema and a lost
      // connection land in the same place and both leave the form filled in.
      console.error('🔥 Error creating the pocket', error);
      const { message, status } = normalizeError(error);
      setMessageToUser({ message, status });
    } finally {
      setIsSubmitting(false);
    }
  }

  // 🚫 FORM DISABLE STATE
  const isFormDisabled = !isAuthenticated;
  //==============================================
  // 🛡️ AUTHENTICATION GUARD - PREVENT RENDERING IF NOT AUTHENTICATED
  if (isCheckingAuth) {
    return (
      <section className='newPocket__page page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div>Checking authentication...</div>
          </div>
        </div>
      </section>
    );
  }

  // 🚫 REDIRECT IF NOT AUTHENTICATED - ADDITIONAL PROTECTION LAYER
  if (!isAuthenticated) {
    return (
      <section className='newPocket__page page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h3>Authentication Required</h3>
            <p>Please log in to create a new pocket.</p>
          </div>
        </div>
      </section>
    );
  }
  // console.log('desired_date',pocketData.desiredDate)
  //-----------------------
  // 🎨 RENDER COMPONENT
  return (
    <section className='newPocket__page page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='page__content'>
        {/* 📱 HEADER SECTION */}
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

        {/* 🆕 MENSAJE DE NO AUTENTICADO
    {!isAuthenticated && (
    <div className='error-message' style={{ margin: '1rem 0', padding: '1rem' }}>
      Please log in to create a new account
    </div>
      )}      */}

        {/* 📝 FORM SECTION */}
        <form className='form__box' autoComplete='off'>
          <div className='container--pocketName form__container'>
            {/* 📛 NAME INPUT */}
            <div className='input__box'>
              <label htmlFor='name' className='label forms__label'>
                {'Name'}
                <CharacterCounter
                  value={pocketData.name}
                  maxLength={NAME_MAX_LENGTHS.pocket_name}
                />
                &nbsp;
                <span className='validation__errMsg'>
                  {validationMessages['name']}
                </span>
              </label>

              <input
                type='text'
                className={`input__container`}
                placeholder={`${'purpose/name'}`}
                id={'name'}
                name={'name'}
                onChange={inputHandler}
                value={pocketData['name']}
                disabled={isFormDisabled}
                maxLength={NAME_MAX_LENGTHS.pocket_name}
                autoComplete='off'
              />
            </div>
            {/* 📝 NOTE INPUT */}
            <div className='input__box'>
              <label htmlFor='note' className='label forms__label'>
                {'Note'}
                <CharacterCounter
                  value={pocketData.note}
                  maxLength={NAME_MAX_LENGTHS.note}
                />
                &nbsp;
                <span className='validation__errMsg'>
                  {validationMessages['note']}
                </span>
              </label>

              <textarea
                className={`input__container`}
                placeholder={`${'description'}`}
                onChange={inputHandler}
                id={'note'}
                name={'note'}
                value={pocketData['note']}
                maxLength={NAME_MAX_LENGTHS.note}
                autoComplete='off'
              />
            </div>

            {/* 💰 TARGET AMOUNT INPUT */}
            {/* Target Amount */}
            {/* Label and conversion message share a row, as in New Category and
                New Account: the message states what will be stored, and the
                rate tooltip opens over it. The message sits outside the label
                so hovering it does not focus the input. */}
            <div className='form__label-row'>
              <label htmlFor={formDataNumber.keyName} className='form__title1'>
                {'Target Amount'}

                <CharacterCounter
                  value={formData[formDataNumber.keyName] || ''}
                  maxLength={15}
                />

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

              {showRatePreview && (
                <RateTooltip
                  tipText={rateTooltipText}
                  surface='dark'
                  placement='anchor-left'
                >
                  <span className='form__fx-preview'>
                    {targetCurrencyPreview}
                  </span>
                </RateTooltip>
              )}
            </div>

            <div className='form__amount-row'>
              <input
                className={`input__container`}
                type='text'
                id={formDataNumber.keyName}
                name={formDataNumber.keyName}
                placeholder={formDataNumber.keyName}
                value={formData[formDataNumber.keyName]}
                onChange={inputHandler}
                maxLength={15}
                autoComplete='off'
              />

              <CurrencyBadge
                variant={'form'}
                updateOutsideCurrencyData={updateDataCurrency}
                currency={selectedCurrency}
              />
            </div>

            {/* 📅 DATE PICKER */}
            <label className='label '>
              {'Desired Date'}&nbsp;
              <span className='validation__errMsg'>
                {validationMessages['date']}
              </span>
            </label>

            <div className='form__datepicker__container'>
              <FormDatepicker
                changeDate={changeDesiredDate} //onChange
                date={pocketData.desiredDate}
                variant={'form'}
                minDate={startOfToday()}
                popperClassName='pocket-datepicker-popper'
              />
            </div>
          </div>{' '}
          {/* END. container--pocketName form__container*/}
          {/* 💾 SUBMIT BUTTON */}
          <FormSubmitBtn
            onClickHandler={onSubmitForm}
            disabled={isSubmitting || isFormDisabled}
          >
            save
          </FormSubmitBtn>
        </form>

        {/* 💬 USER MESSAGES */}
        <MessageToUser
          isLoading={isSubmitting}
          messageToUser={messageToUser}
          variant='form'
        />
      </div>
    </section>
  );
}

export default NewPocket;
