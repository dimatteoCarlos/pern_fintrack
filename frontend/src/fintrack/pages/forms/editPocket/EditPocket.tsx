//frontend/src/fintrack/pages/forms/editPocket/EditPocket.tsx
//
// The pocket editor. A route rather than a modal, and that is settled on the
// contract rather than on taste: committing and releasing cash answer with the
// entire detail payload, so those repaint the screen underneath them and belong
// in modals, while editing is the one write that needs an addressable slot —
// the three sibling detail cards already established one.
//
// It sits beside the creation form rather than under editionAndDeletion/,
// because it is the same form over the same five fields and the account editor
// reaches a pocket through the retired account model, which this replaces.
//
// What it sends is only what changed. That is not an optimisation: the update
// schema is strict and refuses an empty body, `note: null` clears a note where
// an absent key leaves it alone, and a deadline already in the past is refused
// by the server — so an overdue pocket can only be renamed at all because its
// unchanged deadline is never re-sent.

// 🎯 IMPORTS
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import '../styles/forms-styles.css';

// 🛠️ CUSTOM HOOKS & UTILITIES
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.ts';
import { useCurrencyPreview } from '../../../hooks/useCurrencyPreview.ts';
import useAuth from '../../../../auth/hooks/useAuth.ts';
import { validationData } from '../../../validations/utils/custom_validation.ts';
import { normalizeError } from '../../../helpers/normalizeError.ts';
import {
  fromCalendarDay,
  numberFormatCurrency,
  toCalendarDay,
} from '../../../helpers/functions.ts';
import { editPocket } from '../../../api/pocketApi.ts';
import { usePocketDetailStore } from '../../../stores/usePocketDetailStore.ts';
import { usePocketBoardStore } from '../../../stores/usePocketBoardStore.ts';

// 📦 COMPONENTS
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import FormDatepicker from '../../../general_components/datepicker/Datepicker.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge.tsx';
import RateTooltip from '../../../general_components/rateTooltip/RateTooltip.tsx';
import CharacterCounter from '../../../general_components/characterCounter/CharacterCounter.tsx';

// 🖼️ ASSETS
import LeftArrowSvg from '../../../../assets/LeftArrowSvg.svg';

// 🏷️ TYPES & CONSTANTS
import { CurrencyType, FormNumberInputType } from '../../../types/types.ts';
import { EditPocketBody } from '../../../types/pocketTypes.ts';
import { DEFAULT_CURRENCY } from '../../../helpers/constants.ts';
import { NAME_MAX_LENGTHS } from '../../../validations/utils/inputConstraints/nameMaxLengths.ts';

// 📋 TYPE DEFINITIONS
type PocketDataType = {
  name: string;
  note: string;
  currency?: CurrencyType;
  desiredDate: Date;
  amount?: number | '';
};

type LocationStateType = {
  previousRoute?: string;
};

// ⚙️ CONSTANTS & INITIAL STATES
const formDataNumber = { keyName: 'amount', title: 'target' };

// The floor the calendar offers, read from the device. It is ergonomics, not
// the rule: the server refuses a past deadline on the OWNER's calendar, which
// is the only calendar that can settle it. Today itself is offered, because a
// goal due this month is a real goal.
const startOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// =============================
// 🎯 COMPONENT DEFINITION
// =============================
function EditPocket() {
  const location = useLocation();
  const navigateTo = useNavigate();
  const routeState = location.state as LocationStateType | null;

  // The parameter keeps its name. Renaming it to accountId is what let the old
  // pocket screen spend a pocket id against the account endpoints.
  const { pocketId } = useParams();
  const parsedPocketId = Number(pocketId);
  const hasValidId = Number.isInteger(parsedPocketId) && parsedPocketId > 0;

  const returnRoute =
    routeState?.previousRoute ?? `/fintrack/pocket/pockets/${pocketId}`;

  // 🏁 STATE MANAGEMENT
  const { isAuthenticated, isCheckingAuth } = useAuth();

  const pocket = usePocketDetailStore((store) => store.pocket);
  const isLoaded = usePocketDetailStore((store) => store.isLoaded);
  const detailError = usePocketDetailStore((store) => store.error);
  const fetchDetail = usePocketDetailStore((store) => store.fetchDetail);

  const [formData, setFormData] = useState<FormNumberInputType>({
    [formDataNumber.keyName]: '',
  });

  const [pocketData, setPocketData] = useState<PocketDataType | null>(null);

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [messageToUser, setMessageToUser] = useState<
    { message: string; status?: number } | string | null | undefined
  >(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // The store short-circuits when it already holds this pocket, so arriving
  // from its own detail card costs no request. A refresh or a pasted link finds
  // it empty and asks. The screen is NOT cleared on the way out: the detail
  // card this returns to is the same pocket, and clearing would make it fetch
  // again what the save already answered with.
  useEffect(() => {
    if (!hasValidId) return;

    void fetchDetail(parsedPocketId);
  }, [parsedPocketId, hasValidId, fetchDetail]);

  // Seeded once the pocket is in hand, and once only: re-seeding on every store
  // change would overwrite what the owner is typing whenever anything else
  // invalidated the detail.
  useEffect(() => {
    if (pocket === null || pocketData !== null) return;

    setPocketData({
      name: pocket.name,
      note: pocket.note ?? '',
      currency: pocket.currency,
      // Built from the parts of the calendar label. new Date() on one of these
      // is UTC midnight and opens the picker on the previous day west of UTC.
      desiredDate: fromCalendarDay(pocket.desiredDate) ?? startOfToday(),
      // Seeded as well as shown, because the validator reads the amount off
      // this object and not off the input's own string. Left unset it would
      // report the target as missing on a pocket that has one.
      amount: pocket.target,
    });

    setFormData({ [formDataNumber.keyName]: String(pocket.target) });
  }, [pocket, pocketData]);

  // 🎮 EVENT HANDLER HOOKS
  //
  // The hook writes the parsed amount onto the same object the rest of the form
  // lives on, and it is typed for a state that is always present. This one is
  // null until the pocket lands, so the setter is wrapped rather than cast: a
  // cast would let the hook spread null and leave an object carrying the amount
  // and nothing else. The wrapper cannot fire before the form renders, which is
  // after the pocket is in hand, so leaving null alone is a guard and not a
  // dropped keystroke.
  const setLoadedPocketData: React.Dispatch<
    React.SetStateAction<PocketDataType>
  > = useCallback((action) => {
    setPocketData((previous) => {
      if (previous === null) return previous;

      return typeof action === 'function' ? action(previous) : action;
    });
  }, []);

  const { inputNumberHandlerFn } = useInputNumberHandler(
    setFormData,
    setValidationMessages,
    setLoadedPocketData,
  );

  // ✨ INPUT HANDLERS
  function inputHandler(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    e.preventDefault();
    const { name, value } = e.target;

    if (name === formDataNumber.keyName) {
      inputNumberHandlerFn(name, value);
    } else {
      setPocketData((prev) => (prev ? { ...prev, [name]: value } : prev));
    }
  }

  const changeDesiredDate = useCallback((selectedDate: Date): void => {
    setPocketData((data) =>
      data ? { ...data, desiredDate: selectedDate } : data,
    );
  }, []);

  const selectedCurrency =
    pocketData?.currency ?? pocket?.currency ?? DEFAULT_CURRENCY;

  function updateDataCurrency(currency: CurrencyType) {
    setPocketData((data) => (data ? { ...data, currency } : data));
  }

  // States what the backend will store as the target. Reads the rates already
  // held in the store, so it issues no request.
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

  // 📤 FORM SUBMISSION LOGIC
  async function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();

    if (!isAuthenticated) {
      setMessageToUser('Your session has expired. Please log in again.');
      return;
    }

    if (pocket === null || pocketData === null) return;

    const newValidationMessages = {
      ...validationData(pocketData, {
        nonZeroFields: ['amount'],
      }),
    };

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }

    // Only what moved. An unchanged field is omitted rather than re-sent: the
    // deadline of an overdue pocket would be refused as a past date, and a
    // target re-sent drags its currency with it and reconverts a figure nobody
    // touched.
    const payload: EditPocketBody = {};

    const name = pocketData.name.toLowerCase().trim();
    if (name !== pocket.name) payload.name = name;

    // The one field with three states rather than two. Emptied where a note
    // existed is null, which clears it; empty where there was none is nothing
    // to say; anything else is the new text.
    const note = pocketData.note.trim();
    if (note !== (pocket.note ?? '')) {
      payload.note = note === '' ? null : note;
    }

    const targetAmount = Number(formData[formDataNumber.keyName]);
    if (targetAmount !== pocket.target) {
      payload.targetAmount = targetAmount;
      // Required whenever the amount is sent. A figure without its unit is not
      // an amount, and the server converts and stores what it did.
      payload.currency = selectedCurrency;
    }

    const desiredDate = toCalendarDay(pocketData.desiredDate);
    if (desiredDate !== pocket.desiredDate) payload.desiredDate = desiredDate;

    // The schema refuses an empty body, and a request that is going to be
    // refused should not be sent. Said in words rather than by a disabled
    // button, which would leave the owner guessing why.
    if (Object.keys(payload).length === 0) {
      setMessageToUser('Nothing changed yet.');
      return;
    }

    setIsSubmitting(true);
    setMessageToUser(null);

    try {
      const detail = await editPocket(parsedPocketId, payload);

      setValidationMessages({});

      // The response carried the whole detail payload with its figures already
      // recomputed, so the screen this returns to is answered and asks for
      // nothing. The board is only marked stale: it refetches if and when the
      // owner walks back to it.
      usePocketDetailStore.getState().setDetail(detail);
      usePocketBoardStore.getState().invalidate();

      navigateTo(returnRoute);
    } catch (error) {
      // One path for every failure. The client throws on a refused request as
      // well as on a network fault, so a 400 from the strict schema and a lost
      // connection land in the same place and both leave the form filled in.
      console.error('🔥 Error editing the pocket', error);
      const { message, status } = normalizeError(error);
      setMessageToUser({ message, status });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFormDisabled = !isAuthenticated;

  // 🛡️ AUTHENTICATION GUARD
  if (isCheckingAuth) {
    return (
      <section className='newPocket__page page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div className='form__title'>Checking authentication...</div>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className='newPocket__page page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <h3 className='form__title'>Authentication Required</h3>
          <p>Please log in to edit a pocket.</p>
        </div>
      </section>
    );
  }

  const header = (
    <div className='main__title--container'>
      {/* The link held nothing but a glyph, so it was announced as an unnamed
          link. "Go back" and not the destination: returnRoute is whatever the
          caller handed over, and only falls back to this pocket's own detail. */}
      <Link to={returnRoute} className='iconLeftArrow' aria-label='Go back'>
        <LeftArrowSvg aria-hidden='true' />
      </Link>

      <div className='form__title'>{'Edit Pocket'}</div>
    </div>
  );

  // Four states, and they are not degrees of one another: an id that is not a
  // number is not a failed request, and a request still in flight is not a
  // pocket that could not be read.
  if (!hasValidId) {
    return (
      <section className='newPocket__page page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          {header}
          <p>That is not a pocket.</p>
        </div>
      </section>
    );
  }

  if (detailError) {
    return (
      <section className='newPocket__page page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          {header}
          <p>This pocket could not be loaded.</p>
        </div>
      </section>
    );
  }

  if (!isLoaded || pocketData === null) {
    return (
      <section className='newPocket__page page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          {header}
          <div className='pocketDetail__skeletonHero' aria-hidden='true'></div>
        </div>
      </section>
    );
  }

  //-----------------------
  // 🎨 RENDER COMPONENT
  return (
    <section className='newPocket__page page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='page__content'>
        {header}

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
                value={pocketData.name}
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
                value={pocketData.note}
                maxLength={NAME_MAX_LENGTHS.note}
                autoComplete='off'
              />
            </div>

            {/* 💰 TARGET AMOUNT INPUT */}
            <div className='form__label-row'>
              <label htmlFor={formDataNumber.keyName} className='form__title1'>
                {'Target Amount'}

                <CharacterCounter
                  value={formData[formDataNumber.keyName] || ''}
                  maxLength={15}
                />

                <div className='validation__errMsg'>
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
                changeDate={changeDesiredDate}
                date={pocketData.desiredDate}
                variant={'form'}
                minDate={startOfToday()}
                popperClassName='pocket-datepicker-popper'
              />
            </div>
          </div>

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

export default EditPocket;
